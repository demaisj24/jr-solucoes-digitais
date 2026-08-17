# VENCIVO — MASTER STATE

**Data de atualização:** 17/08/2026  
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
Portfólio `Vencivo Atendimento Inteligente` sob análise/restrição da Meta em 17/08/2026.

Enquanto a análise estiver pendente:
- não criar outro portfólio;
- não remover o atual;
- não repetir convites;
- não tentar contornar a restrição;
- não tratar a divergência Marcos/Aila como causa confirmada sem evidência da Meta.

## 5. HOME — estado atual

### Concluído
**HOME-01 — Tipografia e Hierarquia Visual**
- Alteração visual aplicada no `index.html`.
- Corpo, H1, lead, H2, H3, cards, textos auxiliares e mobile tiveram escala/hierarquia ajustadas.
- Fonte atual preservada.
- Nenhuma lógica funcional alterada.
- Commit de implementação: `7fcc544b4836b267a259067880997b8953d7ebb8`.
- Vercel confirmou produção READY.

### Próximo módulo
**HOME-02 — Header e menu**

Escopo planejado:
- aumentar e melhorar visual do menu;
- destacar `Entrar / Minha conta`;
- colocar `Instalar app` como última ação;
- manter `Orçamento` em destaque;
- preservar funcionamento e navegação existentes.

### Fila posterior
- HOME-03 — organização final das ações do header
- HOME-04 — Hero, narrativa, CTAs e benefícios
- HOME-05 — demonstração visual/animada do agente
- HOME-06 — formulário de contato
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
