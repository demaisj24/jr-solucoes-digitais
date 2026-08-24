# OPS-02 — Backup criptografado do banco Supabase

Status: **BOOTSTRAP MANUAL PREPARADO — AINDA SEM BACKUP REAL**.

Este documento descreve a segunda versão do desenho de backup do PostgreSQL do VENCIVO. A implementação foi dividida em duas etapas para evitar ativar um cron antes de provar que o backup realmente pode ser restaurado.

## 1. Estratégia em duas etapas

### Etapa A — bootstrap manual

O workflow entra na `main` apenas com `workflow_dispatch`, sem `schedule`.

Depois que os dois GitHub Secrets forem configurados, executamos uma vez manualmente, validamos o artifact criptografado e fazemos um restore em ambiente separado.

### Etapa B — automação diária

Somente depois do restore real aprovado será aberta uma segunda mudança adicionando:

```yaml
schedule:
  - cron: "15 4 * * *"
```

Essa agenda diária atende ao RPO inicial de até 24 horas.

## 2. Por que a versão anterior foi substituída

A primeira proposta usava `pg_dump` bruto instalado no runner e criptografia `openssl enc -aes-256-cbc`.

A revisão encontrou quatro problemas:

1. o banco de produção está em PostgreSQL **17.6** e o cliente padrão do runner pode não acompanhar a versão do servidor;
2. o Supabase recomenda `supabase db dump`, que aplica filtros específicos e evita incluir internals/reserved roles que podem gerar erros no restore;
3. a agenda de 2x/semana não atendia ao RPO inicial de até 24 horas;
4. um workflow novo não deve ser agendado antes de existir na branch padrão e ter passado por um primeiro teste manual com credenciais reais.

A v2 usa Supabase CLI fixada em `2.115.0`, GPG/AES-256 e ativação em duas etapas.

## 3. Workflow de bootstrap

Arquivo:

`.github/workflows/supabase-db-backup.yml`

No bootstrap:

- somente execução manual via `workflow_dispatch`;
- nenhuma execução automática;
- permissões `contents: read`;
- concurrency impede duas cópias simultâneas;
- timeout total de 30 minutos.

Isso permite versionar e revisar o mecanismo sem criar execuções agendadas quebradas enquanto os Secrets ainda não existem.

## 4. Secrets obrigatórios

Nunca registrar os valores em documentação, issue, commit ou chat.

### `SUPABASE_DB_URL`

Connection string PostgreSQL do projeto de produção.

Usar preferencialmente a **Session Pooler** indicada pelo painel Supabase para operações de dump/restore quando apropriado.

Requisitos:

- tratar como segredo;
- deve apontar para `uxmlmyhiagjefuufanyg`;
- não reutilizar no frontend;
- atualizar o secret se a senha do banco for rotacionada.

### `BACKUP_ENCRYPTION_PASSPHRASE`

Senha exclusiva para criptografia dos backups.

Requisitos:

- pelo menos 32 caracteres;
- idealmente aleatória e longa;
- não reutilizar senha pessoal;
- guardar uma cópia em gerenciador de senhas seguro fora do GitHub;
- perder essa passphrase significa perder a capacidade de descriptografar os backups.

## 5. Conteúdo do backup

O workflow gera, via `supabase db dump`:

- `roles.sql` — roles exportáveis;
- `schema.sql` — schema da aplicação;
- `data.sql` — dados;
- `history_schema.sql` — schema de `supabase_migrations`;
- `history_data.sql` — histórico de migrations;
- `metadata.json` — data, versão da CLI e commit de origem.

O dump de dados exclui `storage.buckets_vectors` e `storage.vector_indexes`, conforme orientação atual de backup/restore do Supabase.

A CLI é fixada em **2.115.0** para o comportamento não mudar silenciosamente entre execuções.

## 6. Criptografia

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

## 7. Retenção e segundo destino

A primeira camada usa GitHub Actions Artifact com retenção de **30 dias**.

Isso é temporário: código e artifact continuam no ecossistema GitHub.

Destino off-site inicial já reservado:

- pasta privada `VENCIVO - Backups` no Google Drive do proprietário.

A automação GitHub → Drive só será considerada depois do primeiro backup e restore validados. Até lá, não adicionaremos credenciais extras do Google ao CI.

## 8. Descriptografia

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

## 9. Restore planejado

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

Depois, preservar/validar o histórico de migrations usando `history_schema.sql` e `history_data.sql`.

## 10. O que validar no restore

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

## 11. Storage

Este workflow protege o PostgreSQL, **não os bytes dos objetos do Supabase Storage**.

No checkpoint de 24/08/2026, o bucket privado `vencivo-knowledge` tinha 0 objetos/0 bytes. Storage continua sendo gate separado e deve ser reavaliado quando surgirem objetos persistentes.

## 12. Gate de ativação

### Para integrar o bootstrap manual

Pode ser integrado sem os Secrets porque não existe cron e nenhuma execução é automática.

### Para executar o primeiro backup

Obrigatório:

1. criar `SUPABASE_DB_URL` como GitHub Secret;
2. criar `BACKUP_ENCRYPTION_PASSPHRASE` como GitHub Secret e guardar cópia fora do GitHub;
3. disparar o workflow manualmente;
4. confirmar run verde e artifact presente;
5. verificar que o artifact não contém SQL em claro.

### Para habilitar o cron diário

Obrigatório antes:

1. validar checksum;
2. descriptografar o artifact em ambiente confiável;
3. restaurar em ambiente separado;
4. confirmar Auth, schema, RLS, funções, dados e migration history;
5. registrar o resultado do restore.

Somente então habilitar o `schedule` diário.

## 13. Regra de continuidade

**Gerar artifact não prova recuperação. OPS-02 só será considerado concluído após um restore real bem-sucedido.**
