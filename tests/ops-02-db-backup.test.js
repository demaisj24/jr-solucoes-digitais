import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/supabase-db-backup.yml', import.meta.url), 'utf8');

test('OPS-02: backup usa connection string somente via GitHub Secret', () => {
  assert.match(workflow, /secrets\.SUPABASE_DB_URL/);
  assert.doesNotMatch(workflow, /postgres(?:ql)?:\/\/[^$\s]+@/i);
});

test('OPS-02: backup exige passphrase dedicada', () => {
  assert.match(workflow, /secrets\.BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(workflow, /must have at least 24 characters/);
});

test('OPS-02: dump é validado antes da criptografia', () => {
  const dump = workflow.indexOf('pg_dump');
  const validate = workflow.indexOf('pg_restore --list backup/vencivo.dump');
  const encrypt = workflow.indexOf('openssl enc -aes-256-cbc');
  assert.ok(dump >= 0 && validate > dump && encrypt > validate);
});

test('OPS-02: plaintext é removido antes do upload', () => {
  const remove = workflow.indexOf('rm -f backup/vencivo.dump');
  const upload = workflow.indexOf('actions/upload-artifact@v4');
  assert.ok(remove >= 0 && upload > remove);
  assert.match(workflow, /test ! -e backup\/vencivo\.dump/);
});

test('OPS-02: artifact contém somente backup criptografado e metadados', () => {
  assert.match(workflow, /backup\/vencivo\.dump\.enc/);
  assert.match(workflow, /backup\/vencivo\.dump\.enc\.sha256/);
  assert.match(workflow, /backup\/metadata\.json/);
  const uploadBlock = workflow.slice(workflow.indexOf('uses: actions/upload-artifact@v4'));
  assert.doesNotMatch(uploadBlock, /\n\s+backup\/vencivo\.dump\s*(?:\n|$)/);
});

test('OPS-02: workflow usa permissões mínimas', () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});
