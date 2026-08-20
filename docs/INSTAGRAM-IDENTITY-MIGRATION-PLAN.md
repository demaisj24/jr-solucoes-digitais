# VENCIVO — INST-05: Identidade e idempotência Instagram (plano de migration)

**Branch:** `feat/instagram-identity-migration`
**Base:** `main` @ `7943629`
**Status:** proposta — **nenhuma migration foi aplicada ao banco real**.

Esta é a Fase 1 pedida: só desenho. `apply_migration` não foi chamado. `execute_sql` só foi usado para leitura, na fase de análise anterior.

## 1. Migration proposta

`docs/sql/instagram-connections-agent-identity.sql` — ALTER incremental na `instagram_connections` já existente (0 linhas em produção). Resumo dos passos, na ordem:

1. `agents`: adiciona `UNIQUE (id, owner_id)` — aditivo, não rejeita nada (id já é único).
2. `instagram_connections`: adiciona `agent_id uuid` e `access_token_encrypted text`.
3. Remove a coluna `access_token` (texto puro) — tabela vazia, nada a migrar.
4. `agent_id` vira `NOT NULL` + FK **composto** `(agent_id, owner_id) REFERENCES agents(id, owner_id)` — é o mecanismo de integridade multi-tenant (seção 3).
5. Troca a unique constraint de `(owner_id, instagram_user_id)` para `UNIQUE(instagram_user_id)` global + `UNIQUE(agent_id)`.
6. Revoga `SELECT` de `access_token_encrypted` para `authenticated`/`anon` (hardening de coluna, RLS não cobre isso).

## 2. Alterações de constraints

| Constraint | Antes | Depois |
|---|---|---|
| Unicidade de conexão | `UNIQUE(owner_id, instagram_user_id)` | `UNIQUE(instagram_user_id)` (global) + `UNIQUE(agent_id)` |
| `agent_id` | não existe | `NOT NULL`, FK composto para `agents(id, owner_id)` |
| `access_token` | `text NOT NULL` (plaintext) | removida |
| `access_token_encrypted` | não existe | `text NOT NULL` |
| `agents` | `PRIMARY KEY(id)` | + `UNIQUE(id, owner_id)` (pré-requisito do FK composto acima) |

## 3. Estratégia multi-tenant (owner_id de connection == owner_id do agent)

Em vez de um trigger (que precisa ser mantido, testado à parte, e só protege caminhos que passam pela lógica do trigger), uso um **FK composto declarativo**: `FOREIGN KEY (agent_id, owner_id) REFERENCES agents(id, owner_id)`. Isso exige que `agents` tenha `UNIQUE(id, owner_id)` (passo 1) — sem isso o Postgres não aceita o FK composto, porque um FK só pode referenciar uma chave candidata (única) da tabela alvo.

Com isso, é **estruturalmente impossível** — a nível de banco, não de aplicação — inserir uma linha em `instagram_connections` com `agent_id` de um agente cujo `owner_id` seja diferente do `owner_id` da própria conexão. Isso vale mesmo para SQL direto rodado com a service role (só um erro de FK explícito bloquearia), não depende de nenhuma validação de código do backend estar correta. É a garantia mais forte disponível no Postgres para este caso, mais robusta que um trigger `BEFORE INSERT/UPDATE`.

Complementar: o código do backend (o handler que grava a conexão, quando implementado numa tarefa futura) **também** deve validar `agent.owner_id === session.user.id` antes do insert, do jeito que `feat/instagram-foundation` já faz — o FK composto é a rede de segurança do banco, não substitui a validação de posse na camada de aplicação, que continua sendo a primeira linha de defesa (evita até tentar o insert errado).

## 4. Criptografia do token — antes de qualquer `access_token_encrypted`

