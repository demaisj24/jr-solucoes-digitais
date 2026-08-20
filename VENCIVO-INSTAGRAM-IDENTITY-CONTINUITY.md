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

## Próximo passo exato
1. Revisão do ChatGPT sobre a migration proposta (ambos os arquivos `.sql` e o plano).
2. Se aprovada: aplicar **só** `docs/sql/instagram-connections-agent-identity.sql` via `apply_migration`, confirmando antes que `instagram_connections` continua com 0 linhas.
3. Rodar `get_advisors` (security) depois de aplicar, para confirmar que nenhum novo lint apareceu.
4. `instagram_webhook_events` fica para quando o processamento real de eventos for iniciado (INST-06+), não nesta aplicação.
5. Implementar `decrypt()` e o handler real de gravação da conexão (com `agent_id`) só depois disso, em tarefa própria.
