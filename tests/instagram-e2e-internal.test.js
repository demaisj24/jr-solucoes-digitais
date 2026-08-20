// INST-08C — Integração interna completa (só mocks), payload real ->
// resolução -> agente -> conhecimento -> contexto -> Gemini -> resposta
// interna. NUNCA chama nenhuma URL da Meta/Instagram nem envia nada.
//
// Usa o handler REAL do webhook (api/instagram-webhook.js, INST-04A) para
// validar o payload — não uma reimplementação da validação — e depois o
// pipeline real de resolução (INST-08A) + processamento (INST-08B).
//
// Rodar com:
//   node --test tests/instagram-e2e-internal.test.js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const APP_SECRET = 'e2e-test-app-secret-not-real';
const VERIFY_TOKEN = 'e2e-test-verify-token-not-real';
process.env.INSTAGRAM_APP_SECRET = APP_SECRET;
process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'e2e-test-service-role-key-not-real';
process.env.GEMINI_API_KEY = 'e2e-test-gemini-key-not-real';

let webhookPOST;
let dedupeKeyForEntry;
let processInstagramMessage;

before(async () => {
  const webhook = await import('../api/instagram-webhook.js');
  webhookPOST = webhook.POST;
  dedupeKeyForEntry = webhook.dedupeKeyForEntry;
  const proc = await import('../lib/instagram-process-event.js');
  processInstagramMessage = proc.processInstagramMessage;
});

// ===========================================================================
// Helpers
// ===========================================================================

function sign(bodyBytes) {
  const hex = crypto.createHmac('sha256', APP_SECRET).update(bodyBytes).digest('hex');
  return `sha256=${hex}`;
}

// Payload baseado EXATAMENTE na estrutura já validada em
// tests/instagram-webhook.test.js (INST-04A) — nenhum campo inventado.
function realisticDirectPayload({ instagramUserId, text, mid = 'mid.e2e-1' }) {
  return {
    object: 'instagram',
    entry: [
      {
        id: instagramUserId,
        time: 1734000000,
        messaging: [
          {
            sender: { id: 'ig-consumer-999' },
            recipient: { id: instagramUserId },
            timestamp: 1734000000,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

// Passo 1 real do pipeline: manda o payload pelo handler REAL do webhook
// (assinatura HMAC válida) e confirma que foi aceito, exatamente como a
// Meta faria a entrega.
async function postToRealWebhook(payloadObj) {
  const body = JSON.stringify(payloadObj);
  const req = new Request('https://example.vercel.app/api/instagram-webhook', {
    method: 'POST',
    headers: { 'x-hub-signature-256': sign(body) },
    body,
  });
  const res = await webhookPOST(req);
  const json = await res.json();
  return { status: res.status, json };
}

// Mock de rede para os passos seguintes (Supabase + Gemini) — mesmo
// padrão já usado nos testes do INST-08A/08B.
function withMockedFetch(responders, fn) {
  const original = global.fetch;
  let calls = 0;
  const log = [];
  global.fetch = async (url, init) => {
    const n = calls;
    calls += 1;
    log.push(String(url));
    const responder = responders[n];
    if (!responder) throw new Error(`chamada de fetch #${n} inesperada (sem responder configurado): ${url}`);
    return responder(url, init);
  };
  return fn({ getCalls: () => calls, getLog: () => log }).finally(() => {
    global.fetch = original;
  });
}
const jsonOk = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const jsonFail = (status) => async () => ({ ok: false, status, json: async () => null });
const abortError = () => async () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  throw e;
};
const geminiSuccess = (text) => jsonOk({ candidates: [{ content: { parts: [{ text }] } }] });

// Pipeline completo: payload -> webhook real -> extrai entry -> resolve+
// processa (mockado). Espelha o que um futuro orquestrador faria depois
// de aceitar o evento — não existe esse orquestrador ainda (ver lacuna
// reportada mais abaixo).
async function runFullPipeline(payloadObj, responders) {
  const webhookResult = await postToRealWebhook(payloadObj);
  assert.equal(webhookResult.status, 200, 'webhook deveria aceitar um payload assinado e válido');
  assert.equal(webhookResult.json.accepted, true);

  const entry = payloadObj.entry[0];
  const instagramUserId = entry.id;
  const text = entry.messaging[0].message.text;

  return withMockedFetch(responders, () => processInstagramMessage({ instagramUserId, message: text }));
}

const activeConnection = { agent_id: 'agent-1', owner_id: 'owner-1', status: 'active' };
const activeAgentMinimal = { id: 'agent-1', owner_id: 'owner-1', status: 'active' };
const fullAgentRow = {
  id: 'agent-1',
  owner_id: 'owner-1',
  company_name: 'Salão Realista Ltda',
  agent_name: 'Bia',
  segment: 'salão de beleza',
  whatsapp: '',
  city_region: '',
  services: 'Corte Premium VX - R$ 147,00 - código VX-8472',
  business_hours: '',
  personality: '',
  objective: '',
  capabilities: ['responder dúvidas'],
  knowledge_store_name: null,
};

// ===========================================================================
// 1) Direct de texto -> agente ativo -> conhecimento disponível -> Gemini
//    retornando resposta (fluxo feliz completo, ponta a ponta real)
// ===========================================================================

test('Direct de texto real -> webhook aceita -> resolve -> agente ativo -> conhecimento -> Gemini -> resposta interna', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'Quanto custa o corte premium?' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([{ content: 'Corte Premium VX: R$ 147,00, código VX-8472.' }]),
    geminiSuccess('O Corte Premium VX custa R$ 147,00 (código VX-8472).'),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.reply, 'O Corte Premium VX custa R$ 147,00 (código VX-8472).');
  assert.equal(result.knowledgeUsed, true);
});

// ===========================================================================
// 2) Evento duplicado — ver seção de lacuna no relatório
// ===========================================================================

test('evento duplicado: dedupeKeyForEntry é estável para o mesmo entry (a chave em si está correta)', () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const key1 = dedupeKeyForEntry(payload.entry[0]);
  const key2 = dedupeKeyForEntry(payload.entry[0]);
  assert.equal(key1, key2);
});

test('evento duplicado: o webhook por si só aceita a MESMA entrega duas vezes (não deduplica sozinho — por desenho do INST-04A)', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi de novo' });
  const first = await postToRealWebhook(payload);
  const second = await postToRealWebhook(payload);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(first.json, second.json);
});

test('evento duplicado: LACUNA CONFIRMADA — sem uma camada de orquestração que grave em instagram_webhook_events, processInstagramMessage roda 2x para o mesmo evento (2 chamadas reais ao Gemini)', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'pergunta repetida' });

  let geminiCalls = 0;
  const responders = [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([]),
    async () => {
      geminiCalls += 1;
      return geminiSuccess('resposta gerada')();
    },
  ];

  const result1 = await runFullPipeline(payload, responders);
  const result2 = await runFullPipeline(payload, [...responders]);

  assert.equal(result1.ok, true);
  assert.equal(result2.ok, true);
  assert.equal(geminiCalls, 2, 'PROVA DA LACUNA: o Gemini foi chamado 2 vezes para o mesmo evento — nada impede isso hoje');
});