| Item | Decisão |
|---|---|
| **Algoritmo** | AES-256-GCM (`aes-256-gcm`, Node `node:crypto`) — mesmo já referenciado em `feat/instagram-foundation` (`api/instagram-callback.js`), reaproveitado para manter um único padrão de criptografia no projeto. |
| **Formato armazenado** | string única: `<iv>.<authTag>.<ciphertext>`, cada parte em `base64url`, separadas por `.`. Uma única coluna `text`, sem precisar de colunas separadas para iv/tag. |
| **Nonce/IV** | 12 bytes (96 bits) aleatórios por operação de criptografia, via `crypto.randomBytes(12)` — o tamanho recomendado para GCM. **Nunca reutilizado**: cada `encrypt()` gera um IV novo, mesmo ao re-criptografar o mesmo token (ex.: em uma renovação). |
| **Autenticação** | Built-in do GCM — o `authTag` (16 bytes) gerado por `cipher.getAuthTag()` é armazenado junto e verificado no `decrypt()` via `decipher.setAuthTag(...)`. Qualquer bit alterado no ciphertext ou no authTag faz `decipher.final()` lançar erro — não existe "decriptação parcial silenciosa". Não precisa de HMAC separado; GCM já é AEAD (Authenticated Encryption with Associated Data). |
| **Chave** | 32 bytes (256 bits), fora do banco, fora do frontend. Nunca gerada/derivada em runtime a partir de outra coisa — é um segredo fixo por ambiente. |
| **Variável de ambiente** | `INSTAGRAM_TOKEN_ENCRYPTION_KEY` — string hex de 64 caracteres (32 bytes), mesmo nome já usado em `feat/instagram-foundation`. Validada com regex `/^[0-9a-fA-F]{64}$/` antes de qualquer uso; se ausente/malformada, a função de encrypt/decrypt lança erro imediatamente (fail-closed, nunca grava/lê com chave inválida). |
| **`encrypt(value)`** | `iv = randomBytes(12)`; `cipher = createCipheriv('aes-256-gcm', key, iv)`; `ciphertext = cipher.update(value,'utf8') + cipher.final()`; retorna `iv.base64url + '.' + authTag.base64url + '.' + ciphertext.base64url`. (Já existe, sem alteração, em `feat/instagram-foundation`.) |
| **`decrypt(stored)`** | **Ainda não implementada em nenhuma branch** — precisa existir antes do primeiro uso real do token (fora do escopo do INST-05, mas documentado aqui para a migration fazer sentido). Faz o inverso: separa as 3 partes por `.`, decodifica cada uma de base64url, `decipher.setAuthTag(authTag)`, `decipher.update(ciphertext) + decipher.final()`. Se o formato tiver menos/mais de 3 partes, ou `final()` lançar (tag inválida), trata como falha de descriptografia — nunca retorna dado parcial. |
| **Rotação futura** | Sem `key_version` na tabela hoje — para o volume esperado (uma conexão por agente, poucas dezenas/centenas de linhas), rotação é: script de manutenção decripta tudo com a chave antiga, re-criptografa com a nova, roda uma vez, troca a env var. Se o volume crescer a ponto de isso não ser trivial, revisar então para adicionar uma coluna `key_version smallint` e suportar múltiplas chaves simultâneas — não implementar agora (YAGNI), só registrado como gatilho de quando revisar. |
| **Tratamento de erro** | `decrypt()` que falha (tag inválida, formato corrompido, chave errada) nunca deve derrubar o fluxo nem vazar detalhe do erro ao cliente final — marca a conexão como `status='error'`, loga só `{agent_id, event: 'decrypt_failed'}` (sem o valor cifrado, sem a chave), e força o dono a reconectar o Instagram. Nunca tentar "consertar" ou reprocessar automaticamente um valor que falhou na autenticação do GCM. |

**Garantias explícitas pedidas, já cobertas pelo desenho acima:**
- Chave fora do banco: só em variável de ambiente do servidor (Vercel), nunca em coluna/linha.
- Token nunca em plaintext: coluna `access_token` removida da migration; só `access_token_encrypted` existe.
- Token nunca no frontend: nenhum endpoint atual ou planejado seleciona essa coluna para resposta HTTP; reforçado com `REVOKE SELECT` a nível de coluna (item 7 da migration).
- Token nunca em log: nem `encrypt()`/`decrypt()` nem nenhum handler devem `console.log` o valor — só metadados (`agent_id`, `status`, tipo de erro).
- Encrypt/decrypt só no backend: funções vivem em código server-side (`api/*.js`), nunca expostas como endpoint que aceite/retorne o valor decriptado.

## 4a. Correção 7/8 — privilégios de coluna (revisão técnica encontrou FAIL)

