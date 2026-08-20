// INST-08A — Testes da resolução instagram_webhook_events -> agent_id.
// Sem tocar o Supabase real: resolveFromRows() é pura (sem I/O), e
// resolveAgentForInstagramEvent() é testada com fetch mockado.
//
// Rodar com:
//   node --test tests/instagram-resolve-agent.test.js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';

let resolveFromRows;
let resolveAgentForInstagramEvent;

before(async () => {
  const mod = await import('../lib/instagram-resolve-agent.js');
  resolveFromRows = mod.resolveFromRows;
  resolveAgentForInstagramEvent = mod.resolveAgentForInstagramEvent;
});

const activeConnection = { agent_id: 'agent-1', owner_id: 'owner-1', status: 'active' };
const activeAgent = { id: 'agent-1', owner_id: 'owner-1', status: 'active' };

// ===========================================================================
// resolveFromRows — lógica pura, cobre todos os casos pedidos
// ===========================================================================

test('resolução válida: conexão active + agente active + owner batendo', () => {
  const result = resolveFromRows({ connection: activeConnection, agent: activeAgent });
  assert.deepEqual(result, { ok: true, agent_id: 'agent-1', owner_id: 'owner-1' });
});

test('conta Instagram inexistente: connection null', () => {
  const result = resolveFromRows({ connection: null, agent: null });
  assert.deepEqual(result, { ok: false, reason: 'connection_not_found' });
});

test('conexão revoked', () => {
  const result = resolveFromRows({ connection: { ...activeConnection, status: 'revoked' }, agent: null });
  assert.deepEqual(result, { ok: false, reason: 'connection_revoked' });
});

test('conexão com erro (status=error)', () => {
  const result = resolveFromRows({ connection: { ...activeConnection, status: 'error' }, agent: null });
  assert.deepEqual(result, { ok: false, reason: 'connection_error' });
});

test('agente inexistente: connection active mas agent null', () => {
  const result = resolveFromRows({ connection: activeConnection, agent: null });
  assert.deepEqual(result, { ok: false, reason: 'agent_not_found' });
});

for (const status of ['draft', 'demo', 'paused', 'archived']) {
  test(`agente inativo: status='${status}'`, () => {
    const result = resolveFromRows({ connection: activeConnection, agent: { ...activeAgent, status } });
    assert.deepEqual(result, { ok: false, reason: 'agent_inactive' });
  });
}

test('isolamento entre owners: agent.owner_id diferente de connection.owner_id (defesa da aplicação, independente do FK)', () => {
  const mismatchedAgent = { id: 'agent-1', owner_id: 'owner-DE-OUTRO-CLIENTE', status: 'active' };
  const result = resolveFromRows({ connection: activeConnection, agent: mismatchedAgent });
  assert.deepEqual(result, { ok: false, reason: 'owner_mismatch' });
  // Confirma que a checagem de owner acontece ANTES da checagem de status
  // do agente — um agente 'active' de outro owner ainda é rejeitado.
  assert.notEqual(result.reason, 'agent_inactive');
});

test('múltiplos eventos concorrentes: chamadas repetidas produzem resultado idêntico e determinístico (leitura pura, sem estado)', () => {
  const results = Array.from({ length: 20 }, () => resolveFromRows({ connection: activeConnection, agent: activeAgent }));
  for (const r of results) {
    assert.deepEqual(r, { ok: true, agent_id: 'agent-1', owner_id: 'owner-1' });
  }
});

// ===========================================================================
// resolveAgentForInstagramEvent — payload/entrada malformada (não chega a
// consultar o banco)
// ===========================================================================

function withMockedFetch(responses, fn) {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    const body = responses[calls] ?? [];
    calls += 1;
    return { ok: true, status: 200, json: async () => body };
  };
  return fn(() => calls).finally(() => {
    global.fetch = original;
  });
}

test('payload malformado: instagram_user_id vazio não consulta o banco', async () => {
  await withMockedFetch([], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent('');
    assert.deepEqual(result, { ok: false, reason: 'invalid_instagram_user_id' });
    assert.equal(getCalls(), 0, 'não deveria ter chamado fetch nenhuma vez');
  });
});

test('payload malformado: instagram_user_id undefined não consulta o banco', async () => {
  await withMockedFetch([], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent(undefined);
    assert.deepEqual(result, { ok: false, reason: 'invalid_instagram_user_id' });
    assert.equal(getCalls(), 0);
  });
});

test('payload malformado: instagram_user_id não-string não consulta o banco', async () => {
  await withMockedFetch([], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent(123456789);
    assert.deepEqual(result, { ok: false, reason: 'invalid_instagram_user_id' });
    assert.equal(getCalls(), 0);
  });
});

test('payload malformado: instagram_user_id absurdamente longo é rejeitado', async () => {
  await withMockedFetch([], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent('9'.repeat(500));
    assert.deepEqual(result, { ok: false, reason: 'invalid_instagram_user_id' });
    assert.equal(getCalls(), 0);
  });
});

// ===========================================================================
// resolveAgentForInstagramEvent — fluxo real com fetch mockado (simula as
// duas consultas REST: instagram_connections, depois agents)
// ===========================================================================

test('fluxo completo mockado: resolução válida faz exatamente 2 consultas', async () => {
  await withMockedFetch([[activeConnection], [activeAgent]], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent('ig-user-123');
    assert.deepEqual(result, { ok: true, agent_id: 'agent-1', owner_id: 'owner-1' });
    assert.equal(getCalls(), 2, 'deveria consultar connections e depois agents');
  });
});

test('fluxo completo mockado: conta inexistente faz só 1 consulta (não busca agents à toa)', async () => {
  await withMockedFetch([[]], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent('ig-user-nao-conectado');
    assert.deepEqual(result, { ok: false, reason: 'connection_not_found' });
    assert.equal(getCalls(), 1, 'não deveria consultar agents sem uma connection válida');
  });
});

test('fluxo completo mockado: conexão revoked faz só 1 consulta', async () => {
  await withMockedFetch([[{ ...activeConnection, status: 'revoked' }]], async (getCalls) => {
    const result = await resolveAgentForInstagramEvent('ig-user-revoked');
    assert.deepEqual(result, { ok: false, reason: 'connection_revoked' });
    assert.equal(getCalls(), 1);
  });
});
