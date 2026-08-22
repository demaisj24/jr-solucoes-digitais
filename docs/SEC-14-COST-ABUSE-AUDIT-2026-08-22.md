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

**SEC-14 permanece BLOCKED para merge até teste real + revisão adversarial.**

O hardening está isolado em branch própria. `main` não foi alterada.
