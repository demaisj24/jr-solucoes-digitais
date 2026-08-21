# VENCIVO — CONTEXT CHECKPOINT

Data: 2026-08-20

## Fonte oficial

Repositório: https://github.com/demaisj24/jr-solucoes-digitais
Branch de produção: `main`

Este arquivo é um checkpoint de continuidade. Não substitui MASTER STATE, HANDOFF, ROADMAP ou PROTOCOLO.

## Objetivo do produto

VENCIVO é um SaaS premium de agentes de IA para atendimento empresarial, com foco principal em Instagram. O agente deve aprender o conhecimento da empresa, atuar como atendente especialista, responder Direct e comentários e, futuramente, compreender áudio. WhatsApp não é foco do MVP e a integração WhatsApp foi considerada economicamente inviável para o produto atual.

## Arquitetura Instagram — estado consolidado

Fluxo alvo:

Instagram webhook
→ persistência/idempotência PostgreSQL
→ resolução Instagram → agente
→ conhecimento do agente
→ Gemini
→ resposta
→ claim atômico de envio
→ Instagram Send API
→ atualização de `response_status`

Banco:
- `instagram_connections` já foi migrada para incluir `agent_id`, `access_token_encrypted` e FK composto `(agent_id, owner_id) → agents(id, owner_id)`.
- `UNIQUE(instagram_user_id)` e `UNIQUE(agent_id)` foram aplicados.
- `access_token` plaintext foi removido.
- authenticated/anon não possuem SELECT na tabela; service_role mantém acesso interno.
- `instagram_webhook_events` já foi criada com idempotência por `UNIQUE(provider_event_id)`, RLS sem acesso ao cliente e estados de processamento/resposta definidos.

## Peças aprovadas/construídas

- INST-04/04A: webhook Instagram com validação HMAC e leitura segura do corpo.
- INFRA-01: consolidação de `/api/health`, liberando slot de Serverless Function; `main` recebeu o merge e produção ficou READY com 11 functions.
- INST-05 Fase 2: identidade Instagram → agente aplicada no Supabase.
- INST-07: `instagram_webhook_events` aplicada no Supabase.
- INST-08A: resolução segura Instagram → agente.
- INST-08B: processamento interno do evento → conhecimento do agente → Gemini, sem Send API.
- INST-08C: teste E2E interno identificou inicialmente a lacuna de idempotência de processamento.
- INST-08D: orquestração de idempotência com `INSERT ... ON CONFLICT(provider_event_id) DO NOTHING`, impedindo Gemini duplicado após dedupe PostgreSQL.
- INST-09: auditoria da Instagram Send API concluída em desenho, ainda sem envio real.

## Máquina de resposta

`response_status`:

`NULL → sending → sent`

ou

`sending → ambiguous → sent`
`sending → ambiguous → sending → sent`
`sending → ambiguous → failed`
`sending → failed` para 4xx.

Campos aprovados para resposta:
- `response_status`
- `instagram_message_id`
- `response_attempted_at`
- `response_confirmed_at`
- `last_response_error`
- `retry_count`
- `next_retry_at`

`response_check_at` foi descartado.

## Send API auditada

API escolhida: Instagram API with Instagram Login.

Endpoint auditado:
`POST https://graph.instagram.com/v25.0/<IG_ID>/messages`

Autenticação:
`Authorization: Bearer <access_token>` — nunca query string.

Request:
```json
{"recipient":{"id":"<IGSID>"},"message":{"text":"<resposta>"}}
```

Sucesso esperado contém `recipient_id` e `message_id`.

Permissões auditadas:
- `instagram_business_basic`
- `instagram_business_manage_messages`

Existe risco/pendência comercial sobre Advanced Access/App Review para contas de terceiros. Isso precisa ser confirmado com documentação oficial da Meta antes de considerar o produto pronto para escala.

Limite de 1000 bytes UTF-8 foi registrado na auditoria e deve ser confirmado contra documentação oficial antes de tratá-lo como fato definitivo.

## Criptografia — BLOQUEADOR ATUAL

O DeepSeek propôs `lib/instagram-token-crypto.js` para AES-256-GCM, formato `iv.tag.ciphertext` em base64url e chave Base64 de 32 bytes, com validação estrita.

A proposta foi revisada e considerada boa como rascunho, mas NÃO está aprovada para implementação porque o código real de `encrypt()` existente precisa ser localizado no repositório e comparado exatamente.

Antes de implementar decrypt, Claude Code deve auditar:
- algoritmo;
- encoding da chave;
- tamanho da chave;
- IV;
- authTag;
- ordem dos componentes;
- encoding dos componentes;
- AAD, se houver;
- formato exato de `access_token_encrypted`.

Não assumir compatibilidade apenas pelo desenho anterior.

## Revisão independente DeepSeek

O DeepSeek revisou a arquitetura e apontou:
1. validar `owner_id + agent_id` sempre;
2. claim atômico de `response_status='sending'` antes do fetch;
3. tratar concorrência com operação atômica no PostgreSQL, não apenas um lock nominal;
4. resposta como texto puro, com limite de bytes e proteção contra conteúdo abusivo, sem criar sanitizador HTML desnecessário;
5. rate limiting deve existir antes da produção, mas pode ser uma etapa separada;
6. prompt injection e isolamento do conhecimento devem ser auditados na implementação real;
7. áudio futuro é compatível com a arquitetura atual.

## Próximos passos oficiais

1. **INST-09C — Claude Code:** localizar e auditar o `encrypt()` real do Instagram no repositório. NÃO implementar decrypt ainda.
2. **INST-09D:** após aprovação da auditoria, implementar decrypt compatível e testes criptográficos.
3. **INST-09E:** implementar Send API de texto com claim atômico de `response_status`, sem retry automático nesta primeira camada.
4. Testes de concorrência, timeout, 4xx/5xx, ausência de `message_id`, token expirado e segurança de segredo.
5. Validar cuidadosamente Advanced Access/App Review e requisitos comerciais da Meta.
6. Testar integração real de forma controlada antes de produção.
7. Só depois avançar para áudio no Direct.

## Regras de trabalho

- `main` não deve ser alterada diretamente.
- Branch isolada por tarefa.
- Sem merge automático.
- Não aplicar SQL sem aprovação explícita.
- Não configurar secrets de produção sem aprovação.
- Não chamar Meta/Instagram real durante testes locais.
- Não expor tokens.
- Não alterar AI-01/AI-02/checkout/WhatsApp sem tarefa específica.
- GitHub é a fonte da verdade para código e estado técnico.
- Claude Code executa mudanças no repositório real.
- DeepSeek é revisor/gerador auxiliar sem acesso ao repositório.
- ChatGPT atua como arquiteto/revisor final.

## Fluxo multi-IA

ChatGPT = arquiteto/revisor → define tarefas e critérios.

DeepSeek = volume/revisão independente/código proposto sem assumir acesso ao repo.

Claude Code = implementação e verificação no repositório real.

GitHub = fonte oficial da verdade.

Nenhuma IA deve declarar que verificou o repositório sem realmente ter acesso a ele.
