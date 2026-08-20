# VENCIVO — INST-05B: Idempotência de eventos Instagram

**Branch:** `feat/instagram-idempotency-design`  
**Base:** `feat/instagram-identity-migration`  
**Status:** desenho técnico — **não aplicar migration**.

## Objetivo

Garantir que uma mesma entrada do webhook do Instagram não seja processada duas vezes, sem criar o risco de considerar como "duplicado" um evento que foi registrado mas cujo processamento caiu no meio.

## Problema identificado no desenho inicial

`provider_event_id UNIQUE` é suficiente para deduplicação de registro, mas não é suficiente para garantir entrega/processamento.

Cenário:

1. evento chega;
2. linha é inserida;
3. processamento começa;
4. processo cai antes de `processed_at`;
5. Meta reenvia o evento;
6. uma checagem apenas por `provider_event_id` pode descartá-lo como duplicado.

Isso pode causar perda silenciosa de mensagem.

## Estado mínimo proposto

A tabela deve distinguir **recebimento**, **processamento**, **sucesso** e **falha recuperável**.

Estados:

- `received` — evento registrado e ainda não processado;
- `processing` — worker assumiu o evento;
- `processed` — processamento concluído com sucesso;
- `failed` — última tentativa falhou e o evento pode ser reprocessado.

Campos adicionais propostos:

- `status text not null` com CHECK nesses quatro valores;
- `attempts integer not null default 0`;
- `processing_started_at timestamptz`;
- `processed_at timestamptz`;
- `last_error_at timestamptz`;
- `last_error_code text` — somente código categórico, nunca segredo ou payload sensível;
- `updated_at timestamptz not null default now()`.

## Lease contra evento preso

`processing` não pode ser permanente.

Um worker deve considerar recuperável um evento cujo `processing_started_at` ultrapassou um timeout definido pela aplicação. O worker pode então reassumir o evento e incrementar `attempts`.

O timeout exato **não é fixado nesta fase**, porque depende do contrato final do processamento de Direct/áudio/imagem e deve ser validado com testes de latência antes da implementação.

## Regra de deduplicação

A chave `provider_event_id` continua UNIQUE.

Ao receber um evento existente:

- `processed` → não processar novamente;
- `received` → pode ser assumido por worker;
- `failed` → pode ser reprocessado conforme política de retry;
- `processing` recente → não assumir simultaneamente;
- `processing` expirado → recuperar por lease/claim atômico.

A decisão deve ser feita no backend/service role, não pelo navegador.

## Claim atômico

O processamento deve evitar dois workers assumirem o mesmo evento.

O mecanismo preferido é uma operação transacional/atômica equivalente a:

```text
status = received OR status = failed
OR status = processing AND processing_started_at expirado
        ↓
status = processing
attempts = attempts + 1
processing_started_at = now()
```

A implementação concreta pode usar `UPDATE ... WHERE ... RETURNING` ou função SQL dedicada, desde que a operação seja atômica. Não usar sequência `SELECT → UPDATE` separada para claim.

## Falhas

Falhas transitórias não devem apagar o evento.

Após erro:

```text
processing → failed
```

registrando apenas metadados seguros.

Não registrar em `last_error_code`, logs ou payload:

- access token;
- chave de criptografia;
- conteúdo integral da mensagem;
- headers secretos;
- URLs assinadas de mídia.

## Payload

O desenho original de `payload jsonb` permanece deliberadamente mínimo. Não armazenar automaticamente o payload bruto da Meta.

A política de retenção de conteúdo conversacional ainda precisa ser definida antes de persistir texto, áudio, imagens ou URLs de mídia.

## Multi-tenant

`agent_id` pode permanecer nullable no evento inicial, porque o webhook pode chegar antes de uma conexão válida ser resolvida.

Quando `agent_id` existir, o backend deve resolver a conexão por `instagram_user_id` e validar a relação de ownership antes de processar.

Não confiar em `agent_id` fornecido pelo cliente.

## Índices

Além do UNIQUE de `provider_event_id`, o desenho final deve avaliar índice para recuperação de trabalho pendente, por exemplo em `status` + `created_at`/`processing_started_at`. O índice exato será definido junto da query de claim para evitar índice sem consumidor real.

## RLS / acesso

A tabela é infraestrutura de backend. Manter RLS habilitada e nenhum acesso direto de `anon`/`authenticated`; o processamento usa `service_role` no servidor.

## Fora de escopo

Esta fase NÃO implementa:

- migration de produção;
- handler de webhook;
- Direct;
- comentários;
- áudio;
- download de mídia;
- Gemini;
- resposta automática;
- leads/CRM;
- OAuth;
- `decrypt()`.

## Gate para aplicação

Antes de aplicar a tabela em produção, exigir:

1. revisão do schema final;
2. revisão da query/função de claim atômico;
3. teste de concorrência com dois workers;
4. teste de crash entre claim e processamento;
5. teste de retry de `failed`;
6. teste de recuperação de `processing` expirado;
7. confirmação de que `instagram_connections` permanece intacta;
8. `get_advisors` após migration;
9. nenhum dado real necessário para o teste — a tabela pode ser validada com dados sintéticos e removidos ao final, ou em ambiente de desenvolvimento.

## Decisão atual

**Não aplicar `docs/sql/instagram-webhook-events.sql` como está.**

O arquivo original é uma boa base de identidade/deduplicação, mas precisa incorporar estado de processamento e recuperação antes de virar infraestrutura de produção.
