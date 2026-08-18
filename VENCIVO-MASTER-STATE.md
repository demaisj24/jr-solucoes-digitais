# VENCIVO — MASTER STATE

**Data de atualização:** 18/08/2026
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

Não alterar sem necessidade durante a fase visual:
- login
- cadastro
- sessão/autenticação
- Supabase
- Asaas
- checkout
- Gemini
- funcionamento dos agentes
- fluxos funcionais existentes

## 4. Meta / WhatsApp
Portfólio `Vencivo Atendimento Inteligente` sob análise/restrição da Meta em 18/08/2026.

Enquanto a análise estiver pendente:
- não criar outro portfólio;
- não remover o atual;
- não repetir convites;
- não tentar contornar a restrição;
- não tratar a divergência Marcos/Aila como causa confirmada sem evidência da Meta.

## 5. HOME — estado atual

### Concluído
**HOME-01 — Tipografia e Hierarquia Visual**
- Concluído e publicado em produção.
- Commit: `7fcc544b4836b267a259067880997b8953d7ebb8`.

**HOME-02 — Header e Menu**
- Concluído e publicado em produção.
- Commit principal: `8a9eb6ae13b8e42a155f4f55e04a6c4f09a32f6b`.
- Registro posterior sem alteração de conteúdo: `c707c007fb2b51e723a4c76fb46145f67a906f61`.

**HOME-03 — Organização final das ações do header**
- Concluído e publicado em produção.
- Commit: `690ea13d9c9ee8e4ad3e4045aff2be8a6247a682`.

**HOME-04 — Hero, narrativa, CTAs e benefícios**
- Concluído e publicado/implementado.
- Commit de implementação: `431860472879363c59e295e348b3c580afba8c12`.

**HOME-05 — Demonstração visual autônoma do agente**
- Concluído e publicado.
- Commit: `55b5f6dc09820585a20813cfb98c2f452ebbf7e4`.

**HOME-06 — Finalização visual aprovada**
- Concluído nesta etapa visual.
- O H1 do Hero foi quebrado em duas linhas para melhorar a hierarquia.
- A seção redundante `#ia` foi removida, pois repetia a proposta central já apresentada no Hero.
- O formulário de contato foi preservado sem alteração funcional.
- IDs, hrefs, JavaScript, Supabase/auth, PWA/service worker e demais integrações foram preservados.
- Diff final em relação à `main` anterior: somente `index.html`, com 2 adições e 3 deleções, correspondentes ao H1, à remoção da seção redundante e ao newline final.
- Commit de produção: `aa5801ce53cf49f3a896448e6988b8785a6f4937`.
- Vercel production: `READY`, deployment `dpl_EZ2qNJfipcZnqfzd1CSSocipmaWV`.
- Aliases de produção confirmados: `vencivo.com.br` e `www.vencivo.com.br`.

### Fila posterior
- HOME-07 — prova social visual com exemplos claramente identificados
- HOME-08 — revisão visual final desktop/mobile

## 6. Outras pendências
- retomar Meta após análise;
- concluir WhatsApp;
- auditoria de segurança;
- validação de autenticação e isolamento de dados;
- testes ponta a ponta de agentes;
- testes ponta a ponta de pagamentos;
- teste de produção;
- preparação para lançamento.

## 7. Método de continuidade
O Projeto VENCIVO no ChatGPT é o ambiente de trabalho; o GitHub é a fonte técnica permanente.

Cada conversa deve ter uma missão pequena. Ao concluir/interromper, atualizar o HANDOFF.

Nova conversa: ler MASTER STATE + HANDOFF + contexto relevante antes de alterar qualquer coisa.

## 8. Documentos de continuidade
- `CONTEXTO-VENCIVO-CONTINUACAO.md` — contexto histórico
- `VENCIVO-MASTER-STATE.md` — estado mestre
- `VENCIVO-HANDOFF.md` — ponto de parada
- `VENCIVO-ROADMAP.md` — sequência operacional
