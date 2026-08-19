# VENCIVO — MASTER STATE

**Data de atualização:** 19/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch de produção:** `main`
**Vercel:** `vencivo-ai`
**Produção:** `vencivo.com.br`

> Fonte resumida e permanente do estado do projeto. Atualizar após cada módulo relevante.

## 1. Produto
Vencivo Atendimento Inteligente / Vencivo AI é um SaaS para criação de agentes de IA personalizados para empresas.

Posicionamento aprovado: não vender como simples chatbot, mas como agente treinado para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano.

## 2. Componentes existentes
- Frontend/site
- autenticação e conta do usuário
- agentes de IA
- Supabase
- Gemini
- Asaas
- checkout recorrente com cartão
- Pix
- checkout Pix avulso
- Resend
- domínio `vencivo.com.br`
- preparação para WhatsApp Cloud API / Embedded Signup
- portfólio empresarial Meta `Vencivo Atendimento Inteligente`

## 3. Regra de preservação
Antes de editar, localizar e ler a versão efetivamente usada pela produção.

Não alterar sem necessidade:
- login
- cadastro
- sessão/autenticação
- Supabase
- Asaas
- checkout
- Gemini
- funcionamento dos agentes
- fluxos funcionais existentes
- PWA/service worker

## 4. Meta / WhatsApp
Portfólio `Vencivo Atendimento Inteligente` está restrito pela Meta conforme handoff de 18/08/2026.

Enquanto a restrição permanecer:
- não criar outro portfólio para contornar a restrição;
- não remover o atual;
- não repetir convites;
- não tentar contornar a restrição;
- não tratar hipótese Aila/e-mail/nome como causa confirmada sem evidência da Meta.

O novo App `VENCIVO` / `VENCIVO-IG` e o PR #9 de Business Login permanecem isolados e não foram promovidos para `main`.

## 5. HOME — estado atual

### Concluído
**HOME-01 — Tipografia e Hierarquia Visual**
- Produção: `7fcc544b4836b267a259067880997b8953d7ebb8`.

**HOME-02 — Header e Menu**
- Produção: `8a9eb6ae13b8e42a155f4f55e04a6c4f09a32f6b`.

**HOME-03 — Organização final das ações do header**
- Produção: `690ea13d9c9ee8e4ad3e4045aff2be8a6247a682`.

**HOME-04 — Hero, narrativa, CTAs e benefícios**
- Produção: `431860472879363c59e295e348b3c580afba8c12`.

**HOME-05 — Demonstração visual autônoma do agente**
- Produção: `55b5f6dc09820585a20813cfb98c2f452ebbf7e4`.

**HOME-06 — Finalização visual aprovada**
- Produção: `aa5801ce53cf49f3a896448e6988b8785a6f4937`.

**HOME-07 — Prova social visual demonstrativa**
- Concluído e publicado.
- PR: `#5`.
- Merge em `main`: `c4f183ab8f1b6a4c31fb4ef858b7729eb79d8506`.
- Produção respondeu HTTP 200 após o deploy.

### Em andamento
**HOME-08 — revisão visual final desktop/mobile**
- PR #7 / branch `home-08-service-previews` continuam separados de `main`.
- Preview já validado pelo usuário.
- Ainda não promover para `main` sem decisão própria do módulo.

## 6. AI-01 — Base de Conhecimento do Agente

**Estado:** `IMPLEMENTADO / TESTADO PARCIALMENTE`.

**PR:** #8, branch `feat/ai-01-knowledge-base`, base `main`.

Implementação existente no PR:
- `ia-v4.html` como builder visual;
- criação do agente;
- upload privado;
- PDF, DOC, DOCX, TXT, MD, CSV e RTF;
- Gemini File Search por agente;
- isolamento por `public_id`/agente;
- recuperação semântica integrada ao chat;
- proteção contra exposição de prompt/credenciais;
- remoção do endpoint legado `api/chat.js`;
- ajuste do `vercel.json` para o limite do Vercel Hobby.

Preview AI-01:
- deployment `dpl_5omZfQ3Z4txcRiFAnXDvjh7hqRgU`;
- Vercel `READY`;
- build concluído sem erro;
- apenas aviso ESM/CommonJS do Vercel;
- runtime logs consultados nas últimas 24h: nenhum log encontrado.

**Ainda não está CONCLUÍDO.**

Próximo gate obrigatório:
`documento → upload → indexação → recuperação semântica → resposta do agente`.

Depois:
- isolamento entre agentes/clientes;
- exclusão/substituição;
- documento sem resposta relevante;
- prompt injection em documento;
- inspeção visual desktop/mobile;
- teste do chat com conhecimento real.

Não fazer merge antes desses gates e da aprovação do responsável.

## 7. Instagram / Meta
**PR #9 — branch `feat/instagram-business-login` — aberto/draft.**

A fundação OAuth foi construída em branch isolada e o preview está `READY`. Não houve cadastro de URL na Meta nem alteração de `main`.

## 8. Outras pendências
- HOME-08;
- AI-01;
- Meta/Instagram;
- WhatsApp Cloud API / Embedded Signup;
- webhook e mensagens;
- auditoria de autenticação;
- isolamento de dados e RLS;
- Gemini/credenciais;
- Asaas/webhooks/pagamentos;
- Resend/e-mails;
- PWA/service worker;
- testes ponta a ponta;
- políticas/termos/LGPD;
- SEO/analytics/onboarding;
- preparação para lançamento.

## 9. Método de continuidade
O GitHub é a fonte técnica permanente. Cada conversa deve ter uma missão pequena. Ao concluir/interromper, atualizar o HANDOFF.

**Próximo ponto oficial:** retomar o teste ponta a ponta do AI-01 no preview, sem alterar `main` até os gates passarem e haver aprovação.

## 10. Documentos de continuidade
- `CONTEXTO-VENCIVO-CONTINUACAO.md`
- `VENCIVO-MASTER-STATE.md`
- `VENCIVO-HANDOFF.md`
- `VENCIVO-ROADMAP.md`
- `VENCIVO-PROTOCOLO-DE-TRABALHO.md`
- `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`
