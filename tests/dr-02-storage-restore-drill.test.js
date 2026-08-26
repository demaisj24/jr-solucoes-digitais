import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const seed = readFileSync(new URL('../.github/workflows/supabase-storage-dr-seed.yml', import.meta.url), 'utf8');
const restore = readFileSync(new URL('../.github/workflows/supabase-storage-restore-drill.yml', import.meta.url), 'utf8');

test('DR-02 restore: seed exige confirmação explícita e usa caminho isolado de teste', () => {
  assert.match(seed, /SEED-STORAGE-DR-TEST/);
  assert.match(seed, /__dr_test__\/vencivo-storage-restore-sentinel\.txt/);
});

test('DR-02 restore: alvo usa secrets separados do projeto de produção', () => {
  assert.match(restore, /SUPABASE_RESTORE_URL/);
  assert.match(restore, /SUPABASE_RESTORE_SERVICE_ROLE_KEY/);
  assert.match(restore, /test "\$PROD_URL" != "\$RESTORE_URL"/);
});

test('DR-02 restore: aceita sb_secret via apikey sem tentar usa-la como JWT Bearer', () => {
  assert.match(restore, /restore_headers=\(-H "apikey: \$\{RESTORE_KEY\}"\)/);
  assert.match(restore, /if \[\[ "\$RESTORE_KEY" != sb_secret_\* \]\]; then/);
  assert.match(restore, /restore_headers\+=\(-H "Authorization: Bearer \$\{RESTORE_KEY\}"\)/);
  assert.match(restore, /"\$\{restore_headers\[@\]\}"/);
});

test('DR-02 restore: backup sem sentinel não pode ser contado como prova', () => {
  assert.match(restore, /DR sentinel is absent from this backup/);
  assert.match(restore, /grep -qx 'VENCIVO STORAGE DR SENTINEL v1'/);
});

test('DR-02 restore: valida bytes restaurados e limpa sentinels', () => {
  assert.match(restore, /\bcmp\b/);
  assert.match(restore, /Cleanup DR sentinels and plaintext/);
  assert.match(restore, /DELETE/);
  assert.match(restore, /if \[\[ "\$key" != sb_secret_\* \]\]; then/);
});
