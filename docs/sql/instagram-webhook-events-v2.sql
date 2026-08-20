-- VENCIVO / INST-05B — Idempotência de eventos Instagram
-- PROPOSTA. NÃO APLICAR EM PRODUÇÃO NESTA FASE.
--
-- Evolução do desenho inicial: além de deduplicar por provider_event_id,
-- mantém estado de processamento e recuperação de eventos presos.

create table if not exists public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),

  provider_event_id text not null,
  instagram_user_id text not null,

  -- Pode ser NULL quando o evento chega antes de existir uma conexão
  -- resolvida. O backend deve resolver a identidade antes do processamento.
  agent_id uuid references public.agents(id) on delete set null,

  event_type text not null check (event_type in ('messaging', 'comments', 'unknown')),

  -- Não persistir payload bruto da Meta por padrão.
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),

  attempts integer not null default 0
    check (attempts >= 0),

  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider_event_id)
);

create index if not exists instagram_webhook_events_work_idx
  on public.instagram_webhook_events (status, created_at)
  where status in ('received', 'failed');

create index if not exists instagram_webhook_events_processing_idx
  on public.instagram_webhook_events (processing_started_at)
  where status = 'processing';

create index if not exists instagram_webhook_events_agent_id_idx
  on public.instagram_webhook_events (agent_id);

create index if not exists instagram_webhook_events_instagram_user_id_idx
  on public.instagram_webhook_events (instagram_user_id);

alter table public.instagram_webhook_events enable row level security;

-- Nenhuma policy pública: infraestrutura exclusiva do backend/service role.
--
-- IMPORTANTE:
-- A criação da tabela NÃO implementa o claim/lease. O worker deve fazer
-- uma operação atômica de claim antes de processar o evento. Não usar
-- SELECT seguido de UPDATE separado para evitar corrida entre workers.
