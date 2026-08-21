// SEC-13 — Testes da correção: rate limiting durável via RPC no Supabase
// (public.rate_limit_hit), substituindo o Map() em memória de api/chat.js,
// api/agent-chat.js e api/agents.js, que não é compartilhado entre instâncias
// serverless.
//
// A lógica da própria função SQL (limite, janela, expiração, isolamento entre
// chaves, concorrência via SELECT...FOR UPDATE, RLS/grants) já foi validada
// exaustivamente em Fase 2 dentro de BEGIN...ROLLBACK contra o projeto real
// (25/25 verificações) e novamente após a aplicação real da migration via
// smoke test — este arquivo cobre apenas a integração no lado do código
// (api/*.js): chaves, limites, janelas, fail-open/fail-closed e escopo do diff.
//
// Rodar com:
//   node --test tests/sec-13-durable-rate-limit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const FILES = {
  chat: 'api/chat.js',
  agentChat: 'api/agent-chat.js',
  agents: 'api/agents.js'
};

test('os 3 arquivos são JS sintaticamente válido', () => {
  for (const rel of Object.values(FILES)) {
    assert.doesNotThrow(() => {
      execSync(`node --check "${path.join(root, rel)}"`, { stdio: 'pipe' });
    }, `${rel} não é JS válido`);
  }
});

test('nenhum dos 3 arquivos usa mais Map() em memória para rate limit (buckets/WINDOW_MS)', () => {
  for (const rel of Object.values(FILES)) {
    const content = read(rel);
    assert.equal(/\bnew Map\(\)/.test(content) && rel !== FILES.agentChat, false, `${rel} não deveria mais ter Map() de rate limit`);
    assert.equal(content.includes('WINDOW_MS'), false, `${rel} ainda referencia o antigo WINDOW_MS`);
    assert.equal(/buckets\s*=\s*new Map/.test(content), false, `${rel} ainda declara buckets=new Map()`);
  }
  // agent-chat.js mantém um Map(), mas é o `cache` de agente/conhecimento (não relacionado a rate limit).
  assert.match(read(FILES.agentChat), /const cache=new Map\(\)/, 'agent-chat.js deveria manter o cache de agente/conhecimento intocado');
});

test('os 3 arquivos chamam a RPC public.rate_limit_hit via PostgREST', () => {
  for (const rel of Object.values(FILES)) {
    assert.match(read(rel), /\/rest\/v1\/rpc\/rate_limit_hit/, `${rel} deveria chamar /rest/v1/rpc/rate_limit_hit`);
  }
});

test('nenhum arquivo api/*.js chama rate_limit_cleanup automaticamente (decisão: só existe na migration por enquanto)', () => {
  const apiDir = path.join(root, 'api');
  const out = execSync(`git ls-files "api/*.js" "api/**/*.js"`, { cwd: root }).toString().trim().split('\n').filter(Boolean);
  for (const rel of out) {
    const content = readFileSync(path.join(root, rel), 'utf8');
    assert.equal(content.includes('rate_limit_cleanup'), false, `${rel} não deveria referenciar rate_limit_cleanup ainda`);
  }
});

test('chat.js: chaves com prefixo "chat:", limites e janela corretos (10/h sessão, 30/h IP)', () => {
  const c = read(FILES.chat);
  assert.match(c, /`chat:session:\$\{ip\}:\$\{sessionId\}`/);
  assert.match(c, /`chat:ip:\$\{ip\}`/);
  assert.match(c, /SESSION_LIMIT\s*=\s*10\b/);
  assert.match(c, /IP_LIMIT\s*=\s*30\b/);
  assert.match(c, /RATE_LIMIT_WINDOW_SECONDS\s*=\s*60\s*\*\s*60\b/);
});

test('agent-chat.js: chaves com prefixo "agent-chat:", limites e janela corretos (30/h sessão, 120/h IP)', () => {
  const c = read(FILES.agentChat);
  assert.match(c, /`agent-chat:session:\$\{client\}:\$\{sid\}`/);
  assert.match(c, /`agent-chat:ip:\$\{client\}`/);
  assert.match(c, /SESSION_LIMIT=30\b/);
  assert.match(c, /IP_LIMIT=120\b/);
  assert.match(c, /RATE_LIMIT_WINDOW_SECONDS=60\*60\b/);
});

test('agents.js: chave com prefixo "agents:create:", limite e janela corretos (5/h)', () => {
  const c = read(FILES.agents);
  assert.match(c, /`agents:create:\$\{ip\(req\)\}`/);
  assert.match(c, /CREATE_LIMIT=5\b/);
  assert.match(c, /RATE_LIMIT_WINDOW_SECONDS=60\*60\b/);
});

