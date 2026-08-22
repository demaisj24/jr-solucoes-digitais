// SEC-13 Fase 4 — Testes da correção dos achados F1 (crescimento ilimitado de
// rate_limit_buckets via session_id forjado) e F2 (fail-open sem teto quando o
// RPC falha/expira), encontrados no adversarial review pós-Fase 3.
//
// Cobre exatamente o que mudou nesta fase, em api/chat.js e api/agent-chat.js:
//   A. IP checado antes de sessão (uma requisição já bloqueada por IP não
//      consulta/cria bucket de sessão).
//   B. session_id vira 1 de SESSION_SLOTS "slots" via hash local determinístico
//      (sessionSlot) — cardinalidade máxima por IP passa a ser fixa.
//   C. pg_cron agendando rate_limit_cleanup(7200) a cada 15 min — verificado ao
//      vivo contra o Supabase nesta sessão (job registrado, schedule, executor,
//      grants, sem novo advisory WARN); NÃO tem teste automatizado aqui porque
//      isso viveria só no Supabase e os testes deste repositório não têm/devem
//      ter credenciais de banco embutidas (mesma filosofia zero-dependência já
//      usada nos outros arquivos de teste do projeto).
//   D. fallback local (fallbackHit) só quando o RPC falha/expira — limite
//      conservador, TTL curto, tamanho máximo, sem crescimento ilimitado, marca
//      de log SEC13_RATE_LIMIT_FALLBACK.
//   E. api/agents.js NÃO muda nesta fase (fail-closed já é imune a F1 e F2).
//
// api/chat.js e api/agent-chat.js ganharam exports nomeados adicionais
// (rateLimitHit/hit, fallbackHit, sessionSlot, fallbackBuckets, clientIp/ip) só
// para permitir estes testes reais — o runtime da Vercel usa exclusivamente o
// export default de cada um.
//
// Rodar com:
//   node --test tests/sec-13-fase4-f1-f2.test.js

// Precisa existir ANTES do import dos módulos, porque SERVICE_ROLE_KEY/GEMINI_KEY
// são lidos de process.env uma única vez, no top-level do módulo.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fase4-test-fake-service-role-key';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'fase4-test-fake-gemini-key';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const FILES = { chat: 'api/chat.js', agentChat: 'api/agent-chat.js' };

const chatMod = await import(pathToFileURL(path.join(root, 'api', 'chat.js')).href);
const agentChatMod = await import(pathToFileURL(path.join(root, 'api', 'agent-chat.js')).href);

const realFetch = globalThis.fetch;
function makeMockRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

// ---------------------------------------------------------------------------
// B. sessionSlot — determinístico, local, sem segredo, cardinalidade limitada
// ---------------------------------------------------------------------------

test('sessionSlot: determinístico e sempre dentro de [0, slots)', () => {
  const N = 256;
  const samples = ['a', 'ab', 'session-123', '', 'x'.repeat(100), 'ção-utf8-🚀'];
  for (const sid of samples) {
    const s1 = chatMod.sessionSlot(sid, N);
    const s2 = chatMod.sessionSlot(sid, N);
    assert.equal(s1, s2, `sessionSlot não é determinístico para "${sid}"`);
    assert.ok(Number.isInteger(s1) && s1 >= 0 && s1 < N, `slot ${s1} fora de [0,${N}) para "${sid}"`);
  }
});

test('sessionSlot: cardinalidade máxima por IP é limitada a SESSION_SLOTS mesmo com milhares de session_id forjados/distintos (correção F1)', () => {
  const N = 256;
  const slotsSeen = new Set();
  for (let i = 0; i < 5000; i++) {
    slotsSeen.add(chatMod.sessionSlot(`forged-session-${i}-${Math.random()}`, N));
  }
  assert.ok(slotsSeen.size <= N, `deveria haver no máximo ${N} slots distintos, achou ${slotsSeen.size}`);
  // com 5000 valores distintos em 256 slots, esperamos ocupação praticamente total
  // (prova de que o hash espalha razoavelmente, não colapsa tudo num slot só)
  assert.ok(slotsSeen.size > N * 0.9, `distribuição suspeita: só ${slotsSeen.size} de ${N} slots usados`);
});

test('sessionSlot: mesmo session_id gera o mesmo slot em chat.js e agent-chat.js (implementação idêntica)', () => {
  const sid = 'shared-session-id-across-endpoints';
  assert.equal(chatMod.sessionSlot(sid, 256), agentChatMod.sessionSlot(sid, 256));
});

