-- VENCIVO / INST-08D — Prova real (Postgres) de que ON CONFLICT DO NOTHING
-- nunca altera a linha original, e que Prefer: resolution=ignore-
-- duplicates se comporta como esperado a nível de banco.
--
-- Regras respeitadas: tudo dentro de uma única transação, termina em
-- ROLLBACK, sem nenhum COMMIT, nada fica persistido — inclusive porque a
-- tabela instagram_webhook_events JÁ EXISTE (aplicada no INST-07), não
-- precisa ser criada aqui, e nenhuma migration nova é aplicada.
--
-- O que isto prova: a garantia de "não sobrescrever em conflito" É real
-- no Postgres (item H do INST-08D). O que isto NÃO prova: concorrência
-- verdadeira entre duas transações simultâneas — impossível de
-- reproduzir através de chamadas MCP sequenciais isoladas (ver limitação
-- documentada em tests/instagram-webhook-orchestrator.test.js, teste C).

begin;

do $$
declare
  original_time timestamptz;
  after_time timestamptz;
  original_payload jsonb;
  after_payload jsonb;
  insert_count_1 integer;
  insert_count_2 integer;
begin
  -- 1) Primeira inserção — evento "original".
  insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, created_at)
  values (
    'idempotency-test-key-1',
    'ig-user-idem-test',
    'messaging',
    '{"entry_id":"e1","time":1000,"item_count":1,"item_types":["message"]}'::jsonb,
    '2026-01-01T00:00:00Z'
  )
  on conflict (provider_event_id) do nothing;
  get diagnostics insert_count_1 = row_count;
  if insert_count_1 <> 1 then
    raise exception 'FALHA: a primeira inserção deveria ter afetado exatamente 1 linha, afetou %', insert_count_1;
  end if;
  raise notice 'OK: evento original inserido';

  select created_at, payload into original_time, original_payload
  from public.instagram_webhook_events where provider_event_id = 'idempotency-test-key-1';

  -- 2) "Duplicata" — mesma provider_event_id, dados DIFERENTES (simula um
  -- reenvio da Meta com timestamp/payload levemente diferente).
  insert into public.instagram_webhook_events (provider_event_id, instagram_user_id, event_type, payload, created_at)
  values (
    'idempotency-test-key-1',
    'ig-user-idem-test',
    'messaging',
    '{"entry_id":"e1","time":9999,"item_count":99,"item_types":["comment"]}'::jsonb,
    '2026-06-06T00:00:00Z'
  )
  on conflict (provider_event_id) do nothing;
  get diagnostics insert_count_2 = row_count;
  if insert_count_2 <> 0 then
    raise exception 'FALHA: a segunda inserção (duplicata) deveria ter afetado 0 linhas, afetou %', insert_count_2;
  end if;
  raise notice 'OK: duplicata corretamente ignorada (0 linhas afetadas)';

  -- 3) item H: confirma que os dados ORIGINAIS não foram tocados.
  select created_at, payload into after_time, after_payload
  from public.instagram_webhook_events where provider_event_id = 'idempotency-test-key-1';

  if after_time <> original_time then
    raise exception 'FALHA: created_at foi alterado pela duplicata (era %, virou %)', original_time, after_time;
  end if;
  if after_payload <> original_payload then
    raise exception 'FALHA: payload foi alterado pela duplicata (era %, virou %)', original_payload, after_payload;
  end if;
  if (after_payload->>'time')::int = 9999 then
    raise exception 'FALHA: o payload da duplicata vazou para a linha original';
  end if;
  raise notice 'OK (item H): dados do evento original preservados, duplicata nunca alterou nada';

  -- 4) Confirma que continua existindo só 1 linha para essa chave.
  if (select count(*) from public.instagram_webhook_events where provider_event_id = 'idempotency-test-key-1') <> 1 then
    raise exception 'FALHA: deveria existir exatamente 1 linha para esta provider_event_id';
  end if;
  raise notice 'OK: exatamente 1 linha para a chave, mesmo após a tentativa de duplicata';

  raise notice 'TODOS OS TESTES DE IDEMPOTÊNCIA (POSTGRES REAL) PASSARAM';
end $$;

rollback;
-- ROLLBACK de propósito: nem o evento "original" nem a tentativa de
-- duplicata ficam persistidos.
