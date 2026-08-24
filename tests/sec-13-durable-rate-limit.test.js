// SEC-13 — regressão do rate limiting durável via RPC no Supabase.
//
// Este arquivo valida invariantes atuais do produto. Os testes detalhados de
// fallback/sessionSlot permanecem em sec-13-fase4-f1-f2.test.js.
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

test('SEC-13: endpoints protegidos continuam sintaticamente válidos', () => {
  for (const rel of Object.values(FILES)) {
    assert.doesNotThrow(() => execSync(`node --check "${path.join(root, rel)}"`, { stdio: 'pipe' }), `${rel} não é JS válido`);
  }
});

test('SEC-13: os 3 endpoints usam a RPC rate_limit_hit', () => {
  for (const rel of Object.values(FILES)) {
    assert.match(read(rel), /\/rest\/v1\/rpc\/rate_limit_hit/, `${rel} deve chamar rate_limit_hit`);
  }
});

test('SEC-13: implementação antiga ilimitada não voltou', () => {
  for (const rel of Object.values(FILES)) {
    const content = read(rel);
    assert.equal(/(?<!FALLBACK_)\bWINDOW_MS\b/.test(content), false, `${rel} ainda referencia WINDOW_MS antigo`);
    assert.equal(/(?<![a-zA-Z])buckets\s*=\s*new Map/.test(content), false, `${rel} ainda declara o Map antigo`);
  }
  assert.equal(/new Map\(\)/.test(read(FILES.agents)), false, 'agents.js não deve usar Map de rate limit em memória');
});

test('SEC-13: limites principais permanecem no contrato esperado', () => {
  const chat = read(FILES.chat);
  const agentChat = read(FILES.agentChat);
  const agents = read(FILES.agents);
  assert.match(chat, /SESSION_LIMIT\s*=\s*10\b/);
  assert.match(chat, /IP_LIMIT\s*=\s*30\b/);
  assert.match(agentChat, /SESSION_LIMIT=30\b/);
  assert.match(agentChat, /IP_LIMIT=120\b/);
  assert.match(agents, /CREATE_LIMIT=5\b/);
});

test('SEC-13: checagem de IP precede sessão nos chats', () => {
  const chat = read(FILES.chat);
  const agentChat = read(FILES.agentChat);
  assert.ok(chat.indexOf('rateLimitHit(`chat:ip:') < chat.indexOf('rateLimitHit(`chat:session:'));
  assert.ok(agentChat.indexOf('hit(`agent-chat:ip:') < agentChat.indexOf('hit(`agent-chat:session:'));
});

test('SEC-13: agents continua fail-closed em falha do RPC', () => {
  const c = read(FILES.agents);
  const from = c.indexOf('!r.ok');
  const to = c.indexOf('finally', from);
  assert.notEqual(from, -1);
  assert.notEqual(to, -1);
  const block = c.slice(from, to);
  const returns = block.match(/return (true|false)/g) || [];
  assert.ok(returns.length >= 2);
  assert.ok(returns.every((r) => r === 'return true'));
});

test('SEC-13: fallback observável permanece nos dois chats', () => {
  for (const rel of [FILES.chat, FILES.agentChat]) {
    const matches = read(rel).match(/SEC13_RATE_LIMIT_FALLBACK/g) || [];
    assert.ok(matches.length >= 2, `${rel} deve manter logs grepáveis do fallback`);
  }
});

test('SEC-13: projeto continua zero-dependência e dentro do orçamento operacional de funções', () => {
  assert.equal(existsSync(path.join(root, 'package.json')), false, 'não deve surgir package.json sem decisão arquitetural');
  const cfg = JSON.parse(read('vercel.json'));
  assert.ok(cfg.functions?.['api/agents.js']);
  assert.ok(cfg.functions?.['api/webhooks/asaas.js']);
  const files = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  assert.ok(files.length <= 12, `esperado no máximo 12 funções, encontrado ${files.length}`);
});
