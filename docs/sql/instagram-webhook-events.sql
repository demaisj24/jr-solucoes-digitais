-- VENCIVO / INST-05B — Idempotência de eventos Instagram
-- PROPOSTA DE DESENHO, v2 (corrigida em revisão). NÃO APLICAR NESTA FASE.
--
-- Não é necessária para concluir a migration de identidade (já aplicada:
-- instagram-connections-agent-identity.sql). Fica registrada aqui para
-- revisão, só deve ser aplicada quando o processamento real de eventos
-- (worker) for de fato construído — e mesmo assim, SEM o worker nesta
-- mesma migration (ver nota pgmq no fim do arquivo).
--
-- Não reaproveita `billing_events` (schema tecnicamente compatível, mas
-- semanticamente é uma tabela de billing/Asaas).

begin;

create table if not exists public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),

  -- Chave de deduplicação = dedupeKeyForEntry(entry) (api/instagram-webhook.js,
  -- INST-04A) — SHA-256 determinístico sobre {id, time, changes, messaging}
  -- do `entry` do webhook. Não é um id fornecido pela Meta.
  --
  -- Limitação conhecida e aceita nesta fase: a chave é por ENTRY inteiro,
  -- não por mensagem/comentário individual dentro dele. Suficiente para
  -- não reprocessar a mesma entrega de webhook; ao implementar
  -- processamento real por mensagem/comentário, recalcular a chave por
  -- item individual (messaging[].message.mid / changes[].value.id).
  provider_event_id text not null,

  -- Conta Instagram Business que recebeu o evento (entry.id no payload).
  -- Guardado mesmo sem agent_id resolvido, para não perder o evento.
  instagram_user_id text not null,

  -- Nullable de propósito: evento pode chegar para uma conta ainda sem
  -- conexão ativa (não conectada, revogada, ou erro).
  agent_id uuid references public.agents(id) on delete set null,

  event_type text not null check (event_type in ('messaging', 'comments', 'unknown')),

  -- =======================================================================
  -- Ciclo de vida explícito: received -> processing -> processed | failed
  -- =======================================================================
  -- received:   linha inserida (dedup passou). Estado inicial, sempre.
  -- processing: um worker reivindicou o evento (leu da fila) e começou a
  --             trabalhar nele. Setado pelo worker ANTES de qualquer
  --             chamada ao agente/Gemini — nunca implícito.
  -- processed:  processamento concluído com sucesso (respondeu, ou decidiu
  --             explicitamente que nenhuma ação era necessária).
  --             processed_at é setado no mesmo instante, como ÚLTIMO passo.
  -- failed:     processamento tentou e falhou de forma não recuperável
  --             (ou esgotou as tentativas de retry da fila). Terminal,
  --             assim como processed — não volta sozinho para "received".
  --
  -- Todas as transições são feitas pelo worker (não implementado nesta
  -- fase); esta migration só declara os estados possíveis.
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),

  -- Setado só quando status vira 'processed' — nunca em nenhum outro
  -- momento. NULL em todos os outros estados (received/processing/failed).
  processed_at timestamptz,

  -- =======================================================================
  -- payload — schema concreto, NUNCA o payload bruto da Meta
  -- =======================================================================
  -- Formato exigido (validado pelo CHECK abaixo):
  --   { "entry_id": text, "time": number, "item_count": integer,
  --     "item_types": text[] }
  -- item_types ⊆ {"message","comment"}.
  --
  -- Nunca incluir: texto de mensagem/comentário, nome de remetente ou
  -- comentarista, qualquer id de item individual (mid/comment id — esses
  -- já estão embutidos no hash de provider_event_id, não precisam
  -- duplicar aqui), qualquer token/secret, e NUNCA mídia bruta (áudio,
  -- imagem, vídeo ou URL de mídia) — retrieval de mídia, quando existir,
  -- é responsabilidade de uma etapa própria, com sua própria política de
  -- retenção, nunca armazenada nesta tabela.
  -- Sem DEFAULT de propósito: um valor default (ex.: '{}') violaria o
  -- próprio CHECK abaixo, e mascarar isso com um default artificial
  -- (entry_id null, etc.) esconderia inserts que esqueceram de montar o
  -- payload correto. Toda inserção futura tem que montar o objeto certo
  -- explicitamente — é o comportamento que queremos forçar.
  payload jsonb not null
    check (
      payload ? 'entry_id'
      and payload ? 'time'
      and payload ? 'item_count'
      and payload ? 'item_types'
      and jsonb_typeof(payload->'item_types') = 'array'
    ),

  created_at timestamptz not null default now(),

  unique (provider_event_id)
);

-- =========================================================================
-- Índices — mantidos exatamente os já revisados, nenhum especulativo
-- =========================================================================
create index if not exists instagram_webhook_events_agent_id_idx
  on public.instagram_webhook_events (agent_id);

create index if not exists instagram_webhook_events_instagram_user_id_idx
  on public.instagram_webhook_events (instagram_user_id);

