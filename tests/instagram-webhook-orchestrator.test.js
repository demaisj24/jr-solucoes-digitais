// INST-08D — Testes da orquestração de idempotência (insert-then-process).
// Supabase e Gemini mockados via global.fetch, reproduzindo o CONTRATO
// real do PostgREST (Prefer: resolution=ignore-duplicates,return=
// representation -> array vazio em conflito, array com a linha em
// sucesso). O teste C (concorrência) usa uma camada mockada com
// semântica atômica explícita — ver comentário na própria seção sobre a
// limitação de não conseguir testar concorrência real de Postgres através
// desta ferramenta (chamadas MCP sequenciais, sem duas transações
// simultâneas abertas de verdade). Um teste complementar real contra o
// Postgres (item H) roda à parte, em transação com ROLLBACK.
//
// Rodar com:
//   node --test tests/instagram-webhook-orchestrator.test.js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.INSTAGRAM_APP_SECRET = 'orchestrator-test-app-secret-not-real';
process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'orchestrator-test-verify-token-not-real';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'orchestrator-test-service-role-key-not-real';
process.env.GEMINI_API_KEY = 'orchestrator-test-gemini-key-not-real';

let claimAndProcessInstagramEntry;

before(async () => {
  const mod = await import('../lib/instagram-webhook-orchestrator.js');
  claimAndProcessInstagramEntry = mod.claimAndProcessInstagramEntry;
});

function directEntry({ id, mid = 'mid.orch-1', text = 'olá' }) {
  return {
    id,
    time: 1734000000,
    messaging: [{ sender: { id: 'consumer-1' }, recipient: { id }, timestamp: 1734000000, message: { mid, text } }],
  };
}

