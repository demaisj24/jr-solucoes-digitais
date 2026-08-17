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

**HOME-02 — Header e Menu**
- Concluído e publicado em produção.
- Header teve escala, espaçamento, contraste e legibilidade ajustados.
- `Entrar / Minha conta` recebeu destaque visual preservando `id="authLink"` e `href="conta.html"`.
- `Instalar app` foi reorganizado para ser a última ação dentro do menu mobile, preservando `id="installBtn"` e o comportamento PWA existente.
- `Orçamento` permaneceu como CTA de destaque e preservou `href="#contato"`.
- IDs, hrefs, JavaScript funcional e integrações existentes foram preservados.
- Arquivo de aplicação alterado: `index.html`.
- Commit de implementação: `8a9eb6ae13b8e42a155f4f55e04a6c4f09a32f6b`.
- Commit posterior sem alteração de conteúdo: `c707c007fb2b51e723a4c76fb46145f67a906f61`.
- Vercel confirmou produção READY para o commit mais recente.

**HOME-03 — Organização final das ações do header**
- Concluído e publicado em produção.
- Alteração restrita ao CSS do `index.html`.
- Desktop: `Entrar / Minha conta` recebeu separação visual da navegação por espaçamento e divisor vertical, mantendo `Orçamento` como CTA principal independente.
- Mobile: `Entrar / Minha conta` recebeu separação visual da navegação por margem, divisor horizontal e agrupamento das ações; `Instalar app` permaneceu como última ação do menu.
- `Orçamento` permaneceu fora do menu e preservou `href="#contato"`.
- IDs preservados: `authLink`, `installBtn`, `menuBtn`.
- Hrefs preservados: `conta.html`, `#contato` e destinos existentes do menu.
- JavaScript, Supabase/auth, PWA/service worker e demais integrações não foram alterados.
- Diff confirmado: somente `index.html`, 2 linhas adicionadas e 2 removidas, todas no CSS responsivo do header.
- Commit de implementação: `690ea13d9c9ee8e4ad3e4045aff2be8a6247a682`.
- Vercel confirmou deployment de produção `READY` associado ao commit `690ea13d9c9ee8e4ad3e4045aff2be8a6247a682`.
- Endpoint do deployment respondeu HTTP 200.
- Validação responsiva desktop/mobile foi conferida no CSS pelos breakpoints existentes (`>900px` e `<=900px`), com verificação específica da hierarquia de `authLink`, `installBtn`, `menuBtn` e `Orçamento`.

**HOME-04 — Hero, narrativa, CTAs e benefícios**
- Concluído e implementado no `index.html`.
- Copy aprovada aplicada exatamente:
  - eyebrow: `VENCIVO AI · agente de IA para seu negócio`
  - H1: `Não contrate um chatbot. Crie um agente para o seu negócio.`
  - lead: `Seu agente conhece o seu negócio, atende seus clientes 24 horas por dia, qualifica oportunidades e encaminha para sua equipe quando necessário.`
  - CTA principal: `Criar meu agente de IA →`
  - CTA secundário: `Ver como funciona`
  - benefícios: `Conhece seu negócio`, `Atendimento 24h`, `Qualifica clientes`, `Encaminha para sua equipe`
- Card existente recebeu melhoria visual de contraste, profundidade, hierarquia e acabamento, sem animação avançada.
- CTA principal preservou `href="ia.html"`; CTA secundário preservou `href="#ia"`.
- IDs, JavaScript, autenticação, Supabase, Asaas, Gemini, PWA/service worker e integrações foram preservados.
- Commit de implementação: `431860472879363c59e295e348b3c580afba8c12`.

**HOME-05 — Demonstração visual autônoma do agente**
- Concluído e implementado no `.aiCard` existente do `index.html`.
- Não foi criado novo componente nem nova seção.
- A demonstração segue a sequência visual: cliente pergunta → processamento → resposta → qualificação/encaminhamento → reinício.
- Implementação prioritariamente em CSS com `@keyframes`; nenhum JavaScript novo foi adicionado.
- Não utiliza API, Gemini, Supabase ou qualquer integração funcional para a animação.
- `prefers-reduced-motion: reduce` foi incluído; nesse modo a demonstração fica estática, sem animação contínua.
- Layout, header, autenticação, PWA, CTAs e integrações existentes foram preservados.
- O JavaScript existente permaneceu inalterado.
- Arquivo de aplicação alterado: `index.html`.
- Commit de implementação: `55b5f6dc09820585a20813cfb98c2f452ebbf7e4`.
- Diff do HOME-05 ficou restrito ao `index.html` em relação ao commit de implementação do HOME-04; não foram alterados arquivos funcionais de backend ou integração.
- Teste estrutural: classes, keyframes, `prefers-reduced-motion`, IDs protegidos, CTAs e scripts existentes foram conferidos após a implementação.
- Limitação de teste visual: não foi possível executar navegador automatizado/screenshot desktop-mobile neste ambiente; a validação responsiva foi feita por inspeção do CSS e dos breakpoints existentes. A confirmação visual final em navegador real permanece recomendada.

### Próximo módulo
**HOME-06 — formulário de contato**

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
