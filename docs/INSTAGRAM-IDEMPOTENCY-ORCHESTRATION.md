# VENCIVO — INST-08D: orquestração de idempotência (fecha a lacuna do INST-08C)

**Branch:** `feat/instagram-idempotency-orchestration`
**Base:** `feat/instagram-e2e-internal-test` (INST-04A+08A+08B+08C combinados), a partir de `main` @ `fd87fa4`

## Onde a orquestração entra — análise antes de codar

Reli `api/instagram-webhook.js` (INST-04A): a rota `POST` hoje só valida assinatura e formato e responde `200` — **de propósito, não processa nada** (comentário do próprio arquivo: "Fundação apenas: nenhuma chamada ao agente/Gemini, nenhuma persistência..."). Colocar a orquestração completa (insert + resolução + Gemini, que pode levar até 8s pelo timeout já existente) **dentro** do handler do webhook mudaria esse desenho deliberado e arriscaria a resposta rápida que a Meta espera de um webhook — decisão que não foi pedida aqui e que eu não tomo sozinho.

**Decisão:** a orquestração vira uma função nova, importável, em `lib/instagram-webhook-orchestrator.js` — no mesmo padrão de `lib/instagram-resolve-agent.js` (INST-08A) e `lib/instagram-process-event.js` (INST-08B): fora de `api/` (nunca conta contra o limite de Serverless Functions), não é um endpoint, não é chamada por nada em produção ainda. Ela recebe um `entry` já validado (o mesmo formato que `api/instagram-webhook.js` já aceita) e faz exatamente o que foi pedido: `dedupeKeyForEntry()` → `INSERT ... ON CONFLICT (provider_event_id) DO NOTHING` → só processa se realmente inseriu. **Quem chama essa função (o próprio webhook, de forma assíncrona, ou um mecanismo futuro) é uma decisão de uma tarefa posterior — não implementada aqui**, para não criar o "worker definitivo" vedado pela regra 9.

## `service_role` — como já é usado, reaproveitado sem expor nada novo

Confirmado no código existente (`api/webhooks/asaas.js`, `lib/instagram-resolve-agent.js`, `lib/instagram-process-event.js`): `process.env.SUPABASE_SERVICE_ROLE_KEY` é lido só no servidor, nunca respondido ao cliente, enviado em cada chamada via headers `apikey` e `Authorization: Bearer` para `https://uxmlmyhiagjefuufanyg.supabase.co/rest/v1/...`. A nova função usa exatamente o mesmo padrão — nenhum mecanismo novo de autenticação, nenhuma credencial nova.

**Mecanismo de idempotência real usado — já comprovado no repositório:** `api/webhooks/asaas.js` já faz exatamente isso para `billing_events` — `POST` com header `Prefer: resolution=ignore-duplicates,return=representation`. Se a linha já existe (conflito com a `UNIQUE`), o PostgREST **não insere nada e devolve um array vazio**, em vez de erro. Se insere, devolve a linha criada. É o próprio Postgres, via a constraint `UNIQUE(provider_event_id)` (já aplicada, INST-05B), que decide — não é uma checagem em JavaScript. Reaproveitado aqui sem alteração do mecanismo.

## Fluxo implementado

```
entry (já validado pelo webhook)
        │
        ▼
dedupeKeyForEntry(entry)  -- reaproveitado de api/instagram-webhook.js (INST-04A), sem duplicar
        │
        ▼
POST instagram_webhook_events, Prefer: resolution=ignore-duplicates,return=representation
        │
   array vazio? ──► { ok:false, reason:'duplicate_event' }  -- Gemini NUNCA é chamado
        │ array com 1 linha (inserção real)
        ▼
extrai texto da mensagem do entry (só Direct de texto — áudio fora de escopo)
        │
   sem texto extraível? ──► { ok:false, reason:'unsupported_entry_type', persisted:true }
        │
        ▼
processInstagramMessage()  (INST-08B, reaproveitado sem duplicar)
        │
        ▼
resultado + persisted:true + providerEventId
```

## Decisões de escopo explícitas (não inventadas, registradas)

- **`status` da linha não é alterado por esta orquestração.** O `INSERT` grava com o `DEFAULT 'received'` já existente; nem sucesso nem falha do Gemini fazem esta função tocar `status`/`processed_at`. Isso é deliberado: a regra 6 veda implementar `response_status`, e por precaução de escopo (regra "SOMENTE essa orquestração") não estendi isso para gerenciar transições de `status` também — ficaria fácil de inventar uma semântica de retry que ninguém pediu. Efeito prático: se o Gemini falhar depois do insert (cenário do teste E), a linha **permanece com `status='received'`**, trivialmente recuperável por uma futura rotina de recovery (`WHERE status='received' AND created_at < ...`) — não implementada aqui.
- **`agent_id` não é preenchido no INSERT.** No momento da inserção ainda não sabemos o agente (a resolução acontece depois, só se o evento for novo). Consistente com o comentário original do INST-05B ("nullable de propósito").
- **Só Direct de texto.** Um `entry` de comentário, ou de Direct sem texto (áudio, imagem — fora de escopo), é persistido (deduplicado corretamente) mas não chega ao Gemini — `unsupported_entry_type`.

## O que NÃO foi feito (por instrução explícita)

Nenhum envio ao Instagram. Nenhum `response_status`. Nenhum áudio. Nenhuma instalação de pgmq. Nenhum worker (a função não é chamada por nada automaticamente). Nenhuma alteração em `main`. Nenhuma migration nova aplicada. Nenhuma alteração de schema (a tabela já tinha tudo que esta orquestração precisa, desde o INST-07).