function withMockedFetch(responders, fn) {
  const original = global.fetch;
  let calls = 0;
  const log = [];
  global.fetch = async (url, init) => {
    const n = calls;
    calls += 1;
    log.push({ url: String(url), init });
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
const geminiSuccess = (text) => jsonOk({ candidates: [{ content: { parts: [{ text }] } }] });

const insertedRow = (extra = {}) => [{ id: 'evt-uuid-1', status: 'received', ...extra }];
const activeConnection = { agent_id: 'agent-1', owner_id: 'owner-1', status: 'active' };
const activeAgentMinimal = { id: 'agent-1', owner_id: 'owner-1', status: 'active' };
const fullAgentRow = {
  id: 'agent-1',
  owner_id: 'owner-1',
  company_name: 'Empresa Teste',
  agent_name: 'Ana',
  segment: 'serviços',
  whatsapp: '',
  city_region: '',
  services: '',
  business_hours: '',
  personality: '',
  objective: '',
  capabilities: [],
  knowledge_store_name: null,
};

// ===========================================================================
// A) primeiro evento -> INSERT + processamento
// ===========================================================================

test('A) primeiro evento: insere (array não vazio) e processa até o Gemini', async () => {
  await withMockedFetch(
    [
      jsonOk(insertedRow()), // POST instagram_webhook_events -> inserção real
      jsonOk([activeConnection]),
      jsonOk([activeAgentMinimal]),
      jsonOk([fullAgentRow]),
      jsonOk([]),
      geminiSuccess('resposta gerada'),
    ],
    async ({ getCalls, getLog }) => {
      const result = await claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-A' }));
      assert.equal(result.ok, true);
      assert.equal(result.reply, 'resposta gerada');
      assert.equal(result.persisted, true);
      assert.equal(getCalls(), 6);
      // Confirma que o insert foi feito com o Prefer correto (a garantia
      // real está nesse header, não em lógica JS).
      const insertCall = getLog()[0];
      assert.equal(insertCall.init.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
    }
  );
});

// ===========================================================================
// B) mesmo evento novamente -> nenhum Gemini
// ===========================================================================

test('B) evento duplicado: insert retorna array vazio (conflito real do Postgres) e o Gemini NUNCA é chamado', async () => {
  await withMockedFetch([jsonOk([])], async ({ getCalls }) => {
    const result = await claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-A' }));
    assert.deepEqual(result, { ok: false, reason: 'duplicate_event', providerEventId: result.providerEventId });
    assert.equal(getCalls(), 1, 'só a tentativa de insert deveria ter acontecido — nada de resolver/carregar/Gemini');
  });
});

// ===========================================================================
// C) dois requests concorrentes -> somente um processamento
// ===========================================================================
//
// LIMITAÇÃO EXPLÍCITA: esta ferramenta (chamadas MCP sequenciais ao
// Supabase) não consegue manter duas transações Postgres verdadeiramente
// simultâneas abertas ao mesmo tempo — cada chamada é uma ida-e-volta
// completa e isolada. Uma concorrência 100% real (duas conexões
// disputando a mesma UNIQUE no mesmo instante) não é testável através
// deste canal. O que ESTE teste prova: que o código de
// claimAndProcessInstagramEntry, quando chamado duas vezes ao mesmo
// tempo (Promise.all, dois disparos antes de qualquer um terminar) sobre
// uma camada de persistência mockada que reproduz fielmente o contrato
// PostgREST (só uma chamada pode "ganhar" o array não-vazio; a garantia
// de atomicidade do check-e-set é a mesma que uma UNIQUE constraint real
// oferece — não uma corrida insegura em JS), só deixa UM dos dois
// processar. A garantia de que o Postgres real nunca deixa duas
// transações inserirem a mesma UNIQUE simultaneamente é uma propriedade
// ACID do próprio banco, não algo que precise (ou consiga) ser
// re-provado por um teste de aplicação — o que pode e deve ser testado é
// se O NOSSO CÓDIGO reage corretamente ao resultado dessa garantia, que
// é exatamente o que este teste faz.
test('C) duas chamadas concorrentes (Promise.all) sobre uma camada que reproduz o contrato real: só uma processa', async () => {
  // "Banco" em memória com semântica atômica check-e-set — equivalente
  // ao que a UNIQUE(provider_event_id) real garante, não uma corrida.
  const fakeUniqueIndex = new Map();
  let geminiCalls = 0;

  const original = global.fetch;
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/rest/v1/instagram_webhook_events') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      // Atômico por construção: JS de thread única não intercala este
      // bloco síncrono entre as duas chamadas concorrentes.
      if (fakeUniqueIndex.has(body.provider_event_id)) {
        return { ok: true, status: 200, json: async () => [] };
      }
      const row = { id: `evt-${fakeUniqueIndex.size + 1}`, ...body };
      fakeUniqueIndex.set(body.provider_event_id, row);
      return { ok: true, status: 200, json: async () => [row] };
    }
    if (u.includes('instagram_connections')) return { ok: true, status: 200, json: async () => [activeConnection] };
    // loadActiveAgent (INST-08B) filtra status=eq.active explicitamente;
    // o resolver (INST-08A) não filtra por status na query — é assim que
    // as duas chamadas a /rest/v1/agents são distinguidas aqui.
    if (u.includes('/rest/v1/agents') && u.includes('status=eq.active')) {
      return { ok: true, status: 200, json: async () => [fullAgentRow] };
    }
    if (u.includes('/rest/v1/agents')) return { ok: true, status: 200, json: async () => [activeAgentMinimal] };
    if (u.includes('agent_knowledge')) return { ok: true, status: 200, json: async () => [] };
    if (u.includes('generativelanguage.googleapis.com')) {
      geminiCalls += 1;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
    }
    throw new Error(`URL inesperada no teste C: ${u}`);
  };

  try {
    const entry = directEntry({ id: 'ig-user-concurrent' });
    const [r1, r2] = await Promise.all([claimAndProcessInstagramEntry(entry), claimAndProcessInstagramEntry(entry)]);

    const results = [r1, r2];
    const succeeded = results.filter((r) => r.ok);
    const duplicated = results.filter((r) => !r.ok && r.reason === 'duplicate_event');

    assert.equal(succeeded.length, 1, 'exatamente uma das duas chamadas concorrentes deveria processar');
    assert.equal(duplicated.length, 1, 'a outra deveria ser reconhecida como duplicata');
    assert.equal(geminiCalls, 1, 'o Gemini só pode ter sido chamado uma vez entre as duas concorrentes');
  } finally {
    global.fetch = original;
  }
});

// ===========================================================================
// D) dois eventos diferentes -> ambos processados
// ===========================================================================

test('D) dois eventos diferentes (ids distintos) são ambos inseridos e processados', async () => {
  const resultA = await withMockedFetch(
    [jsonOk(insertedRow()), jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), geminiSuccess('resposta A')],
    () => claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-D1', mid: 'mid.d1' }))
  );
  const resultB = await withMockedFetch(
    [jsonOk(insertedRow()), jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), geminiSuccess('resposta B')],
    () => claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-D2', mid: 'mid.d2' }))
  );
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  assert.equal(resultA.reply, 'resposta A');
  assert.equal(resultB.reply, 'resposta B');
  assert.notEqual(resultA.providerEventId, resultB.providerEventId);
});

