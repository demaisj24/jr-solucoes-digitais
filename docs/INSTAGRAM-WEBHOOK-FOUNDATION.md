# VENCIVO — Fundação do Webhook Instagram (INST-04 / INST-04A)

**Branch:** `feat/instagram-webhook` (fundação) → `fix/instagram-webhook-raw-body` (INST-04A, migração de formato)
**Endpoint:** `api/instagram-webhook.js` → `/api/instagram-webhook`
**Depende de:** nada em produção. Não requer a branch `feat/instagram-foundation` (OAuth) para existir — reaproveita apenas o nome de variável `INSTAGRAM_APP_SECRET` já previsto em `docs/INSTAGRAM-INTEGRATION-PLAN.md` (branch OAuth) para manter um único segredo do App por ambiente.

## INST-04A — formato Web Request/Response

A partir de `fix/instagram-webhook-raw-body`, o handler usa o formato Web padrão (`export async function GET(request)` / `export async function POST(request)`), documentado em `vercel.com/docs/functions/runtimes/node-js` como suportado sem configuração adicional. Esse formato **não passa pela camada de helpers automáticos** (`request.query`/`.cookies`/`.body`) que existe só no formato Node clássico `(req, res)` — logo não há mais nenhuma dependência de `export const config = { api: { bodyParser: false } }` (removido) nem incerteza sobre se esse `config` é honrado. O corpo chega sempre como bytes brutos via `request.body` (ReadableStream padrão), lido em streaming com o mesmo corte antecipado em 1 MB de antes.

Esse é o único arquivo do repositório usando esse formato — todos os outros `api/*.js` continuam no formato Node `(req,res)` clássico. A documentação da Vercel confirma que os dois formatos podem coexistir no mesmo diretório `api/`, detectados por arquivo.

## O que este endpoint faz

- `GET` — implementa a verificação do webhook da Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`), respondendo o `challenge` em texto puro somente quando o modo é `subscribe` e o token bate com `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
- `POST` — lê o corpo bruto via `request.body` (stream padrão Web, sem parsing automático possível), valida `X-Hub-Signature-256` com HMAC-SHA256 usando `INSTAGRAM_APP_SECRET` (comparação em tempo constante), faz parse do JSON, aceita somente `payload.object === 'instagram'` com `entry[]` estruturalmente válido, e responde `200` sem processar nada.

## O que este endpoint deliberadamente NÃO faz (fica para INST-05+)

- Não persiste nenhum evento no Supabase.
- Não deduplica de fato — apenas expõe `dedupeKeyForEntry(entry)`, uma função pura e determinística que o INST-05 usará para persistir com `unique constraint` (mesmo padrão de `billing_events` em `api/webhooks/asaas.js`).
- Não resolve `instagram_user_id -> agent_id`.
- Não chama Gemini/File Search nem o motor do agente.
- Não envia nenhuma resposta ao Instagram (Direct ou comentário).
- Não cria tabela nem executa SQL. Quando o INST-05 precisar de uma tabela de eventos, seguir o modelo de `docs/instagram-connections.sql` (na branch `feat/instagram-foundation`): SQL revisável em `docs/`, aplicado manualmente após aprovação.

## Variáveis de ambiente

| Variável | Uso | Observação |
|---|---|---|
| `INSTAGRAM_APP_SECRET` | Valida `X-Hub-Signature-256` no `POST` | Mesmo App Secret já previsto para o OAuth (`feat/instagram-foundation`). Nunca no frontend. |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Valida `hub.verify_token` no `GET` | Novo. Definido pelo desenvolvedor no momento de configurar o webhook no App Dashboard da Meta — **não configurar na Meta nesta tarefa**. |

Sem essas variáveis configuradas, o endpoint responde `503` e não vaza qual delas falta.

## Segurança

- Corpo lido como bytes brutos via `request.body` (formato Web Request, sem camada de parsing automático) — a assinatura é calculada sobre os bytes exatos recebidos, não sobre um JSON re-serializado.
- `X-Hub-Signature-256` comparado com `crypto.timingSafeEqual` após validar formato hex de 64 caracteres.
- `hub.verify_token` também comparado em tempo constante.
- Limite de 1 MB por payload (`413` acima disso).
- Nenhum log grava o corpo bruto, texto de mensagem/comentário ou os segredos — só metadados (`object`, quantidade de `entry`).
- Eventos autenticados fora do escopo (`object !== 'instagram'`) recebem `200 { ignored: true }` para não gerar retentativa da Meta, mas não são processados.

## Testes

`tests/instagram-webhook.test.js`, usando o test runner nativo do Node (`node --test`) — nenhuma dependência nova foi instalada, pois o repositório não tinha framework de testes.

Rodar com:

```
node --test tests/instagram-webhook.test.js
```

15 testes, cobrindo os 10 cenários obrigatórios do INST-04 mais 5 casos extras (limite de tamanho, método não suportado, ausência de vazamento de segredo nas respostas, e os dois `503` de configuração ausente).

## Achado arquitetural (documentado, não alterado)

A branch remota `feat/vencivo-instagram-intelligence` (commit `aa695fb`) contém uma implementação anterior e não integrada de `api/webhooks/instagram.js`, além de alterações em `api/agent-chat.js` e `api/agents.js` e uma reescrita divergente de `VENCIVO-MASTER-STATE.md`/`VENCIVO-HANDOFF.md`. Ela não é referenciada por nenhum documento de controle atual (`VENCIVO-CURRENT-TASK.md`, `VENCIVO-MULTI-AI-PROTOCOL.md`) e mexe em áreas hoje protegidas (AI-01/agentes) fora do escopo desta tarefa.

**Impacto:** nenhum no curto prazo — branch isolada, não mergeada. Risco de confusão futura se alguém tentar reaproveitá-la sem revisão, já que ela diverge do protocolo atual (não usa `INSTAGRAM_APP_SECRET`, não tem idempotência, mexe em arquivos fora do escopo do webhook).

**Opções:** (a) arquivar/deletar a branch após confirmação do dono do produto; (b) manter apenas como referência histórica sem promovê-la.

**Recomendação:** não mesclar nem reaproveitar código dela; se necessário, extrair só a ideia (que já foi incorporada aqui) e arquivar a branch numa decisão explícita fora do escopo do INST-04.
