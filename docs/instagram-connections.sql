-- VENCIVO / Instagram
-- Aplicar somente após revisão e teste da branch feat/instagram-foundation.
-- Não executar automaticamente em produção.

create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  instagram_username text,
  access_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scopes text not null,
  status text not null default 'connected' check (status in ('connected','expired','revoked','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id),
  unique (instagram_user_id)
);

create index if not exists instagram_connections_owner_idx
  on public.instagram_connections(owner_id);

create index if not exists instagram_connections_expiry_idx
  on public.instagram_connections(token_expires_at);

alter table public.instagram_connections enable row level security;

-- O frontend não recebe o token. O acesso operacional será feito pelas APIs
-- usando a service role, sempre após validar owner_id/agent_id.
-- Não criar policy de leitura pública para access_token_encrypted.

create or replace function public.set_instagram_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists instagram_connections_updated_at on public.instagram_connections;
create trigger instagram_connections_updated_at
before update on public.instagram_connections
for each row execute function public.set_instagram_connections_updated_at();
