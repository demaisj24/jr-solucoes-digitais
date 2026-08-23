import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../api/agent-chat.js', import.meta.url), 'utf8');

test('SEC-18: public chat must not expose retrieved knowledge text or store identifiers', () => {
  assert.match(source, /knowledgeGrounding/);
  assert.doesNotMatch(
    source,
    /sources\.push\(\{[^}]*text:/s,
    'public response must not include retrieved document text'
  );
  assert.doesNotMatch(
    source,
    /sources\.push\(\{[^}]*store:/s,
    'public response must not include internal File Search store identifiers'
  );
});

test('SEC-18: chat may report grounding metadata without document content', () => {
  const marker = 'knowledgeGrounding:';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'knowledgeGrounding metadata must remain available');
  const tail = source.slice(start, start + 180);
  assert.match(tail, /used:chunks\.length>0/);
  assert.match(tail, /chunks:chunks\.length/);
});
