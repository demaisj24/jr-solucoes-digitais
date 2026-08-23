// SEC-14 HIGH #1 — Testes da correção da race condition em ensureStore()
// (api/agents.js): duas requisições concorrentes para o MESMO agente, ambas
// vendo knowledge_store_name ainda nulo, podiam criar (e pagar) dois File
// Search Stores no Gemini; só o último PATCH "vencia" no banco, o outro Store
// ficava órfão e cobrado para sempre, sem cleanup nenhum.
//
// Estratégia corrigida (CAS pós-criação + cleanup do perdedor):
//   1. lê knowledge_store_name — se já existe, retorna sem chamar o Gemini;
//   2. se vazio, cria o Store no Gemini (chamada lenta, fora de qualquer
//      lock/transação Postgres — nunca vira uma transação longa);
//   3. persiste com PATCH CONDICIONAL (`knowledge_store_name=is.null`),
//      Prefer: return=representation;
//   4. array com 1 linha -> venceu, usa o Store recém-criado;
//   5. array vazio -> perdeu: busca o knowledge_store_name vencedor, deleta o
//      Store órfão que acabou de criar, usa o vencedor;
//   6. falha no DELETE do perdedor nunca é mascarada (log estruturado,
//      identificadores técnicos só) e nunca substitui o vencedor.
//
// ensureStore/deleteFileSearchStore ganharam export nomeado só para permitir
// este teste real (mock de fetch + chamadas simultâneas via Promise.all) —
// mesmo padrão já usado pelo SEC-13 Fase 4 em api/chat.js/api/agent-chat.js.
// O runtime da Vercel usa exclusivamente o export default de api/agents.js,
// intocado por esta mudança.
//
// Rodar com:
//   node --test tests/sec-14-ensure-store-cas.test.js

// Precisa existir ANTES do import do módulo, porque GEMINI_KEY/SERVICE_ROLE_KEY
// são lidos de process.env uma única vez, no top-level do módulo.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sec14-test-fake-service-role-key';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'sec14-test-fake-gemini-key';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(root, 'api', 'agents.js'), 'utf8');
const agentsMod = await import(pathToFileURL(path.join(root, 'api', 'agents.js')).href);

const realFetch = globalThis.fetch;
function jsonResponse(status, body, extraHeaders = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (k) => extraHeaders[k.toLowerCase()] ?? null }
  };
}

// Mock mínimo e determinístico do "mundo externo" de ensureStore(): o Gemini
// (criação/deleção de fileSearchStores) e o Supabase REST (PATCH condicional +
// GET de release). dbState simula a única linha de `agents` relevante — um
// objeto simples com `knowledge_store_name`, exatamente como a coluna real
// (nullable, sem lock, sem coluna extra) se comporta sob compare-and-swap.
function makeGeminiSupabaseMock({ dbState, storeNames }) {
  const calls = { post: [], patch: [], get: [], delete: [] };
  let issued = 0;
  const fetchMock = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      calls.post.push({ url: u, body: opts.body });
      const name = storeNames[issued] ?? `fileSearchStores/auto-${issued}`;
      issued++;
      return jsonResponse(200, { name });
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores/') && method === 'DELETE') {
      calls.delete.push({ url: u });
      return jsonResponse(200, {});
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') {
      calls.patch.push({ url: u, body: opts.body });
      const parsed = JSON.parse(opts.body);
      const conditional = u.includes('knowledge_store_name=is.null');
      if (conditional) {
        if (dbState.knowledge_store_name === null) {
          dbState.knowledge_store_name = parsed.knowledge_store_name;
          return jsonResponse(200, [{ ...dbState }]);
        }
        return jsonResponse(200, []); // CAS perdido: 0 linhas afetadas, nunca um erro HTTP
      }
      // Nenhum caminho do código corrigido deveria mais fazer PATCH incondicional —
      // se isso for chamado, é sinal de regressão (ver teste dedicado abaixo).
      dbState.knowledge_store_name = parsed.knowledge_store_name;
      return jsonResponse(200, [{ ...dbState }]);
    }
    if (u.includes('/rest/v1/agents') && method === 'GET') {
      calls.get.push({ url: u });
      return jsonResponse(200, [{ knowledge_store_name: dbState.knowledge_store_name }]);
    }
    throw new Error(`fetch inesperado no mock: ${method} ${u}`);
  };
  return { fetchMock, calls, dbState };
}

