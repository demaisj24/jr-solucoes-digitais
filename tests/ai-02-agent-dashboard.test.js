import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const api = readFileSync(new URL('../api/agents.js', import.meta.url), 'utf8');
const pagePath = new URL('../meu-agente.html', import.meta.url);
const page = readFileSync(pagePath, 'utf8');

function listBlock(){
  const start=api.indexOf("if(action==='list')");
  assert.notEqual(start,-1,'action=list deve existir');
  return api.slice(start,start+1800);
}

test('AI-02: página de gestão existe',()=>{
  assert.equal(existsSync(pagePath),true);
  assert.match(page,/Meu agente/);
  assert.match(page,/action:'list'/);
});

test('AI-02: list exige agent_id e usa autorização do proprietário',()=>{
  const block=listBlock();
  assert.match(block,/const id=clean\(b\.agent_id,80\)/);
  assert.match(block,/Agente é obrigatório\./);
  assert.match(block,/const a=await knowledgeAgent\(req,id\)/);
});

test('AI-02: list consulta somente conhecimento do agente autorizado',()=>{
  const block=listBlock();
  assert.match(block,/agent_knowledge\?agent_id=eq\.\$\{encodeURIComponent\(a\.id\)\}/);
  assert.match(block,/limit=100/);
});

test('AI-02: list não seleciona nem devolve conteúdo dos documentos',()=>{
  const block=listBlock();
  const selectMatch=block.match(/select=([^&`]+)/);
  assert.ok(selectMatch);
  assert.equal(selectMatch[1].split(',').map(x=>x.trim()).includes('content'),false);
  assert.doesNotMatch(block,/content\s*:/);
});

test('AI-02: list retorna somente metadados necessários',()=>{
  const block=listBlock();
  for(const field of ['id','file_name','content_type','size_bytes','created_at']) assert.match(block,new RegExp(`\\b${field}\\b`));
  assert.match(block,/knowledge_ready:!!a\.knowledge_store_name/);
});

test('AI-02: página usa sessão Supabase e token Bearer para gestão',()=>{
  assert.match(page,/supabase\.auth\.getSession\(\)/);
  assert.match(page,/Authorization:'Bearer '\+token/);
  assert.match(page,/action:'prepare'/);
  assert.match(page,/action:'process'/);
});
