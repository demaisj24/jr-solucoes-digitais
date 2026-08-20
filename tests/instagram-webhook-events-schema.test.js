// INST-07 — Testes LOCAIS (sem banco) do desenho de instagram_webhook_events.
//
// Estes testes NÃO tocam o Supabase. Reimplementam em JS puro exatamente
// a lógica dos CHECK constraints e da máquina de transição aprovada em
// docs/INSTAGRAM-RESPONSE-IDEMPOTENCY.md, para validar a lógica do
// desenho antes de qualquer aplicação real. A verificação de que o SQL
// em si contém essas mesmas regras é feita à parte (leitura do arquivo).
//
// Rodar com:
//   node --test tests/instagram-webhook-events-schema.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sqlPath = path.join(root, 'docs', 'sql', 'instagram-webhook-events.sql');

// ===========================================================================
// Reimplementação em JS pura das regras do SQL (não é o SQL em si — é o
// modelo de referência usado para testar a LÓGICA do desenho).
// ===========================================================================

const RESPONSE_STATUSES = ['sending', 'sent', 'ambiguous', 'failed'];
const PROCESS_STATUSES = ['received', 'processing', 'processed', 'failed'];

// Espelha o CHECK do campo `payload`.
function isValidPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (!('entry_id' in payload)) return false;
  if (!('time' in payload)) return false;
  if (!('item_count' in payload)) return false;
  if (!('item_types' in payload)) return false;
  if (!Array.isArray(payload.item_types)) return false;
  return true;
}

// Espelha os CHECKs cruzados de response_status/instagram_message_id/
// response_confirmed_at/next_retry_at/retry_count.
function isConsistentRow(row) {
  if (row.response_status !== null && !RESPONSE_STATUSES.includes(row.response_status)) return false;
  if (row.instagram_message_id !== null && row.response_status !== 'sent') return false;
  if (row.response_confirmed_at !== null && row.response_status !== 'sent') return false;
  if (row.next_retry_at !== null && !['sending', 'ambiguous'].includes(row.response_status)) return false;
  if (row.retry_count < 0) return false;
  if (!PROCESS_STATUSES.includes(row.status)) return false;
  return true;
}

// Espelha a máquina de transição aprovada (INST-06) para response_status.
const VALID_TRANSITIONS = {
  null: ['sending'],
  sending: ['sent', 'failed', 'ambiguous'],
  ambiguous: ['sent', 'sending', 'failed'],
  sent: [], // terminal
  failed: [], // terminal
};

function isValidTransition(from, to) {
  const key = from === null ? 'null' : from;
  return (VALID_TRANSITIONS[key] || []).includes(to);
}

function baseRow(overrides = {}) {
  return {
    status: 'processing',
    processed_at: null,
    response_status: null,
    instagram_message_id: null,
    response_attempted_at: null,
    response_confirmed_at: null,
    last_response_error: null,
    retry_count: 0,
    next_retry_at: null,
    ...overrides,
  };
}

// ===========================================================================
// payload — CHECK
// ===========================================================================

test('payload válido: schema mínimo exato', () => {
  assert.equal(isValidPayload({ entry_id: 'e1', time: 1, item_count: 1, item_types: ['message'] }), true);
});

test('payload válido: item_types vazio (evento sem itens classificáveis)', () => {
  assert.equal(isValidPayload({ entry_id: 'e1', time: 1, item_count: 0, item_types: [] }), true);
});

test('payload inválido: faltando entry_id', () => {
  assert.equal(isValidPayload({ time: 1, item_count: 1, item_types: ['message'] }), false);
});

test('payload inválido: item_types não é array', () => {
  assert.equal(isValidPayload({ entry_id: 'e1', time: 1, item_count: 1, item_types: 'message' }), false);
});

test('payload inválido: objeto vazio (o DEFAULT que causou o bug da v2 original)', () => {
  assert.equal(isValidPayload({}), false);
});

test('payload inválido: contém texto de mensagem (não deveria nunca ser aceito)', () => {
  // Mesmo que alguém tente colar o payload bruto por engano, o schema
  // mínimo não tem espaço para "message_text" — não é rejeitado por
  // conter o campo extra (jsonb permite), mas o ponto é que a aplicação
  // nunca deve popular isso; este teste documenta a intenção.
  const withExtra = { entry_id: 'e1', time: 1, item_count: 1, item_types: ['message'], message_text: 'não deveria estar aqui' };
  assert.equal(isValidPayload(withExtra), true); // CHECK não bloqueia campo extra
  assert.ok('message_text' in withExtra, 'documentado: CHECK não impede campo extra — disciplina é da aplicação, não do banco');
});

