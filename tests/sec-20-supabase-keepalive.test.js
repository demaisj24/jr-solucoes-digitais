// SEC-20 — testes estaticos do workflow de keepalive do Supabase Free
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(root, '.github', 'workflows', 'supabase-keepalive.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const vercelConfig = readFileSync(path.join(root, 'vercel.json'), 'utf8');

test('SEC-20: workflow tem cron 2x por semana', () => {
  assert.match(workflow, /cron:\s*"0 9 \* \* 1,4"/);
});

test('SEC-20: consulta plan_catalog via SUPABASE_URL', () => {
  assert.match(workflow, /\$\{SUPABASE_URL\}\/rest\/v1\/plan_catalog\?select=code&active=eq\.true&limit=1/);
});

test('SEC-20: nao consulta tabelas com dados de usuario', () => {
  assert.equal(/\/rest\/v1\/(agents|agent_knowledge|profiles|subscriptions|usage_counters|instagram_connections)\b/.test(workflow), false);
});

test('SEC-20: nao usa service role', () => {
  assert.equal(/SERVICE_ROLE/i.test(workflow), false);
  assert.match(workflow, /SUPABASE_ANON_KEY/);
  assert.match(workflow, /secrets\.SUPABASE_ANON_KEY/);
});

test('SEC-20: permissions sao somente leitura', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(/permissions:[\s\S]{0,100}\bwrite\b/i.test(workflow), false);
});

test('SEC-20: curl falha em HTTP >= 400 e possui timeouts', () => {
  assert.match(workflow, /curl\s+--fail-with-body\b/);
  assert.match(workflow, /set\s+-euo\s+pipefail/);
  assert.match(workflow, /--connect-timeout\s+5/);
  assert.match(workflow, /--max-time\s+10/);
  assert.match(workflow, /timeout-minutes:\s*2/);
});

test('SEC-20: nao adiciona Vercel Cron', () => {
  const parsed = JSON.parse(vercelConfig);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'crons'), false);
  assert.equal(vercelConfig.includes('supabase-keepalive'), false);
});

test('SEC-20: nao adiciona Serverless Function de keepalive', () => {
  assert.equal(existsSync(path.join(root, 'api', 'cron', 'supabase-keepalive.js')), false);
  const files = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  assert.equal(files.some((f) => f.includes('supabase-keepalive')), false);
});

test('SEC-20: nenhuma credencial literal no workflow', () => {
  assert.equal(/eyJ[A-Za-z0-9_-]{10,}/.test(workflow), false);
  assert.equal(/sb_(publishable|secret)_[A-Za-z0-9_-]+/.test(workflow), false);
  assert.equal(/SUPABASE_URL:\s*['"]https?:\/\//.test(workflow), false);
});
