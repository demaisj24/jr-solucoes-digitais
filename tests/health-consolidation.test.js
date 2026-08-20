// INFRA-01 — Testes da consolidação de api/health.js em rewrite estático.
//
// Usa o test runner nativo do Node (node:test), mesmo padrão do INST-04.
// Rodar com:
//   node --test tests/health-consolidation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('api/health.js foi removido (deixa de contar como Serverless Function)', () => {
  assert.equal(existsSync(path.join(root, 'api', 'health.js')), false);
});

test('health.json existe na raiz e preserva exatamente o contrato antigo de /api/health', () => {
  const filePath = path.join(root, 'health.json');
  assert.equal(existsSync(filePath), true);
  const body = JSON.parse(readFileSync(filePath, 'utf8'));
  assert.deepEqual(body, {
    ok: true,
    service: 'vencivo-ai',
    model: 'gemini-3.1-flash-lite',
  });
});

test('vercel.json reescreve /api/health para /health.json', () => {
  const cfg = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(Array.isArray(cfg.rewrites), 'vercel.json deve ter um array "rewrites"');
  const rule = cfg.rewrites.find((r) => r.source === '/api/health');
  assert.ok(rule, 'deve existir uma regra de rewrite para /api/health');
  assert.equal(rule.destination, '/health.json');
});

test('vercel.json continua válido e não perdeu o bloco "functions" existente', () => {
  const cfg = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(cfg.functions);
  assert.ok(cfg.functions['api/webhooks/asaas.js']);
  assert.ok(cfg.functions['api/agents.js']);
});

test('api/deployment-status.js não foi alterado nesta tarefa', () => {
  // INFRA-01 proíbe alterar o endpoint usado pelo WhatsApp e pela implantação.
  const filePath = path.join(root, 'api', 'deployment-status.js');
  assert.equal(existsSync(filePath), true);
  const content = readFileSync(filePath, 'utf8');
  // Confere que o contrato de resposta que os 3 consumidores dependem
  // ({active, whatsapp_status, status} / {error}) continua presente.
  assert.match(content, /active:paid/);
  assert.match(content, /whatsapp_status:a\[0\]\.whatsapp_status/);
  assert.match(content, /status:a\[0\]\.status/);
});

test('contagem de arquivos de função em api/ cai para 11 (abaixo do limite de 12 do plano Hobby)', () => {
  const out = execSync('git ls-files "api/*.js" "api/**/*.js"', { cwd: root }).toString().trim();
  const files = out.split('\n').filter(Boolean);
  assert.equal(files.length, 11, `esperado 11 arquivos, encontrado ${files.length}: ${files.join(', ')}`);
  assert.ok(!files.includes('api/health.js'));
});

test('as 3 páginas que consomem /api/deployment-status continuam intactas', () => {
  const diff = execSync(
    'git diff main -- whatsapp-config.html whatsapp-config-v2.html implantacao.html',
    { cwd: root }
  ).toString();
  assert.equal(diff.trim(), '', 'nenhuma dessas páginas deveria ter diff contra main');
});
