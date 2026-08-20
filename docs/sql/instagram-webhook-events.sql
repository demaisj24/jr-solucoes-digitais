-- VENCIVO / INST-05 — Idempotência de eventos Instagram
-- PROPOSTA DE DESENHO. NÃO APLICAR NESTA FASE.
--
-- Não é necessária para concluir a migration de identidade
-- (docs/sql/instagram-connections-agent-identity.sql). Fica registrada
-- aqui para revisão em conjunto, mas só deve ser aplicada quando o
-- INST-06 (ou equivalente) for de fato persistir/processar eventos.
--
-- Não reaproveita `billing_events` (schema tecnicamente compatível, mas
-- semanticamente é uma tabela de billing/Asaas — misturar eventos de
-- mensageria do Instagram ali confunde auditoria e responsabilidades).

create table if not exists public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),

  -- Chave de deduplicação. Hoje corresponde a dedupeKeyForEntry(entry)
  -- (api/instagram-webhook.js) — um hash SHA-256 determinístico sobre
  -- {id, time, changes, messaging} da entrada do webhook. Não é um "id"
  -- fornecido pela Meta (o payload não traz um event id global único).
  provider_event_id text not null,

  -- Conta Instagram Business que recebeu o evento (entry.id no payload).
  -- Guardado mesmo quando ainda não resolvido para um agent_id, para não
  -- perder o evento por falta de conexão configurada.
  instagram_user_id text not null,

  -- Nullable de propósito: um evento pode chegar para uma conta Instagram
  -- ainda sem conexão ativa (não conectada, revogada, ou erro). Preferimos
  -- registrar e deduplicar mesmo assim a descartar o evento silenciosamente.
  agent_id uuid references public.agents(id) on delete set null,

  event_type text not null check (event_type in ('messaging', 'comments', 'unknown')),

  -- Mínimo e seguro por definição: NÃO o payload bruto da Meta. Ver
  -- docs/INSTAGRAM-IDENTITY-MIGRATION-PLAN.md, seção "payload seguro" —
  -- guarda só metadados estruturais (ids, contagens, tipo), nunca texto
  -- de mensagem/comentário do cliente final, e nunca token/secret.
  payload jsonb not null default '{}'::jsonb,

  processed_at timestamptz,
  created_at timestamptz not null default now(),

  unique (provider_event_id)
);

create index if not exists instagram_webhook_events_agent_id_idx
  on public.instagram_webhook_events (agent_id);

create index if not exists instagram_webhook_events_instagram_user_id_idx
  on public.instagram_webhook_events (instagram_user_id);

alter table public.instagram_webhook_events enable row level security;

-- Mesmo padrão de billing_events hoje: RLS ligada, nenhuma policy.
-- Só a service role (backend) acessa esta tabela — não há caso de uso
-- de leitura/escrita direta pelo navegador do cliente.
