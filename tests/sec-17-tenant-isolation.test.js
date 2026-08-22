import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../api/agents.js', import.meta.url), 'utf8');

test('SEC-17: knowledge management requires authenticated owner even for demo agents', () => {
  const marker = 'async function knowledgeAgent(req,id)';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'knowledgeAgent must exist');
  const end = source.indexOf('function fileExt', start);
  const fn = source.slice(start, end);

  assert.match(fn, /const u=await authUser\(req\)/);
  assert.match(
  fn,
  /if\(!u\?\.id(?:\|\|[^)]*)?\)/,
  'must reject unauthenticated knowledge management'
);
  assert.match(fn, /a\.owner_id!==u\.id/, 'must require owner match');
});

test('SEC-17: knowledge routes must not authorize access solely from demo status', () => {
  const marker = 'async function knowledgeAgent(req,id)';
  const start = source.indexOf(marker);
  const end = source.indexOf('function fileExt', start);
  const fn = source.slice(start, end);

  assert.doesNotMatch(
    fn,
    /if\(a\.status==='active'.*?owner_id!==u\.id\)/s,
    'authorization must not be conditional only on active status'
  );
});
