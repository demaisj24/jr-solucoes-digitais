# VENCIVO — HANDOFF OFICIAL

**Data de atualização:** 19/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch de produção:** `main`
**Vercel:** `vencivo-ai` → `vencivo.com.br`

## Ponto oficial de parada
AI-01 foi concluído, testado ponta a ponta e integrado na `main`.

### AI-01 — CONCLUÍDO
Objetivo: permitir que cada agente utilize uma Base de Conhecimento própria e responda com fatos reais do negócio.

Validado com documento real contendo:
- Produto: Corte Premium VX
- Preço: R$ 147,00
- Código interno: VX-8472

Testes aprovados:
- upload de documento;
- indexação;
- recuperação via File Search;
- resposta correta de preço;
- resposta correta de código;
- consulta de produtos/serviços;
- pergunta sem informação relevante sem invenção;
- prompt injection sem exposição do prompt/regras;
- continuidade/contexto;
- isolamento funcional por agente;
- teste do chat com conhecimento real.

Modelo funcional validado no ambiente: `gemini-3.5-flash-lite`.

A integração final foi feita de forma limpa sobre a `main` atual:
- branch de integração criada diretamente da `main`;
- somente `api/agent-chat.js` e `api/agents.js` alterados nessa integração;
- PR #11 aberto sem Draft;
- PR #11 mergeado com sucesso;
- commit de integração: `cc4ce75dfed93285ee2a8b5e4879c920740f88a0`.

Não reabrir AI-01 sem evidência de regressão.

## O que já existe no produto
- Home/landing page SaaS;
- posicionamento aprovado: não vender como simples chatbot, mas como agente de IA para o negócio;
- criador de agente;
- empresa/segmento/serviços;
- personalidade selecionável;
- capacidades;
- criação e persistência de agente;
- Supabase;
- Vercel;
- Gemini;
- Base de Conhecimento por documentos;
- File Search por agente;
- chat do agente;
- autenticação/conta existente;
- preparação de cobrança/Asaas existente;
- domínio `vencivo.com.br`;
- preparação para integrações Meta/WhatsApp.

## Próximo módulo oficial — AI-02 / Produto SaaS
Objetivo: transformar o núcleo funcional em uma experiência SaaS vendável sem quebrar AI-01.

Prioridade imediata:
1. Dashboard mínimo pós-criação;
2. listar agentes do cliente;
3. abrir/configurar agente;
4. editar dados do agente;
5. visualizar/gerenciar conhecimento;
6. histórico/conversas;
7. experiência de teste do agente;
8. medir e otimizar latência;
9. streaming da resposta quando tecnicamente seguro;
10. Fast Path para perguntas simples quando comprovadamente vantajoso.

### Estratégia de performance
Não alterar AI-01 apenas por hipótese. Medir primeiro:
- tempo total;
- tempo Gemini;
- File Search;
- Supabase;
- primeira resposta percebida;
- erros 429/5xx.

Depois aplicar otimizações localizadas.

## Depois do AI-02
### Monetização
- definir planos comerciais finais;
- checkout/assinatura;
- ativação automática após pagamento;
- controle de acesso por plano;
- cancelamento/renovação/inadimplência;
- métricas de uso/custo.

### Canais
- Instagram Business Login/Meta continua isolado;
- WhatsApp Cloud API / Embedded Signup continua isolado;
- não tentar contornar restrições atuais da Meta;
- ativar canais somente após revisão específica.

### Produção/escala
- auditoria de autenticação;
- RLS/isolamento de dados;
- proteção de APIs;
- rate limits;
- prompt injection/documentos maliciosos;
- credenciais e segredos;
- testes E2E;
- teste de carga/concurrency;
- monitoramento;
- custos por agente;
- LGPD/termos/políticas;
- SEO/analytics/onboarding;
- PWA/service worker.

## Estratégia de lançamento
Não esperar o produto perfeito para começar a vender.

MVP comercial desejado:
`cliente cria agente → configura → envia conhecimento → testa → escolhe plano → paga → usa`.

Primeira meta comercial: primeiros 5 clientes, inicialmente por venda/prospecção manual, validando nichos como salão, clínica, restaurante, imobiliária, estética e serviços.

## Meta / Instagram
PR #9 / branch `feat/instagram-business-login` permanece isolado. Não promover sem decisão específica.
A restrição atual da Meta permanece uma restrição operacional a ser tratada separadamente. Não criar novo portfólio para contornar a restrição, não repetir convites e não inventar URLs/configurações.

## HOME
HOME-01 a HOME-07 concluídos/publicados conforme MASTER STATE.
HOME-08 permanece separado de `main` até decisão específica.

## Regras de continuidade
- `main` é a fonte de produção.
- Nunca sobrescrever mudanças aprovadas.
- Antes de editar, ler o arquivo efetivamente usado.
- Fazer mudanças localizadas e testáveis.
- Não afirmar que algo foi corrigido sem evidência do código/deploy/teste.
- Não fazer merge forçado.
- Ao interromper uma sessão, atualizar este HANDOFF e o MASTER STATE.

## Próximo passo exato
**Retomar pelo AI-02: Dashboard mínimo + experiência pós-criação do agente, preservando o AI-01 já integrado.**
