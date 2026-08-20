# VENCIVO — INST-09: auditoria da Send API do Instagram (sem implementar)

**Branch:** `feat/instagram-send-api-audit`
**Base:** `main` @ `fd87fa4`
**Status:** só pesquisa/documentação. Nenhum código, nenhuma chamada real, nenhuma migration.

## 0) Achado crítico primeiro: duas APIs diferentes existem — só uma serve o VENCIVO

A Meta documenta **dois caminhos diferentes** para mandar DM no Instagram, e são frequentemente confundidos:

| | Instagram API with Instagram Login (Business Login) | Messenger Platform via Facebook Page |
|---|---|---|
| Endpoint | `https://graph.instagram.com/v25.0/<IG_ID>/messages` | `https://graph.facebook.com/<v>/me/messages` |
| Autenticação | `Authorization: Bearer <token>` (header) | `?access_token=<token>` (**query string**) |
| Permissão | `instagram_business_basic` + `instagram_business_manage_messages` | `instagram_manage_messages` |
| Exige Facebook Page vinculada | Não | Sim |

O VENCIVO **já implementou o OAuth do primeiro caminho** (`feat/instagram-foundation`: `instagram-oauth.js` autoriza em `instagram.com/oauth/authorize`, troca código em `api.instagram.com/oauth/access_token`, perfil em `graph.instagram.com` — inconfundivelmente "Instagram API with Instagram Login", não Messenger Platform). **Recomendação: usar exclusivamente o primeiro caminho.** O segundo, além de exigir uma Facebook Page (que o fluxo de OAuth do VENCIVO não coleta), colocaria o token na **query string** — violação direta da regra de segurança desta tarefa. Não confundir os dois na implementação futura.

## 1–9) Fluxo recomendado, request/response

```
POST https://graph.instagram.com/v25.0/<IG_ID>/messages
Authorization: Bearer <access_token decriptografado, só em memória>
Content-Type: application/json

{
  "recipient": { "id": "<IGSID>" },
  "message": { "text": "<resposta gerada pelo Gemini>" }
}
```

- **`<IG_ID>`**: a conta profissional do Instagram do VENCIVO/cliente — já armazenada em `instagram_connections.instagram_user_id`. Não é o mesmo id do destinatário.
- **`<IGSID>`**: Instagram-scoped ID de quem mandou a mensagem — vem de `entry.messaging[].sender.id` no payload do webhook (já presente na estrutura usada desde o INST-04A/08C, nenhum campo novo necessário).
- **Resposta de sucesso:** `{"recipient_id": "IGSID", "message_id": "MESSAGE-ID"}` — o `message_id` só existe depois do envio confirmado (não serve como idempotency key do lado do cliente — já investigado e confirmado no INST-06).
- **Limite de tamanho:** texto deve ser UTF-8, **≤ 1000 bytes**. Precisa ser verificado/truncado antes do envio (o Gemini já é limitado a `maxOutputTokens:160` no `lib/instagram-process-event.js`, o que ajuda, mas 1000 bytes UTF-8 não é o mesmo que um limite de tokens — precisa de checagem explícita de bytes na implementação futura, não presumir que o limite de tokens já garante isso).

Fonte primária: [developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api)

## 3, 7) Autenticação e permissões

Token no header `Authorization: Bearer`, nunca em query string. Permissões exigidas: `instagram_business_basic` + `instagram_business_manage_messages` — **já são exatamente as mesmas solicitadas** em `feat/instagram-foundation`'s `SCOPES`, confirmado de forma independente contra a documentação atual, não presumido do código.

**Achado relevante para o produto, não só técnico:** a documentação distingue **Standard Access** ("se seu app serve contas que você possui ou gerencia") de **Advanced Access** ("se seu app serve contas Instagram profissionais que você não possui nem gerencia"). O modelo do VENCIVO — clientes de terceiros conectando as próprias contas via OAuth — é exatamente o segundo caso. **Isso sugere que o VENCIVO provavelmente vai precisar de Advanced Access (App Review) para escalar além de um pequeno grupo de contas de teste**, algo que já tem contexto de restrição anterior da Meta registrado em `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`. Registrado como risco de produto, não resolvido aqui — decisão do dono do produto.

## 16) Comportamento quando a permissão de mensagens não está disponível

