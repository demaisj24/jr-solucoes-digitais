# VENCIVO — MASTER STATE

**Data de criação:** 17/08/2026  
**Repositório:** `demaisj24/jr-solucoes-digitais`  
**Branch principal:** `main`

> Este arquivo é a fonte resumida de estado do projeto. Ele deve ser atualizado quando uma etapa relevante for concluída, corrigida ou alterada.

## 1. Objetivo do produto

Vencivo Atendimento Inteligente / Vencivo AI é um SaaS para criação de agentes de IA personalizados para empresas.

Posicionamento aprovado: não vender o produto como simples chatbot, mas como agente treinado para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano.

## 2. Regra de preservação

Preservar tudo que já funciona. Antes de editar código, localizar e ler a versão efetivamente usada pela aplicação.

Nesta etapa, não alterar sem necessidade:
- login;
- cadastro;
- sessão/autenticação;
- Supabase;
- Asaas;
- checkout;
- Gemini;
- funcionamento atual dos agentes;
- fluxos funcionais existentes.

## 3. Componentes já existentes

- Frontend/site do Vencivo;
- autenticação e conta do usuário;
- agentes de IA;
- Supabase;
- Gemini;
- Asaas;
- checkout recorrente com cartão;
- Pix;
- checkout Pix avulso;
- Resend;
- domínio `vencivo.com.br`;
- preparação para WhatsApp Cloud API / Embedded Signup;
- portfólio empresarial Meta `Vencivo Atendimento Inteligente`.

## 4. Arquivos relevantes conhecidos

- `agente.html`
- `conta.html`
- `conta-fix.js`
- `ia-demo.html`
- `ia-demo-real.html`
- `ia-v2.html`
- `ia-v3.html`
- `DEPLOY-VENCIVO-AI.md`
- `README-VENCIVO-AI.md`
- `README-WHATSAPP-IMPLANTACAO.md`
- `WHATSAPP-INTEGRATION-NEXT.md`
- `NEXT-VENCIVO-AI.txt`
- `CONTEXTO-VENCIVO-CONTINUACAO.md`

## 5. Estado recente confirmado no GitHub

Houve trabalho recente em:
- estabilidade do carregamento dos agentes na conta;
- restauração/sincronização de sessão;
- preservação de sessão nas requisições da API do service worker;
- checkout Asaas;
- Pix;
- checkout recorrente com cartão;
- checkout Pix avulso;
- UX da conta e mensagens de pagamento;
- login com Enter.

## 6. Meta / WhatsApp

Caminho escolhido: WhatsApp Cloud API / Embedded Signup.

Portfólio empresarial existente: `Vencivo Atendimento Inteligente`.

Estado em 17/08/2026:
- empresa/portfólio sofreu restrição da Meta;
- foi solicitada análise;
- identidade/documentação foi enviada conforme o fluxo iniciado;
- análise da Meta está pendente;
- ainda não foi adicionado número WhatsApp ao portfólio.

Regra enquanto a análise estiver pendente:
- não criar outro portfólio;
- não remover o portfólio atual;
- não ficar repetindo convites;
- não fazer alterações precipitadas na empresa;
- não tentar contornar a restrição.

Observação: houve confusão anterior entre o nome `Aila`, o e-mail usado e a conta pessoal administradora. Isso não deve ser tratado como causa confirmada da restrição sem evidência da Meta.

## 7. Resend / domínio

Resend é o serviço de e-mail do projeto.

`vencivo.com.br` está registrado no Registro.br.

## 8. Trabalho visual atual

A HOME está em fase de melhoria visual, preservando funcionamento.

Fila conhecida:
1. aumentar tipografia e hierarquia;
2. melhorar header/menu;
3. destacar `Entrar` / `Minha conta`;
4. colocar `Instalar app` como última ação;
5. manter `Orçamento` em destaque;
6. remover repetição de conteúdo;
7. reorganizar Hero com `Não contrate um chatbot. Crie um agente para o seu negócio.`;
8. melhorar CTAs e benefícios;
9. evoluir demonstração visual do agente;
10. adicionar formulário de contato;
11. adicionar prova social visual sem apresentar depoimentos fictícios como reais.

## 9. Pendências de alto nível

- concluir melhorias visuais da HOME;
- resolver/retomar Meta após a análise;
- concluir integração WhatsApp;
- auditoria de segurança;
- validação completa de autenticação e isolamento de dados;
- teste ponta a ponta de agentes;
- teste ponta a ponta de pagamentos;
- teste de produção;
- preparação final para lançamento.

## 10. Método de continuidade

Toda sessão de trabalho deve ter uma missão clara e limitada.

Ao concluir ou interromper uma etapa, registrar um HANDOFF contendo:
- data;
- conversa/módulo;
- objetivo;
- o que foi feito;
- o que foi testado;
- resultado;
- erros;
- arquivos alterados;
- commit/deploy;
- pendências;
- próximo passo exato;
- itens que não devem ser alterados.

Uma conversa do ChatGPT não é a memória técnica definitiva. O GitHub é a fonte técnica de verdade.

## 11. Regra para novas conversas

Ao abrir uma nova conversa do Projeto VENCIVO:

1. consultar o estado atual do GitHub;
2. ler este arquivo e o último HANDOFF disponível;
3. verificar commits recentes quando necessário;
4. identificar o último ponto concluído;
5. continuar somente do próximo passo;
6. não reimplementar funcionalidade já concluída sem motivo comprovado.

## 12. Próximo passo operacional

Antes de novas alterações no código, estabelecer e registrar o primeiro HANDOFF oficial da continuidade do Vencivo. Depois disso, trabalhar por módulos/conversas curtas.
