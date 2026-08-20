-- VENCIVO / INST-07 — Schema final de instagram_webhook_events
-- PROPOSTA DE DESENHO, v3. NÃO APLICAR NESTA FASE.
--
-- v3: incorpora o estado de resposta externa aprovado no INST-06
-- (docs/INSTAGRAM-RESPONSE-IDEMPOTENCY.md) sobre a v2 já auditada
-- (PASS em todos os itens: RLS, payload, retenção, rollback, dedup,
-- índices). Nenhum campo novo além dos 7 explicitamente aprovados.
--
-- Não é necessária para concluir a migration de identidade (já aplicada:
-- instagram-connections-agent-identity.sql). Só deve ser aplicada quando
-- o processamento real de eventos (worker) for de fato construído — e
-- mesmo assim, SEM o worker nesta mesma migration.
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
  -- não por mensagem/comentário individual dentro dele.
  provider_event_id text not null,

  -- Conta Instagram Business que recebeu o evento (entry.id no payload).
  instagram_user_id text not null,

  -- Nullable de propósito: evento pode chegar para uma conta ainda sem
  -- conexão ativa.
  agent_id uuid references public.agents(id) on delete set null,

  event_type text not null check (event_type in ('messaging', 'comments', 'unknown')),

  -- =======================================================================
  -- Ciclo de vida do PROCESSAMENTO: received -> processing -> processed | failed
  -- =======================================================================
  -- Separado de response_status (abaixo) de propósito — são conceitos
  -- diferentes: um evento pode ser `processed` sem nunca ter enviado
  -- resposta (nenhuma ação necessária), e o processamento (Gemini) pode
  -- ter sucesso enquanto o envio está `ambiguous`. Ver INST-06.
  --
  -- received:   linha inserida (dedup passou). Estado inicial, sempre.
  -- processing: um worker reivindicou o evento e começou a trabalhar
  --             nele. Setado ANTES de qualquer chamada ao agente/Gemini.
  -- processed:  processamento concluído com sucesso (respondeu, ou
  --             decidiu explicitamente que nenhuma ação era necessária).
  --             processed_at setado no mesmo instante, como ÚLTIMO passo.
  -- failed:     processamento tentou e falhou de forma não recuperável,
  --             ou esgotou as tentativas de retry. Terminal.
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),

  -- Setado só quando status vira 'processed'.
  processed_at timestamptz,

  -- =======================================================================
  -- Estado da RESPOSTA externa (INST-06) — separado do status acima
  -- =======================================================================
  -- NULL:      nenhuma resposta foi tentada, ou nenhuma é necessária.
  -- sending:   uma tentativa de envio via Send API está em curso (ou foi
  --            iniciada — pode ter travado aqui por timeout/crash).
  -- sent:      confirmado — 200 + instagram_message_id recebidos e
  --            gravados, OU confirmado via verificação best-effort do
  --            histórico de conversa depois de um estado ambiguous.
  -- ambiguous: timeout ou 5xx no Send API — resultado desconhecido. Não
  --            reenviar direto: verificar histórico de conversa antes.
  -- failed:    4xx (falha definitiva, sem retry) OU retries esgotados
  --            depois de ambiguous repetido. Motivo em last_response_error.
  --
  -- Transições válidas:
  --   NULL -> sending
  --   sending -> sent | failed(4xx) | ambiguous
  --   ambiguous -> sent (verificado) | sending (retry) | failed (esgotado)
  -- sent e failed são terminais.
  response_status text
    check (response_status is null or response_status in ('sending', 'sent', 'ambiguous', 'failed')),

  -- Id retornado pela Meta no Send API — só existe depois de um envio
  -- confirmado. Não é um mecanismo de idempotência (a Meta não oferece
  -- um) — é só prova/auditoria de que o envio aconteceu.
  instagram_message_id text
    check (instagram_message_id is null or response_status = 'sent'),

  -- Início da tentativa de envio mais recente. Usado pelo recovery para
  -- detectar timeout (`response_status='sending' AND response_attempted_at
  -- < now() - limiar`) e como âncora da janela de busca na verificação
  -- best-effort do histórico de conversa.
  response_attempted_at timestamptz,

  -- Quando a resposta foi confirmada como enviada — via 200 direto, ou
  -- via verificação best-effort depois de um estado ambiguous. É o
  -- momento da CONFIRMAÇÃO, não necessariamente do envio real (que pode
  -- ser desconhecido no caso do estado ambiguous).
  response_confirmed_at timestamptz
    check (response_confirmed_at is null or response_status = 'sent'),

  -- Motivo do estado ambiguous/failed mais recente (ex.: "4xx: outside
  -- 24h window", "timeout", "5xx: ..."). Nunca incluir corpo de resposta
  -- da Meta que possa conter dado do cliente final ou qualquer segredo —
  -- só uma descrição curta do erro.
  last_response_error text,

  -- Quantas tentativas de envio já foram feitas. Usado para o teto de
  -- retries (limite definido na implementação do worker, não aqui).
  retry_count integer not null default 0
    check (retry_count >= 0),

  -- Próxima vez em que uma nova tentativa (envio ou reverificação) pode
  -- ocorrer — calculado pelo código (backoff exponencial sobre
  -- retry_count), não por trigger. Só faz sentido enquanto uma resposta
  -- ainda está em andamento.
  next_retry_at timestamptz
    check (next_retry_at is null or response_status in ('sending', 'ambiguous')),

  -- =======================================================================
  -- payload — schema concreto, NUNCA o payload bruto da Meta
  -- =======================================================================
  -- Formato exigido (validado pelo CHECK abaixo):
  --   { "entry_id": text, "time": number, "item_count": integer,
  --     "item_types": text[] }
  -- item_types ⊆ {"message","comment"}.
  --
  -- Nunca incluir: texto de mensagem/comentário, nome de remetente ou
  -- comentarista, ids de item individual, token/secret, e NUNCA mídia
  -- bruta (áudio, imagem, vídeo ou URL de mídia) — retrieval de mídia,
  -- quando existir, é responsabilidade de uma etapa própria, com sua
  -- própria política de retenção, nunca armazenada nesta tabela.
  --
  -- Sem DEFAULT de propósito: um valor default violaria o próprio CHECK,
  -- e mascarar isso com um default artificial esconderia inserts que
  -- esqueceram de montar o payload correto.
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
-- Índices — mantidos exatamente os já aprovados, nenhum novo
-- =========================================================================
-- Um índice parcial em (response_status, next_retry_at) seria útil para
-- a futura consulta de recovery, mas não foi aprovado nesta fase — fica
-- registrado como consideração futura, não implementado agora.
create index if not exists instagram_webhook_events_agent_id_idx
  on public.instagram_webhook_events (agent_id);

create index if not exists instagram_webhook_events_instagram_user_id_idx
  on public.instagram_webhook_events (instagram_user_id);

-- =========================================================================
-- RLS — REVOKE explícito, não depender de RLS-sem-policy implícito
-- =========================================================================
alter table public.instagram_webhook_events enable row level security;

revoke all on public.instagram_webhook_events
  from authenticated, anon;

-- Nenhuma policy é criada — só service_role acessa esta tabela.

commit;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- begin;
--   drop table if exists public.instagram_webhook_events;
-- commit;
--
-- Seguro e completo: tabela nova, sem dependentes.

-- =========================================================================
-- Retenção operacional (avaliada, NÃO implementada nesta migration)
-- =========================================================================
-- Alvo: 90 dias corridos a partir de created_at. Não guarda mídia bruta
-- (ver seção payload acima). Implementação requer pg_cron — confirmado
-- NÃO instalado neste projeto (list_extensions, installed_version=null):
--   select cron.schedule(
--     'purge_instagram_webhook_events',
--     '0 4 * * *',
--     $$ delete from public.instagram_webhook_events
--        where created_at < now() - interval '90 days' $$
--   );
-- Não criar este job agora.

-- =========================================================================
-- Nota pgmq — NÃO instalado neste projeto (confirmado, ver INST-05B)
-- =========================================================================
-- Decisão INST-06: PostgreSQL outbox, sem fila dedicada, para o MVP.
-- pgmq permanece não instalado e fora de escopo.