test('SESSION_SLOTS/FALLBACK_* são iguais nos dois arquivos e batem com o valor decidido na análise de colisão (256)', () => {
  for (const rel of [FILES.chat, FILES.agentChat]) {
    const c = read(rel);
    assert.match(c, /SESSION_SLOTS\s*=\s*256\b/, `${rel}: SESSION_SLOTS deveria ser 256`);
    assert.match(c, /FALLBACK_RATIO\s*=\s*0\.2\b/, `${rel}: FALLBACK_RATIO deveria ser 0.2`);
    assert.match(c, /FALLBACK_MAX_ENTRIES\s*=\s*500\b/, `${rel}: FALLBACK_MAX_ENTRIES deveria ser 500`);
  }
});

// ---------------------------------------------------------------------------
// D. fallbackHit — limite conservador, borda exata, TTL, tamanho máximo
// ---------------------------------------------------------------------------

test('fallbackHit: aplica um limite bem mais conservador que o limite real (20% = FALLBACK_RATIO)', () => {
  chatMod.fallbackBuckets.clear();
  const realLimit = 30; // ex.: IP_LIMIT de chat.js
  const key = 'test:fallback:ratio';
  let allowed = 0;
  for (let i = 0; i < realLimit; i++) {
    if (!chatMod.fallbackHit(key, realLimit)) allowed++;
  }
  assert.equal(allowed, 6, `esperava exatamente 6 permitidas (20% de ${realLimit}), achou ${allowed}`);
  chatMod.fallbackBuckets.clear();
});

test('fallbackHit: bloqueia exatamente na borda (limite atingido) e a requisição imediatamente seguinte', () => {
  chatMod.fallbackBuckets.clear();
  const key = 'test:fallback:exact-edge';
  const limit = 10; // fallbackLimit = max(1, floor(10*0.2)) = 2
  assert.equal(chatMod.fallbackHit(key, limit), false, '1ª chamada permitida');
  assert.equal(chatMod.fallbackHit(key, limit), false, '2ª chamada (== fallbackLimit) ainda permitida');
  assert.equal(chatMod.fallbackHit(key, limit), true, '3ª chamada, imediatamente após atingir o limite, bloqueada');
  chatMod.fallbackBuckets.clear();
});

test('fallbackHit: limite mínimo de 1 mesmo quando 20% do limite real arredonda para 0', () => {
  chatMod.fallbackBuckets.clear();
  const key = 'test:fallback:min-one';
  const limit = 2; // floor(2*0.2)=0 -> deve virar 1, nunca 0 (0 travaria tudo incondicionalmente)
  assert.equal(chatMod.fallbackHit(key, limit), false, 'deveria permitir pelo menos 1 mesmo com limite real baixo');
  assert.equal(chatMod.fallbackHit(key, limit), true);
  chatMod.fallbackBuckets.clear();
});

test('fallbackHit: TTL curto — janela expira e reseta a contagem (sem esperar os 5 min reais)', () => {
  chatMod.fallbackBuckets.clear();
  const key = 'test:fallback:ttl';
  const limit = 5; // fallbackLimit = 1
  assert.equal(chatMod.fallbackHit(key, limit), false, 'usa a única permissão da janela');
  assert.equal(chatMod.fallbackHit(key, limit), true, 'bloqueada, ainda dentro da janela');
  // Simula o relógio avançando além de FALLBACK_WINDOW_MS manipulando a entrada
  // real (fallbackBuckets é exportado exatamente para isso) — evita um teste de
  // ~5 minutos de duração real.
  const entry = chatMod.fallbackBuckets.get(key);
  assert.ok(entry, 'entrada deveria existir no Map do fallback');
  entry.startedAt = Date.now() - 6 * 60 * 1000;
  assert.equal(chatMod.fallbackHit(key, limit), false, 'após expirar a janela, deveria resetar e permitir de novo');
  chatMod.fallbackBuckets.clear();
});

test('fallbackHit: tamanho máximo do armazenamento — nunca cresce além de FALLBACK_MAX_ENTRIES mesmo tentando deliberadamente crescer sem limite (chat.js)', () => {
  chatMod.fallbackBuckets.clear();
  for (let i = 0; i < 5000; i++) chatMod.fallbackHit(`attack-key-${i}`, 10);
  assert.ok(chatMod.fallbackBuckets.size <= 500, `deveria ter no máximo 500 entradas, tem ${chatMod.fallbackBuckets.size}`);
  chatMod.fallbackBuckets.clear();
});

