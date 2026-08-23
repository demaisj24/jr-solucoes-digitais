// SEC-20 — testes estáticos do workflow de keepalive do Supabase Free
// (.github/workflows/supabase-keepalive.yml).
//
// Arquitetura oficial reconciliada: GitHub Actions (não Vercel Cron, não
// Serverless Function), 2x/semana, chave anônima do Supabase contra
// `plan_catalog` (única tabela com policy de SELECT para `anon`), nunca
// `agents`, nunca a service role.
//
// Sem parser YAML dedicado neste projeto (zero-dependência, sem
// package.json) — segue o mesmo padrão já usado em todo o resto da suíte:
// leitura do arquivo como texto + asserções por regex sobre a fonte real,
// nunca por interpretação estrutural de uma lib externa.
//
// Rodar com:
//   node --test tests/sec-20-supabase-keepalive.test.js

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

// ---------------------------------------------------------------------------
// 1/2. cron existe e é 2x/semana
// ---------------------------------------------------------------------------
test('SEC-20: workflow tem um schedule de cron definido', () => {
  assert.match(workflow, /schedule:\s*\n\s*-\s*cron:\s*"[^"]+"/);
});

test('SEC-20: cron roda no máximo 2x por semana (dia-da-semana com exatamente 2 valores, nunca "*")', () => {
  const m = workflow.match(/cron:\s*"([^"]+)"/);
  assert.ok(m, 'deveria haver uma expressão cron');
  const fields = m[1].trim().split(/\s+/);
  assert.equal(fields.length, 5, 'expressão cron deve ter 5 campos');
  const dayOfWeek = fields[4];
  assert.notEqual(dayOfWeek, '*', 'dia da semana não pode ser "*" (isso rodaria todo dia)');
  const days = dayOfWeek.split(',');
  assert.ok(days.length <= 2, `esperado no máximo 2 dias por semana, achou ${days.length} (${dayOfWeek})`);
  assert.equal(m[1], '0 9 * * 1,4', 'preferência explícita: "0 9 * * 1,4"');
});

// ---------------------------------------------------------------------------
// 3/4/5. endpoint correto, plan_catalog usada, agents NÃO usada
// ---------------------------------------------------------------------------
test('SEC-20: consulta o endpoint REST correto do Supabase via SUPABASE_URL', () => {
  assert.match(workflow, /\$\{SUPABASE_URL\}\/rest\/v1\/plan_catalog/);
});

test('SEC-20: usa plan_catalog', () => {
  assert.match(workflow, /plan_catalog/);
});

test('SEC-20: NÃO usa a tabela agents (nem qualquer outra tabela com dado de usuário)', () => {
  assert.equal(/\/rest\/v1\/agents\b|\bagents\?select/.test(workflow), false, 'não deveria consultar agents');
  assert.equal(/\/rest\/v1\/(agent_knowledge|profiles|subscriptions|usage_counters|instagram_connections)\b/.test(workflow), false,
    'não deveria consultar nenhuma outra tabela com dado de usuário');
});

// ---------------------------------------------------------------------------
// 6. service_role NÃO aparece
// ---------------------------------------------------------------------------
test('SEC-20: SERVICE_ROLE não aparece em nenhuma forma', () => {
  assert.equal(/SERVICE_ROLE/i.test(workflow), false);
});

test('SEC-20: usa SUPABASE_ANON_KEY, não uma variável de service role', () => {
  assert.match(workflow, /SUPABASE_ANON_KEY/);
  assert.match(workflow, /secrets\.SUPABASE_ANON_KEY/);
});

// ---------------------------------------------------------------------------
// 7/8. Vercel Cron NÃO aparece, nenhuma nova função em api/
// ---------------------------------------------------------------------------
test('SEC-20: vercel.json não tem crons nem referência ao endpoint antigo', () => {
  const parsed = JSON.parse(vercelConfig);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'crons'), false, 'vercel.json não deveria ter "crons"');
  assert.equal(vercelConfig.includes('supabase-keepalive'), false, 'vercel.json não deveria referenciar o endpoint antigo');
});