test('evento duplicado: SE existisse uma checagem de idempotência (simulada aqui, NÃO é código de produção), o segundo processamento seria evitado', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'pergunta repetida 2' });
  const entry = payload.entry[0];
  const key = dedupeKeyForEntry(entry);

  // Simulação em memória do que INSERT ... ON CONFLICT (provider_event_id)
  // DO NOTHING RETURNING id faria no banco real (instagram_webhook_events,
  // já com UNIQUE(provider_event_id) desde o INST-05B). Isso NÃO é a
  // implementação real — é só para provar que, SE essa checagem existisse
  // e fosse chamada antes de processInstagramMessage, o comportamento
  // esperado (não reprocessar) seria alcançado.
  const simulatedSeenKeys = new Set();
  function simulatedInsertIsNew(k) {
    if (simulatedSeenKeys.has(k)) return false;
    simulatedSeenKeys.add(k);
    return true;
  }

  let geminiCalls = 0;
  const responders = [jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), async () => {
    geminiCalls += 1;
    return geminiSuccess('resposta gerada')();
  }];

  const isNew1 = simulatedInsertIsNew(key);
  assert.equal(isNew1, true);
  const result1 = isNew1 ? await runFullPipeline(payload, responders) : { ok: false, reason: 'duplicate' };

  const isNew2 = simulatedInsertIsNew(key);
  assert.equal(isNew2, false, 'a segunda tentativa com a mesma chave deveria ser reconhecida como duplicata');
  const result2 = isNew2 ? await runFullPipeline(payload, [...responders]) : { ok: false, reason: 'duplicate' };

  assert.equal(result1.ok, true);
  assert.deepEqual(result2, { ok: false, reason: 'duplicate' });
  assert.equal(geminiCalls, 1, 'com a checagem simulada, o Gemini só é chamado 1 vez');
});

// ===========================================================================
// 3) Conta Instagram inexistente
// ===========================================================================

test('conta Instagram inexistente: connection_not_found', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-nao-conectado', text: 'oi' });
  const result = await runFullPipeline(payload, [jsonOk([])]);
  assert.deepEqual(result, { ok: false, reason: 'connection_not_found' });
});

// ===========================================================================
// 4) Conexão revoked
// ===========================================================================

test('conexão revoked: connection_revoked', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [jsonOk([{ ...activeConnection, status: 'revoked' }])]);
  assert.deepEqual(result, { ok: false, reason: 'connection_revoked' });
});

// ===========================================================================
// 5) Agente paused
// ===========================================================================

