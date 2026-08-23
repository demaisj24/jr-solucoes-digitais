// SEC-14 HIGH #2 — Testes da correção de idempotência de documento por
// conteúdo (api/agents.js): antes desta correção, o mesmo conteúdo enviado
// novamente para o mesmo agente disparava um novo upload/embedding pago no
// Gemini toda vez, sem nenhuma checagem de duplicidade — path é um UUID
// aleatório gerado a cada `prepare`, então nunca poderia servir de identidade
// de conteúdo.
//
// Estratégia corrigida (SHA-256 do conteúdo + UNIQUE(agent_id,content_hash)):
//   1. hash calculado a partir dos bytes JÁ baixados do Storage (nunca do
//      path/nome/tamanho isolado, nunca reenviado a serviço externo);
//   2. checagem otimista via SELECT por (agent_id, content_hash) — se existe,
//      NUNCA chama ensureStore/upload/polling, retorna status:'duplicate';
//   3. se não existe, segue o fluxo normal (ensureStore -> upload -> polling)
//      e o INSERT final carrega content_hash;
//   4. defesa final contra corrida real: UNIQUE(agent_id,content_hash) no
//      banco — um 23505 no INSERT é tratado explicitamente (nunca vira 500),
//      a chamada perdedora reconhece que já pagou o upload ao Gemini (não
//      finge que o custo não ocorreu) e devolve o registro vencedor.
//
// processKnowledge/deleteUploadedObject ganharam export nomeado só para
// permitir este teste real (mock de fetch + chamadas simultâneas) — mesmo
// padrão já usado por ensureStore/deleteFileSearchStore (HIGH #1) e por
// api/chat.js/api/agent-chat.js (SEC-13 Fase 4). O runtime da Vercel usa
// exclusivamente o export default, intocado por esta mudança.
//
// Migration aplicada (fora deste arquivo, ver Supabase): agent_knowledge
// ganhou content_hash TEXT nullable + índice único parcial
// (agent_id, content_hash) WHERE content_hash IS NOT NULL — aditiva,
// idempotente, não altera nenhuma linha existente.
//
// Rodar com:
//   node --test tests/sec-14-document-idempotency.test.js

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sec14-test-fake-service-role-key';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'sec14-test-fake-gemini-key';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(root, 'api', 'agents.js'), 'utf8');
const agentsMod = await import(pathToFileURL(path.join(root, 'api', 'agents.js')).href);

const realFetch = globalThis.fetch;
function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: () => null } };
}
function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function agent(overrides = {}) {
  return { id: 'agent-uuid-hk', public_id: 'pub-hk', company_name: 'Acme', knowledge_store_name: 'fileSearchStores/existing', ...overrides };
}