test('SEC-20: nenhuma função nova em api/ (api/cron/supabase-keepalive.js não existe, contagem de api/*.js inalterada)', () => {
  // Nota: api/cron/ pode existir como diretório vazio no filesystem local (git
  // não remove diretórios vazios após `git rm` do último arquivo dentro
  // dele) — isso é inofensivo e não afeta git nem Vercel. O que importa é que
  // nenhum ARQUIVO de função exista ali.
  assert.equal(existsSync(path.join(root, 'api', 'cron', 'supabase-keepalive.js')), false, 'api/cron/supabase-keepalive.js não deveria existir');
  const files = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  assert.equal(files.length, 11, `esperado 11 arquivos de função em api/ (mesma contagem de antes do SEC-20), achou ${files.length}`);
  assert.equal(files.some((f) => f.includes('cron')), false, 'nenhum arquivo de função deveria estar relacionado a cron');
});

// ---------------------------------------------------------------------------
// 9. permissions não concede write
// ---------------------------------------------------------------------------
test('SEC-20: permissions é somente contents:read, nenhuma permissão de escrita', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(/permissions:[\s\S]*?write/i.test(workflow.slice(workflow.indexOf('permissions:'), workflow.indexOf('permissions:') + 60)), false,
    'bloco permissions não deveria conceder nenhum "write"');
});

// ---------------------------------------------------------------------------
// 10. timeout existe
// ---------------------------------------------------------------------------
test('SEC-20: curl tem timeout curto e explícito', () => {
  assert.match(workflow, /--connect-timeout\s+\d+/);
  assert.match(workflow, /--max-time\s+\d+/);
  const maxTime = Number(workflow.match(/--max-time\s+(\d+)/)[1]);
  assert.ok(maxTime <= 15, `--max-time deveria ser curto, achou ${maxTime}s`);
});

test('SEC-20: job também tem timeout-minutes como rede de segurança adicional', () => {
  assert.match(workflow, /timeout-minutes:\s*\d+/);
});

// ---------------------------------------------------------------------------
// 11. falha HTTP não vira sucesso
// ---------------------------------------------------------------------------
test('SEC-20: curl falha explicitamente em HTTP >= 400 (--fail-with-body ou --fail) e o shell propaga a falha (set -e)', () => {
  assert.match(workflow, /curl\s+--fail(-with-body)?\b/);
  assert.match(workflow, /set\s+-e/);
});

// ---------------------------------------------------------------------------
// 12. nenhuma credencial literal presente
// ---------------------------------------------------------------------------
test('SEC-20: nenhuma credencial literal no workflow — só referências a secrets', () => {
  // Nenhum JWT literal (padrão eyJ...), nenhuma chave sb_publishable_/sb_secret_
  // literal, nenhuma URL de Supabase com credencial embutida.
  assert.equal(/eyJ[A-Za-z0-9_-]{10,}/.test(workflow), false, 'nenhum JWT literal deveria aparecer');
  assert.equal(/sb_(publishable|secret)_[A-Za-z0-9_-]+/.test(workflow), false, 'nenhuma chave Supabase literal deveria aparecer');
  // As únicas ocorrências de SUPABASE_URL/SUPABASE_ANON_KEY devem ser via
  // ${{ secrets.* }} ou referência de env var do shell (${VAR}), nunca um
  // valor literal atribuído diretamente.
  assert.equal(/SUPABASE_URL:\s*['"]https?:\/\//.test(workflow), false, 'SUPABASE_URL não deveria estar hardcoded no workflow');
});

test('SEC-20: nenhum outro mecanismo de keepalive/cron equivalente no repositório', () => {
  const workflowsDir = path.join(root, '.github', 'workflows');
  const others = readdirSync(workflowsDir).filter((f) => f !== 'supabase-keepalive.yml');
  const suspicious = others.filter((f) => {
    const content = readFileSync(path.join(workflowsDir, f), 'utf8');
    return /supabase\.co\/rest|keepalive/i.test(content);
  });
  assert.deepEqual(suspicious, [], `outro workflow parece fazer algo equivalente: ${suspicious.join(', ')}`);
});
