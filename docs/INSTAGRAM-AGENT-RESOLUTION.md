# VENCIVO — INST-08A: resolução `instagram_webhook_events → agent_id`

**Branch:** `feat/instagram-agent-resolution`
**Base:** `main` @ `fd87fa4`
**Escopo:** só resolução de identidade (evento → agente). Sem Gemini, sem resposta ao Instagram, sem worker, sem pgmq, sem áudio.

## Análise forense — schema real confirmado agora (não presumido)

Consultado `information_schema.columns` + `pg_constraint` nesta sessão, contra o banco real:

- `instagram_connections`: `owner_id uuid NOT NULL`, `agent_id uuid NOT NULL`, `status text NOT NULL DEFAULT 'active'` com `CHECK IN ('active','revoked','error')`, `UNIQUE(instagram_user_id)`, `UNIQUE(agent_id)`, FK composto `instagram_connections_agent_owner_fkey (agent_id, owner_id) → agents(id, owner_id) ON DELETE CASCADE`.
- `agents`: `owner_id uuid` **nullable** (42 de 55 linhas hoje têm `owner_id IS NULL` — agentes sem dono, confirmado no INST-05), `status text NOT NULL DEFAULT 'demo'` com `CHECK IN ('draft','demo','active','paused','archived')`, `UNIQUE(id, owner_id)`.
- `instagram_webhook_events`: `agent_id uuid` nullable, FK simples `→ agents(id) ON DELETE SET NULL` (não composto — só aponta pro agente, sem repetir `owner_id` aqui).

## Fluxo de resolução

```
entry.id (webhook)  ──►  instagram_user_id
                              │
                              ▼
                 instagram_connections (UNIQUE instagram_user_id)
                              │
                    status='active'? ──► não: connection_revoked | connection_error
                              │ sim
                              ▼
                 agents WHERE id=connection.agent_id AND owner_id=connection.owner_id
                              │
                    encontrado? ──► não: agent_not_found
                              │ sim
                    agent.owner_id == connection.owner_id? ──► não: owner_mismatch (defesa extra)
                              │ sim
                    agent.status='active'? ──► não: agent_inactive
                              │ sim
                              ▼
                    { agent_id, owner_id }
```

### Por que revalidar `owner_id` na aplicação, já existindo o FK composto

O FK `instagram_connections_agent_owner_fkey` já garante, a nível de banco, que **toda linha em `instagram_connections`** só pode existir com `(agent_id, owner_id)` correspondendo a um `agents` real com o mesmo par — isso torna a inconsistência estruturalmente impossível **enquanto a escrita respeitar o FK**. Mas a instrução é explícita: *"não confiar somente no frontend"* — e por extensão, não confiar só numa constraint de escrita para proteger uma leitura que decide qual cliente recebe a resposta de qual agente. A função de resolução compara `agent.owner_id === connection.owner_id` **de novo**, na aplicação, antes de liberar qualquer resultado `ok:true`. Isso é redundante com o FK por desenho — é a rede de segurança que continua funcionando mesmo se um bug futuro no código de escrita, uma migration mal feita, ou uma alteração manual via SQL algum dia violar essa garantia sem eu perceber.

### Definição de cada caso pedido

| Caso | Condição detectada | Resultado |
|---|---|---|
| Resolução válida | conexão `active`, agente encontrado com mesmo `owner_id`, agente `active` | `{ ok: true, agent_id, owner_id }` |
| Conta Instagram inexistente | nenhuma linha em `instagram_connections` para o `instagram_user_id` | `{ ok: false, reason: 'connection_not_found' }` |
| Conexão revogada | `instagram_connections.status = 'revoked'` | `{ ok: false, reason: 'connection_revoked' }` |
| Conexão com erro | `instagram_connections.status = 'error'` | `{ ok: false, reason: 'connection_error' }` |
| Agente inexistente | busca por `id=connection.agent_id AND owner_id=connection.owner_id` não retorna linha | `{ ok: false, reason: 'agent_not_found' }` (defensivo — não deveria acontecer sob o FK composto normal, já que ele cascateia a remoção da conexão junto com o agente) |
| Agente inativo | `agents.status != 'active'` (cobre `draft`, `demo`, `paused`, `archived` — decisão deliberada, ver nota abaixo) | `{ ok: false, reason: 'agent_inactive' }` |
| Cruzamento entre owners | `agent.owner_id !== connection.owner_id` (só alcançável artificialmente nos testes, já que o FK impede na escrita real) | `{ ok: false, reason: 'owner_mismatch' }` |
| `instagram_user_id` malformado | vazio, não-string, ausente | `{ ok: false, reason: 'invalid_instagram_user_id' }` — nem chega a consultar o banco |
| Múltiplos eventos concorrentes | resolução é **só leitura**, sem nenhuma escrita — chamadas concorrentes são naturalmente seguras (sem lock, sem condição de corrida possível, cada chamada é independente e determinística) | mesmo resultado sempre, para o mesmo estado do banco |

**Nota sobre "agente inativo":** decisão deliberada, não suposição — só `status='active'` resolve com sucesso. `demo` fica de fora mesmo sendo o estado padrão pós-criação (`DEFAULT 'demo'`), porque o Instagram é um canal voltado a cliente final pagante; usar um agente `demo` para responder de verdade no Instagram seria expor um agente ainda em teste/validação a conversas reais. Fica registrado como decisão de produto passível de revisão, não uma regra técnica inventada sem critério.

### Concorrência

A resolução em si não precisa de `FOR UPDATE SKIP LOCKED` nem de nenhum lock — é uma leitura pura, sem side effect, sem estado compartilhado mutável no processo. O ponto que **vai** precisar de controle de concorrência é o *claim* de um evento para processamento (`instagram_webhook_events.status: received → processing`), que pertence ao worker — **fora do escopo desta tarefa**, não implementado.

## Decisão de arquitetura — onde este código vive

**Fora de `api/`.** Criado em `lib/instagram-resolve-agent.js` (novo diretório na raiz do projeto), não dentro de `api/`. Motivo: qualquer arquivo dentro de `api/` é tratado pela Vercel como uma Serverless Function — depois de toda a saga do INFRA-01 (limite de 12 no plano Hobby), criar mais um arquivo ali, mesmo que "utilitário", arriscaria estourar o limite de novo sem necessidade, já que este módulo **não é um endpoint** (não há worker/trigger HTTP nesta tarefa). Colocá-lo fora de `api/` garante, de forma inequívoca, que a Vercel nunca o conta como função — sem depender de nenhuma convenção de nome (`_prefixo`, etc.) que eu precisaria verificar.

## O que NÃO foi feito (por instrução explícita)

- Nenhuma escrita em `instagram_webhook_events` (não seta `status`/`agent_id` na linha do evento — a função só resolve e retorna, não persiste). Isso fica para quando o worker (fora de escopo) decidir o que fazer com o resultado.
- Nenhuma chamada a Gemini.
- Nenhum envio de resposta ao Instagram.
- Nenhuma implementação de áudio.
- Nenhuma instalação de pgmq, nenhum worker.
- Nenhum SQL novo aplicado — a resolução usa só leitura sobre o schema já existente.
