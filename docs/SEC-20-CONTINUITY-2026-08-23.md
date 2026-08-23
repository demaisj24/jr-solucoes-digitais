# SEC-20 — Continuidade (2026-08-23)

Documento de continuidade para retomar o trabalho amanhã. Puramente informativo — não altera comportamento do sistema.

## Status

**SEC-20 (Supabase Free keepalive) está FECHADO.**

- Commit final: `01a94b05cf7b0aaa74e03a46c6349083be1442f7` (parent `7e737ee`)
- Branch: `sec-20-supabase-availability`
- Push confirmado para `origin/sec-20-supabase-availability`
- Passou por todos os gates: reconciliação → revisão adversarial → staging → revisão final do staged diff → commit → revisão pós-commit → push → revisão pós-push
- **Não foi mergeado em `main`** — nenhum PR foi aberto, merge nunca foi solicitado.

## Arquitetura final

GitHub Actions (`.github/workflows/supabase-keepalive.yml`) → `cron: "0 9 * * 1,4"` (2x/semana) → `curl` contra `plan_catalog?select=code&active=eq.true&limit=1` usando `SUPABASE_ANON_KEY` (nunca `service_role`, nunca a tabela `agents`) → resposta descartada. `permissions: contents: read`, timeout duplo, `--fail-with-body` + `set -euo pipefail` (falha HTTP derruba o job). Teste: `tests/sec-20-supabase-keepalive.test.js`, 15/15 passando, zero dependência externa.

## Incidente durante a tarefa (para não repetir)

O checkout compartilhado (`C:\Users\demai\Downloads\jr-solucoes-digitais`) foi assumido por uma sessão paralela no meio da revisão (checkout para `feat/instagram-webhook` + rebase ali). Meu trabalho staged foi preservado automaticamente via `git stash` pela própria sessão paralela (`stash@{0}`) antes da troca — nada foi perdido. Recuperado criando um worktree isolado novo (`C:/Users/demai/Downloads/jr-solucoes-digitais-sec20`) e `git stash apply stash@{0}` (apply, não pop). **Lição reforçada:** sempre usar worktree isolado para trabalho de branch específica, nunca reaproveitar o checkout compartilhado, mesmo para revisões que parecem rápidas.

## Worktrees ativos

| Diretório | Branch | Commit |
|---|---|---|
| `jr-solucoes-digitais` (compartilhado) | `feat/instagram-webhook` | da sessão paralela, não mexer |
| `jr-solucoes-digitais-sec14` | `sec-14-high-hardening` | `f7da54d` — pushed, não mergeado |
| `jr-solucoes-digitais-keepalive` | `infra/supabase-free-keepalive` | `dc05944` — WIP não commitado, abordagem Vercel superada, não apagar |
| `jr-solucoes-digitais-sec20` | `sec-20-supabase-availability` | `01a94b0` — este trabalho, pushed, limpo |

## Stashes (não remover sem autorização explícita)

- `stash@{0}`: WIP SEC-20 — já redundante (conteúdo commitado e pushado), seguro para dropar quando autorizado, ainda não feito.
- `stash@{1}`: WIP SEC-14 antes da SEC-17 — mais antigo, ainda pendente de resolução própria.

## Achado crítico NÃO corrigido (decisão do usuário pendente)

A policy RLS `plan_catalog_public_active_select` (role `anon`) é **RESTRICTIVE**, não PERMISSIVE — bloqueia todo acesso anônimo a `plan_catalog` independente da condição, mesmo com `GRANT SELECT` presente. Confirmado ao vivo: `curl` com a anon key real retorna HTTP 200 com array vazio, mesmo sem filtro algum. O keepalive ainda cumpre seu propósito central (HTTP 200 = Supabase respondeu), mas não confirma dado real. Impacto em produção hoje: nenhum (os únicos consumidores de `plan_catalog` usam `service_role`, que ignora RLS). **Não corrigido** — é alteração de segurança em produção, fora do escopo autorizado até aqui.

## Roadmap registrado (nenhum item iniciado)

1. System documentation / manual de manutenção
2. System backup
3. Supabase database backup
4. Storage backup
5. Disaster recovery / restore test
6. Inventário de infraestrutura e secrets
7. Procedimento de recuperação para leigo

Backup é explicitamente separado do keepalive — Supabase Free não tem backup automático.

## Outras frentes em andamento (não tocadas nesta tarefa)

- `fix/sec-04-knowledge-auth` @ `df7eb22` — corrigido, não mergeado.
- `fix/sec-06-supabase-vendor` @ `47a403c` — corrigido, não mergeado.
- SEC-02 — pausado aguardando autorização da Fase 3.
- SEC-16/17/18/19 — avançados pela sessão paralela, mergeados/commitados conforme seus próprios branches.
