import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const bucket = String(process.env.STORAGE_BUCKET || 'vencivo-knowledge');
const out = String(process.env.STORAGE_BACKUP_DIR || 'storage-backup/plain');

if (!base || !key) throw new Error('Supabase Storage backup credentials are missing.');
if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(bucket)) throw new Error('Invalid bucket name.');

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function list(prefix = '') {
  const items = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const r = await fetch(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } })
    });
    if (!r.ok) throw new Error(`Storage list failed (${r.status}).`);
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error('Unexpected Storage list response.');
    items.push(...page);
    if (page.length < limit) break;
    offset += page.length;
  }
  return items;
}

async function walk(prefix = '') {
  const result = [];
  for (const item of await list(prefix)) {
    const name = String(item?.name || '');
    if (!name || name === '.emptyFolderPlaceholder') continue;
    const path = prefix ? `${prefix}/${name}` : name;
    const isFolder = !item?.id && !item?.metadata;
    if (isFolder) result.push(...await walk(path));
    else result.push({ path, id: item?.id || null, metadata: item?.metadata || null, created_at: item?.created_at || null, updated_at: item?.updated_at || null });
  }
  return result;
}

const objects = await walk('');
let totalBytes = 0;
for (const object of objects) {
  const encodedPath = object.path.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`${base}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!r.ok) throw new Error(`Storage download failed for ${object.path} (${r.status}).`);
  const bytes = Buffer.from(await r.arrayBuffer());
  totalBytes += bytes.length;
  const dest = join(out, 'objects', ...object.path.split('/'));
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  object.backup_size_bytes = bytes.length;
}

await mkdir(out, { recursive: true });
const manifest = {
  version: 1,
  created_at: new Date().toISOString(),
  bucket,
  object_count: objects.length,
  total_bytes: totalBytes,
  objects
};
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ bucket, object_count: objects.length, total_bytes: totalBytes }));