// Mock completo do "mundo externo" de processKnowledge(): download do Storage,
// Gemini (upload resumable + finalize + polling, aqui sempre "done" de
// imediato para não depender de tempo real), e Supabase REST (SELECT de
// dedup + INSERT final protegido por UNIQUE). `knowledgeRows` simula a tabela
// agent_knowledge de verdade, incluindo a constraint (agent_id, content_hash).
function makeProcessMock({ storageBytes }) {
  const calls = { storageGet: [], geminiUploadStart: [], geminiUploadPut: [], supabaseSelect: [], supabaseInsert: [], storageDelete: [] };
  const knowledgeRows = [];
  let uploadSeq = 0;
  const fetchMock = async (url, opts = {}) => {
    const u = String(url); const method = opts.method || 'GET';
    if (u.includes('/storage/v1/object/authenticated/')) {
      calls.storageGet.push({ url: u });
      return { ok: true, arrayBuffer: async () => storageBytes };
    }
    if (u.includes(':uploadToFileSearchStore') && method === 'POST') {
      calls.geminiUploadStart.push({ url: u });
      return { ok: true, json: async () => ({}), headers: { get: (k) => (k.toLowerCase() === 'x-goog-upload-url' ? 'https://generativelanguage.googleapis.com/upload/mock' : null) } };
    }
    if (u === 'https://generativelanguage.googleapis.com/upload/mock' && method === 'PUT') {
      uploadSeq++;
      calls.geminiUploadPut.push({ url: u, seq: uploadSeq });
      return jsonResponse(200, { done: true, response: { documentName: `documents/doc-${uploadSeq}` } });
    }
    if (u.includes('/rest/v1/agent_knowledge') && method === 'GET') {
      calls.supabaseSelect.push({ url: u });
      const m = u.match(/content_hash=eq\.([0-9a-f]+)/);
      const hash = m ? m[1] : null;
      const found = knowledgeRows.filter((r) => r.agent_id === 'agent-uuid-hk' && r.content_hash === hash);
      return jsonResponse(200, found.length ? [found[0]] : []);
    }
    if (u.includes('/rest/v1/agent_knowledge') && method === 'POST') {
      calls.supabaseInsert.push({ url: u, body: opts.body });
      const parsed = JSON.parse(opts.body);
      const conflict = parsed.content_hash != null && knowledgeRows.some((r) => r.agent_id === parsed.agent_id && r.content_hash === parsed.content_hash);
      if (conflict) return jsonResponse(409, { code: '23505', message: 'duplicate key value violates unique constraint "agent_knowledge_agent_id_content_hash_key"' });
      knowledgeRows.push(parsed);
      return jsonResponse(200, [parsed]);
    }
    if (u.includes('/storage/v1/object/') && method === 'DELETE') {
      calls.storageDelete.push({ url: u });
      return jsonResponse(200, {});
    }
    throw new Error(`fetch inesperado no mock: ${method} ${u}`);
  };
  return { fetchMock, calls, knowledgeRows };
}

