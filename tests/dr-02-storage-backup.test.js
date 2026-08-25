import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/supabase-storage-backup.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/backup-supabase-storage.mjs', import.meta.url), 'utf8');

test('DR-02 Storage: workflow é manual-only até restore real de objeto', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(/\bschedule\s*:/.test(workflow), false);
});

test('DR-02 Storage: usa secrets existentes e bucket privado conhecido', () => {
  assert.match(workflow, /secrets\.SUPABASE_URL/);
  assert.match(workflow, /secrets\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /secrets\.BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(workflow, /STORAGE_BUCKET:\s*vencivo-knowledge/);
});

test('DR-02 Storage: exporta por API autenticada sem publicar objeto', () => {
  assert.match(script, /storage\/v1\/object\/list/);
  assert.match(script, /storage\/v1\/object\/authenticated/);
  assert.equal(/storage\/v1\/object\/public/.test(script), false);
});

test('DR-02 Storage: bundle é AES256 e plaintext é removido antes do artifact', () => {
  assert.match(workflow, /--symmetric --cipher-algo AES256/);
  const remove = workflow.indexOf('rm -rf storage-backup/plain storage-backup/vencivo-storage.tar.gz');
  const upload = workflow.indexOf('uses: actions/upload-artifact@');
  assert.ok(remove >= 0 && upload > remove);
});

test('DR-02 Storage: artifact contém criptografado, checksum e manifesto, com retenção 30 dias', () => {
  assert.match(workflow, /vencivo-storage\.tar\.gz\.gpg/);
  assert.match(workflow, /vencivo-storage\.tar\.gz\.gpg\.sha256/);
  assert.match(workflow, /storage-backup\/manifest\.json/);
  assert.match(workflow, /retention-days:\s*30/);
});