`instagram_connections.scopes` (coluna já existente, `text[]`) grava o que foi realmente concedido no momento da conexão. Antes de tentar enviar, a implementação futura deve checar se `'instagram_business_manage_messages'` está no array — se não estiver, falhar fechado (`reason: 'messaging_permission_missing'`) sem sequer tentar a chamada, em vez de descobrir isso por um 403 da Meta.

## 10–14) Limites, rate limits, erros, timeout

| Item | Valor | Fonte |
|---|---|---|
| Tamanho do texto | ≤ 1000 bytes UTF-8 | Documentação oficial (primária) |
| Rate limit | **100 chamadas/segundo por conta profissional** para texto/links/reações/stickers (10/s para áudio/vídeo) | `developers.facebook.com/docs/graph-api/overview/rate-limiting/` (primária) — reportado via header `X-Business-Use-Case-Usage`; excedido = erro `80002` (OAuthException) |
| Rate limit (nota de incerteza) | Fontes **secundárias** (blogs, não Meta) mencionam um teto de ~200 DMs automatizadas/hora por conta, distinto do rate limit técnico acima — **não confirmado na documentação primária**, tratar como não verificado até confirmação operacional | terceiros, não Meta |
| Janela de 24h | Resposta livre só até 24h após a última mensagem do usuário; depois, só "Human Agent" por até 7 dias, só para suporte | Documentação oficial |
| Erro 4xx — fora da janela de 24h | Código `10`, subcódigo `2534022` | Fontes secundárias, consistente com o comportamento documentado da janela |
| Erro 4xx — token expirado/inválido | Código `190` — reconectar a conta | Fontes secundárias |
| Erro 4xx — bloqueio temporário por volume | Código `368` | Fontes secundárias |
| Erro 5xx | Não há uma lista específica documentada pela Meta para este endpoint — tratar como erro transitório, mesmo padrão já usado para o Gemini (`lib/instagram-process-event.js`: log seguro, não expor detalhe ao usuário final) | — |
| Timeout | Não documentado pela Meta (não é uma garantia que o provedor publica) — **decisão do VENCIVO**, recomendo o mesmo padrão já em produção para o Gemini (`AbortController`, ~8–10s) | Decisão própria |

## 15) Token expirado/revogado

Token de longa duração dura **60 dias**, renovável via `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>` (token precisa ter ≥24h e ainda não ter expirado). `instagram_connections.token_expires_at` já existe e já é preenchido pelo fluxo de OAuth (`feat/instagram-foundation`). **Antes de decriptografar**, a implementação futura deve checar `token_expires_at > now()` — se já expirou, falhar fechado (`reason: 'token_expired'`) e marcar `instagram_connections.status = 'error'` (valor já existente no `CHECK` da coluna), sem tentar decriptografar nem chamar a Meta. Renovação automática do token é um mecanismo separado, não coberto por esta auditoria — registrado como próxima peça necessária, não implementada.

## 17–18) Texto agora, áudio/imagem depois

Só texto (`message.text`) é o escopo desta auditoria e da implementação futura mais próxima. Áudio/imagem exigiriam um formato de `message` diferente (attachment com URL de mídia) — **não pesquisado em profundidade aqui, deliberadamente**, e já reafirmado no roadmap do VENCIVO como etapa posterior (`AUDIO-01`).

## Onde a descriptografia AES-256-GCM deve acontecer

Auditado o schema real: `instagram_connections.access_token_encrypted` — `text NOT NULL`, `authenticated`/`anon` sem `SELECT` (confirmado agora via `has_table_privilege`, igual à Fase 2 do INST-05), só `service_role` lê. Formato já definido (não implementado): `iv.authTag.ciphertext` em base64url, `encrypt()` já existe em `api/instagram-callback.js` (branch `feat/instagram-foundation`, não mergeada) — **`decrypt()` não existe em nenhuma branch ainda**.

**Recomendação de local:** um módulo dedicado, pequeno e puro — `lib/instagram-token-crypto.js` (não criado nesta tarefa) — com uma função `decryptAccessToken(stored)` que só faz a operação criptográfica, sem I/O, testável isoladamente (mesmo padrão de `resolveFromRows` do INST-08A: lógica pura separada da busca de dados). A **chamada** a essa função deve acontecer só dentro do futuro módulo de envio (`lib/instagram-send-message.js`, não criado), **imediatamente antes** do `fetch` para `graph.instagram.com` — nunca durante a resolução (INST-08A) nem durante o processamento/Gemini (INST-08B), que não precisam do token. O valor decriptografado deve viver só na variável local do escopo da chamada HTTP, nunca ser atribuído a um objeto que possa ser logado, serializado ou devolvido por qualquer função.

