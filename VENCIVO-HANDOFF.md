# VENCIVO — HANDOFF OFICIAL

**Data de atualização:** 19/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch:** `main`
**Produção:** Vercel `vencivo-ai` → `vencivo.com.br`

## Último módulo concluído
**HOME-07 — Prova social visual demonstrativa**

## Ponto de parada desta sessão — 19/08/2026
A sessão foi retomada pelo estado oficial do GitHub e os documentos de continuidade foram relidos: MASTER STATE, HANDOFF, ROADMAP, PROTOCOLO e `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`.

### Estado confirmado
- `main` continua sendo a fonte de produção.
- Produção continua em `vencivo-ai` → `vencivo.com.br`.
- `main` não foi alterada durante esta sessão.
- Não houve merge de AI-01 nem de Instagram.
- O PR #8 de **AI-01 — Base de Conhecimento do Agente** permanece aberto/draft, com branch `feat/ai-01-knowledge-base`.
- O PR #9 de **Instagram Business Login** permanece aberto/draft, com branch `feat/instagram-business-login`.
- O PR #7 de HOME-08 permanece aberto/draft.

### AI-01 — situação real encontrada
O PR #8 já contém uma implementação isolada de:
- `ia-v4.html` como builder visual;
- criação do agente;
- upload privado de documentos;
- PDF, DOC, DOCX, TXT, MD, CSV e RTF;
- Gemini File Search por agente;
- isolamento por `public_id`/agente;
- recuperação semântica integrada ao chat;
- proteção contra exposição de prompt/credenciais;
- remoção do endpoint legado `api/chat.js`;
- ajuste do `vercel.json` para o limite do Vercel Hobby.

Validação observada:
- preview Vercel `READY`;
- build concluído sem erro;
- runtime errors não identificados no período verificado;
- `main` preservada.

Deployment do preview AI-01 verificado nesta sessão: `dpl_5omZfQ3Z4txcRiFAnXDvjh7hqRgU`.
Build: concluído; somente aviso do Vercel sobre compilação ESM para CommonJS, sem falha de build.
Runtime logs consultados nas últimas 24h: nenhum log encontrado.

**AI-01 permanece como `IMPLEMENTADO / TESTADO PARCIALMENTE`, não CONCLUÍDO.**

### Teste que falta fechar
O próximo teste técnico prioritário é o fluxo real:
`documento → upload → indexação → recuperação semântica → resposta do agente`.

Depois devem ser validados, antes de qualquer merge:
- isolamento entre agentes/clientes;
- substituição/exclusão de documento;
- comportamento com documento sem resposta relevante;
- prompt injection dentro do documento;
- teste visual desktop/mobile do builder;
- comportamento do chat com conhecimento real.

### Instagram / Meta
O PR #9 continua isolado e não foi promovido para `main`.
A fundação contém callback OAuth consolidado, state HMAC com expiração, troca de tokens, leitura do perfil, persistência privada e RLS. A ativação real ainda depende das credenciais/segredos do ambiente e da configuração correta na Meta.

Não cadastrar URL inventada na Meta, não tentar contornar a restrição anterior e não alterar o portfólio restrito sem decisão específica.

### HOME-08
A branch `home-08-service-previews` continua separada. As alterações visuais ainda não foram promovidas para `main`. O preview já havia sido validado pelo usuário.

## Regra para a próxima sessão
Retomar **exatamente daqui**, priorizando o teste ponta a ponta do AI-01 no preview antes de qualquer merge.

Sequência:
1. Testar documento real no preview AI-01.
2. Confirmar upload/indexação/recuperação/resposta.
3. Testar isolamento entre agentes.
4. Testar exclusão/substituição.
5. Testar prompt injection e documentos sem resposta relevante.
6. Fazer inspeção visual final do builder.
7. Se todos os gates passarem, apresentar resultado e só então pedir aprovação para merge.

## Itens que não devem ser alterados sem autorização específica
- `main` sem aprovação explícita;
- login;
- cadastro;
- sessão/autenticação;
- Supabase/RLS em produção sem análise;
- Asaas;
- checkout;
- Gemini em produção fora do escopo AI-01;
- funcionamento existente dos agentes;
- WhatsApp/Meta enquanto a restrição estiver vigente;
- PWA/service worker;
- integrações funcionais existentes.

## Referências permanentes
- `VENCIVO-MASTER-STATE.md`
- `VENCIVO-ROADMAP.md`
- `VENCIVO-PROTOCOLO-DE-TRABALHO.md`
- `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`
