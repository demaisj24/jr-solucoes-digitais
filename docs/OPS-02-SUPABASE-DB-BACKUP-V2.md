# OPS-02 — Backup diário criptografado do banco Supabase

Status: **PREPARADO, NÃO ATIVADO**.

Este documento descreve a segunda versão do desenho de backup do PostgreSQL do VENCIVO. O workflow só deve entrar em produção depois que os dois GitHub Secrets necessários existirem e um primeiro backup/restore for validado.

## 1. Por que a versão anterior foi substituída

A primeira proposta usava `pg_dump` bruto instalado no runner e criptografia `openssl enc -aes-256-cbc`.

A revisão encontrou três problemas:

1. o banco de produção está em PostgreSQL **17.6** e o cliente padrão do runner pode não acompanhar a versão do servidor;
2. o próprio Supabase recomenda `supabase db dump`, porque aplica filtros específicos e evita incluir internals que geram erros de permissão no restore;
3. a agenda de 2x/semana não atendia ao RPO inicial de até 24 horas.

A v2 usa a Supabase CLI fixada em `2.115.0`, backup diário e GPG/AES-256.

## 2. Workflow

Arquivo:

`.github/workflows/supabase-db-backup.yml`

Agenda preparada:

- todos os dias às 04:15 UTC;
- também pode ser disparado manualmente por `workflow_dispatch`.

Enquanto a PR estiver em draft, nada é executado em produção.

## 3. Secrets obrigatórios

Nunca registrar os valores em documentação, issue, commit ou chat.

### `SUPABASE_DB_URL`

Connection string PostgreSQL do projeto de produção.

Usar preferencialmente a **Session Pooler** indicada pelo painel Supabase para operações de dump/restore quando apropriado.

Requisitos:

- tratar como segredo;
- deve apontar para `uxmlmyhiagjefuufanyg`;
- não reutilizar a URL em frontend;
- atualizar o secret se a senha do banco for rotacionada.

### `BACKUP_ENCRYPTION_PASSPHRASE`

Senha exclusiva para criptografia dos backups.

Requisitos:

- pelo menos 32 caracteres;
- idealmente aleatória e longa;
- não reutilizar senha pessoal;
- guardar cópia em gerenciador de senhas fora do GitHub;
- perder essa passphrase significa perder a capacidade de descriptografar os backups.

## 4. Conteúdo do backup

O workflow gera, via `supabase db dump`:

- `roles.sql` — roles exportáveis;
- `schema.sql` — schema da aplicação;
- `data.sql` — dados;
- `history_schema.sql` — schema de `supabase_migrations`;
- `history_data.sql` — histórico de migrations;
- `metadata.json` — data, versão da CLI e commit de origem.

O dump de dados exclui `storage.buckets_vectors` e `storage.vector_indexes`, conforme orientação atual da documentação de backup/restore do Supabase.

A CLI é fixada em **2.115.0** para que o comportamento do backup não mude silenciosamente entre execuções.

## 5. Criptografia

Os arquivos são empacotados e criptografados com GPG simétrico:

- AES-256;
- passphrase lida via stdin;
- plaintext removido antes do upload;
- checksum SHA-256 calculado sobre o arquivo criptografado.

Artifact final:

- `vencivo-backup.tar.gz.gpg`;
- `vencivo-backup.tar.gz.gpg.sha256`;
- `metadata.json`.

Nenhum SQL em claro deve fazer parte do artifact.

## 6. Retenção

A primeira camada usa GitHub Actions Artifact com retenção de **30 dias**.

Isso é uma camada temporária e útil, mas **não é o destino off-site final**, porque código e artifact continuam no ecossistema GitHub.

Destino off-site inicial já reservado:

- pasta privada `VENCIVO - Backups` no Google Drive do proprietário.

A automação GitHub → Drive não será criada antes de validarmos manualmente um backup real e seu restore.

## 7. Descriptografia

Somente em máquina/ambiente confiável:

```bash
printf '%s\n' "$BACKUP_ENCRYPTION_PASSPHRASE" | \
  gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --output vencivo-backup.tar.gz \
    --decrypt vencivo-backup.tar.gz.gpg

tar -xzf vencivo-backup.tar.gz -C restore/
```

Antes da descriptografia:

```bash
sha256sum -c vencivo-backup.tar.gz.gpg.sha256
```

## 8. Restore planejado

O restore deve ser feito **somente em ambiente separado**, nunca diretamente sobre produção durante o teste.

Fluxo-base oficial do Supabase:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

Depois, preservar/validar o histórico de migrations usando `history_schema.sql` e `history_data.sql` conforme a orientação de restore do Supabase.

## 9. O que validar no restore

- tabelas públicas presentes;
- `auth.users` preservado conforme o dump produzido pela CLI;
- relações `auth.users` ↔ `profiles`;
- constraints e índices;
- RLS/policies;
- funções, triggers e RPCs;
- contagens básicas contra o baseline do inventário de DR;
- `plan_catalog` acessível somente conforme a policy prevista;
- aplicação de teste consegue autenticar e executar fluxos básicos;
- migration history disponível;
- nenhuma credencial antiga reaproveitada indevidamente.

## 10. Storage

Este workflow protege o PostgreSQL, **não os bytes dos objetos do Supabase Storage**.

No checkpoint de 24/08/2026, o bucket privado `vencivo-knowledge` tinha 0 objetos/0 bytes. Storage continua sendo um gate separado e deve ser reavaliado sempre que surgirem arquivos persistentes.

## 11. Gate antes do merge

Não integrar a rotina agendada enquanto não houver:

1. `SUPABASE_DB_URL` configurado como GitHub Secret;
2. `BACKUP_ENCRYPTION_PASSPHRASE` configurado como GitHub Secret e guardado fora do GitHub;
3. revisão final do workflow;
4. primeiro run manual verde;
5. artifact contendo apenas conteúdo criptografado;
6. restore real em ambiente separado planejado/executado.

## 12. Regra de continuidade

**Gerar artifact não prova recuperação. OPS-02 só será considerado concluído após um restore real bem-sucedido.**
