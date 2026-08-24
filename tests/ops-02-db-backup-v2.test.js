import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/supabase-db-backup.yml', import.meta.url), 'utf8');

test('OPS-02 v2: backup é diário para RPO de até 24h', () => {
  assert.match(workflow, /cron:\s*"15 4 \* \* \*"/);
});

test('OPS-02 v2: usa Supabase CLI fixada em 2.115.0, nunca latest', () => {
  assert.match(workflow, /supabase@2\.115\.0/);
  assert.equal(/supabase@latest/.test(workflow), false);
});

test('OPS-02 v2: usa connection string somente via GitHub Secret', () => {
  assert.match(workflow, /secrets\.SUPABASE_DB_URL/);
  assert.equal(/postgres(?:ql)?:\/\/[^$\s]+@/i.test(workflow), false);
});

test('OPS-02 v2: exige passphrase dedicada de pelo menos 32 caracteres', () => {
  assert.match(workflow, /secrets\.BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(workflow, /at least 32 characters/);
});

test('OPS-02 v2: exporta roles, schema e data com supabase db dump', () => {
  assert.match(workflow, /db dump[^\n]+roles\.sql --role-only/);
  assert.match(workflow, /db dump[^\n]+schema\.sql/);
  assert.match(workflow, /db dump[^\n]+data\.sql --use-copy --data-only/);
});

test('OPS-02 v2: preserva histórico de migrations em dumps separados', () => {
  assert.match(workflow, /history_schema\.sql --schema supabase_migrations/);
  assert.match(workflow, /history_data\.sql --use-copy --data-only --schema supabase_migrations/);
});

test('OPS-02 v2: exclui tabelas vetoriais de Storage recomendadas pela documentação', () => {
  assert.match(workflow, /-x "storage\.buckets_vectors"/);
  assert.match(workflow, /-x "storage\.vector_indexes"/);
});

test('OPS-02 v2: criptografa com GPG AES256 e passphrase via stdin', () => {
  assert.match(workflow, /gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0/);
  assert.match(workflow, /--symmetric --cipher-algo AES256/);
  assert.equal(/openssl enc -aes-256-cbc/.test(workflow), false);
});

test('OPS-02 v2: plaintext é removido antes do upload', () => {
  const remove = workflow.indexOf('rm -rf backup/plain backup/vencivo-backup.tar.gz');
  const upload = workflow.indexOf('uses: actions/upload-artifact@v4');
  assert.ok(remove >= 0 && upload > remove);
  assert.match(workflow, /test ! -e backup\/vencivo-backup\.tar\.gz/);
});

test('OPS-02 v2: artifact só leva bundle criptografado, checksum e metadata', () => {
  const block = workflow.slice(workflow.indexOf('uses: actions/upload-artifact@v4'));
  assert.match(block, /backup\/vencivo-backup\.tar\.gz\.gpg/);
  assert.match(block, /backup\/vencivo-backup\.tar\.gz\.gpg\.sha256/);
  assert.match(block, /backup\/metadata\.json/);
  assert.equal(/\n\s+backup\/vencivo-backup\.tar\.gz\s*(?:\n|$)/.test(block), false);
  assert.equal(/backup\/plain\//.test(block), false);
});

test('OPS-02 v2: retenção temporária do artifact é 30 dias', () => {
  assert.match(workflow, /retention-days:\s*30/);
});

test('OPS-02 v2: não permite jobs concorrentes do mesmo backup', () => {
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /group:\s*vencivo-supabase-db-backup/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
});

test('OPS-02 v2: permissions não concede write', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(/permissions:[\s\S]{0,100}\bwrite\b/i.test(workflow), false);
});

test('OPS-02 v2: não usa service role/API key para dump', () => {
  assert.equal(/SERVICE_ROLE|sb_secret_|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY/i.test(workflow), false);
});
