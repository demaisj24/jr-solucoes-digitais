import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/data-retention.yml', import.meta.url), 'utf8');

test('SEC-21C: retention uses existing Supabase secrets', () => {
  assert.match(workflow, /secrets\.SUPABASE_URL/);
  assert.match(workflow, /secrets\.SUPABASE_SERVICE_ROLE_KEY/);
});

test('SEC-21C: retention removes only old rate_limit_buckets', () => {
  assert.match(workflow, /rate_limit_buckets\?updated_at=lt\.\$\{cutoff\}/);
  assert.match(workflow, /48 hours ago/);
  assert.doesNotMatch(workflow, /\/rest\/v1\/(agents|profiles|subscriptions|agent_knowledge)\?/);
});

test('SEC-21C: retention is a DELETE with minimal response', () => {
  assert.match(workflow, /-X DELETE/);
  assert.match(workflow, /Prefer: return=minimal/);
});

test('SEC-21C: workflow has minimal repository permission', () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});

test('SEC-21C: retention runs daily and can be triggered manually', () => {
  assert.match(workflow, /cron: "40 3 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
});
