import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const agents = readFileSync(new URL('../api/agents.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260825202000_dr02_agent_knowledge_storage_source.sql', import.meta.url), 'utf8');

test('DR-02: schema registra caminho canônico e documento derivado do Gemini', () => {
  assert.match(migration, /storage_path\s+text/);
  assert.match(migration, /gemini_document_name\s+text/);
});

test('DR-02: processamento persiste referência da fonte canônica', () => {
  assert.match(agents, /storage_path:path/);
  assert.match(agents, /gemini_document_name:operation\.response\.documentName/);
});

test('DR-02: arquivo canônico não é apagado após indexação', () => {
  assert.equal(/storage\/v1\/object\/\$\{KNOWLEDGE_BUCKET\}\/\$\{path\}[^\n]*method:'DELETE'/.test(agents), false);
});

test('DR-02: listagem não expõe storage_path nem identificador interno Gemini', () => {
  const listBlock = agents.match(/if\(action==='list'\)[\s\S]*?if\(await limited\(`agents:create:/)?.[0] || '';
  assert.notEqual(listBlock, '');
  assert.equal(/storage_path|gemini_document_name/.test(listBlock), false);
});