A v1 desta migration tinha `REVOKE SELECT (access_token_encrypted) ON instagram_connections FROM authenticated, anon;`. Revisão técnica encontrou que isso **não tem efeito real**: `authenticated`/`anon` já têm `SELECT` em nível de **tabela** nessa tabela hoje — confirmado com `has_table_privilege('authenticated', 'public.instagram_connections', 'SELECT')` = `true`. Documentação oficial do PostgreSQL: *"Granting the privilege at the table level and then revoking it for one column will not do what you might wish: the table-level grant is unaffected by a column-level operation."* Confirmei também, com `has_column_privilege(..., 'access_token', 'SELECT')` = `true`, que **hoje, `authenticated` já consegue ler o `access_token` em texto puro** (mesmo com 0 linhas — o privilégio existe, só não há dado ainda).

### Busca por consumidores (repositório inteiro, `main`)

`instagram_connections`, `instagram_user_id`, `token_expires_at`, `scopes` — **zero ocorrências em qualquer `.js`/`.html`**. `username` — nenhum arquivo contém a string. Ou seja: **nenhum frontend ou API em `main` consulta `instagram_connections` de nenhuma forma, hoje.**

Padrão confirmado no resto do projeto: todo acesso a dado sensível/específico do dono (`deployment-status.js`, e o `instagram-status.js` já desenhado em `feat/instagram-foundation`) passa por um **endpoint de backend com service role**, nunca por consulta direta do cliente à tabela via `anon`/`authenticated`. Não há uma única exceção a esse padrão no código atual.

### Decisão A vs. B

- **A — grant explícito de colunas necessárias:** exigiria eu apontar quais colunas "são necessárias". A busca não encontrou nenhum consumidor real — qualquer lista de colunas seria uma suposição do que "pode vir a ser útil", exatamente o que a instrução pediu para não fazer ("não conceda por conveniência").
- **B — nenhuma concessão direta + view segura sem token:** resolve o vazamento, mas criar uma *view* sem nenhum consumidor real também é conceder acesso "por conveniência" — só que via um objeto novo em vez de uma coluna.

**Recomendação: uma forma mais estrita de B — `REVOKE SELECT` de tabela inteira, sem grant substituto e sem view.** Nenhuma das duas opções como formuladas se sustenta com a evidência encontrada (zero consumidores); a única resposta consistente com "determine exatamente quais colunas precisam ser expostas" é "nenhuma, hoje". Quando um consumidor real existir, a escolha entre coluna específica, view, ou (o padrão já usado em 100% do resto do projeto) um endpoint de backend deve ser feita então — a última opção nem exige nenhuma alteração de GRANT, porque service role ignora RLS/privilégios de coluna.

**Efeito colateral assumido e sinalizado:** as 4 policies de RLS (`select_own`/`insert_own`/`update_own`/`delete_own`) ficam dormentes — sem privilégio de tabela, RLS nunca chega a ser avaliada para `authenticated`/`anon`. Isso é intencional nesta fase.

### Teste de privilégios

`docs/sql/instagram-connections-privilege-test.sql` — usa `has_table_privilege()`/`has_column_privilege()` (calculam o privilégio efetivo, não só leem grants explícitos — é o mecanismo certo, diferente do que causou a leitura errada da v1). Rodado **antes** da correção, hoje, confirma o bug: `authenticated` tem `SELECT` de tabela inteira e consegue ler `access_token`. Resultado esperado **depois** da v2: `authenticated`/`anon` sem nenhum privilégio de `SELECT` na tabela, para nenhuma coluna.

## 5. Schema de `instagram_webhook_events` (desenho, não aplicar ainda)

`docs/sql/instagram-webhook-events.sql`. Campos: `id`, `provider_event_id` (`UNIQUE`, é o `dedupeKeyForEntry()` já implementado no INST-04/04A), `instagram_user_id`, `agent_id` (nullable — evento pode chegar antes de existir conexão resolvida), `event_type`, `payload jsonb` (mínimo/seguro — ver nota abaixo), `processed_at`, `created_at`. RLS ligada, sem policy (só service role, mesmo padrão de `billing_events`). Não reaproveita `billing_events` (schema compatível, mas domínio semântico diferente — misturaria mensageria com billing).

