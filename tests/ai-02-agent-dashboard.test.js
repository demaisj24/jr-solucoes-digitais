import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../api/agents.js', import.meta.url), 'utf8');

test('AI-02: action=list existe no endpoint de agentes', () => {
  assert.match(source, /if\(action==='list'\)/);
});

test('AI-02: list exige agent_id', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);
  assert.match(block, /const id=clean\(b\.agent_id,80\)/);
  assert.match(block, /if\(!id\)/);
});

test('AI-02: list usa knowledgeAgent para autorização', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);
  assert.match(block, /const a=await knowledgeAgent\(req,id\)/);
});

test('AI-02: list consulta somente o agent_id autorizado', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);

  assert.match(
    block,
    /agent_knowledge\?agent_id=eq\.\$\{encodeURIComponent\(a\.id\)\}/
  );
});

test('AI-02: list não retorna conteúdo dos documentos', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);

  const selectMatch = block.match(/select=([^&`]+)/);
  assert.ok(selectMatch, 'consulta de documentos deve possuir select explícito');

  assert.equal(
    selectMatch[1].split(',').map((x) => x.trim()).includes('content'),
    false,
    'list não pode selecionar content'
  );

  assert.doesNotMatch(
    block,
    /content\s*:/,
    'list não deve devolver campo content'
  );
});

test('AI-02: list retorna apenas metadados esperados', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);

  for (const field of [
    'id',
    'file_name',
    'content_type',
    'size_bytes',
    'created_at',
  ]) {
    assert.match(
      block,
      new RegExp(`\\b${field}\\b`),
      `campo ${field} deve fazer parte dos metadados`
    );
  }
});

test('AI-02: list informa knowledge_ready sem expor a base inteira', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);

  assert.match(block, /knowledge_ready:!!a\.knowledge_store_name/);
  assert.match(block, /documents/);
});

test('AI-02: list usa limite de documentos', () => {
  const start = source.indexOf("if(action==='list')");
  assert.notEqual(start, -1);

  const block = source.slice(start, start + 1800);

  assert.match(block, /limit=100/);
});
