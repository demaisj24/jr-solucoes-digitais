// SEC-20 — testes estáticos do workflow de keepalive do Supabase Free
// (.github/workflows/supabase-keepalive.yml).
//
// Arquitetura oficial reconciliada: GitHub Actions (não Vercel Cron, não
// Serverless Function), 2x/semana, chave anônima do Supabase contra
// `plan_catalog`, nunca `agents`, nunca a service role.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(root, '.github', 'workflows', 'supabase-keepalive.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const vercelConfig = readFileSync(path.join(root, 'vercel.json'), 'utf8');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260824140203_sec20_plan_catalog_public_select_permissive.sql');
const migration = readFileSync(migrationPath, 'utf8');

test('SEC-20: workflow tem um schedule de cron definido', () => {
  assert.match(workflow, /schedule:\s*\n\s*-\s*cron:\s*"[^"]+"/);
});

test('SEC-20: cron roda no máximo 2x por semana e usa 0 9 * * 1,4', () => {
  const m = workflow.match(/cron:\s*"([^"]+)"/);
  assert.ok(m, 'deveria haver uma expressão cron');
  const fields = m[1].trim().split(/\s+/);
  assert.equal(fields.length, 5, 'expressão cron deve ter 5 campos');
  const dayOfWeek = fields[4];
  assert.notEqual(dayOfWeek, '*', 'dia da semana não pode ser *');
  const days = dayOfWeek.split(',');
  assert.ok(days.length <= 2, `esperado no máximo 2 dias por semana, achou ${days.length}`);
  assert.equal(m[1], '0 9 * * 1,4');
});

test('SEC-20: consulta o endpoint REST correto do Supabase via SUPABASE_URL', () => {
  assert.match(workflow, /\$\{SUPABASE_URL\}\/rest\/v1\/plan_catalog/);
});

test('SEC-20: usa plan_catalog', () => {
  assert.match(workflow, /plan_catalog/);
});

test('SEC-20: NÃO usa agents nem outras tabelas com dados de usuário', () => {
  assert.equal(/\/rest\/v1\/agents\b|\bagents\?select/.test(workflow), false);
  assert.equal(/\/rest\/v1\/(agent_knowledge|profiles|subscriptions|usage_counters|instagram_connections)\b/.test(workflow), false);
});

test('SEC-20: SERVICE_ROLE não aparece em nenhuma forma', () => {
  assert.equal(/SERVICE_ROLE/i.test(workflow), false);
});

test('SEC-20: usa SUPABASE_ANON_KEY', () => {
  assert.match(workflow, /SUPABASE_ANON_KEY/);
  assert.match(workflow, /secrets\.SUPABASE_ANON_KEY/);
});

test('SEC-20: vercel.json não tem crons nem referência ao endpoint antigo', () => {
  const parsed = JSON.parse(vercelConfig);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'crons'), false);
  assert.equal(vercelConfig.includes('supabase-keepalive'), false);
});

test('SEC-20: nenhuma função nova em api/ e contagem continua 11', () => {
  assert.equal(existsSync(path.join(root, 'api', 'cron', 'supabase-keepalive.js')), false);
  const files = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  assert.equal(files.length, 11, `esperado 11 funções em api/, achou ${files.length}`);
  assert.equal(files.some((f) => f.includes('cron')), false);
});

test('SEC-20: permissions é somente contents:read', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  const start = workflow.indexOf('permissions:');
  assert.equal(/\bwrite\b/i.test(workflow.slice(start, start + 80)), false);
});

test('SEC-20: curl tem timeout curto e explícito', () => {
  assert.match(workflow, /--connect-timeout\s+\d+/);
  assert.match(workflow, /--max-time\s+\d+/);
  const maxTime = Number(workflow.match(/--max-time\s+(\d+)/)[1]);
  assert.ok(maxTime <= 15, `--max-time deveria ser curto, achou ${maxTime}s`);
});

test('SEC-20: job também tem timeout-minutes', () => {
  assert.match(workflow, /timeout-minutes:\s*\d+/);
});

test('SEC-20: HTTP >= 400 falha e shell propaga a falha', () => {
  assert.match(workflow, /curl\s+--fail(-with-body)?\b/);
  assert.match(workflow, /set\s+-e/);
});

test('SEC-20: nenhuma credencial literal no workflow', () => {
  assert.equal(/eyJ[A-Za-z0-9_-]{10,}/.test(workflow), false);
  assert.equal(/sb_(publishable|secret)_[A-Za-z0-9_-]+/.test(workflow), false);
  assert.equal(/SUPABASE_URL:\s*['"]https?:\/\//.test(workflow), false);
});

test('SEC-20: nenhum outro mecanismo de keepalive equivalente no repositório', () => {
  const workflowsDir = path.join(root, '.github', 'workflows');
  const others = readdirSync(workflowsDir).filter((f) => f !== 'supabase-keepalive.yml');
  const suspicious = others.filter((f) => {
    const content = readFileSync(path.join(workflowsDir, f), 'utf8');
    return /supabase\.co\/rest|keepalive/i.test(content);
  });
  assert.deepEqual(suspicious, [], `outro workflow parece equivalente: ${suspicious.join(', ')}`);
});

test('SEC-20: migration torna a policy pública explicitamente permissive e somente SELECT', () => {
  assert.match(migration, /create\s+policy\s+plan_catalog_public_active_select/i);
  assert.match(migration, /as\s+permissive/i);
  assert.match(migration, /for\s+select/i);
  assert.match(migration, /to\s+anon\s*,\s*authenticated/i);
  assert.match(migration, /using\s*\(\s*active\s*=\s*true\s*\)/i);
  assert.equal(/insert|update|delete/i.test(migration.replace(/drop\s+policy/ig, '')), false);
});