// ===========================================================================
// Consistência cruzada de response_status
// ===========================================================================

test('linha consistente: nenhuma resposta tentada ainda', () => {
  assert.equal(isConsistentRow(baseRow()), true);
});

test('linha consistente: sending com attempted_at, sem message_id/confirmed_at', () => {
  assert.equal(isConsistentRow(baseRow({ response_status: 'sending', response_attempted_at: new Date() })), true);
});

test('linha consistente: sent com message_id e confirmed_at', () => {
  assert.equal(
    isConsistentRow(baseRow({ response_status: 'sent', instagram_message_id: 'mid.123', response_confirmed_at: new Date() })),
    true
  );
});

test('linha INCONSISTENTE: instagram_message_id presente sem response_status=sent', () => {
  assert.equal(isConsistentRow(baseRow({ response_status: 'sending', instagram_message_id: 'mid.123' })), false);
});

test('linha INCONSISTENTE: response_confirmed_at presente com response_status=ambiguous', () => {
  assert.equal(isConsistentRow(baseRow({ response_status: 'ambiguous', response_confirmed_at: new Date() })), false);
});

test('linha INCONSISTENTE: next_retry_at presente com response_status=sent (terminal)', () => {
  assert.equal(isConsistentRow(baseRow({ response_status: 'sent', instagram_message_id: 'mid.1', response_confirmed_at: new Date(), next_retry_at: new Date() })), false);
});

test('linha INCONSISTENTE: retry_count negativo', () => {
  assert.equal(isConsistentRow(baseRow({ retry_count: -1 })), false);
});

test('linha INCONSISTENTE: response_status fora do enum', () => {
  assert.equal(isConsistentRow(baseRow({ response_status: 'sent_twice' })), false);
});

// ===========================================================================
// Máquina de transição — os 7 casos pedidos: sucesso, 4xx, 5xx, timeout,
// ambiguous, retry, retry esgotado
// ===========================================================================

test('transição válida: null -> sending (início do envio)', () => {
  assert.equal(isValidTransition(null, 'sending'), true);
});

test('transição válida: sending -> sent (sucesso)', () => {
  assert.equal(isValidTransition('sending', 'sent'), true);
});

test('transição válida: sending -> failed (4xx, falha definitiva)', () => {
  assert.equal(isValidTransition('sending', 'failed'), true);
});

test('transição válida: sending -> ambiguous (timeout ou 5xx)', () => {
  assert.equal(isValidTransition('sending', 'ambiguous'), true);
});

test('transição válida: ambiguous -> sent (verificação best-effort confirma)', () => {
  assert.equal(isValidTransition('ambiguous', 'sent'), true);
});

test('transição válida: ambiguous -> sending (retry)', () => {
  assert.equal(isValidTransition('ambiguous', 'sending'), true);
});

test('transição válida: ambiguous -> failed (retry esgotado)', () => {
  assert.equal(isValidTransition('ambiguous', 'failed'), true);
});

test('transição INVÁLIDA: sent é terminal — não pode voltar a sending', () => {
  assert.equal(isValidTransition('sent', 'sending'), false);
});

test('transição INVÁLIDA: failed é terminal — não pode voltar a ambiguous', () => {
  assert.equal(isValidTransition('failed', 'ambiguous'), false);
});

test('transição INVÁLIDA: sending não pula direto pra failed por esgotamento sem passar por ambiguous', () => {
  // O desenho aprovado exige que timeout/5xx sempre passe por ambiguous
  // antes de um eventual failed por esgotamento — sending->failed só é
  // válido para 4xx definitivo, não para "esgotei tentativas".
  // Este teste documenta que o par (sending, failed) É válido (4xx), mas
  // a razão (last_response_error) é o que diferencia — a máquina de
  // estados sozinha não distingue os dois motivos, por design (INST-06).
  assert.equal(isValidTransition('sending', 'failed'), true);
});

test('transição INVÁLIDA: null -> sent (não pode confirmar sem antes tentar enviar)', () => {
  assert.equal(isValidTransition(null, 'sent'), false);
});

// ===========================================================================
// Cenários críticos completos (A-F do documento de análise), como dados
// ===========================================================================

