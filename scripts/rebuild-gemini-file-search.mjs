import { pathToFileURL } from 'node:url';

const MAX_DOCUMENTS = 100;
const MAX_BYTES = 50 * 1024 * 1024;
const POLL_LIMIT = 60;
const POLL_INTERVAL_MS = 1500;
const PLACEHOLDER = '[Documento indexado no Gemini File Search]';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function requireEnv(name) {
  const value = clean(process.env[name], 20000);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function supabaseHeaders(key, extra = {}) {
  const headers = { apikey: key, ...extra };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function readJson(response, label) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  return payload;
}

function objectUrl(baseUrl, bucket, storagePath) {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`;
}

async function loadSource(row, config) {
  if (row.storage_path) {
    if (!row.storage_path.startsWith(`${config.agentPublicId}/`)) {
      throw new Error(`Knowledge row ${row.id} has a storage_path outside its agent prefix.`);
    }
    const response = await fetch(objectUrl(config.supabaseUrl, config.bucket, row.storage_path), {
      headers: supabaseHeaders(config.supabaseKey)
    });
    if (!response.ok) throw new Error(`Canonical Storage object for knowledge row ${row.id} is unavailable.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error(`Knowledge row ${row.id} has invalid canonical size.`);
    return bytes;
  }

  const text = String(row.content ?? '');
  if (!text.trim() || text.trim() === PLACEHOLDER) {
    throw new Error(`Knowledge row ${row.id} has no recoverable canonical source.`);
  }
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > MAX_BYTES) throw new Error(`Knowledge row ${row.id} exceeds the rebuild limit.`);
  return bytes;
}

async function uploadDocument(storeName, row, bytes, config) {
  const mime = clean(row.content_type, 120) || 'text/plain';
  const displayName = clean(row.file_name, 160) || `knowledge-${row.id}.txt`;
  const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/${storeName}:uploadToFileSearchStore?key=${encodeURIComponent(config.geminiKey)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName,
      chunkingConfig: { whiteSpaceConfig: { maxTokensPerChunk: 300, maxOverlapTokens: 40 } },
      customMetadata: [
        { key: 'vencivo_agent_id', stringValue: config.agentPublicId },
        { key: 'vencivo_knowledge_id', stringValue: String(row.id) }
      ]
    })
  });
  if (!start.ok) throw new Error(`Gemini preparation failed for knowledge row ${row.id} with HTTP ${start.status}.`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error(`Gemini did not return an upload URL for knowledge row ${row.id}.`);

  const finish = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mime
    },
    body: bytes
  });
  let operation = await readJson(finish, `Gemini upload for knowledge row ${row.id}`);
  for (let attempt = 0; operation && !operation.done && attempt < POLL_LIMIT; attempt += 1) {
    if (!operation.name) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${encodeURIComponent(config.geminiKey)}`);
    operation = await readJson(status, `Gemini operation for knowledge row ${row.id}`);
  }
  if (operation?.error || !operation?.done || !operation?.response?.documentName) {
    throw new Error(`Gemini did not confirm rebuild for knowledge row ${row.id}.`);
  }
  return operation.response.documentName;
}

async function patchRow(config, table, filter, body) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: supabaseHeaders(config.supabaseKey, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Supabase update for ${table} failed with HTTP ${response.status}.`);
}

async function rebuild(config) {
  const agentResponse = await fetch(`${config.supabaseUrl}/rest/v1/agents?public_id=eq.${encodeURIComponent(config.agentPublicId)}&select=id,public_id,company_name,knowledge_store_name&limit=1`, {
    headers: supabaseHeaders(config.supabaseKey)
  });
  const agents = await readJson(agentResponse, 'Agent lookup');
  const agent = agents?.[0];
  if (!agent) throw new Error('Target agent was not found.');

  const knowledgeResponse = await fetch(`${config.supabaseUrl}/rest/v1/agent_knowledge?agent_id=eq.${encodeURIComponent(agent.id)}&select=id,file_name,content,content_type,size_bytes,storage_path,gemini_document_name&order=id.asc&limit=${MAX_DOCUMENTS + 1}`, {
    headers: supabaseHeaders(config.supabaseKey)
  });
  const rows = await readJson(knowledgeResponse, 'Knowledge inventory');
  if (!rows?.length) throw new Error('Target agent has no knowledge to rebuild.');
  if (rows.length > MAX_DOCUMENTS) throw new Error(`Target agent exceeds the ${MAX_DOCUMENTS}-document rebuild limit.`);

  const sources = [];
  for (const row of rows) sources.push({ row, bytes: await loadSource(row, config) });
  console.log(JSON.stringify({ event: 'GEMINI_REBUILD_PLAN_OK', agent_public_id: config.agentPublicId, documents: sources.length, mode: config.mode }));
  if (config.mode === 'plan') return { planned: sources.length };
  if (config.confirmation !== 'REBUILD-GEMINI-FILE-SEARCH') throw new Error('Confirmation phrase rejected.');

  const create = await fetch(`https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${encodeURIComponent(config.geminiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: `VENCIVO DR · ${clean(agent.company_name, 80)} · ${config.agentPublicId}`,
      embeddingModel: 'models/gemini-embedding-2'
    })
  });
  const store = await readJson(create, 'Gemini store creation');
  if (!store?.name) throw new Error('Gemini store creation returned no resource name.');

  const rebuilt = [];
  for (const source of sources) {
    const documentName = await uploadDocument(store.name, source.row, source.bytes, config);
    rebuilt.push({ id: source.row.id, documentName });
  }

  for (const item of rebuilt) {
    await patchRow(config, 'agent_knowledge', `id=eq.${encodeURIComponent(item.id)}`, { gemini_document_name: item.documentName });
  }
  await patchRow(config, 'agents', `id=eq.${encodeURIComponent(agent.id)}`, { knowledge_store_name: store.name });
  console.log(JSON.stringify({ event: 'GEMINI_REBUILD_PASS', agent_public_id: config.agentPublicId, documents: rebuilt.length, new_store: store.name, old_store_preserved: Boolean(agent.knowledge_store_name) }));
  return { rebuilt: rebuilt.length, store: store.name };
}

async function main() {
  const mode = clean(process.env.REBUILD_MODE, 20) || 'plan';
  if (!['plan', 'apply'].includes(mode)) throw new Error('REBUILD_MODE must be plan or apply.');
  const agentPublicId = requireEnv('AGENT_PUBLIC_ID');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(agentPublicId)) throw new Error('AGENT_PUBLIC_ID format is invalid.');
  const config = {
    mode,
    confirmation: clean(process.env.REBUILD_CONFIRMATION, 100),
    agentPublicId,
    supabaseUrl: requireEnv('SUPABASE_URL').replace(/\/+$/, ''),
    supabaseKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    geminiKey: mode === 'apply' ? requireEnv('GEMINI_API_KEY') : clean(process.env.GEMINI_API_KEY, 20000),
    bucket: clean(process.env.KNOWLEDGE_BUCKET, 100) || 'vencivo-knowledge'
  };
  await rebuild(config);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main().catch((error) => {
  console.error(JSON.stringify({ event: 'GEMINI_REBUILD_FAILED', error: error.message }));
  process.exitCode = 1;
});

export { clean, objectUrl, supabaseHeaders, loadSource, rebuild };
