# VENCIVO — SEC-14 Cost/Abuse Surface Audit

Data: 2026-08-22  
Base: `main` @ `0bf259f1487eea88b1e32edae5a132facb48e9f6`  
Branch de hardening: `sec-14-file-search-rate-limit`

## Objetivo

Mapear todas as superfícies atuais que podem gerar custo Gemini e fechar o achado F6 da auditoria anterior: Gemini File Search em `api/agents.js` sem rate limit.

## Mapa de custo Gemini

| Superfície | Entrada | Gemini | Limite antes da SEC-14 | Risco |
|---|---|---|---|---|
| `POST /api/chat.js` | `system_prompt` + mensagem + histórico | `generateContent` | SEC-13: IP 30/h + sessão 10/h, durável | Médio, já mitigado |
| `POST /api/agent-chat.js` | mensagem + contexto do agente | `generateContent`; File Search quando `knowledge_store_name` existe | SEC-13: IP 120/h + sessão 30/h, durável | Médio, já mitigado |
| `POST /api/agents.js?action=prepare` | metadados de arquivo | Não chama Gemini; cria URL assinada de Storage | Nenhum | Pré-condição para abuso |
| `POST /api/agents.js?action=process` | arquivo previamente enviado | cria File Search Store quando necessário; `uploadToFileSearchStore`; polling da operação | **Nenhum** | **ALTO — F6** |
| `POST /api/agents.js` criação de agente | dados do agente/base textual | Não chama Gemini diretamente | SEC-13: criação 5/h por IP | Baixo para custo Gemini |
| `GET /api/agents.js` | consulta de agente | Não chama Gemini | N/A | Sem custo Gemini |

## F6 — confirmação do achado

