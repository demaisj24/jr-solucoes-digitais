-- VENCIVO / INST-05 — Identidade e idempotência Instagram
-- PROPOSTA DE MIGRATION. NÃO EXECUTAR EM PRODUÇÃO SEM APROVAÇÃO.
--
-- Objetivo: transformar `instagram_connections` (já em produção, 0 linhas,
-- desenho do PR #9 / feat/instagram-business-login) na tabela definitiva
-- capaz de resolver instagram_user_id -> agent_id -> owner_id, com token
-- criptografado e isolamento multi-tenant garantido por constraint.
--
-- v2: corrige o FAIL encontrado em revisão — o REVOKE de coluna original
-- não tinha efeito real porque authenticated/anon já possuem SELECT em
-- nível de TABELA (confirmado com has_table_privilege() antes de escrever
-- esta versão: authenticated_table_select = true, e o access_token em
-- texto puro hoje já é lido por 'authenticated' via esse grant de tabela).
-- Ver docs/INSTAGRAM-IDENTITY-MIGRATION-PLAN.md, seção "Correção 7/8".

begin;

-- =========================================================================
-- 0) Guard transacional — aborta se a tabela deixou de estar vazia
-- =========================================================================
-- Esta migration não faz backfill de agent_id nem criptografa tokens
-- existentes. Ela assume 0 linhas. Isso era só um comentário na v1; agora
-- é uma checagem real dentro da própria transação.
do $$
begin
  if (select count(*) from public.instagram_connections) <> 0 then
    raise exception 'instagram_connections não está vazia (% linhas) — esta migration não tem passo de backfill. Abortando.',
      (select count(*) from public.instagram_connections);
  end if;
end $$;

-- =========================================================================
-- 1) agents: pré-requisito para o FK composto multi-tenant (passo 4)
-- =========================================================================
-- id já é UNIQUE (é a PK). Adicionar (id, owner_id) como UNIQUE não rejeita
-- nenhuma linha existente (id já é globalmente único) e não muda nenhum
-- comportamento de leitura/escrita de agents. É puramente aditivo.
-- Confirmado: 42 das 55 linhas de agents têm owner_id NULL hoje — isso não
-- viola o UNIQUE (Postgres trata cada NULL como distinto) e faz o FK do
-- passo 4 corretamente rejeitar conexões apontando para esses agentes
-- sem dono (comportamento desejado).
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
-- A tabela está vazia (garantido pelo guard do passo 0) — nada a migrar.
alter table public.instagram_connections
  drop column access_token;

alter table public.instagram_connections
  alter column access_token_encrypted set not null;

-- =========================================================================
-- 4) instagram_connections: agent_id obrigatório + integridade multi-tenant
-- =========================================================================
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
alter table public.instagram_connections
  drop constraint if exists instagram_connections_owner_id_instagram_user_id_key;

alter table public.instagram_connections
  add constraint instagram_connections_instagram_user_id_key
  unique (instagram_user_id);

alter table public.instagram_connections
  add constraint instagram_connections_agent_id_key
  unique (agent_id);

-- =========================================================================
-- 6) Índices — nenhum adicional necessário (unique acima já indexa)
-- =========================================================================

-- =========================================================================
-- 7) Privilégios de coluna — CORRIGIDO (v2)
-- =========================================================================
-- Decisão (ver seção "Decisão A/B" do plano): nem A (grant explícito de
-- colunas "convenientes") nem B-com-view — a busca no repositório inteiro
-- não encontrou NENHUM consumidor (frontend ou API) que leia
-- instagram_connections hoje. Toda leitura Instagram-relacionada no
-- projeto (deployment-status.js, e o planejado instagram-status.js) passa
-- por um endpoint de backend com service role, nunca pelo cliente direto.
-- Logo: acesso de authenticated/anon é revogado por completo, sem
-- concessão substituta e sem view. Isso é o mecanismo correto para o bug
-- encontrado (table-level grant mascarava o revoke de coluna), porque
-- revoga o grant de TABELA que estava causando o problema, não só de
-- coluna.
--
-- Efeito colateral, sinalizado explicitamente (não escondido): as 4
-- policies de RLS já existentes (select_own/insert_own/update_own/
-- delete_own, todas owner_id = auth.uid()) ficam dormentes — RLS só filtra
-- linhas de quem já tem privilégio na tabela; sem esse privilégio, a
-- policy nunca chega a ser avaliada. Isso é intencional nesta fase: se/
-- quando existir um consumidor real de leitura direta, a escolha entre
-- (a) grant de colunas específicas, (b) view segura, ou (c) — o padrão já
-- usado em todo o resto do projeto — um endpoint de backend com service
-- role, deve ser feita então, com o consumidor real definindo o que
-- expor. Não antes.
revoke select on public.instagram_connections
  from authenticated, anon;

-- =========================================================================
-- 8) Colunas preservadas sem alteração
-- =========================================================================
-- created_at, updated_at, status, scopes, username, token_expires_at,
-- instagram_user_id (tipo/nome) — mantidos exatamente como estão.

commit;

-- =========================================================================
-- ROLLBACK — CORRIGIDO (v2), espelha exatamente o mecanismo aplicado
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
--
-- Nota: o passo 7 (v2) fez um REVOKE de tabela inteira, sem nenhum GRANT
-- substituto — então o rollback correspondente é devolver exatamente o
-- que existia antes: `grant select on ... to authenticated, anon;` (nível
-- de tabela, igual ao estado original). Isso é diferente da v1, cujo
-- rollback tentava desfazer um REVOKE de coluna que nunca teve efeito —
-- aqui o GRANT de tabela realmente reverte o REVOKE de tabela do passo 7.