### Regras de segurança — como cada uma será satisfeita

| Regra | Como |
|---|---|
| Nunca retornar o token | Nenhuma função de `lib/` (existente ou futura) inclui o token no valor de retorno — os retornos já estabelecidos (`resolveFromRows`, `processInstagramMessage`) não têm e não devem ganhar um campo de token |
| Nunca logar token/plaintext | `decryptAccessToken()` e o futuro `sendInstagramMessage()` nunca passam o valor decriptografado para `console.log`/`console.error` — só metadados seguros (`agent_id`, código de erro), mesmo padrão já usado em todo o `lib/` existente |
| Nunca em query string | Header `Authorization: Bearer`, nunca `?access_token=` — decisão já tomada na escolha do endpoint (seção 0) |
| Fail-closed na descriptografia | Falha de `decipher.final()` (tag inválida) ou chave ausente/malformada nunca retorna valor parcial — propaga erro, quem chama trata como `token_decrypt_failed` e não tenta enviar |
| Nunca expor ao frontend | Toda essa cadeia roda só em `lib/`, chamada só por código server-side (backend), nunca por um endpoint que devolve dado ao navegador — mesmo padrão já auditado no INST-05 (RLS + REVOKE explícito) |

## Comparação com implementação antiga do repositório

Busca em todas as branches (`feat/instagram-business-login`/PR#9, `feat/instagram-foundation`, `feat/vencivo-instagram-intelligence`) por qualquer chamada de **envio** de mensagem (`/messages`, `graph.instagram.com` fora do OAuth): **nenhuma existe**. O único código relacionado é troca/refresh de token OAuth (`longToken()`, PR#9) — não uma implementação de envio a ser reaproveitada ou descartada. **Não há "código antigo de envio" para comparar** — esta auditoria parte do zero, informada pela documentação atual, não por uma implementação anterior enviesada. O único ponto de atenção herdado do PR#9 (já resolvido no INST-05) é não voltar a armazenar `access_token` em texto puro.

## Riscos

1. **Advanced Access da Meta** — modelo de negócio do VENCIVO (servir contas de terceiros) provavelmente exige App Review/Advanced Access; não resolvido aqui, decisão de produto/timing.
2. **Rate limit de "200/hora" não confirmado** — se for real e distinto do limite técnico de 100/s, pode ser mais restritivo na prática; precisa validação operacional antes de assumir qualquer um dos dois números como teto de design.
3. **Limite de 1000 bytes UTF-8** não é garantido só pelo limite de tokens do Gemini — precisa de checagem explícita de bytes na implementação futura (não presumir).
4. **Refresh de token de 60 dias** não tem mecanismo implementado ainda — se não for construído antes do primeiro token expirar, conexões param de funcionar silenciosamente (mitigado por checar `token_expires_at` antes de tentar enviar e marcar `status='error'`, mas isso só detecta, não previne).
5. Duplicação potencial futura: `decryptAccessToken()` sendo uma peça nova, ainda sem `lib/instagram-token-crypto.js` — risco baixo, mas registrado para não ser esquecido na próxima tarefa de implementação.

## PASS/FAIL

| Item | Status |
|---|---|
| Endpoint, método, autenticação corretos identificados (e a API errada descartada com justificativa) | **PASS** |
| Formato de request/response documentado com fonte primária | **PASS** |
| Identificadores (IG_ID, IGSID) mapeados para colunas/campos já existentes | **PASS** |
| Permissões confirmadas independentemente do código existente | **PASS** |
| Limites e rate limits documentados, com incerteza sinalizada onde a fonte é só secundária | **PASS** |
| Erros 4xx/5xx e timeout documentados | **PASS** |
| Token expirado/revogado — mecanismo de checagem definido | **PASS** |
| Permissão de mensagens ausente — comportamento definido | **PASS** |
| Local da descriptografia AES-256-GCM definido, com todas as 5 regras de segurança endereçadas | **PASS** |
| Comparação com código antigo | **PASS** — nenhum código de envio antigo existe para reutilizar ou descartar |
| Nenhuma implementação, chamada real, migration ou config feita | **PASS** |

## Fontes oficiais utilizadas

- [Instagram API with Instagram Login — Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- [Messenger Platform — Instagram Send Message (comparação, não escolhida)](https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message/)
- [Graph API — Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- [Instagram Platform — Refresh Access Token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/)
- [Instagram Platform — Access Token](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