test('fallbackHit: tamanho máximo do armazenamento — mesma garantia em agent-chat.js', () => {
  agentChatMod.fallbackBuckets.clear();
  for (let i = 0; i < 5000; i++) agentChatMod.fallbackHit(`attack-key-${i}`, 10);
  assert.ok(agentChatMod.fallbackBuckets.size <= 500, `deveria ter no máximo 500 entradas, tem ${agentChatMod.fallbackBuckets.size}`);
  agentChatMod.fallbackBuckets.clear();
});

test('fallbackHit: sob muitas chamadas "simultâneas" (Promise.all) para a MESMA chave, a contagem final é exata — sem duplicidade', async () => {
  chatMod.fallbackBuckets.clear();
  const key = 'test:fallback:concurrency';
  const limit = 25; // fallbackLimit = 5
  const results = await Promise.all(Array.from({ length: 30 }, () => Promise.resolve(chatMod.fallbackHit(key, limit))));
  const allowed = results.filter((r) => r === false).length;
  assert.equal(allowed, 5, `esperava exatamente 5 permitidas, achou ${allowed}`);
  chatMod.fallbackBuckets.clear();
});

// ---------------------------------------------------------------------------
// rateLimitHit()/hit() — RPC como autoridade, e queda para o fallback
// ---------------------------------------------------------------------------

test('rateLimitHit: com o RPC respondendo normalmente, o resultado dele é a autoridade — o fallback não é tocado', async () => {
  chatMod.fallbackBuckets.clear();
  globalThis.fetch = async () => ({ ok: true, json: async () => true });
  try {
    const result = await chatMod.rateLimitHit('test:rpc:authority', 10);
    assert.equal(result, true);
    assert.equal(chatMod.fallbackBuckets.size, 0, 'fallback não deveria ter sido tocado com o RPC funcionando');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('rateLimitHit: erro HTTP do RPC cai no fallback conservador (não é mais fail-open incondicional)', async () => {
  chatMod.fallbackBuckets.clear();
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => null });
  try {
    const limit = 10; // fallbackLimit = 2
    assert.equal(await chatMod.rateLimitHit('test:rpc:http-error', limit), false);
    assert.equal(await chatMod.rateLimitHit('test:rpc:http-error', limit), false);
    assert.equal(await chatMod.rateLimitHit('test:rpc:http-error', limit), true, '3ª deveria ser bloqueada pelo fallback');
  } finally {
    globalThis.fetch = realFetch;
    chatMod.fallbackBuckets.clear();
  }
});

test('rateLimitHit: exceção de rede no RPC cai no fallback conservador', async () => {
  chatMod.fallbackBuckets.clear();
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED (simulado)'); };
  try {
    const limit = 10;
    assert.equal(await chatMod.rateLimitHit('test:rpc:exception', limit), false);
    assert.equal(await chatMod.rateLimitHit('test:rpc:exception', limit), false);
    assert.equal(await chatMod.rateLimitHit('test:rpc:exception', limit), true);
  } finally {
    globalThis.fetch = realFetch;
    chatMod.fallbackBuckets.clear();
  }
});

test('rateLimitHit: timeout real do RPC (estoura RATE_LIMIT_TIMEOUT_MS, ~1s) também cai no fallback, não em fail-open incondicional', async () => {
  chatMod.fallbackBuckets.clear();
  globalThis.fetch = (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  });
  try {
    const result = await chatMod.rateLimitHit('test:rpc:timeout', 10);
    assert.equal(result, false, '1ª chamada do fallback é permitida');
    assert.equal(chatMod.fallbackBuckets.has('test:rpc:timeout'), true, 'deveria ter registrado no fallback');
  } finally {
    globalThis.fetch = realFetch;
    chatMod.fallbackBuckets.clear();
  }
});

test('hit (agent-chat.js): mesmo comportamento de fallback em erro HTTP e exceção do RPC', async () => {
  agentChatMod.fallbackBuckets.clear();
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => null });
  try {
    const limit = 30; // fallbackLimit = 6
    let allowed = 0;
    for (let i = 0; i < 8; i++) {
      if (!(await agentChatMod.hit('test:agent-chat:fallback', limit))) allowed++;
    }
    assert.equal(allowed, 6, `esperava 6 permitidas (20% de 30), achou ${allowed}`);
  } finally {
    globalThis.fetch = realFetch;
    agentChatMod.fallbackBuckets.clear();
  }
});