function agent(overrides = {}) {
  return { id: 'agent-uuid-1', public_id: 'pub-1', company_name: 'Acme', knowledge_store_name: null, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Agente já possui store: zero POST Gemini.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: agente já com knowledge_store_name -> zero chamadas ao Gemini/Supabase', async () => {
  const { fetchMock, calls } = makeGeminiSupabaseMock({ dbState: { knowledge_store_name: 'fileSearchStores/existing' }, storeNames: [] });
  globalThis.fetch = fetchMock;
  try {
    const result = await agentsMod.ensureStore(agent({ knowledge_store_name: 'fileSearchStores/existing' }));
    assert.equal(result, 'fileSearchStores/existing');
    assert.equal(calls.post.length, 0, 'não deveria chamar o Gemini');
    assert.equal(calls.patch.length, 0, 'não deveria persistir nada');
    assert.equal(calls.delete.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 2. Agente sem store, chamada única: exatamente 1 POST, 1 PATCH CAS vencedor.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: agente sem store, 1 chamada -> exatamente 1 POST Gemini, 1 PATCH CAS vencedor, store correto persistido', async () => {
  const dbState = { knowledge_store_name: null };
  const { fetchMock, calls } = makeGeminiSupabaseMock({ dbState, storeNames: ['fileSearchStores/only-one'] });
  globalThis.fetch = fetchMock;
  try {
    const result = await agentsMod.ensureStore(agent());
    assert.equal(result, 'fileSearchStores/only-one');
    assert.equal(calls.post.length, 1);
    assert.equal(calls.patch.length, 1);
    assert.ok(calls.patch[0].url.includes('knowledge_store_name=is.null'), 'PATCH deveria ser condicional (CAS), nunca incondicional');
    assert.equal(dbState.knowledge_store_name, 'fileSearchStores/only-one');
    assert.equal(calls.delete.length, 0, 'ninguém perdeu a corrida, nada deveria ser deletado');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 3 + teste adversarial de custo: duas chamadas REALMENTE concorrentes
// (Promise.all, não sequenciais) no mesmo agente sem store.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1 (adversarial de custo): 2 chamadas concorrentes -> 2 POST Gemini reais, só 1 CAS vence, 1 store persistido, 1 store perdedor deletado, zero duplicação lógica', async () => {
  const dbState = { knowledge_store_name: null };
  const { fetchMock, calls } = makeGeminiSupabaseMock({
    dbState,
    storeNames: ['fileSearchStores/racer-A', 'fileSearchStores/racer-B']
  });
  globalThis.fetch = fetchMock;
  try {
    // Duas requisições concorrentes de verdade: cada uma lê agent.knowledge_store_name
    // como null ANTES de qualquer uma ter chance de persistir (mesmo objeto "stale"
    // que duas requisições HTTP independentes teriam lido do banco no mesmo instante).
    const [resultA, resultB] = await Promise.all([
      agentsMod.ensureStore(agent()),
      agentsMod.ensureStore(agent())
    ]);

    // Adversarial de custo: a corrida REALMENTE produziu 2 Stores externos pagos —
    // não é um teste sequencial disfarçado.
    assert.equal(calls.post.length, 2, 'as duas chamadas concorrentes deveriam ter chamado o Gemini de verdade, cada uma');

    // Mas só 1 fica associado ao agente.
    assert.equal(calls.patch.length, 2, 'as duas deveriam tentar o CAS');
    assert.equal([resultA, resultB].filter((r) => r === dbState.knowledge_store_name).length, 2,
      'as duas chamadas deveriam devolver o MESMO nome de store vencedor (nenhuma duplicação lógica)');
    assert.equal(resultA, resultB, 'ambas as respostas devem convergir para o mesmo store, mesmo que uma tenha "perdido"');

    // O perdedor foi explicitamente deletado.
    assert.equal(calls.delete.length, 1, 'exatamente 1 store perdedor deveria receber DELETE');
    const deletedName = calls.delete[0].url.split('/v1beta/')[1].split('?')[0];
    assert.notEqual(deletedName, dbState.knowledge_store_name, 'o store deletado não pode ser o vencedor');
    assert.ok(['fileSearchStores/racer-A', 'fileSearchStores/racer-B'].includes(deletedName));
    assert.ok(['fileSearchStores/racer-A', 'fileSearchStores/racer-B'].includes(dbState.knowledge_store_name));
  } finally {
    globalThis.fetch = realFetch;
  }
});
// ---------------------------------------------------------------------------
// 4. Segunda chamada chega depois da primeira persistir: nenhum segundo POST.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: segunda chamada chega depois da primeira já ter persistido -> nenhum segundo POST', async () => {
  const dbState = { knowledge_store_name: null };
  const { fetchMock, calls } = makeGeminiSupabaseMock({ dbState, storeNames: ['fileSearchStores/first'] });
  globalThis.fetch = fetchMock;
  try {
    const first = await agentsMod.ensureStore(agent());
    assert.equal(first, 'fileSearchStores/first');
    assert.equal(calls.post.length, 1);

    // A "segunda chamada" representa uma nova leitura do agente depois que a
    // primeira já persistiu — knowledge_store_name já vem preenchido do banco.
    const second = await agentsMod.ensureStore(agent({ knowledge_store_name: dbState.knowledge_store_name }));
    assert.equal(second, 'fileSearchStores/first');
    assert.equal(calls.post.length, 1, 'nenhum segundo POST deveria acontecer');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 5. CAS perde: store vencedor permanece, perdedor é deletado, retorno usa o vencedor.
// (Já coberto em detalhe pelo teste adversarial de custo acima — este teste
// isola o caminho perdedor sozinho, de forma determinística/sequencial, para
// verificar o retorno específico sem depender de quem "ganha" a corrida real.)
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: CAS perde -> usa o store vencedor já persistido, deleta o próprio store recém-criado', async () => {
  // Simula: quando ESTA chamada tenta o PATCH condicional, o banco JÁ TEM um
  // vencedor — construímos o mock com knowledge_store_name=null e, no meio do
  // fluxo, "outra requisição" (mesmo ensureStore) persiste primeiro de verdade.
  const winnerDbState = { knowledge_store_name: null };
  const mock2 = makeGeminiSupabaseMock({ dbState: winnerDbState, storeNames: ['fileSearchStores/winner', 'fileSearchStores/loser'] });
  globalThis.fetch = mock2.fetchMock;
  try {
    // "Outra requisição" vence primeiro, de verdade, via o mesmo ensureStore.
    const winnerResult = await agentsMod.ensureStore(agent());
    assert.equal(winnerResult, 'fileSearchStores/winner');

    // Agora esta chamada tenta, mas o agente que ELA tinha em mãos ainda está
    // com knowledge_store_name null (leitura obsoleta, mesma premissa de uma
    // requisição HTTP concorrente que leu o banco antes do vencedor persistir).
    const loserResult = await agentsMod.ensureStore(agent());
    assert.equal(loserResult, 'fileSearchStores/winner', 'deveria devolver o store vencedor, nunca o próprio (perdedor)');
    assert.equal(winnerDbState.knowledge_store_name, 'fileSearchStores/winner', 'o vencedor persistido nunca deveria ser sobrescrito');
    assert.equal(mock2.calls.delete.length, 1);
    assert.ok(mock2.calls.delete[0].url.includes('fileSearchStores/loser'), 'o DELETE deveria mirar o store perdedor, nunca o vencedor');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 6. DELETE do store perdedor falha: erro observável, vencedor intacto, sem overwrite.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: DELETE do store perdedor falha -> erro logado estruturado, vencedor intacto, retorno ainda é o vencedor', async () => {
  const winnerDbState = { knowledge_store_name: 'fileSearchStores/winner-2' }; // já vencido por outra requisição
  let deleteAttempted = false;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      return jsonResponse(200, { name: 'fileSearchStores/loser-2' });
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores/') && method === 'DELETE') {
      deleteAttempted = true;
      return jsonResponse(500, { error: 'simulated Gemini outage' }); // DELETE falha
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') {
      return jsonResponse(200, []); // sempre perde (0 linhas)
    }
    if (u.includes('/rest/v1/agents') && method === 'GET') {
      return jsonResponse(200, [{ knowledge_store_name: winnerDbState.knowledge_store_name }]);
    }
    throw new Error(`fetch inesperado: ${method} ${u}`);
  };
  const originalConsoleError = console.error;
  const errorLogs = [];
  console.error = (...args) => { errorLogs.push(args); };
  try {
    const result = await agentsMod.ensureStore(agent());
    assert.equal(result, 'fileSearchStores/winner-2', 'mesmo com DELETE falhando, o retorno deve ser o vencedor, nunca o perdedor nem erro');
    assert.equal(deleteAttempted, true, 'o DELETE deveria de fato ter sido tentado');
    assert.equal(winnerDbState.knowledge_store_name, 'fileSearchStores/winner-2', 'o vencedor nunca é sobrescrito por causa de uma falha de cleanup');
    const orphanLog = errorLogs.find((a) => String(a[0] || '').includes('orphan') || String(a[0] || '').includes('SEC14'));
    assert.ok(orphanLog, 'a falha do DELETE deveria gerar um log estruturado e observável, não ser mascarada silenciosamente');
    const loggedPayload = JSON.stringify(orphanLog);
    assert.equal(/content|token|Bearer|payload/i.test(loggedPayload), false, 'o log não deve conter conteúdo/token/payload — só identificadores técnicos');
  } finally {
    globalThis.fetch = realFetch;
    console.error = originalConsoleError;
  }
});

// ---------------------------------------------------------------------------
// 7. Erro no POST Gemini: banco não recebe knowledge_store_name falso.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: erro no POST Gemini (HTTP not ok) -> nenhum PATCH acontece, nada falso é persistido', async () => {
  let patchCalled = false;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      return jsonResponse(500, null);
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') { patchCalled = true; return jsonResponse(200, []); }
    throw new Error(`fetch inesperado: ${method} ${u}`);
  };
  try {
    await assert.rejects(() => agentsMod.ensureStore(agent()), /Não foi possível criar a base inteligente/);
    assert.equal(patchCalled, false, 'nenhum PATCH deveria acontecer se o Gemini falhou em criar o store');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('SEC-14 HIGH#1: POST Gemini ok mas sem "name" no corpo -> mesmo tratamento (nenhum PATCH, erro real)', async () => {
  let patchCalled = false;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      return jsonResponse(200, {}); // sem "name"
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') { patchCalled = true; return jsonResponse(200, []); }
    throw new Error(`fetch inesperado: ${method} ${u}`);
  };
  try {
    await assert.rejects(() => agentsMod.ensureStore(agent()), /Não foi possível criar a base inteligente/);
    assert.equal(patchCalled, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 8. Erro no PATCH CAS (exceção/HTTP error real, não "perdeu a corrida"):
// não sobrescrever vencedor, tratar corretamente, nunca assumir sucesso.
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: PATCH CAS lança exceção (ex.: Supabase indisponível) -> propaga erro, nunca assume sucesso silenciosamente', async () => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      return jsonResponse(200, { name: 'fileSearchStores/never-persisted' });
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') {
      throw new Error('Supabase indisponível (simulado)');
    }
    throw new Error(`fetch inesperado: ${method} ${u}`);
  };
  try {
    await assert.rejects(() => agentsMod.ensureStore(agent()));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('SEC-14 HIGH#1: PATCH CAS devolve HTTP de erro (não 0-linhas, um erro real) -> propaga erro via db(), nunca trata como "perdeu"', async () => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url), method = opts.method || 'GET';
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/fileSearchStores?') && method === 'POST') {
      return jsonResponse(200, { name: 'fileSearchStores/never-persisted-2' });
    }
    if (u.includes('/rest/v1/agents') && method === 'PATCH') {
      return jsonResponse(503, null); // erro real do Supabase, não "0 linhas afetadas"
    }
    throw new Error(`fetch inesperado: ${method} ${u}`);
  };
  try {
    await assert.rejects(() => agentsMod.ensureStore(agent()), /Falha ao persistir dados/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------------------
// 9. Nenhum caminho voltou a usar PATCH incondicional (regressão estática).
// ---------------------------------------------------------------------------
test('SEC-14 HIGH#1: ensureStore() nunca mais faz PATCH incondicional em agents (regressão estática)', () => {
  const ensureStoreSlice = source.slice(
    source.indexOf('async function ensureStore'),
    source.indexOf('async function processKnowledge')
  );
  assert.match(ensureStoreSlice, /knowledge_store_name=is\.null/, 'ensureStore deveria persistir via PATCH condicional (CAS)');
  // O único PATCH a `agents?id=eq....` dentro de ensureStore precisa carregar o
  // filtro condicional — não pode existir um PATCH "cru" a agents sem ele.
  const patchAgentsCalls = ensureStoreSlice.match(/db\(`agents\?id=eq\.[^`]*`,\{method:'PATCH'/g) || [];
  assert.equal(patchAgentsCalls.length, 1, 'deveria haver exatamente 1 PATCH a agents dentro de ensureStore');
  assert.ok(patchAgentsCalls[0].includes('knowledge_store_name=is.null'), 'o único PATCH a agents dentro de ensureStore deve ser condicional');
});

test('SEC-14 HIGH#1: ensureStore/deleteFileSearchStore exportados só para teste, export default (runtime Vercel) intocado', () => {
  // Regex tolerante a outros nomes no mesmo export nomeado (ex.: processKnowledge,
  // adicionado pelo HIGH #2) — o que importa é que ensureStore/deleteFileSearchStore
  // continuem exportados juntos, não o conjunto exato/a ordem.
  assert.match(source, /export \{ [^}]*\bensureStore\b[^}]*\bdeleteFileSearchStore\b[^}]* \};/);
  assert.match(source, /export default async function handler\(req,res\)/);
  assert.equal(typeof agentsMod.ensureStore, 'function');
  assert.equal(typeof agentsMod.default, 'function');
});

test('SEC-14 HIGH#1: nenhuma migration, coluna ou dependência nova (diff mínimo)', () => {
  assert.equal(/ALTER TABLE|CREATE TABLE|migration/i.test(source), false, 'agents.js não deveria conter DDL/migration inline');
  assert.equal(/pg_advisory/.test(source), false, 'não deveria usar advisory lock');
  assert.equal(/require\(['"](?!node:)/.test(source), false, 'nenhum require de pacote externo novo');
  assert.equal(/from\s+['"](?!\.\/|\.\.\/|node:)/.test(source), false, 'nenhum import de pacote externo novo');
});