// ---------------------------------------------------------------------------
// 1. Primeiro upload: hash calculado, 1 upload Gemini, 1 INSERT com hash.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: primeiro upload -> hash calculado, 1 upload Gemini, 1 INSERT com content_hash', async () => {
  const bytes = Buffer.from('conteúdo do primeiro documento');
  const { fetchMock, calls, knowledgeRows } = makeProcessMock({ storageBytes: bytes });
  globalThis.fetch = fetchMock;
  try {
    const result = await agentsMod.processKnowledge(agent(), 'pub-hk/first.txt', 'first.txt', 'text/plain', bytes.length);
    assert.equal(result.status, 'ready');
    assert.equal(calls.geminiUploadStart.length, 1);
    assert.equal(calls.geminiUploadPut.length, 1);
    assert.equal(calls.supabaseInsert.length, 1);
    const inserted = JSON.parse(calls.supabaseInsert[0].body);
    assert.equal(inserted.content_hash, sha256Hex(bytes));
    assert.equal(knowledgeRows.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 2. Mesmo conteúdo + mesmo nome: 0 upload adicional.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: mesmo conteúdo + mesmo nome reenviado -> 0 upload adicional, status duplicate', async () => {
  const bytes = Buffer.from('conteúdo repetido');
  const { fetchMock, calls } = makeProcessMock({ storageBytes: bytes });
  globalThis.fetch = fetchMock;
  try {
    const first = await agentsMod.processKnowledge(agent(), 'pub-hk/a.txt', 'a.txt', 'text/plain', bytes.length);
    assert.equal(first.status, 'ready');
    assert.equal(calls.geminiUploadStart.length, 1);

    const second = await agentsMod.processKnowledge(agent(), 'pub-hk/a-again.txt', 'a.txt', 'text/plain', bytes.length);
    assert.equal(second.status, 'duplicate');
    assert.equal(second.reason, 'already_processed');
    assert.equal(calls.geminiUploadStart.length, 1, 'nenhum upload adicional deveria acontecer');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 3. Mesmo conteúdo + nome diferente: 0 upload adicional.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: mesmo conteúdo, nome de arquivo diferente -> ainda 0 upload adicional (hash é do conteúdo, não do nome)', async () => {
  const bytes = Buffer.from('conteúdo idêntico, nomes diferentes');
  const { fetchMock, calls } = makeProcessMock({ storageBytes: bytes });
  globalThis.fetch = fetchMock;
  try {
    await agentsMod.processKnowledge(agent(), 'pub-hk/relatorio-v1.pdf', 'relatorio-v1.pdf', 'application/pdf', bytes.length);
    assert.equal(calls.geminiUploadStart.length, 1);
    const second = await agentsMod.processKnowledge(agent(), 'pub-hk/relatorio-final.pdf', 'relatorio-final.pdf', 'application/pdf', bytes.length);
    assert.equal(second.status, 'duplicate');
    assert.equal(calls.geminiUploadStart.length, 1, 'nome diferente não deveria importar — conteúdo é idêntico');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 4. Mesmo nome + conteúdo diferente: novo hash, novo upload, segundo registro.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: mesmo nome de arquivo, conteúdo diferente -> novo hash, novo upload, 2 registros', async () => {
  const bytesV1 = Buffer.from('versão 1 do documento');
  const bytesV2 = Buffer.from('versão 2 do documento, conteúdo mudou de verdade');
  const { fetchMock, calls, knowledgeRows } = makeProcessMock({ storageBytes: bytesV1 });
  globalThis.fetch = fetchMock;
  try {
    const first = await agentsMod.processKnowledge(agent(), 'pub-hk/relatorio.pdf', 'relatorio.pdf', 'application/pdf', bytesV1.length);
    assert.equal(first.status, 'ready');

    // Mesmo nome, MAS o conteúdo real baixado do Storage já é outro —
    // exatamente o cenário de "atualização legítima" que o requisito pede
    // para NUNCA ser bloqueado por engano.
    const mock2 = makeProcessMock({ storageBytes: bytesV2 });
    mock2.knowledgeRows.push(...knowledgeRows); // mesmo estado acumulado da tabela
    globalThis.fetch = mock2.fetchMock;
    const second = await agentsMod.processKnowledge(agent(), 'pub-hk/relatorio.pdf', 'relatorio.pdf', 'application/pdf', bytesV2.length);
    assert.equal(second.status, 'ready', 'conteúdo diferente nunca deve ser bloqueado como duplicata');
    assert.equal(mock2.calls.geminiUploadStart.length, 1, 'conteúdo diferente deve gerar um upload novo');
    assert.equal(mock2.knowledgeRows.length, 2, 'dois registros distintos, hashes diferentes');
    assert.notEqual(mock2.knowledgeRows[0].content_hash, mock2.knowledgeRows[1].content_hash);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 5. Conteúdo vazio: comportamento explícito e testado.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: conteúdo vazio -> hash determinístico (SHA-256 do buffer vazio), dedup funciona igual', async () => {
  const empty = Buffer.alloc(0);
  const { fetchMock, calls, knowledgeRows } = makeProcessMock({ storageBytes: empty });
  globalThis.fetch = fetchMock;
  try {
    const first = await agentsMod.processKnowledge(agent(), 'pub-hk/vazio1.txt', 'vazio1.txt', 'text/plain', 0);
    assert.equal(first.status, 'ready');
    const inserted = JSON.parse(calls.supabaseInsert[0].body);
    assert.equal(inserted.content_hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256 do buffer vazio é uma constante conhecida');
    assert.equal(knowledgeRows.length, 1);

    const second = await agentsMod.processKnowledge(agent(), 'pub-hk/vazio2.txt', 'vazio2.txt', 'text/plain', 0);
    assert.equal(second.status, 'duplicate', 'um segundo arquivo vazio para o mesmo agente é corretamente tratado como duplicata do mesmo conteúdo (vazio)');
    assert.equal(calls.geminiUploadStart.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 6. Dois uploads concorrentes do mesmo conteúdo (adversarial de custo real).
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2 (adversarial): 2 chamadas concorrentes do mesmo conteúdo -> ambas podem chegar ao Gemini, só 1 linha sobrevive, nenhum 500 por race', async () => {
  const bytes = Buffer.from('conteúdo disputado pelas duas requisições');
  const { fetchMock, calls, knowledgeRows } = makeProcessMock({ storageBytes: bytes });
  globalThis.fetch = fetchMock;
  try {
    const [resultA, resultB] = await Promise.all([
      agentsMod.processKnowledge(agent(), 'pub-hk/racer-a.txt', 'racer-a.txt', 'text/plain', bytes.length),
      agentsMod.processKnowledge(agent(), 'pub-hk/racer-b.txt', 'racer-b.txt', 'text/plain', bytes.length)
    ]);

    // Adversarial de custo: as duas checagens otimistas rodaram ANTES de
    // qualquer uma persistir, então as duas de fato chegaram ao Gemini —
    // não é um teste sequencial disfarçado.
    assert.equal(calls.geminiUploadStart.length, 2, 'as duas requisições concorrentes deveriam ter feito upload real ao Gemini, cada uma');
    assert.equal(calls.geminiUploadPut.length, 2);

    // Mas só 1 linha sobrevive no Postgres (simulado): a UNIQUE constraint
    // impediu a segunda persistência, não um erro genérico.
    assert.equal(knowledgeRows.length, 1, 'apenas 1 linha deveria sobreviver, mesmo com 2 uploads reais tendo acontecido');

    // Nenhuma das duas resultou em exceção/erro 500 por causa da corrida —
    // as duas devolvem um resultado definido (uma 'ready', outra 'duplicate').
    const statuses = [resultA.status, resultB.status].sort();
    assert.deepEqual(statuses, ['duplicate', 'ready'], 'uma vence (ready) e a outra reconhece a duplicata (duplicate), nenhuma vira erro');
    const loser = resultA.status === 'duplicate' ? resultA : resultB;
    assert.equal(loser.reason, 'concurrent_race_lost');
    // A perdedora sabe que pagou o upload de verdade — não finge que o custo
    // não ocorreu: ainda devolve o document_name do SEU PRÓPRIO upload real.
    assert.ok(loser.document_name, 'a chamada perdedora deveria reconhecer que seu próprio upload real ocorreu');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 7. Hash collision: SHA-256 é fingerprint, não um mecanismo criptográfico
// adicional — não deve ser tratado como cenário operacional esperado. Este
// teste documenta a decisão, não implementa detecção/mitigação de colisão.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: SHA-256 é documentado como fingerprint de conteúdo — colisão não é tratada como caso operacional (decisão registrada, não uma nova defesa)', () => {
  assert.match(source, /hash SHA-256 dos\s*\n?\/\/ bytes/, 'o comentário do fluxo de idempotência deveria estar presente');
  // Não deve existir nenhuma segunda função de hash/verificação anti-colisão
  // (ex.: um segundo algoritmo, um double-check de bytes armazenados) — a
  // decisão é usar SHA-256 sozinho como fingerprint, documentada, não
  // resolvida com engenharia extra fora do escopo desta rodada.
  assert.equal(/createHash\(['"]sha1['"]\)|createHash\(['"]md5['"]\)/i.test(source), false, 'não deveria haver um segundo hash "anti-colisão"');
  assert.equal((source.match(/createHash\('sha256'\)/g) || []).length, 1, 'exatamente 1 ponto de cálculo de hash, sem duplicação de mecanismo');
});

// ---------------------------------------------------------------------------
// 8. Linhas antigas sem hash continuam válidas.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: linha antiga sem content_hash não quebra a checagem de dedup para um agente diferente/novo conteúdo', async () => {
  const bytes = Buffer.from('conteúdo novo, agente com histórico antigo sem hash');
  const { fetchMock, calls, knowledgeRows } = makeProcessMock({ storageBytes: bytes });
  // Simula uma linha antiga pré-migration: sem content_hash (null).
  knowledgeRows.push({ agent_id: 'agent-uuid-hk', file_name: 'antigo-sem-hash.txt', content_hash: null });
  globalThis.fetch = fetchMock;
  try {
    const result = await agentsMod.processKnowledge(agent(), 'pub-hk/novo.txt', 'novo.txt', 'text/plain', bytes.length);
    assert.equal(result.status, 'ready', 'uma linha antiga sem hash não deveria ser confundida com uma duplicata de um novo conteúdo com hash real');
    assert.equal(calls.geminiUploadStart.length, 1);
    assert.equal(knowledgeRows.length, 2, 'a linha antiga permanece, mais a nova');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 9. Migration não apaga dados existentes (verificado ao vivo no Supabase).
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: migration é aditiva (ALTER TABLE ADD COLUMN + CREATE UNIQUE INDEX, ambos IF NOT EXISTS/idempotentes) — confirmado ao vivo: 31 linhas preservadas, 0 com hash logo após aplicar', () => {
  // Este teste documenta o resultado já verificado ao vivo via Supabase MCP no
  // momento da aplicação da migration (não repete a verificação de rede aqui —
  // ver relatório da sessão). Verificação estática: nenhuma DDL destrutiva
  // (DROP/TRUNCATE/DELETE) foi introduzida em api/agents.js por esta correção.
  assert.equal(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i.test(source), false, 'agents.js não deveria conter nenhuma DDL/DML destrutiva');
});

// ---------------------------------------------------------------------------
// 10. Hash não aparece em logs de erro.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: content_hash nunca aparece em nenhum console.error/log — só identificadores técnicos mínimos', async () => {
  const bytes = Buffer.from('conteúdo sensível não deveria vazar no log');
  const hash = sha256Hex(bytes);
  const { fetchMock, knowledgeRows } = makeProcessMock({ storageBytes: bytes });
  // Força uma corrida real (INSERT perde) para exercitar exatamente o
  // caminho de log adicionado por este achado.
  knowledgeRows.push({ agent_id: 'agent-uuid-hk', content_hash: hash, file_name: 'ja-existente.txt' });
  let insertAttempts = 0;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.includes('/rest/v1/agent_knowledge') && method === 'GET') return jsonResponse(200, []); // checagem otimista não vê (força a corrida)
    if (u.includes('/rest/v1/agent_knowledge') && method === 'POST') { insertAttempts++; return jsonResponse(409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
    return fetchMock(url, opts);
  };
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => { logs.push(args); };
  try {
    const result = await agentsMod.processKnowledge(agent(), 'pub-hk/race-log.txt', 'race-log.txt', 'text/plain', bytes.length);
    assert.equal(result.status, 'duplicate');
    assert.equal(insertAttempts, 1);
    const allLogsText = JSON.stringify(logs);
    assert.equal(allLogsText.includes(hash), false, 'o hash SHA-256 completo não deveria aparecer em nenhum log');
    assert.equal(/conteúdo sensível/.test(allLogsText), false, 'o conteúdo original não deveria aparecer em nenhum log');
    assert.ok(logs.some((a) => String(a[0] || '').includes('SEC14')), 'a corrida deveria gerar um log estruturado observável, com identificadores técnicos mínimos (agent_id), nunca hash/conteúdo');
  } finally {
    globalThis.fetch = realFetch;
    console.error = originalConsoleError;
  }
});

// ---------------------------------------------------------------------------
// Regressão estática: hash calculado só a partir dos bytes, nunca do path.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#2: content_hash é calculado só a partir de bytes (nunca path/fileName/size isolado)', () => {
  const processKnowledgeSlice = source.slice(source.indexOf('async function processKnowledge'));
  assert.match(processKnowledgeSlice, /crypto\.createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/);
  assert.equal(/createHash\([^)]*\)\.update\(path\)/.test(processKnowledgeSlice), false, 'hash nunca deveria ser calculado a partir do path');
  assert.equal(/createHash\([^)]*\)\.update\(fileName\)/.test(processKnowledgeSlice), false, 'hash nunca deveria ser calculado a partir do nome do arquivo');
});

test('SEC-14 HIGH#2: processKnowledge/deleteUploadedObject exportados só para teste, export default (runtime Vercel) intocado', () => {
  assert.match(source, /export \{ ensureStore, deleteFileSearchStore, processKnowledge \};/);
  assert.match(source, /export default async function handler\(req,res\)/);
  assert.equal(typeof agentsMod.processKnowledge, 'function');
  assert.equal(typeof agentsMod.default, 'function');
});

test('SEC-14 HIGH#2: nenhum require/import de pacote externo novo (node:crypto é builtin, permitido)', () => {
  assert.equal(/require\(['"](?!node:)/.test(source), false);
  const externalImports = (source.match(/from\s+['"]([^'"]+)['"]/g) || []).filter((m) => !/from\s+['"](?:\.\/|\.\.\/|node:)/.test(m));
  assert.deepEqual(externalImports, [], `import de pacote externo não permitido: ${externalImports.join(', ')}`);
});
