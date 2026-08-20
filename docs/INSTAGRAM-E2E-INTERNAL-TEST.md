# VENCIVO — INST-08C: integração interna completa (só mocks)

**Branch:** `feat/instagram-e2e-internal-test`
**Base:** `feat/instagram-internal-processing` (INST-08A+08B) + cherry-pick de INST-04A (`api/instagram-webhook.js`), a partir de `main` @ `fd87fa4`

## Fluxo executado (real, não simulado, exceto Supabase/Gemini mockados)

```
payload realista (mesma estrutura de tests/instagram-webhook.test.js, INST-04A)
        │
        ▼
api/instagram-webhook.js — POST(request) REAL   -- valida HMAC-SHA256, formato, aceita
        │
        ▼
extrai entry.id (instagram_user_id) e messaging[0].message.text
        │
        ▼
lib/instagram-resolve-agent.js — resolveAgentForInstagramEvent()  (INST-08A, real)
        │
        ▼
lib/instagram-process-event.js — processInstagramMessage()  (INST-08B, real)
   carrega agente -> conhecimento -> monta prompt -> Gemini (mockado) -> resposta interna
```

Só duas coisas são mockadas: as respostas HTTP do Supabase e do Gemini (via `global.fetch`). O handler do webhook, a resolução e o processamento rodam com o código real, não reimplementado.

## Lacuna confirmada — idempotência de processamento

**Pedido:** confirmar que o mesmo evento não chega duas vezes ao processamento interno quando a camada de idempotência estiver envolvida.

**Resultado: a arquitetura atual NÃO consegue provar isso — e não é um problema de schema.** `instagram_webhook_events.provider_event_id` já é `UNIQUE` (aplicado no INST-05B), e `dedupeKeyForEntry()` já calcula a chave corretamente e de forma estável (testado agora: mesma entrada → mesma chave, sempre). **O que não existe é o código que liga as duas coisas.** Nem `api/instagram-webhook.js` (INST-04A), nem `lib/instagram-resolve-agent.js` (INST-08A), nem `lib/instagram-process-event.js` (INST-08B) fazem qualquer `INSERT` em `instagram_webhook_events`. Não existe hoje nenhuma função que:

1. calcule `dedupeKeyForEntry(entry)`;
2. tente `INSERT ... ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`;
3. só chame `processInstagramMessage()` se o insert retornou uma linha nova.

Provado com teste real (`tests/instagram-e2e-internal.test.js`, "LACUNA CONFIRMADA"): rodar o pipeline completo duas vezes com o **mesmo payload assinado** resulta em **2 chamadas reais ao Gemini** — nada no código atual impede isso. Um segundo teste ("SE existisse uma checagem...") simula em memória (não é código de produção) o que o `INSERT ... ON CONFLICT` faria, e confirma que a peça que falta, uma vez existindo, resolveria o problema — ou seja, os componentes individuais (hash determinístico, constraint `UNIQUE`) estão corretos; só falta a orquestração que os une.

**Não inventei essa orquestração aqui**, conforme instruído — fica registrada como a peça exata que falta para uma tarefa futura (o "worker"/orquestrador explicitamente fora de escopo de INST-08A/08B/08C).

## Comparação curta: `api/agent-chat.js` vs. `lib/instagram-process-event.js`

| | `api/agent-chat.js` | `lib/instagram-process-event.js` |
|---|---|---|
| É um endpoint Vercel | Sim (rota HTTP pública do widget do site) | Não — módulo importável, fora de `api/` de propósito |
| Filtro de `agents.status` | `demo` + `active` | só `active` (decisão deliberada, canal de cliente final) |
| Busca o agente por | `public_id` | `id` interno + `owner_id` (já resolvido) |
| Rate limit por IP/sessão | Sim (buckets em memória) | Não — não se aplica a um evento de webhook já autenticado |
| Cache em memória (60s) | Sim | Não — simplificação deliberada, sem necessidade comprovada ainda |
| Prompt/conhecimento/chamada Gemini | Original | Portado, funcionalmente idêntico |
| Retorna | Resposta HTTP ao navegador | Dado (`{ok, reply, agent_id, owner_id, knowledgeUsed}`) — quem chama decide o que fazer |

**Não unificados.** Continuam sendo dois arquivos com lógica parcialmente duplicada — risco já registrado no INST-08B, mantido aqui sem alteração. Unificar (fazer `agent-chat.js` importar de um módulo compartilhado) é uma tarefa própria, com o teste de regressão do AI-01 (Corte Premium VX / R$ 147,00 / VX-8472) rodado explicitamente antes/depois — não feita aqui.

## O que NÃO foi feito (por instrução explícita)

- Nenhuma chamada a qualquer URL da Meta/Instagram (confirmado por teste dedicado, verificando todas as URLs chamadas em todo o pipeline).
- Nenhum webhook real configurado na Meta.
- Nenhum secret de produção configurado — todos os valores usados são de teste, gerados localmente, nunca persistidos.
- Nenhuma alteração em `main`.
- Nenhum SQL aplicado.
- Nenhuma instalação de pgmq.
- Nenhuma implementação de áudio.
- Nenhuma solução de idempotência inventada — a lacuna foi reportada, não resolvida.