// Nota: extrai o trecho entre "!r.ok" e o "finally" que encerra o try/catch
// (comum aos 3 arquivos) em vez de tentar casar chaves balanceadas — mais
// simples e suficiente para a estrutura real destes arquivos. O "return await
// r.json()" do caminho de sucesso fica no meio do trecho, mas não bate no
// regex /return (true|false)/, então não interfere na contagem.
function sliceAfter(content, fromMarker) {
  const from = content.indexOf(fromMarker);
  assert.notEqual(from, -1, `marcador "${fromMarker}" não encontrado`);
  const to = content.indexOf('finally', from);
  assert.notEqual(to, -1, '"finally" (fim do try/catch) não encontrado após o marcador');
  return content.slice(from, to);
}

test('chat.js e agent-chat.js: fail-open (retornam false tanto no erro HTTP quanto na exceção)', () => {
  for (const rel of [FILES.chat, FILES.agentChat]) {
    const c = read(rel);
    const errorAndCatchBlock = sliceAfter(c, '!r.ok');
    const returns = errorAndCatchBlock.match(/return (true|false)/g) || [];
    assert.ok(returns.length >= 2, `${rel}: esperava 2 "return" (erro HTTP + catch), achou ${returns.length}`);
    assert.ok(returns.every((r) => r === 'return false'), `${rel}: todos os returns entre !r.ok e o sucesso deveriam ser "return false" (fail-open), achou: ${returns.join(', ')}`);
  }
});

test('agent-chat.js: log de fail-open é explícito e "grepável" (SEC13_RATE_LIMIT_FAIL_OPEN) para monitoramento', () => {
  const c = read(FILES.agentChat);
  const matches = c.match(/SEC13_RATE_LIMIT_FAIL_OPEN/g) || [];
  assert.ok(matches.length >= 2, 'deveria aparecer no log do erro HTTP e no log da exceção');
});

test('agents.js: fail-closed (retorna true tanto no erro HTTP quanto na exceção)', () => {
  const c = read(FILES.agents);
  const errorAndCatchBlock = sliceAfter(c, '!r.ok');
  const returns = errorAndCatchBlock.match(/return (true|false)/g) || [];
  assert.ok(returns.length >= 2, `agents.js: esperava 2 "return" (erro HTTP + catch), achou ${returns.length}`);
  assert.ok(returns.every((r) => r === 'return true'), `agents.js: todos os returns entre !r.ok e o sucesso deveriam ser "return true" (fail-closed), achou: ${returns.join(', ')}`);
});

test('todas as chamadas de rate limit nos 3 arquivos usam await (a checagem virou assíncrona)', () => {
  assert.match(read(FILES.chat), /await rateLimitHit\(/);
  assert.match(read(FILES.agentChat), /await hit\(/);
  assert.match(read(FILES.agents), /await limited\(/);
});

test('nenhuma nova Serverless Function foi adicionada (vercel.json e contagem de api/*.js inalterados)', () => {
  const cfg = JSON.parse(read('vercel.json'));
  assert.deepEqual(Object.keys(cfg.functions).sort(), [
    'api/agent-chat.js', 'api/agents.js', 'api/asaas-checkout.js',
    'api/chat.js', 'api/subscription-cancel.js', 'api/webhooks/asaas.js'
  ].sort());
  const files = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  assert.equal(files.length, 11, `esperado 11 arquivos de função em api/, encontrado ${files.length}`);
});

test('nenhum fornecedor/SDK novo foi introduzido (sem package.json, sem require de pacote externo)', () => {
  assert.equal(existsSync(path.join(root, 'package.json')), false, 'projeto deveria continuar sem package.json (zero-dependência)');
  for (const rel of Object.values(FILES)) {
    const c = read(rel);
    assert.equal(/require\(['"](?!node:)/.test(c), false, `${rel} não deveria ter novo require() de pacote externo`);
    assert.equal(/from\s+['"](?!\.\/|\.\.\/|node:)/.test(c), false, `${rel} não deveria importar de um pacote externo`);
  }
});

test('diff contra origin/main é exatamente o esperado: os 3 endpoints + este arquivo de teste — nada além disso', () => {
  const changed = execSync('git diff origin/main --name-only', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  const untracked = execSync('git status --porcelain=v1', { cwd: root }).toString().trim().split('\n').filter(Boolean)
    .filter((l) => l.startsWith('??')).map((l) => l.slice(3).replace(/\/$/, ''));
  const allTouched = new Set([...changed, ...untracked]);
  const expected = new Set([FILES.chat, FILES.agentChat, FILES.agents, 'tests/sec-13-durable-rate-limit.test.js']);
  for (const f of expected) assert.ok(allTouched.has(f), `${f} deveria aparecer no diff (esperado pelo SEC-13, mas ausente)`);
  const unexpected = [...allTouched].filter((f) => !expected.has(f));
  assert.deepEqual(unexpected, [], `arquivos inesperados no diff (fora do escopo do SEC-13): ${unexpected.join(', ')}`);
});