**Nota sobre "payload mínimo/seguro":** a recomendação é armazenar só estrutura (ids, contagem de itens, tipo de evento), **não** o texto de mensagem/comentário do cliente final, mesmo não sendo tecnicamente um "secret" — isso é uma decisão de retenção de dados que ainda não foi tomada para o produto (LGPD, prazo de guarda), então o mais seguro agora é não persistir o conteúdo da conversa antes de essa política existir. Fica registrado como ponto em aberto para quando o processamento real (INST-06+) definir isso.

## 6. Riscos

- **`agents` é tocada** (passo 1, `UNIQUE(id, owner_id)`) — é a única alteração fora de `instagram_connections`. Aditiva, não rejeita dado existente, não muda comportamento de leitura/escrita de `agents`, mas é uma DDL numa tabela de 55 linhas em produção usada por AI-01/AI-02. Sinalizado explicitamente para revisão — nenhuma coluna, valor ou policy de `agents` é alterada, só um índice único adicional.
- **`agent_id NOT NULL`** significa que, a partir desta migration, **nenhum código pode inserir em `instagram_connections` sem já saber o `agent_id`** — isso é exatamente o que `feat/instagram-foundation` já faz (recebe `agent_id` via parâmetro, valida posse, só então insere), mas **quebra definitivamente `api/instagram.js` do PR #9** (que insere só com `owner_id`, sem `agent_id`) — reforça a recomendação já registrada no relatório de arquitetura anterior de **não mergear PR #9 como está**.
- **Remoção de `access_token`** é irreversível sem recriar a coluna (rollback abaixo recria vazia, não recupera dado — mas não há dado, tabela está em 0 linhas).
- **`REVOKE SELECT` de tabela inteira (v2)** deixa as 4 policies de RLS existentes dormentes (sinalizado acima, seção 4a) — se um consumidor de leitura direta for necessário no futuro, é preciso reavaliar então, não implicitamente.
- **Guard de tabela vazia (v2, novo)** agora é um `DO $$ ... RAISE EXCEPTION` real dentro da própria transação — se alguém rodar esta migration depois de qualquer INSERT em `instagram_connections`, ela aborta sozinha em vez de depender de alguém lembrar de checar antes.

## 7. Plano de rollback

Bloco `ROLLBACK` no fim de `docs/sql/instagram-connections-agent-identity.sql` (v2) — reverte os passos 1, 2–5 e 7 na ordem inversa, incluindo `grant select on instagram_connections to authenticated, anon` (nível de tabela) para desfazer exatamente o `revoke` de tabela inteira do passo 7 corrigido — diferente da v1, cujo rollback tentava desfazer um `revoke` de coluna que nunca teve efeito. Seguro porque a tabela permanece vazia entre o design e a aplicação (nenhum código em `main` escreve nela hoje, confirmado por busca no repositório). Se, no momento de aplicar, `select count(*) from instagram_connections` não for mais `0`, o guard da seção 0 aborta a migration automaticamente.

## 8. Arquivos alterados nesta fase (só desenho, branch `feat/instagram-identity-migration`)

- `docs/sql/instagram-connections-agent-identity.sql` (v2 — corrige o REVOKE de coluna sem efeito + guard de tabela vazia real)
- `docs/sql/instagram-connections-privilege-test.sql` (novo — teste de privilégios com `has_table_privilege`/`has_column_privilege`)
- `docs/sql/instagram-webhook-events.sql` (novo, não aplicar ainda)
- `docs/INSTAGRAM-IDENTITY-MIGRATION-PLAN.md` (este arquivo)
- `VENCIVO-INSTAGRAM-IDENTITY-CONTINUITY.md` (continuidade)

Nenhum arquivo de `main`, `feat/instagram-business-login` (PR #9), `feat/instagram-webhook`/`fix/instagram-webhook-raw-body` (INST-04/04A), AI-01, AI-02, WhatsApp ou checkout foi tocado. Nenhum `apply_migration` foi chamado — só `list_tables`/`execute_sql` de leitura, na fase de análise anterior.

## 9. Registro de roadmap — decisão de produto (áudio/imagem/vídeo)

Não faz parte desta tarefa, só registro conforme pedido: o VENCIVO Instagram deverá suportar `text`, `audio`, `image`, `video`. Fluxo planejado para áudio: `Instagram audio → media retrieval → Gemini 3.1 Flash-Lite → texto/transcrição → agente VENCIVO`. Nada disso é implementado nesta fase nem em nenhuma das branches abertas até aqui.
