import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../api/webhooks/asaas.js', import.meta.url), 'utf8');

test('SEC-21B: webhook Asaas não persiste o body bruto', () => {
  assert.doesNotMatch(source, /payload\s*:\s*body/);
});

test('SEC-21B: billing_events mantém campos mínimos para idempotência e auditoria', () => {
  assert.match(source, /provider:'asaas'/);
  assert.match(source, /provider_event_id:eventId/);
  assert.match(source, /event_type:event/);
  assert.match(source, /provider_resource_id:clean\(/);
});

test('SEC-21B: payload completo ainda pode ser usado em memória para processar o evento', () => {
  assert.match(source, /const checkout=body\.checkout\|\|\{\}/);
  assert.match(source, /payment=body\.payment\|\|\{\}/);
  assert.match(source, /subscription=body\.subscription\|\|\{\}/);
});

test('SEC-21B: autenticação do webhook permanece obrigatória', () => {
  assert.match(source, /ASAAS_WEBHOOK_TOKEN/);
  assert.match(source, /received!==TOKEN/);
  assert.match(source, /return out\(res,401/);
});

test('SEC-21B: idempotência continua apoiada em billing_events', () => {
  assert.match(source, /sb\('billing_events'/);
  assert.match(source, /duplicate:true/);
});
