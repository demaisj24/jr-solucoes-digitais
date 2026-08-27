import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { objectUrl, supabaseHeaders } from '../scripts/rebuild-gemini-file-search.mjs';

const script = readFileSync(new URL('../scripts/rebuild-gemini-file-search.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/gemini-file-search-rebuild.yml', import.meta.url), 'utf8');

test('DR-02 Gemini: Storage path is encoded by segment and remains private', () => {
  assert.equal(objectUrl('https://project.supabase.co', 'vencivo-knowledge', 'agent/a b.pdf'), 'https://project.supabase.co/storage/v1/object/authenticated/vencivo-knowledge/agent/a%20b.pdf');
});

test('DR-02 Gemini: modern secret key is never sent as Bearer JWT', () => {
  const modern = supabaseHeaders('sb_secret_example');
  assert.equal(modern.apikey, 'sb_secret_example');
  assert.equal(modern.Authorization, undefined);
  assert.equal(supabaseHeaders('eyJlegacy').Authorization, 'Bearer eyJlegacy');
});

test('DR-02 Gemini: workflow is manual, bounded to one agent and serialized per agent', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /agent_public_id:/);
  assert.match(workflow, /group: gemini-file-search-rebuild-\$\{\{ inputs\.agent_public_id \}\}/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(script, /\^\[a-zA-Z0-9_-\]\{1,80\}\$/);
});

test('DR-02 Gemini: apply requires explicit confirmation and plan is default', () => {
  assert.match(workflow, /default: plan/);
  assert.match(workflow, /REBUILD-GEMINI-FILE-SEARCH/);
  assert.match(script, /config\.mode === 'plan'/);
});

test('DR-02 Gemini: agent pointer changes only after all uploads and document updates', () => {
  const uploadLoop = script.indexOf('for (const source of sources)');
  const documentLoop = script.indexOf('for (const item of rebuilt)');
  const agentPatch = script.indexOf("await patchRow(config, 'agents'");
  assert.ok(uploadLoop > 0 && documentLoop > uploadLoop && agentPatch > documentLoop);
});

test('DR-02 Gemini: old store is preserved and rebuild has a hard document cap', () => {
  assert.match(script, /old_store_preserved/);
  assert.doesNotMatch(script, /method:\s*'DELETE'/);
  assert.match(script, /MAX_DOCUMENTS = 100/);
});
