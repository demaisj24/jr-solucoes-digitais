# VENCIVO — Continuidade: INST-05 (identidade e idempotência Instagram)

**Branch:** `feat/instagram-identity-migration`
**Base:** `main` @ `7943629`
**Status:** Fase 1 (desenho) entregue. **Nenhuma migration foi aplicada.**

## Concluído nesta fase
- Análise do schema real do Supabase (`list_tables`, `execute_sql` de leitura, `list_migrations`, `get_advisors`) confirmando: `instagram_connections` já existe em produção (migration `20260818205553_instagram_business_login_connections`), 0 linhas, sem `agent_id`, `access_token` em texto puro.
- Conflito entre PR #9 (`feat/instagram-business-login`, dono do schema atual) e `feat/instagram-foundation` (schema mais novo, nunca aplicado) documentado e recomendação apresentada: **não mergear PR #9 como está**.
- Opção A (alterar a tabela existente) aprovada e desenhada:
  - `docs/sql/instagram-connections-agent-identity.sql` — migration proposta (não aplicada).
  - `docs/sql/instagram-webhook-events.sql` — desenho da tabela de idempotência (não aplicada, não é pré-requisito da primeira).
  - `docs/INSTAGRAM-IDENTITY-MIGRATION-PLAN.md` — estratégia de criptografia (AES-256-GCM, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`), estratégia multi-tenant (FK composto `(agent_id, owner_id)`), riscos, rollback.

## Não feito (fora de escopo desta fase, por instrução)
- `apply_migration` não foi chamado — nenhuma alteração real no banco.
- `decrypt()` ainda não existe em nenhuma branch (só `encrypt()`, em `feat/instagram-foundation`) — documentado como pendência para quando o token for de fato usado.
- Nenhum código de handler foi escrito ou alterado.
- Gemini, áudio, transcrição, resposta Instagram, Direct, comentários, leads, CRM, novo OAuth, configuração Meta — nada disso foi tocado.

## Não alterado (confirmado)
`main`, `feat/instagram-business-login` (PR #9), `feat/instagram-webhook`, `fix/instagram-webhook-raw-body` (INST-04/04A), AI-01, AI-02, WhatsApp, checkout.

## Correção pós-revisão técnica (2ª rodada)

A revisão encontrou 2 FAILs reais: o `REVOKE SELECT (access_token_encrypted)` da v1 não tinha efeito porque `authenticated`/`anon` já têm `SELECT` de tabela inteira (confirmado com `has_table_privilege`/`has_column_privilege` — `authenticated` já lê `access_token` em texto puro hoje). Corrigido na v2:
- `docs/sql/instagram-connections-agent-identity.sql` — `REVOKE SELECT` de tabela inteira (sem grant substituto, sem view — busca no repositório confirmou zero consumidores), rollback corrigido para espelhar exatamente esse mecanismo, guard de tabela vazia agora é um `DO $$ RAISE EXCEPTION` real.
- `docs/sql/instagram-connections-privilege-test.sql` (novo) — teste com `has_table_privilege`/`has_column_privilege`, com o resultado "antes" (bug) documentado a partir de consulta real feita no banco.

Ainda **nenhuma migration foi aplicada**.

## FASE 2 — Aplicação controlada (concluída)

Migration `instagram_connections_agent_identity` aplicada com sucesso via `apply_migration` (fonte: `docs/sql/instagram-connections-agent-identity.sql`, commit `117c9c3`, só removidos os marcadores `begin;`/`commit;` para não conflitar com a transação própria da ferramenta — nenhuma linha de DDL alterada).

Verificado depois (só consultas de leitura):
- Schema: `agent_id` (uuid, not null), `access_token_encrypted` (text, not null), `access_token` removida — confirmado via `information_schema.columns`.
- Constraints: `instagram_connections_agent_owner_fkey` (FK composto agent_id+owner_id → agents), `instagram_connections_instagram_user_id_key` (unique), `instagram_connections_agent_id_key` (unique), `agents_id_owner_id_key` (unique) — todas confirmadas via `pg_constraint`.
- Privilégios: `has_table_privilege`/`has_column_privilege` confirmam `authenticated`/`anon` sem SELECT nenhum na tabela (incluindo `access_token_encrypted`); `service_role` mantém SELECT/INSERT/UPDATE, incluindo a coluna do token — exatamente o desenho aprovado. Resultado bate 100% com o "depois" documentado em `docs/sql/instagram-connections-privilege-test.sql`.
- Policies de RLS: as 4 (`select/insert/update/delete_own`) continuam existindo, nenhuma referencia a coluna do token — dormentes conforme previsto (sem grant de tabela, nunca são avaliadas).
- Dados: `instagram_connections` continua com **0 linhas**.
- `get_advisors` (security): nenhum lint novo em relação a antes da migration.

Integridade multi-tenant (conexão não pode apontar para agent de outro owner) verificada **pela definição da constraint** (FK composto), não por um INSERT de teste — para preservar `0 linhas` conforme instruído.

Guard de tabela vazia: rodou e não abortou (0 linhas confirmadas antes da aplicação) — é uma checagem de uma vez só, dentro da migration; não é um mecanismo permanente que protege inserts futuros.

`instagram-webhook-events.sql` **não foi aplicada** (fora do escopo desta fase, como instruído).

## Próximo passo exato
1. Revisão do ChatGPT sobre a migration proposta (ambos os arquivos `.sql` e o plano).
2. Se aprovada: aplicar **só** `docs/sql/instagram-connections-agent-identity.sql` via `apply_migration`, confirmando antes que `instagram_connections` continua com 0 linhas.
3. Rodar `get_advisors` (security) depois de aplicar, para confirmar que nenhum novo lint apareceu.
4. `instagram_webhook_events` fica para quando o processamento real de eventos for iniciado (INST-06+), não nesta aplicação.
5. Implementar `decrypt()` e o handler real de gravação da conexão (com `agent_id`) só depois disso, em tarefa própria.
