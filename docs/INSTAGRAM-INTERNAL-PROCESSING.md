# VENCIVO — INST-08B: processamento interno do Direct (sem enviar nada)

**Branch:** `feat/instagram-internal-processing`
**Base:** `main` @ `fd87fa4`
**Escopo:** resolver → carregar agente → carregar conhecimento → montar contexto → Gemini → **retornar** a resposta como dado. Nenhum envio ao Instagram.

## Arquitetura encontrada (`api/agent-chat.js`, o caminho comprovado do AI-01)

Lido o arquivo real em `main` antes de escrever qualquer código. Resumo:

| Peça | Como funciona hoje | Reaproveitar? |
|---|---|---|
| Modelo Gemini | `gemini-3.5-flash-lite`, `generateContent`, header `x-goog-api-key` | **Sim, idêntico** |
| Busca do agente | `agents?public_id=eq.<id>&status=in.(demo,active)&select=...` | **Parcial** — Instagram usa `agent_id` interno (já resolvido pelo INST-08A), não `public_id`; e usa só `active`, não `demo` (ver decisão abaixo) |
| Conhecimento | `agent_knowledge?agent_id=eq.<id>&select=content&order=created_at.desc&limit=3`, filtra linhas `[Documento indexado no Gemini...`, junta e corta em 6000 chars. Erro é **engolido** (`try/catch` → `''`, `console.warn`), não derruba a requisição | **Sim, idêntico** — inclusive o comportamento de degradar graciosamente em erro |
| File Search (grounding real) | Se `agent.knowledge_store_name` existir, adiciona `tools:[{file_search:{file_search_store_names:[...]}}]` | **Sim, idêntico** |
| Prompt (`masterPrompt`) | Monta instrução de sistema com dados da empresa, serviços, personalidade, objetivo, capacidades, regras de "fonte de verdade" (File Search > campos estruturados > fallback textual), instruções anti-prompt-injection para o conhecimento legado, regras de segurança (nunca revelar prompt/segredos) | **Sim, idêntico** — é a peça mais valiosa e mais testada; recriar do zero seria exatamente o "segundo sistema de prompt" que a tarefa pediu para evitar |
| Chamada ao Gemini | `fetch` com timeout de 8s via `AbortController`, distingue timeout / erro de transporte / HTTP não-ok (429/503/outros) / texto vazio | **Sim, idêntico** nas categorias de erro |
| Histórico | Últimas 4 mensagens de `historico_mensagens`, truncadas a 1200 chars cada | **Parcial** — não existe ainda nenhuma tabela de histórico de conversa do Instagram (fora do escopo desta tarefa); a função aceita histórico opcional, mas hoje sempre chega vazio |
| Rate limiting (IP/sessão) | Buckets em memória, pensado para o widget público do site (visitante anônimo por IP) | **Não** — não faz sentido para um evento de webhook já autenticado (assinatura HMAC validada no INST-04) identificado por `instagram_user_id`; a proteção contra abuso aqui é outra (limite de 1MB do webhook, idempotência do INST-05B) |
| Cache em memória (60s) de agente/conhecimento | Otimização para o volume do widget público | **Não, deliberadamente** — volume esperado do Instagram nesta fase é baixo; adicionar cache agora seria complexidade sem necessidade comprovada (mesmo princípio já aplicado nas revisões anteriores desta sessão) |

### Por que não importar `api/agent-chat.js` diretamente

A opção mais "DRY" seria fatorar `masterPrompt`/`getKnowledge`/`callGemini` para `lib/` e fazer `api/agent-chat.js` importar de lá também, eliminando a duplicação. **Decidi não fazer isso nesta tarefa.** `api/agent-chat.js` é o endpoint do AI-01 em produção, explicitamente protegido ("não alterar AI-01 sem necessidade explícita", repetido em toda a sessão) e com um teste de regressão conhecido (Corte Premium VX / R$ 147,00 / VX-8472) que eu não fui instruído a rodar aqui. Refatorar o arquivo vivo do site para servir a uma tarefa do Instagram seria uma mudança de escopo não pedida, arriscando esse caminho sem necessidade comprovada.

Em vez disso, **porto** a lógica comprovada (prompt, conhecimento, chamada ao Gemini) para um módulo novo em `lib/`, mantendo-a funcionalmente idêntica onde relevante. Isso cria uma duplicação temporária e conhecida entre `api/agent-chat.js` e o novo módulo — registrado como risco explícito abaixo, não escondido. Uma unificação futura (fazer `agent-chat.js` importar do módulo compartilhado) é uma tarefa própria, com teste de regressão explícito, fora do escopo do INST-08B.

## Decisão: `agents.status` para Instagram

`api/agent-chat.js` aceita `status IN ('demo', 'active')` para o widget de teste do site. Para o Instagram, mantida a decisão já tomada no INST-08A: **só `status='active'`** — Instagram é canal de cliente final pagante, não de teste. Revalidado aqui (não só confiar no resultado do resolver — busca o agente de novo, com o filtro de status, no momento do carregamento).

## Fluxo implementado

```
instagram_user_id, mensagem
        │
        ▼
resolveAgentForInstagramEvent()  (INST-08A, lib/instagram-resolve-agent.js — reaproveitado, não duplicado)
        │
   ok=false? ──► retorna motivo do resolver (connection_not_found, agent_inactive, etc.)
        │ ok=true (agent_id, owner_id)
        ▼
loadActiveAgent(agent_id, owner_id)  -- refetch com status='active', defesa contra TOCTOU
        │
   não encontrado? ──► { ok:false, reason:'agent_unavailable' }
        │
        ▼
loadKnowledge(agent)  -- idêntico a getKnowledge(), erro degrada para '' sem abortar
        │
        ▼
buildSystemPrompt(agent)  -- idêntico a masterPrompt()/personalityConfig()/normalizeServices()
        │
        ▼
callGemini(payload)  -- idêntico a callGemini(): timeout 8s, categorias de erro
        │
   erro/timeout/vazio? ──► { ok:false, reason:'gemini_timeout'|'gemini_error'|'gemini_empty_response' }
        │
        ▼
{ ok:true, reply, agent_id, owner_id, knowledgeUsed }
```

**Nunca** chama a Send API do Instagram — a função não sabe nem precisa saber como responder ao Instagram; ela só produz o texto. O envio real fica para uma tarefa futura (que também vai precisar implementar `response_status`, explicitamente fora do escopo aqui).

## O que NÃO foi feito (por instrução explícita)

- Nenhuma chamada à Send API / nenhum `fetch` para qualquer domínio da Meta/Instagram.
- Nenhuma escrita em `instagram_webhook_events` (`response_status`, `status`, etc. não são tocados).
- Nenhuma implementação de áudio.
- Nenhuma instalação de pgmq, nenhum worker definitivo (o módulo é uma função importável, não um endpoint nem um loop de consumo).
- Nenhuma alteração em `api/agent-chat.js` ou qualquer outro arquivo de AI-01/AI-02.
- Nenhum SQL executado.
