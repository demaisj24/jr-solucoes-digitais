-- VENCIVO / INST-05 — Identidade e idempotência Instagram
-- PROPOSTA DE MIGRATION. NÃO EXECUTAR EM PRODUÇÃO SEM APROVAÇÃO.
--
-- Objetivo: transformar `instagram_connections` (já em produção, 0 linhas,
-- desenho do PR #9 / feat/instagram-business-login) na tabela definitiva
-- capaz de resolver instagram_user_id -> agent_id -> owner_id, com token
-- criptografado e isolamento multi-tenant garantido por constraint.
--
-- Pré-condição confirmada no banco real antes de escrever isto:
--   select count(*) from public.instagram_connections;  -- 0
-- Se esse número não for 0 no momento de aplicar, PARAR e reavaliar
-- (esta migration assume tabela vazia; não faz backfill de agent_id).

begin;

-- =========================================================================
-- 1) agents: pré-requisito para o FK composto multi-tenant (passo 4)
-- =========================================================================
-- id já é UNIQUE (é a PK). Adicionar (id, owner_id) como UNIQUE não rejeita
-- nenhuma linha existente (id já é globalmente único) e não muda nenhum
-- comportamento de leitura/escrita de agents. É puramente aditivo.
alter table public.agents
  add constraint agents_id_owner_id_key unique (id, owner_id);

-- =========================================================================
-- 2) instagram_connections: novas colunas
-- =========================================================================
alter table public.instagram_connections
  add column agent_id uuid,
  add column access_token_encrypted text;

-- =========================================================================
-- 3) instagram_connections: substituir a coluna de token em texto puro
-- =========================================================================
-- A tabela está vazia — não há dado a migrar. Remove a coluna de texto
-- puro para que não sobre nenhum caminho de código futuro capaz de
-- gravar um token não criptografado nela.
alter table public.instagram_connections
  drop column access_token;

alter table public.instagram_connections
  alter column access_token_encrypted set not null;

-- =========================================================================
-- 4) instagram_connections: agent_id obrigatório + integridade multi-tenant
-- =========================================================================
-- FK composto: garante, no nível do banco, que agent_id só pode apontar
-- para um agente cujo owner_id seja EXATAMENTE o mesmo owner_id da própria
-- conexão. Isso torna estruturalmente impossível uma conexão do owner A
-- apontar para um agente do owner B — não depende de nenhuma validação
-- de aplicação para essa garantia específica.
alter table public.instagram_connections
  alter column agent_id set not null;

alter table public.instagram_connections
  add constraint instagram_connections_agent_owner_fkey
  foreign key (agent_id, owner_id)
  references public.agents (id, owner_id)
  on delete cascade;

-- =========================================================================
-- 5) instagram_connections: unicidade global de instagram_user_id
-- =========================================================================
-- Substitui a constraint antiga, que só impedia duplicidade por
-- (owner_id, instagram_user_id) — permitindo, em tese, a mesma conta
-- Instagram ser conectada por dois owners diferentes ao mesmo tempo.
-- Uma conta Instagram só pode estar ligada a UM agente no sistema inteiro.
alter table public.instagram_connections
  drop constraint if exists instagram_connections_owner_id_instagram_user_id_key;

alter table public.instagram_connections
  add constraint instagram_connections_instagram_user_id_key
  unique (instagram_user_id);

-- Um agente só pode ter uma conexão Instagram ativa por vez.
alter table public.instagram_connections
  add constraint instagram_connections_agent_id_key
  unique (agent_id);

-- =========================================================================
-- 6) Índices
-- =========================================================================
-- instagram_user_id já ganhou índice único implícito no passo 5.
-- agent_id já ganhou índice único implícito no passo 5.
-- owner_id_idx (já existente) permanece útil para telas "minhas conexões".
-- Nenhum índice adicional necessário para esta fase.

-- =========================================================================
-- 7) RLS — mantida, sem regressão de acesso
-- =========================================================================
-- RLS já está habilitada (rls_enabled = true) com 4 policies existentes,
-- todas restritas a owner_id = auth.uid(). Elas continuam válidas sem
-- alteração — o novo agent_id não precisa de policy própria, pois o
-- acesso continua controlado por linha (owner_id), e a integridade
-- agent<->owner agora é garantida pelo FK composto do passo 4.
--
-- Hardening adicional: revogar SELECT de access_token_encrypted para os
-- papéis que o PostgREST usa no client-side. RLS filtra LINHAS, não
-- colunas — sem isto, um SELECT * feito pelo próprio owner autenticado
-- (via anon/publishable key + JWT) devolveria o blob cifrado. Nenhum
-- código atual faz isso (os endpoints já existentes usam service role e
-- nunca selecionam essa coluna), mas a garantia deve estar no banco, não
-- só na disciplina do código de aplicação.
revoke select (access_token_encrypted) on public.instagram_connections
  from authenticated, anon;

-- =========================================================================
-- 8) Colunas preservadas sem alteração
-- =========================================================================
-- created_at, updated_at, status, scopes, username, token_expires_at,
-- instagram_user_id (tipo/nome) — mantidos exatamente como estão.
-- O trigger de updated_at (se existir para esta tabela) não é alterado
-- por esta migration.

commit;

-- =========================================================================
-- ROLLBACK (referência — ver docs/INSTAGRAM-IDENTITY-MIGRATION-PLAN.md)
-- =========================================================================
-- begin;
--   grant select on public.instagram_connections to authenticated, anon;
--   alter table public.instagram_connections drop constraint if exists instagram_connections_agent_id_key;
--   alter table public.instagram_connections drop constraint if exists instagram_connections_instagram_user_id_key;
--   alter table public.instagram_connections add constraint instagram_connections_owner_id_instagram_user_id_key unique (owner_id, instagram_user_id);
--   alter table public.instagram_connections drop constraint if exists instagram_connections_agent_owner_fkey;
--   alter table public.instagram_connections alter column agent_id drop not null;
--   alter table public.instagram_connections add column access_token text;
--   alter table public.instagram_connections alter column access_token_encrypted drop not null;
--   alter table public.instagram_connections drop column access_token_encrypted;
--   alter table public.instagram_connections drop column agent_id;
--   alter table public.agents drop constraint if exists agents_id_owner_id_key;
-- commit;
