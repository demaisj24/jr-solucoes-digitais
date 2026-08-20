-- VENCIVO / INST-07 — Teste de constraints de instagram_webhook_events
-- NÃO EXECUTADO NESTA TAREFA. Preparado para rodar depois que a migration
-- (instagram-webhook-events.sql) for aplicada, em ambiente de teste ou
-- numa janela controlada — nunca direto em produção sem revisão.
--
-- Tudo dentro de uma única transação com ROLLBACK no final: nada fica
-- persistido, mesmo que todas as asserções passem. Usa uma
-- agent_id/instagram_user_id fictícios (ver observação no fim).

begin;

-- Necessário só para satisfazer o FK de agent_id durante o teste — um
-- agente descartável, dentro da mesma transação que será revertida.
insert into public.agents (id, owner_id, company_name, agent_name, segment, whatsapp)
values ('00000000-0000-0000-0000-000000000001', null, 'teste-inst07', 'teste-inst07', 'teste', '0000000000');

do $$
declare
  ok boolean;
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

  -- 4) response_status fora do enum deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status)
    values ('test-3', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'sent_twice');
    raise exception 'FALHA: response_status inválido deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: response_status fora do enum rejeitado corretamente';
  end;

  -- 5) instagram_message_id sem response_status='sent' deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, response_status, instagram_message_id)
    values ('test-4', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, 'sending', 'mid.123');
    raise exception 'FALHA: instagram_message_id sem status sent deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: instagram_message_id sem response_status=sent rejeitado corretamente';
  end;

  -- 6) fluxo completo válido: sending -> sent com todos os campos corretos
  insert into public.instagram_webhook_events (
    provider_event_id, instagram_user_id, agent_id, event_type, payload,
    response_status, instagram_message_id, response_attempted_at, response_confirmed_at, retry_count
  ) values (
    'test-5', 'ig-user-1', '00000000-0000-0000-0000-000000000001', 'messaging',
    '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb,
    'sent', 'mid.456', now() - interval '2 seconds', now(), 0
  );
  raise notice 'OK: fluxo completo sending->sent aceito';

  -- 7) retry_count negativo deve ser REJEITADO
  begin
    insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, retry_count)
    values ('test-6', 'ig-user-1', 'messaging', '{"entry_id":"e1","time":1,"item_count":1,"item_types":["message"]}'::jsonb, -1);
    raise exception 'FALHA: retry_count negativo deveria ter sido rejeitado';
  exception when check_violation then
    raise notice 'OK: retry_count negativo rejeitado corretamente';
  end;

  -- 8) REVOKE efetivo — authenticated/anon não devem ter SELECT
  select has_table_privilege('authenticated', 'public.instagram_webhook_events', 'SELECT') into ok;
  if ok then raise exception 'FALHA: authenticated não deveria ter SELECT'; end if;
  select has_table_privilege('anon', 'public.instagram_webhook_events', 'SELECT') into ok;
  if ok then raise exception 'FALHA: anon não deveria ter SELECT'; end if;
  select has_table_privilege('service_role', 'public.instagram_webhook_events', 'SELECT') into ok;
  if not ok then raise exception 'FALHA: service_role deveria ter SELECT'; end if;
  raise notice 'OK: privilégios de tabela conferem com o desenho aprovado';

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
-- ROLLBACK de propósito: nada deste teste fica persistido, mesmo que
-- todas as asserções acima tenham passado.