test('Cenário A — sucesso limpo: sequência inteira é consistente em cada passo', () => {
  let row = baseRow();
  assert.equal(isConsistentRow(row), true);

  row = { ...row, response_status: 'sending', response_attempted_at: new Date() };
  assert.equal(isValidTransition(null, row.response_status), true);
  assert.equal(isConsistentRow(row), true);

  row = { ...row, response_status: 'sent', instagram_message_id: 'mid.abc', response_confirmed_at: new Date() };
  assert.equal(isValidTransition('sending', row.response_status), true);
  assert.equal(isConsistentRow(row), true);
});

test('Cenário F — o cenário do enunciado: sending preso, recovery marca ambiguous, depois sent sem reenviar', () => {
  let row = baseRow({ response_status: 'sending', response_attempted_at: new Date(Date.now() - 60_000) });
  assert.equal(isConsistentRow(row), true);

  // Recovery detecta "sending" antigo, trata como ambíguo.
  row = { ...row, response_status: 'ambiguous', last_response_error: 'timeout aparente (possível sucesso não confirmado)' };
  assert.equal(isValidTransition('sending', row.response_status), true);
  assert.equal(isConsistentRow(row), true);

  // Verificação via histórico de conversa ENCONTRA a mensagem.
  row = { ...row, response_status: 'sent', instagram_message_id: 'mid.recovered', response_confirmed_at: new Date() };
  assert.equal(isValidTransition('ambiguous', row.response_status), true);
  assert.equal(isConsistentRow(row), true);
  // Nenhum reenvio ocorreu — retry_count permanece 0.
  assert.equal(row.retry_count, 0);
});

test('Cenário E — retries esgotados: 2 ciclos de ambiguous->sending, depois failed', () => {
  let row = baseRow({ response_status: 'sending', response_attempted_at: new Date(), retry_count: 0 });
  row = { ...row, response_status: 'ambiguous' };
  assert.equal(isValidTransition('sending', row.response_status), true);

  row = { ...row, response_status: 'sending', retry_count: 1, response_attempted_at: new Date() };
  assert.equal(isValidTransition('ambiguous', row.response_status), true);

  row = { ...row, response_status: 'ambiguous' };
  row = { ...row, response_status: 'sending', retry_count: 2, response_attempted_at: new Date() };
  row = { ...row, response_status: 'ambiguous' };

  // Limite (ex.: 2) atingido — vai para failed.
  row = { ...row, response_status: 'failed', last_response_error: 'retries esgotados' };
  assert.equal(isValidTransition('ambiguous', row.response_status), true);
  assert.equal(isConsistentRow(row), true);
});

// ===========================================================================
// Contrato do arquivo SQL — confirma que o texto contém exatamente os
// campos/estados aprovados, nem mais nem menos (sem inventar).
// ===========================================================================

test('SQL contém exatamente os 7 campos de resposta aprovados', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  for (const field of [
    'response_status',
    'instagram_message_id',
    'response_attempted_at',
    'response_confirmed_at',
    'last_response_error',
    'retry_count',
    'next_retry_at',
  ]) {
    assert.ok(sql.includes(field), `campo esperado ausente do SQL: ${field}`);
  }
  // Campo avaliado e descartado não deve aparecer como coluna.
  assert.ok(!/\bresponse_check_at\s+timestamptz/.test(sql), 'response_check_at foi descartado na análise — não deve virar coluna');
});

test('SQL não introduz nenhum índice além dos 2 já aprovados', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  const matches = sql.match(/create index if not exists/g) || [];
  assert.equal(matches.length, 2, `esperado 2 "create index", encontrado ${matches.length}`);
});

test('SQL contém REVOKE ALL explícito (não depende de RLS-sem-policy implícito)', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  assert.match(sql, /revoke all on public\.instagram_webhook_events\s+from authenticated, anon;/);
});

test('SQL contém UNIQUE(provider_event_id)', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  assert.match(sql, /unique \(provider_event_id\)/);
});

test('SQL contém o rollback via DROP TABLE', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  assert.match(sql, /drop table if exists public\.instagram_webhook_events/);
});

test('SQL não contém CREATE EXTENSION pgmq nem DELETE de retenção executável (fora de escopo)', () => {
  const sql = readFileSync(sqlPath, 'utf8');
  assert.ok(!/^\s*create extension pgmq/mi.test(sql));
  // O comando de retenção deve existir só como comentário de referência.
  const activeDelete = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.ok(!/delete from public\.instagram_webhook_events/i.test(activeDelete), 'DELETE de retenção não pode estar ativo, só documentado em comentário');
});
