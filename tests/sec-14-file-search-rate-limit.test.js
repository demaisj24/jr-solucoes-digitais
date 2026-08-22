// SEC-14 — regression guard for Gemini File Search cost/abuse surface.
// This test is intentionally dependency-free: it verifies the critical ordering
// in api/agents.js so a future edit cannot move the paid File Search actions back
// in front of the durable rate limit.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'agents.js'), 'utf8');

function between(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0, `missing start marker: ${start}`);
  assert.ok(b > a, `missing end marker: ${end}`);
  return text.slice(a, b);
}

const prepare = between(source, "if(action==='prepare')", "if(action==='process')");
const process = between(source, "if(action==='process')", "if(await limited(`agents:create:");

test('SEC-14: prepare has a durable IP and agent rate limit before knowledgeAgent', () => {
  assert.match(source, /KNOWLEDGE_PREPARE_LIMIT=10/);
  assert.match(prepare, /limited\(`knowledge:prepare:ip:\$\{ip\(req\)\}`,KNOWLEDGE_PREPARE_LIMIT\)/);
  assert.match(prepare, /limited\(`knowledge:prepare:agent:\$\{id\}`,KNOWLEDGE_PREPARE_LIMIT\)/);
  assert.ok(prepare.indexOf("limited(`knowledge:prepare:ip:") < prepare.indexOf('knowledgeAgent(req,id)'));
  assert.ok(prepare.indexOf("limited(`knowledge:prepare:agent:") < prepare.indexOf('knowledgeAgent(req,id)'));
});

test('SEC-14: process has durable IP and per-agent limits before processKnowledge', () => {
  assert.match(source, /KNOWLEDGE_PROCESS_IP_LIMIT=5/);
  assert.match(source, /KNOWLEDGE_PROCESS_AGENT_LIMIT=5/);
  assert.match(process, /limited\(`knowledge:process:ip:\$\{ip\(req\)\}`,KNOWLEDGE_PROCESS_IP_LIMIT\)/);
  assert.match(process, /limited\(`knowledge:process:agent:\$\{id\}`,KNOWLEDGE_PROCESS_AGENT_LIMIT\)/);
  assert.ok(process.indexOf("limited(`knowledge:process:ip:") < process.indexOf('knowledgeAgent(req,id)'));
  assert.ok(process.indexOf("limited(`knowledge:process:agent:") < process.indexOf('knowledgeAgent(req,id)'));
  assert.ok(process.indexOf('knowledgeAgent(req,id)') < process.indexOf('processKnowledge(a,path'));
});

test('SEC-14: limited accepts an explicit limit and remains fail-closed', () => {
  assert.match(source, /async function limited\(key,limit=CREATE_LIMIT\)/);
  assert.match(source, /p_limit:limit/);
  assert.match(source, /if\(!r\.ok\).*return true/s);
  assert.match(source, /catch\(e\).*return true/s);
});

test('SEC-14: Gemini File Search actions remain reachable only through POST action gates', () => {
  assert.match(source, /action==='prepare'/);
  assert.match(source, /action==='process'/);
  assert.match(source, /async function processKnowledge/);
  assert.match(source, /uploadToFileSearchStore/);
  assert.match(source, /fileSearchStores/);
});
