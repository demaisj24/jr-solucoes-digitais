# VENCIVO — HANDOFF OFICIAL DE CONTINUIDADE

**Data:** 17/08/2026
**Conversa/módulo:** Continuidade do VENCIVO após interrupção da conversa VENCIVO2
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch principal/produção:** `main`

## 1. Objetivo

Registrar o primeiro HANDOFF oficial da continuidade do VENCIVO, preservando o estado técnico confirmado no GitHub e definindo o próximo módulo de trabalho.

## 2. Estado atual confirmado

- VENCIVO Atendimento Inteligente / Vencivo AI é um SaaS para criação de agentes de IA personalizados para empresas.
- Posicionamento aprovado: não vender como simples chatbot, mas como agente treinado para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano.
- O repositório oficial é `demaisj24/jr-solucoes-digitais`.
- A branch principal usada em produção é `main`.
- O projeto Vercel é `vencivo-ai`.
- Domínios de produção: `vencivo.com.br` e `www.vencivo.com.br`.
- O último deploy de produção conhecido está READY e foi associado ao commit `7fc05c4f7b7c743a0418ac85373e408907618e76`, com a mensagem `docs: criar estado mestre do Vencivo`.
- O deploy anterior conhecido foi associado ao commit `cb6feb2bc78f85c53fc9519a04cc040b5b86cdf4`, com a mensagem `docs: salvar contexto de continuidade do Vencivo`.

## 3. Sistemas existentes que devem ser preservados

Não alterar sem solicitação explícita:

- login;
- cadastro;
- sessão/autenticação;
- Supabase;
- Asaas;
- checkout;
- Gemini;
- funcionamento atual dos agentes;
- fluxos funcionais existentes.

## 4. Meta / WhatsApp

- Caminho escolhido: WhatsApp Cloud API / Embedded Signup.
- Portfólio empresarial: `Vencivo Atendimento Inteligente`.
- A empresa/portfólio estava sob análise/restrição da Meta em 17/08/2026.
- Identidade/documentação foi enviada conforme o fluxo de análise.
- Ainda não havia número WhatsApp adicionado ao portfólio.
- Enquanto a análise estiver pendente, não criar outro portfólio, não remover o atual, não repetir convites e não tentar contornar a restrição.

## 5. Estado visual da HOME

A HOME está em fase de melhoria visual, com a regra de preservar o funcionamento existente.

Fila visual conhecida:

1. aumentar tipografia e hierarquia;
2. melhorar header/menu;
3. destacar `Entrar` / `Minha conta`;
4. colocar `Instalar app` como última ação;
5. manter `Orçamento` em destaque;
6. remover repetição de conteúdo;
7. reorganizar Hero com `Não contrate um chatbot. Crie um agente para o seu negócio.`;
8. melhorar CTAs e benefícios;
9. evoluir a demonstração visual do agente;
10. adicionar formulário de contato;
11. adicionar prova social visual sem apresentar depoimentos fictícios como reais.

## 6. Próximo módulo exato

**HOME-01 — tipografia e hierarquia visual**

Objetivo do módulo: melhorar a legibilidade, escala tipográfica, contraste hierárquico e percepção premium da HOME, sem alterar lógica, backend ou fluxos funcionais.

Antes de qualquer edição de código no HOME-01:

- localizar o arquivo efetivamente usado pela HOME;
- ler a versão atual completa/relevante;
- identificar a estrutura existente;
- modificar somente o necessário para o objetivo do módulo;
- preservar as funcionalidades existentes.

## 7. Resultado esperado do HOME-01

Ao finalizar o módulo, registrar novo HANDOFF contendo:

- o que foi alterado;
- o que foi testado;
- resultado;
- arquivos alterados;
- commit/deploy;
- pendências;
- próximo módulo.

## 8. O que NÃO fazer no HOME-01

- não alterar autenticação;
- não alterar Supabase;
- não alterar Asaas;
- não alterar checkout;
- não alterar Gemini;
- não alterar lógica dos agentes;
- não alterar integração WhatsApp;
- não mexer na configuração da Meta;
- não fazer mudanças de infraestrutura sem solicitação explícita.

## 9. Estado no momento da interrupção

Nenhuma alteração de código deve ser considerada iniciada neste HANDOFF. Este documento apenas registra o ponto de continuidade e o próximo módulo operacional.

**Próximo passo oficial:** iniciar `HOME-01 — tipografia e hierarquia visual` somente após localizar e ler a implementação atual da HOME.