test('fluxo completo desejado: RPC ok → autoridade; RPC cai → fallback conservador; fallback excede → bloqueia', async () => {
  chatMod.fallbackBuckets.clear();
  const key = 'test:full-flow';
  const limit = 10; // fallbackLimit = 2
  globalThis.fetch = async () => ({ ok: true, json: async () => false });
  assert.equal(await chatMod.rateLimitHit(key, limit), false, 'RPC ok: resultado dele manda');
  globalThis.fetch = async () => { throw new Error('Supabase indisponível (simulado)'); };
  assert.equal(await chatMod.rateLimitHit(key, limit), false, 'RPC caiu: 1ª do fallback permitida');
  assert.equal(await chatMod.rateLimitHit(key, limit), false, 'RPC caiu: 2ª do fallback (== limite) permitida');
  assert.equal(await chatMod.rateLimitHit(key, limit), true, 'RPC caiu: 3ª excede o fallback — bloqueada. NUNCA permite indefinidamente.');
  globalThis.fetch = realFetch;
  chatMod.fallbackBuckets.clear();
});

// ---------------------------------------------------------------------------
// A. Ausência de bypass — IP bloqueado não consulta/cria bucket de sessão
// ---------------------------------------------------------------------------

test('bypass (chat.js): quando o IP já está bloqueado, a checagem de sessão NÃO é chamada (0 chamadas extras ao RPC)', async () => {
  let callCount = 0;
  const calledKeys = [];
  globalThis.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    calledKeys.push(body.p_key);
    return { ok: true, json: async () => body.p_key.startsWith('chat:ip:') };
  };
  try {
    const req = { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: { system_prompt: 'x', nova_mensagem: 'oi', session_id: 'sess-bypass-test' } };
    const res = makeMockRes();
    await chatMod.default(req, res);
    assert.equal(callCount, 1, `esperava exatamente 1 chamada ao RPC (só IP), houve ${callCount}: ${calledKeys.join(', ')}`);
    assert.ok(calledKeys[0].startsWith('chat:ip:'), 'a única chamada deveria ser a de IP');
    assert.equal(res.statusCode, 429);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('bypass (agent-chat.js): quando o IP já está bloqueado, a checagem de sessão NÃO é chamada', async () => {
  let callCount = 0;
  globalThis.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    return { ok: true, json: async () => body.p_key.startsWith('agent-chat:ip:') };
  };
  try {
    const req = { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.10' }, body: { agent_id: 'whatever', nova_mensagem: 'oi', session_id: 'sess-bypass-2' } };
    const res = makeMockRes();
    await agentChatMod.default(req, res);
    assert.equal(callCount, 1, `esperava exatamente 1 chamada ao RPC, houve ${callCount}`);
    assert.equal(res.statusCode, 429);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('bypass: quando o IP está livre e a sessão bloqueia, o Gemini NÃO chega a ser chamado (429 antes)', async () => {
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    return { ok: true, json: async () => body.p_key.startsWith('chat:session:') };
  };
  const geminiCalls = [];
  try {
    const req = { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.11' }, body: { system_prompt: 'x', nova_mensagem: 'oi', session_id: 'sess-bypass-3' } };
    const res = makeMockRes();
    await chatMod.default(req, res);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body?.error?.includes('demonstração'), true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// Ausência de exposição de secrets (extensão do check da Fase 3 para o código novo)
// ---------------------------------------------------------------------------

test('nenhuma chamada de log (console.*) inclui SERVICE_ROLE_KEY no código novo da Fase 4', () => {
  for (const rel of [FILES.chat, FILES.agentChat]) {
    const c = read(rel);
    const consoleCalls = c.match(/console\.\w+\([^;]*\);?/g) || [];
    assert.ok(consoleCalls.length > 0, `${rel}: nenhuma chamada console.* encontrada (regex pode estar errado)`);
    for (const call of consoleCalls) {
      assert.equal(/SERVICE_ROLE_KEY/.test(call), false, `${rel}: chamada de log parece incluir SERVICE_ROLE_KEY: ${call.slice(0, 160)}`);
    }
  }
});

test('fallbackBuckets/sessionSlot não fazem nenhuma chamada de rede (puramente locais) — grep por fetch dentro das duas funções', () => {
  for (const rel of [FILES.chat, FILES.agentChat]) {
    const c = read(rel);
    const fnMatch = c.match(/function (?:fallbackHit|sessionSlot)[\s\S]*?\n(?:function|const fallbackBuckets|async function rateLimitHit|async function hit)/);
    // fallback simplificado: procura o bloco entre "function sessionSlot" e "async function rateLimitHit"/"async function hit"
    const start = c.indexOf('function sessionSlot');
    const end = rel === FILES.chat ? c.indexOf('async function rateLimitHit') : c.indexOf('async function hit(');
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const block = c.slice(start, end);
    assert.equal(/fetch\(/.test(block), false, `${rel}: sessionSlot/fallbackHit não deveriam chamar fetch()`);
  }
});