// ===========================================================================
// E) falha do Gemini depois do INSERT -> evento permanece recuperável
// ===========================================================================

test('E) Gemini falha depois do insert: retorna erro, mas o evento já está persistido (recuperável por status=received, nunca tocado)', async () => {
  await withMockedFetch(
    [jsonOk(insertedRow()), jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), jsonFail(503)],
    async ({ getCalls }) => {
      const result = await claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-E' }));
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'gemini_error');
      assert.equal(result.persisted, true, 'o evento foi persistido antes da falha — não se perde');
      // Nenhuma chamada extra de UPDATE/PATCH foi feita para marcar
      // status — a orquestração não gerencia status nesta tarefa
      // (decisão registrada em docs/INSTAGRAM-IDEMPOTENCY-ORCHESTRATION.md).
      assert.equal(getCalls(), 6, 'exatamente as 6 chamadas esperadas, nenhuma escrita extra de status');
    }
  );
});

// ===========================================================================
// F) erro de persistência -> Gemini não é chamado
// ===========================================================================

test('F) falha ao persistir (erro real, não conflito): retorna persistence_error, Gemini nunca é chamado', async () => {
  await withMockedFetch([jsonFail(500)], async ({ getCalls }) => {
    const result = await claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-F' }));
    assert.deepEqual(result, { ok: false, reason: 'persistence_error' });
    assert.equal(getCalls(), 1);
  });
});

// ===========================================================================
// G) payload inválido -> não persiste
// ===========================================================================

test('G) entry sem id: rejeitado antes de qualquer chamada de rede, não persiste', async () => {
  await withMockedFetch([], async ({ getCalls }) => {
    const result = await claimAndProcessInstagramEntry({ time: 1, messaging: [] });
    assert.deepEqual(result, { ok: false, reason: 'invalid_entry' });
    assert.equal(getCalls(), 0);
  });
});

test('G) entry null: rejeitado antes de qualquer chamada de rede', async () => {
  await withMockedFetch([], async ({ getCalls }) => {
    const result = await claimAndProcessInstagramEntry(null);
    assert.deepEqual(result, { ok: false, reason: 'invalid_entry' });
    assert.equal(getCalls(), 0);
  });
});

// ===========================================================================
// Confirmação: nenhuma URL de domínio Meta/Instagram é chamada
// ===========================================================================

test('nenhuma chamada de rede alcança domínio da Meta/Instagram', async () => {
  await withMockedFetch(
    [jsonOk(insertedRow()), jsonOk([activeConnection]), jsonOk([activeAgentMinimal]), jsonOk([fullAgentRow]), jsonOk([]), geminiSuccess('ok')],
    async ({ getLog }) => {
      await claimAndProcessInstagramEntry(directEntry({ id: 'ig-user-safe' }));
      for (const { url } of getLog()) {
        assert.ok(!/instagram\.com|facebook\.com|graph\.instagram\.com|graph\.facebook\.com/i.test(url), `URL suspeita: ${url}`);
      }
    }
  );
});
