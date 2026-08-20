-- VENCIVO / INST-07 — Teste de constraints de instagram_webhook_events
-- (real, autocontido: cria a tabela dentro da MESMA transação que reverte
-- no final, porque a migration em si ainda não foi aplicada em produção)
--
-- Regras respeitadas nesta versão:
--   1. tudo dentro de uma única transação (begin ... rollback);
--   2. termina obrigatoriamente em ROLLBACK, sem nenhum COMMIT;
--   3. nenhuma linha/objeto fica persistido — inclusive a própria tabela,
--      criada e testada dentro da transação, nunca fora dela;
--   4. não altera nenhuma tabela existente permanentemente (o INSERT de
--      teste em `agents` também é revertido pelo mesmo ROLLBACK);
--   5. não é a migration de produção sendo aplicada — é uma cópia da
--      definição, testada e descartada.
--
-- Verificado antes de rodar contra o projeto real: um canário
-- (`begin; create table ...; rollback;`) confirmou que este ambiente de
-- execução preserva blocos de transação explícitos corretamente — o
-- canário não ficou persistido.

begin;

-- ===========================================================================
-- Definição EXATA da tabela aprovada (docs/sql/instagram-webhook-events.sql
-- v3), copiada aqui só para este teste — nunca commitada fora desta
-- transação.
-- ===========================================================================
create table public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  instagram_user_id text not null,
  agent_id uuid references public.agents(id) on delete set null,
  event_type text not null check (event_type in ('messaging', 'comments', 'unknown')),
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),
  processed_at timestamptz,
  response_status text
    check (response_status is null or response_status in ('sending', 'sent', 'ambiguous', 'failed')),
  instagram_message_id text
    check (instagram_message_id is null or response_status = 'sent'),
  response_attempted_at timestamptz,
  response_confirmed_at timestamptz
    check (response_confirmed_at is null or response_status = 'sent'),
  last_response_error text,
  retry_count integer not null default 0
    check (retry_count >= 0),
  next_retry_at timestamptz
    check (next_retry_at is null or response_status in ('sending', 'ambiguous')),
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

create index instagram_webhook_events_agent_id_idx
  on public.instagram_webhook_events (agent_id);

create index instagram_webhook_events_instagram_user_id_idx
  on public.instagram_webhook_events (instagram_user_id);

alter table public.instagram_webhook_events enable row level security;

revoke all on public.instagram_webhook_events
  from authenticated, anon;

-- Agente descartável só para satisfazer o FK de agent_id durante o teste.
insert into public.agents (id, owner_id, company_name, agent_name, segment, whatsapp)
values ('00000000-0000-0000-0000-000000000001', null, 'teste-inst07', 'teste-inst07', 'teste', '0000000000');

do $$
declare
  ok boolean;
  idx_count integer;