test('agente paused: agent_inactive', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([{ id: 'agent-1', owner_id: 'owner-1', status: 'paused' }]),
  ]);
  assert.deepEqual(result, { ok: false, reason: 'agent_inactive' });
});

// ===========================================================================
// 6) Agente ativo (variação do fluxo feliz sem depender do teste 1)
// ===========================================================================

test('agente ativo: resolução + carregamento concluem com sucesso', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'vocês têm horário hoje?' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([]),
    geminiSuccess('Sim, temos horários disponíveis hoje!'),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.agent_id, 'agent-1');
});

// ===========================================================================
// 7) Conhecimento disponível / 8) Conhecimento indisponível
// ===========================================================================

test('conhecimento disponível: entra no contexto enviado ao Gemini', async () => {
  let capturedBody = null;
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'qual o código do corte premium?' });
  await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([{ content: 'código VX-8472' }]),
    async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return geminiSuccess('É VX-8472.')();
    },
  ]);
  assert.match(capturedBody.systemInstruction.parts[0].text, /código VX-8472/);
});

test('conhecimento indisponível: degrada sem abortar (mesmo comportamento do AI-01)', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonFail(500),
    geminiSuccess('respondo mesmo sem conhecimento'),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.knowledgeUsed, false);
});

// ===========================================================================
// 9) Gemini retornando resposta / 10) timeout / 11) resposta vazia
// ===========================================================================

test('Gemini retornando resposta: reply presente e correto', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([]),
    geminiSuccess('resposta específica de teste'),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.reply, 'resposta específica de teste');
});

test('Gemini timeout: gemini_timeout', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([]),
    abortError(),
  ]);
  assert.deepEqual(result, { ok: false, reason: 'gemini_timeout' });
});

test('Gemini resposta vazia: gemini_empty_response', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  const result = await runFullPipeline(payload, [
    jsonOk([activeConnection]),
    jsonOk([activeAgentMinimal]),
    jsonOk([fullAgentRow]),
    jsonOk([]),
    jsonOk({ candidates: [] }),
  ]);
  assert.deepEqual(result, { ok: false, reason: 'gemini_empty_response' });
});

// ===========================================================================
// 12) Isolamento entre dois agentes, ponta a ponta
// ===========================================================================

test('isolamento entre dois agentes: dois payloads reais e distintos nunca cruzam config/conhecimento/resposta', async () => {
  const payloadA = realisticDirectPayload({ instagramUserId: 'ig-agente-A', text: 'pergunta pro agente A' });
  const payloadB = realisticDirectPayload({ instagramUserId: 'ig-agente-B', text: 'pergunta pro agente B' });

  const resultA = await runFullPipeline(payloadA, [
    jsonOk([{ agent_id: 'agent-A', owner_id: 'owner-A', status: 'active' }]),
    jsonOk([{ id: 'agent-A', owner_id: 'owner-A', status: 'active' }]),
    jsonOk([{ ...fullAgentRow, id: 'agent-A', owner_id: 'owner-A', company_name: 'Empresa A' }]),
    jsonOk([{ content: 'segredo do agente A' }]),
    geminiSuccess('resposta do agente A'),
  ]);

  const resultB = await runFullPipeline(payloadB, [
    jsonOk([{ agent_id: 'agent-B', owner_id: 'owner-B', status: 'active' }]),
    jsonOk([{ id: 'agent-B', owner_id: 'owner-B', status: 'active' }]),
    jsonOk([{ ...fullAgentRow, id: 'agent-B', owner_id: 'owner-B', company_name: 'Empresa B' }]),
    jsonOk([{ content: 'segredo do agente B' }]),
    geminiSuccess('resposta do agente B'),
  ]);

  assert.equal(resultA.agent_id, 'agent-A');
  assert.equal(resultB.agent_id, 'agent-B');
  assert.equal(resultA.reply, 'resposta do agente A');
  assert.equal(resultB.reply, 'resposta do agente B');
  assert.notEqual(resultA.owner_id, resultB.owner_id);
});

// ===========================================================================
// Confirmação explícita: nenhuma URL de domínio Meta/Instagram foi chamada
// em nenhum teste deste arquivo.
// ===========================================================================

test('confirmação: nenhuma chamada de rede em todo o pipeline alcança domínio da Meta/Instagram', async () => {
  const payload = realisticDirectPayload({ instagramUserId: 'ig-business-1', text: 'oi' });
  await withMockedFetch(
    [jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), geminiSuccess('ok')],
    async ({ getLog }) => {
      const webhookResult = await postToRealWebhook(payload);
      assert.equal(webhookResult.status, 200);
      const entry = payload.entry[0];
      await processInstagramMessage({ instagramUserId: entry.id, message: entry.messaging[0].message.text });
      for (const url of getLog()) {
        assert.ok(!/instagram\.com|facebook\.com|graph\.instagram\.com|graph\.facebook\.com/i.test(url), `URL suspeita: ${url}`);
      }
    }
  );
});