-- =========================================================================
-- RLS — REVOKE explícito, não depender de RLS-sem-policy implícito
-- =========================================================================
-- RLS sem nenhuma policy já nega todas as linhas por padrão, mas este
-- projeto tem default ACLs (confirmado em pg_default_acl) que concedem
-- privilégio de tabela a anon/authenticated em tabelas novas — o mesmo
-- tipo de concessão implícita que mascarou o problema encontrado e
-- corrigido em instagram_connections. Não repetir esse padrão: revogar
-- explicitamente, para a intenção ficar auditável no próprio SQL, não
-- inferida do comportamento de um ACL padrão.
alter table public.instagram_webhook_events enable row level security;

revoke all on public.instagram_webhook_events
  from authenticated, anon;

-- Nenhuma policy é criada — só service_role (que ignora RLS/GRANT) acessa
-- esta tabela. Nenhum frontend ou API pública lê/escreve aqui hoje nem
-- está planejado para isso.

commit;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- begin;
--   drop table if exists public.instagram_webhook_events;
-- commit;
--
-- Seguro e completo: tabela nova, sem dependentes (nenhuma outra tabela
-- referencia instagram_webhook_events via FK), sem dado real ainda quando
-- este rollback for usado antes de o worker existir.

-- =========================================================================
-- Retenção operacional (avaliada, NÃO implementada nesta migration)
-- =========================================================================
-- Alvo: 90 dias corridos a partir de created_at. Cobre com folga a janela
-- de reentrega/retry da Meta (dias, não meses) e dá margem operacional
-- para depuração. Não guarda mídia bruta (ver seção payload acima) — só
-- metadados estruturais, então o custo/risco de reter 90 dias é baixo.
-- Implementação (fora desta migration, requer pg_cron — hoje NÃO
-- instalado neste projeto, confirmado via list_extensions):
--   select cron.schedule(
--     'purge_instagram_webhook_events',
--     '0 4 * * *',
--     $$ delete from public.instagram_webhook_events
--        where created_at < now() - interval '90 days' $$
--   );
-- Não criar este job agora — registrado para quando pg_cron for
-- habilitado e o worker existir de fato.

-- =========================================================================
-- Nota pgmq — análise, NÃO instalado neste projeto (confirmado)
-- =========================================================================
-- list_extensions confirma: pgmq disponível (default_version 1.5.1) mas
-- installed_version = null. select nspname from pg_namespace where
-- nspname='pgmq' retornou vazio — a extensão não está habilitada. Nenhuma
-- função pgmq.* existe neste banco hoje. O que segue é desenho baseado na
-- documentação oficial (supabase.com/docs/guides/queues/pgmq), não
-- testado neste projeto, e não deve ser implementado sem uma migration
-- própria (`create extension pgmq;`) aprovada separadamente.
--
-- Funções reais (fonte: documentação oficial):
--   pgmq.create(queue_name text)
--   pgmq.send(queue_name text, msg jsonb, delay integer default 0) -> bigint
--   pgmq.read(queue_name text, vt integer, qty integer) -> setof pgmq.message_record
--   pgmq.pop(queue_name text) -> setof pgmq.message_record   -- at-most-once, NÃO usar
--   pgmq.archive(queue_name text, msg_id bigint) -> boolean
--   pgmq.delete(queue_name text, msg_id bigint) -> boolean
--
-- Semântica real (não "exactly-once", apesar de como a doc às vezes
-- resume): read() dá "at-least-once com timeout de visibilidade" — a
-- mensagem some por `vt` segundos e reaparece se ninguém arquivar/deletar
-- a tempo. Isso é reentrega de TRABALHO, não garante que o EVENTO de
-- negócio não seja processado duas vezes — quem garante isso é o
-- provider_event_id UNIQUE desta tabela. As duas camadas são
-- complementares, não substitutas uma da outra.
--
-- Atomicidade recomendada para quando o worker for implementado (não
-- implementado agora):
-- 1. Registro + publicação: fazer numa ÚNICA função de banco (RPC/
--    SECURITY DEFINER), não em duas chamadas HTTP separadas (PostgREST
--    para insert + RPC para pgmq.send são duas requisições distintas,
--    sem atomicidade entre si por padrão). A função faz
--    `insert ... on conflict (provider_event_id) do nothing returning id`;
--    só chama `pgmq.send()` se retornou uma linha nova. Se já existia
--    (duplicata), pula a publicação inteiramente.
-- 2. Claim: usar `pgmq.read()` (nunca `pop()`), e imediatamente
--    `update instagram_webhook_events set status='processing' where id=...`
--    antes de qualquer chamada ao agente/Gemini.
-- 3. Sucesso: `update ... set status='processed', processed_at=now()`
--    seguido de `pgmq.archive()` — nessa ordem, e preferencialmente na
--    mesma transação/RPC.
-- 4. Falha: NÃO arquivar/deletar — deixar o `vt` expirar para nova
--    tentativa automática (pgmq já conta `read_ct`). Definir um limite de
--    tentativas e o que fazer ao esgotá-lo (`status='failed'` +
--    archive) é decisão de implementação do worker, não desta migration.
-- 5. Fonte de verdade sobre "processado": esta tabela (`status`/
--    `processed_at`), não o estado interno do pgmq — o pgmq só orquestra
--    quando/quantas vezes tentar.