begin
  -- 1) payload vazio deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload)
    values ('test-1', 'ig-user-1', 'messaging', '{}'::jsonb);
    raise exception 'FALHA: payload vazio deveria ter sido rejeitado pelo CHECK';
  exception when check_violation then
    raise notice 'OK: payload vazio rejeitado corretamente';
  end;

  -- 2) payload com schema mínimo correto deve ser ACEITO
  insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload)
  values ('test-2', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb);
  raise notice 'OK: payload mínimo aceito';

  -- 3) provider_event_id duplicado deve ser REJEITADO (idempotência)
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload)
    values ('test-2', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb);
    raise exception 'FALHA: provider_event_id duplicado deveria ter sido rejeitado';
  exception when unique_violation then
    raise notice 'OK: duplicata de provider_event_id rejeitada corretamente';
  end;

  -- 4) status de processamento fora do enum deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, status)
    values ('test-3a', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'done');
    raise exception 'FALHA: status inválido deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: status de processamento fora do enum rejeitado corretamente';
  end;

  -- 5) response_status fora do enum deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status)
    values ('test-3', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'sent_twice');
    raise exception 'FALHA: response_status inválido deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: response_status fora do enum rejeitado corretamente';
  end;

  -- 6) instagram_message_id sem response_status='sent' deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status, instagram_message_id)
    values ('test-4', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'sending', 'mid.123');
    raise exception 'FALHA: instagram_message_id sem status sent deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: instagram_message_id sem response_status=sent rejeitado corretamente';
  end;

  -- 7) response_confirmed_at sem response_status='sent' deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status, response_confirmed_at)
    values ('test-4b', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'ambiguous', now());
    raise exception 'FALHA: response_confirmed_at sem status sent deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: response_confirmed_at sem response_status=sent rejeitado corretamente';
  end;

  -- 8) next_retry_at com response_status='sent' (terminal) deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status, instagram_message_id, response_confirmed_at, next_retry_at)
    values ('test-4c', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'sent', 'mid.789', now(), now());
    raise exception 'FALHA: next_retry_at com status sent (terminal) deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: next_retry_at com response_status=sent rejeitado corretamente';
  end;

  -- 9) next_retry_at com response_status='ambiguous' deve ser ACEITO (combinação válida)
  insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status, next_retry_at, retry_count)
  values ('test-4d', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'ambiguous', now() + interval '30 seconds', 1);
  raise notice 'OK: next_retry_at com response_status=ambiguous aceito (combinação válida)';

  -- 10) fluxo completo válido: sending -> sent com todos os campos corretos
  insert into public.instagram_webhook_events (
    provider_event_id, instagram_user_id, agent_id, event_type, payload,
    response_status, instagram_message_id, response_attempted_at, response_confirmed_at, retry_count
  ) values (
    'test-5', 'ig-user-1', '00000000-0000-0000-0000-000000000001', 'messaging',
    '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb,
    'sent', 'mid.456', now() - interval '2 seconds', now(), 0
  );
  raise notice 'OK: fluxo completo sending->sent aceito (combinação válida)';

  -- 11) retry_count negativo deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, retry_count)
    values ('test-6', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, -1);
    raise exception 'FALHA: retry_count negativo deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: retry_count negativo rejeitado corretamente';
  end;

  -- 12) agent_id apontando para agente inexistente deve ser REJEITADO (FK)
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, agent_id, event_type, payload)
    values ('test-7', 'ig-user-1', '00000000-0000-0000-0000-000000000099', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb);
    raise exception 'FALHA: agent_id inexistente deveria ter sido rejeitado pelo FK';
  exception when foreign_key_violation then
    raise notice 'OK: FK de agent_id rejeitou referência inexistente corretamente';
  end;

  -- 13) REVOKE efetivo — authenticated/anon não devem ter SELECT
  select has_table_privilege('authenticated', 'public.instagram_webhook_events', 'SELECT') into ok;
  if ok then raise exception 'FALHA: authenticated não deveria ter SELECT'; end if;
  select has_table_privilege('anon', 'public.instagram_webhook_events', 'SELECT') into ok;
  if ok then raise exception 'FALHA: anon não deveria ter SELECT'; end if;
  select has_table_privilege('service_role', 'public.instagram_webhook_events', 'SELECT') into ok;
  if not ok then raise exception 'FALHA: service_role deveria ter SELECT'; end if;
  raise notice 'OK: privilégios de tabela conferem com o desenho aprovado';

  -- 14) índices esperados existem, nenhum a mais
  select count(*) into idx_count from pg_indexes
    where schemaname = 'public' and tablename = 'instagram_webhook_events';
  -- pkey + unique(provider_event_id) + 2 índices explícitos = 4
  if idx_count <> 4 then
    raise exception 'FALHA: esperados 4 índices (pkey+unique+2), encontrados %', idx_count;
  end if;
  raise notice 'OK: exatamente 4 índices presentes (pkey, unique provider_event_id, agent_id, instagram_user_id)';

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
-- ROLLBACK de propósito: nada deste teste fica persistido — nem as
-- linhas, nem a própria tabela criada acima, nem o agente de teste.
