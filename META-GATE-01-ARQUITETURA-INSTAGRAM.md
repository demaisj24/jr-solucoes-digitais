# META-GATE-01 — ARQUITETURA INSTAGRAM

**Data:** 18/08/2026  
**Branch:** `feat/vencivo-instagram-intelligence`  
**Base:** `main` em `c4f183ab8f1b6a4c31fb4ef858b7729eb79d8506`

## 1. Resultado do mapeamento

A produção atual usa Vercel Functions e Supabase REST no backend.

Arquivos relevantes em `main`:

- `ia-v3.html` — criador atual do agente;
- `api/agents.js` — criação, leitura e persistência dos agentes;
- `api/agent-chat.js` — atendimento do agente com Gemini;
- `api/chat.js` — endpoint da demonstração pública;
- `api/webhooks/` — estrutura existente de webhooks;
- `whatsapp-config.html`, `whatsapp-config-v2.html` e funções relacionadas — integração WhatsApp existente/em preparação.

O agente atual é persistido na tabela `public.agents`. A criação passa pelo backend com `SUPABASE_SERVICE_ROLE_KEY`, e o chat recupera o agente por `public_id`. O conteúdo de conhecimento atual é persistido em `agent_knowledge` e limitado no fluxo atual antes de ser enviado ao Gemini. Não foi encontrado no `main` atual um conector Instagram implementado.

## 2. Banco real confirmado

Tabelas públicas relevantes existentes:

- `agents`
- `agent_knowledge`
- `agent_sessions`
- `subscriptions`
- `usage_counters`
- `profiles`
- `billing_events`

As tabelas de agentes, conhecimento e sessões possuem RLS habilitado e políticas de proprietário. O backend atual usa service role para operações administrativas e valida o usuário via Supabase Auth quando necessário.

## 3. Implicação arquitetural

Não devemos criar uma segunda tabela de agentes nem duplicar o agente atual.

O Instagram deve ser uma **integração do agente existente**, com entidades próprias para conexão, eventos, conversas, mensagens e oportunidades.

Antes de DDL, será necessário definir a relação exata:

`auth user -> agent -> instagram connection -> conversations/messages/opportunities`

## 4. Meta API escolhida

Para o MVP, a direção é **Instagram API with Instagram Login**.

A documentação atual da Meta descreve suporte a contas profissionais Business e Creator e lista as permissões `instagram_business_basic`, `instagram_business_manage_messages` e `instagram_business_manage_comments`. A API usa `graph.instagram.com` e Business Login for Instagram. Fonte oficial consultada: Meta/Instagram API documentation no Postman.

A documentação também informa que Advanced Access é necessário quando o aplicativo atende contas profissionais que não pertencem ou não são administradas pela equipe do aplicativo. Esse é o cenário do VENCIVO em produção.

## 5. Eventos do MVP

Assinar somente o necessário:

- `messages`;
- `comments`.

Não solicitar inicialmente permissões de publicação, anúncios ou outras funções não necessárias.

## 6. Regras críticas da Meta incorporadas ao design

### Mensagens

A conversa normalmente começa quando o usuário do Instagram envia mensagem para a conta profissional.

O destinatário precisa ter iniciado a conversa para o fluxo normal de messaging.

### Janela

O fluxo padrão possui janela de resposta de 24 horas. O produto não deve presumir follow-up automático fora dessa janela.

### Comentários/private reply

A documentação atual permite private reply ao comentário, com limite de uma mensagem inicial e prazo de até 7 dias para comentário em post/reel. Se o destinatário responder, follow-ups seguem a janela de 24 horas. Instagram Live possui regra específica mais restritiva.

### HUMAN_AGENT

`HUMAN_AGENT` não será usado para automação. A documentação oficial restringe seu uso a suporte humano para questões que não puderam ser resolvidas dentro da janela padrão e proíbe mensagens automatizadas nesse contexto.

### Requests

Mensagens em Requests sem atividade por 30 dias não devem ser tratadas como histórico recuperável indefinidamente pela API. O VENCIVO deve persistir, quando permitido, os eventos que recebeu em seu próprio banco.

### Group messaging

Não suportar grupos; a conversa do Instagram é tratada como 1:1.

## 7. Arquitetura aprovada para implementação

```text
Meta / Instagram
       |
       v
Webhook VENCIVO
       |
       +--> valida assinatura/evento
       +--> idempotência
       +--> identifica conexão/agent
       |
       v
Normalizador
       |
       +--> DM
       +--> comentário
       |
       v
Motor determinístico
       |
       +--> ignora evento irrelevante
       +--> resposta segura conhecida
       +--> envia caso complexo para Gemini
       |
       v
Classificador comercial
       |
       +--> intenção
       +--> temperatura
       +--> oportunidade
       +--> próxima ação
       +--> humano necessário
       |
       +--------------------+
       |                    |
       v                    v
Safety Layer            Dashboard
       |
       v
Meta Send API
```

## 8. Segurança obrigatória

- tokens nunca no frontend;
- tokens nunca em logs;
- tokens nunca em arquivos versionados;
- conexão associada a um único agente/owner;
- mensagens e oportunidades sempre filtradas por agente/owner;
- RLS obrigatório nas novas tabelas;
- idempotência de webhook;
- proteção contra replay/duplicação;
- retry com backoff para erros transitórios;
- bloqueio de envio quando regra da Meta não permitir;
- auditoria mínima de envio e erro;
- nenhuma credencial Meta existente deve ser reutilizada sem confirmação explícita de validade e escopo.

## 9. Custo

A Meta não apresenta na documentação consultada um modelo de cobrança por mensagem equivalente ao WhatsApp. Portanto não devemos modelar o produto como “mensagens ilimitadas sem custo”. O custo do VENCIVO será principalmente infraestrutura + IA e qualquer cobrança que eventualmente venha a ser aplicável ao canal.

O produto não deve absorver custos externos desconhecidos em uma promessa de preço fixo sem limite técnico.

## 10. Gate de aprovação técnica

O MVP só poderá ser considerado tecnicamente aprovado após:

- OAuth real;
- Advanced Access para contas de terceiros;
- conexão de pelo menos duas contas profissionais;
- recebimento de DM;
- recebimento de comentário;
- resposta de DM;
- private reply elegível;
- isolamento entre contas;
- idempotência;
- janela de 24h respeitada;
- bloqueio fora da janela;
- tratamento de erros/429;
- desconexão/revogação;
- nenhuma credencial exposta.

## 11. Estado

**META-GATE-01: IMPLEMENTADO como especificação/mapeamento.**

Não houve alteração em `main`, Supabase ou backend de produção.

Próximo módulo técnico autorizado nesta branch:

> **META-GATE-02 — criar o esqueleto seguro de OAuth/Webhook em branch, sem ativar produção, e preparar os testes de duas contas.**