**Status: FIXED** (rate limiting durável aplicado — ver `Hardening aplicado` abaixo; `knowledge:process:ip` e `knowledge:process:agent`, 5/h cada, gates duráveis/fail-closed via `rate_limit_hit`, reconfirmado nas rodadas de revisão adversarial de HIGH #1/#2 desta sessão). A autenticação de `knowledgeAgent()` continua sendo uma checagem de posse, não um rate limit — os dois mecanismos são distintos e ambos necessários.

`knowledgeAgent()` aceita agentes `demo` sem `owner_id`. Assim, um agente demo anônimo pode ser alcançado sem autenticação. Antes desta correção, `action=process` passava diretamente de `knowledgeAgent()` para `processKnowledge()` sem qualquer chamada a `limited()`.

`processKnowledge()` pode então:

1. ler o arquivo do Storage;
2. criar um File Search Store se o agente ainda não tiver um;
3. enviar o arquivo para `uploadToFileSearchStore`;
4. aguardar a operação do Gemini;
5. registrar o resultado.

Isso transforma uma superfície pública em uma primitiva de consumo do Gemini. O atacante não precisa obter a chave Gemini: a chave fica somente no backend.

O caminho `prepare` também estava sem limite. Ele não gera custo Gemini isoladamente, mas fornece a URL assinada necessária para o atacante colocar novos arquivos no Storage e alimentar o caminho `process`.

Não foi executado um ataque real contra produção porque o objetivo da auditoria é comprovar a superfície sem gerar deliberadamente chamadas pagas. A confirmação é estática e arquitetural, baseada no código efetivamente presente em `main`.

## Impacto financeiro

A documentação oficial do Gemini confirma que File Search em ambiente pago cobra embeddings e que tokens de documentos recuperados entram no uso normal do modelo. A documentação atual também descreve explicitamente a criação do File Search Store e o upload para o store como operações da API. Portanto, ausência de limite no caminho de indexação é uma superfície financeira real, independentemente dos limites de quota do próprio Google.

## Hardening aplicado

### `api/agents.js`

A SEC-14 adiciona rate limiting durável, usando a mesma RPC `rate_limit_hit` já introduzida pela SEC-13:

- `action=prepare`: 10/h por IP + 10/h por agente;
- `action=process`: 5/h por IP + 5/h por agente;
- o limite por IP é consultado antes do lookup do agente;
- o limite por agente usa **somente `a.public_id` retornado pelo banco**, nunca o `agent_id` arbitrário enviado pelo cliente; isso evita reproduzir o problema de cardinalidade ilimitada de chaves que a SEC-13 já corrigiu em `session_id`;
- em `process`, o limite por agente só é consumido depois de o caminho do arquivo ser validado contra o `public_id` canônico;
- os limites de agente são aplicados antes de `processKnowledge()` e, portanto, antes de qualquer chamada que possa chegar ao Gemini;
- `limited()` passa a aceitar limite explícito, preservando `CREATE_LIMIT=5` para criação de agentes;
- falha/timeout do RPC continua **fail-closed**;
- UX usa HTTP 429 com mensagens específicas, sem expor detalhes internos.

### Por que dois eixos

Somente IP não é suficiente contra tráfego distribuído. Somente agente também não é suficiente porque o atacante pode atingir vários agentes públicos. Os dois eixos reduzem ambos os caminhos de abuso sem exigir mudança de UX ou de arquitetura de armazenamento.

## Revisão adversarial adicional

Durante a própria implementação foi identificado um risco secundário: usar o `agent_id` fornecido pelo cliente diretamente na chave persistente de rate limit criaria uma nova superfície de crescimento ilimitado de buckets. Essa versão foi corrigida antes do fechamento da branch: o bucket por agente agora usa o identificador canônico retornado por `knowledgeAgent()`.

A Vercel documenta que `x-forwarded-for` é sobrescrito pela plataforma e não aceita o valor externo do cliente, mantendo a premissa atual do rate limiting por IP enquanto o VENCIVO estiver diretamente atrás da Vercel.

## Limitações remanescentes

- Os limites por agente são limites de abuso, não uma medição financeira exata.
- A superfície `agent-chat` continua com File Search e já possui rate limit próprio; não foi alterada nesta SEC-14 para evitar regressão desnecessária.
- Um atacante distribuído ainda pode tentar criar muitos agentes demo. A criação já possui limite durável de 5/h por IP; uma proteção global de orçamento/quota é uma etapa posterior, não necessária para fechar F6.
- Não foi alterado schema Supabase nesta etapa.

## Critério de aceite SEC-14

- [x] Mapear todas as rotas atuais que chamam Gemini ou habilitam custo Gemini.
- [x] Confirmar F6 no código de `main`.
- [x] Colocar limite antes de `processKnowledge()`.
- [x] Limitar também o precursor `prepare`.
- [x] Evitar chaves persistentes baseadas em identificadores arbitrários do cliente.
- [x] Manter fail-closed no rate limiter.
- [x] Adicionar teste de regressão do ordering e da canonicalização da chave.
- [ ] Executar testes automatizados no ambiente de CI/Claude.
- [ ] Revisão adversarial final.
- [ ] Aprovação explícita antes de merge em `main`.

## Decisão

**SEC-14 original foi mesclada em `main`** via PR #15 (merge commit `ed2281f`), em 2026-08-22.

**Nota de governança/documentação histórica:** este documento e o checklist acima não foram atualizados antes desse merge — os 3 últimos itens (testes automatizados, revisão adversarial final, aprovação explícita) chegaram a `main` marcados como pendentes, sem nenhum registro neste arquivo de que a aprovação explícita tenha sido dada antes do merge acontecer. Registro isso como uma inconsistência de processo, não como uma falha técnica do hardening em si — os testes automatizados e a revisão adversarial foram de fato realizados, só que **depois** do merge, em rodadas de sessão posteriores (ver Addendum abaixo). Não reescrevo o checklist original acima; ele permanece como estava no momento do merge.

O que a Addendum abaixo documenta — a revisão adversarial pós-merge e o hardening adicional (HIGH #1 + HIGH #2) — está implementado e testado numa branch dedicada, **ainda não commitado/pushado**.

---

## Addendum — Revisão adversarial pós-merge: HIGH #1 e HIGH #2

Depois do merge do SEC-14 original em `main` (ver nota de governança acima), uma revisão adversarial dedicada ao código já mesclado encontrou 2 achados HIGH em `ensureStore()`/`processKnowledge()` — ambos analisados, implementados e testados em rodadas de sessão subsequentes, numa branch dedicada (`sec-14-high-hardening`, a partir de `main`@`ed2281f`).

### HIGH #1 — race condition em `ensureStore()`

**Antes:** `check(knowledge_store_name) → cria Store no Gemini → PATCH incondicional`. Duas requisições concorrentes para o mesmo agente, ambas vendo `knowledge_store_name` nulo, podiam criar (e pagar) dois File Search Stores; só o último PATCH "vencia" no banco, o outro Store ficava órfão e cobrado para sempre, sem nenhum cleanup.

**Agora:** `check → cria Store → PATCH condicional (knowledge_store_name IS NULL)`. Quando a requisição perde a corrida: busca o Store vencedor já persistido, **deleta o Store recém-criado por ela própria** (nunca o vencedor), nunca sobrescreve o resultado já persistido. Falha no cleanup do Store perdedor é logada de forma estruturada e observável (nunca mascarada), sem alterar o `knowledge_store_name` já persistido.

Testado com 2 requisições **realmente concorrentes** (não sequenciais): `tests/sec-14-ensure-store-cas.test.js` — **13/13 PASS**.

### HIGH #2 — ausência de deduplicação de documento por conteúdo

**Antes:** o mesmo conteúdo podia ser reenviado para o mesmo agente indefinidamente, cada envio disparando um novo upload/embedding pago no Gemini — `path` (um UUID novo a cada envio) nunca poderia servir de identidade de conteúdo.

**Agora:** SHA-256 calculado sobre os bytes reais já baixados do Storage (nunca do `path`/nome/tamanho isolado, nunca reenviado a serviço externo para calcular) → checagem otimista em `agent_knowledge` por `(agent_id, content_hash)` **antes** de qualquer chamada a `ensureStore`/upload/polling → se encontrado, retorna duplicata sem custo Gemini algum. Defesa final: `UNIQUE (agent_id, content_hash)` parcial no banco — um `23505` no INSERT final é tratado explicitamente (nunca vira erro 500 genérico), a requisição perdedora reconhece o vencedor e devolve um resultado coerente (`status:'duplicate', reason:'concurrent_race_lost'`).

**Registrado explicitamente, não é "zero custo duplicado":** a checagem otimista não impede que **duas requisições concorrentes com o mesmo conteúdo cheguem ambas ao Gemini** — ambas podem completar um upload/embedding pago de verdade — antes que uma delas perca a corrida no INSERT final. A `UNIQUE` constraint impede a **duplicação persistida no banco**, não impede o **custo externo duplicado** que já ocorreu nessa janela de corrida.

Testado com o mesmo padrão de concorrência real: `tests/sec-14-document-idempotency.test.js` — **13/13 PASS**.

### Migration

`supabase/migrations/20260822180549_sec14_agent_knowledge_content_hash.sql` — adiciona `agent_knowledge.content_hash TEXT` (nullable) + índice `UNIQUE (agent_id, content_hash)` parcial (`WHERE content_hash IS NOT NULL`, para não exigir hash retroativo de linhas antigas). O schema já aplicado no projeto Supabase (`uxmlmyhiagjefuufanyg`) corresponde exatamente a este arquivo — verificado por consulta direta ao banco (coluna, tipo, índice, 31 linhas preservadas, 0 com hash retroativo, nenhuma linha antiga alterada). A migration já está aplicada diretamente no banco (não via CI); este arquivo passou a representá-la no repositório nesta rodada.

### Riscos residuais (não resolvidos nesta rodada — permanecem em aberto)

- Crash entre o Gemini confirmar `operation.done` e o INSERT local persistir — pode deixar um documento indexado no Gemini sem nenhum registro local correspondente.
- Custo externo duplicado possível em corrida concorrente com o mesmo conteúdo, antes de qualquer uma perder no `UNIQUE` (ver HIGH #2 acima) — a constraint protege o banco, não o custo já incorrido no Gemini.
- Ausência de teto diário/mensal de uso — só a janela de 1h já existente.
- Ausência de rotina de lifecycle/cleanup para File Search Stores de agentes abandonados.
- Ausência de timeout explícito nas chamadas HTTP ao Gemini dentro de `ensureStore`/`processKnowledge` — o único timeout explícito no arquivo continua sendo o da RPC de rate limit.

Nenhum destes é tratado como resolvido por esta rodada.

### LGPD

`content_hash` é um valor derivado (SHA-256, unidirecional) dos bytes do documento — não é enviado ao Gemini em nenhuma chamada (as 4 únicas referências a ele no código tocam só o Supabase REST), não aparece em nenhum log (os logs da corrida de HIGH #1/#2 carregam só `agent_id`/nome de store, nunca o hash), e não introduz nenhum identificador pessoal novo. Como é derivado do conteúdo do documento — que pode, em tese, conter dado pessoal —, deve acompanhar o mesmo ciclo de retenção/exclusão que a linha de `agent_knowledge` já segue (ou venha a seguir); nenhuma política de retenção nova foi criada nesta rodada.

### Status final desta rodada

- **SEC-14 original (F6):** mesclado em `main` (PR #15, `ed2281f`) — **FIXED**, em produção.
- **SEC-14 HIGH hardening (HIGH #1 + HIGH #2):** implementado e testado (26/26 nos dois testes dedicados) na branch `sec-14-high-hardening`, a partir de `main`@`ed2281f`. **Ainda não commitado, não pushado, não está em produção.**
