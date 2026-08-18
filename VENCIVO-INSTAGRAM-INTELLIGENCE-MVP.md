# VENCIVO — INSTAGRAM INTELLIGENCE MVP

**Data:** 18/08/2026  
**Branch:** `feat/vencivo-instagram-intelligence`  
**Produção preservada:** `main` / `vencivo-ai` / `vencivo.com.br`

## 1. Decisão de produto

O VENCIVO não será lançado como um chatbot genérico de Instagram.

A proposta do primeiro produto de canal é:

> **Não deixe oportunidades de venda passarem despercebidas nas suas DMs.**

O VENCIVO será uma camada de inteligência comercial sobre conversas do Instagram profissional: recebe eventos, identifica intenção, classifica oportunidades, sugere respostas e encaminha para humano quando necessário.

O cliente não precisa substituir o Instagram nem aprender tecnologia de API.

## 2. Público inicial

Prioridade para negócios brasileiros que já vendem ou captam clientes pelo Instagram:

- salões de beleza;
- barbearias;
- estética;
- lojas;
- restaurantes;
- studios;
- profissionais autônomos;
- imobiliárias;
- prestadores de serviços;
- clínicas e outros negócios profissionais, com regras específicas quando necessário.

Requisito técnico do canal: conta profissional do Instagram, Business ou Creator, compatível com a API oficial utilizada pelo VENCIVO.

## 3. Experiência do cliente

Fluxo desejado:

1. criar conta VENCIVO;
2. clicar em **Conectar meu Instagram**;
3. autorizar o VENCIVO pela Meta/OAuth;
4. confirmar a conta profissional conectada;
5. informar negócio, produtos/serviços, preços, horários, regras e FAQ;
6. opcionalmente fornecer documentos de conhecimento;
7. testar conversas em ambiente controlado;
8. ativar atendimento;
9. acompanhar oportunidades no painel.

O cliente nunca deve:

- fornecer senha do Instagram ao VENCIVO;
- copiar access token manualmente;
- criar webhook;
- configurar servidor;
- conhecer Gemini;
- configurar Supabase;
- configurar Meta Developer.

## 4. Dados do Instagram usados no MVP

### Obrigatórios

**DMs:** conteúdo das mensagens, identificadores técnicos necessários para roteamento e contexto da conversa permitido pela API.

**Comentários:** texto do comentário, identificadores técnicos e contexto da publicação disponível no evento/API.

### Não entram no MVP

- publicação de posts;
- gestão de anúncios;
- agendamento de conteúdo;
- analytics avançado;
- hashtags;
- automações de conteúdo;
- qualquer permissão que não seja necessária para o caso de uso principal.

## 5. Inteligência comercial

Cada evento deve passar primeiro por uma camada determinística de filtragem/normalização. Gemini só deve ser chamado quando houver necessidade real de interpretação.

Categorias mínimas:

- dúvida;
- interesse;
- preço/orçamento;
- intenção de compra;
- agendamento;
- objeção/negociação;
- reclamação;
- pedido de humano;
- irrelevante.

Sinais adicionais:

- temperatura: fria / morna / quente;
- produto/serviço citado;
- intenção identificada;
- próxima ação recomendada;
- necessidade de humano;
- evidências textuais que sustentam a classificação.

## 6. Regra de verdade

O VENCIVO não deve afirmar que uma venda foi perdida nem inventar valor financeiro.

Só calcular valor potencial quando houver preço ou dado suficiente fornecido pelo próprio negócio.

Exemplo correto:

> **17 oportunidades identificadas.**

> **8 clientes demonstraram intenção de compra.**

> **5 solicitaram preço.**

Exemplo proibido sem evidência:

> **Você perdeu R$ 10.000.**

## 7. Resposta automática

A IA só poderá responder quando:

1. o evento estiver dentro das regras da Meta;
2. a conversa estiver em janela permitida;
3. a ação for permitida para automação;
4. o conteúdo estiver fundamentado no conhecimento do negócio;
5. não houver necessidade obrigatória de humano;
6. o backend aprovar explicitamente o envio.

A IA nunca decide sozinha se uma mensagem pode ser enviada.

## 8. Meta Safety Layer

Antes de qualquer envio, o backend deverá validar:

- conta conectada correta;
- token válido;
- permissões disponíveis;
- tipo de evento;
- origem da conversa;
- janela de resposta;
- regras específicas para comentário/private reply;
- se a ação é automática ou exige humano;
- idempotência para evitar duplicação;
- rate limit/retry;
- resposta de erro da Meta.

O mecanismo `HUMAN_AGENT` não será usado para estender artificialmente automações. Quando a janela de automação não permitir resposta, o sistema deverá bloquear o envio e indicar ação humana quando apropriado.

## 9. Arquitetura lógica

```text
Instagram / Meta
      |
      v
Webhook Gateway
      |
      v
Validação + idempotência + isolamento por cliente
      |
      v
Normalizador de eventos
      |
      +---- evento irrelevante -> armazenar/ignorar conforme política
      |
      v
Motor de regras
      |
      +---- resposta determinística segura
      |
      +---- interpretação necessária -> Gemini
      |
      v
Classificador de oportunidade
      |
      +---- automático seguro -> Safety Layer -> Meta
      |
      +---- humano necessário -> Inbox/Oportunidade
      |
      v
Supabase
      |
      v
Dashboard VENCIVO
```

## 10. Isolamento multiempresa

Toda entidade ligada ao Instagram deve pertencer a um único usuário/conta VENCIVO.

Entidades previstas:

- `instagram_connections`;
- `instagram_conversations`;
- `instagram_messages`;
- `instagram_events`;
- `instagram_opportunities`;
- `instagram_business_config`.

Os nomes são preliminares e só serão criados depois de confirmar o schema Supabase real de produção.

Nenhum token, conversa, mensagem, documento ou oportunidade pode ser acessível por outro cliente.

RLS deve ser tratado como requisito obrigatório antes de produção.

## 11. Tokens e segredos

Tokens Meta não podem ficar em HTML, JavaScript público, JSON exportado, banco acessível ao cliente ou logs.

O OAuth deve armazenar credenciais de forma segura no backend/secret storage compatível com a arquitetura existente.

O access token não deve ser enviado ao frontend depois da conexão.

## 12. IA e custo

A IA deve ser seletiva.

Não enviar todos os eventos indiscriminadamente ao Gemini.

Primeiro aplicar regras simples para:

- mensagens vazias;
- duplicadas;
- irrelevantes;
- respostas triviais conhecidas;
- eventos que não exigem interpretação.

Quando Gemini for usado, limitar contexto ao necessário e registrar métricas de uso/custo sem expor dados sensíveis.

## 13. Dashboard MVP

A primeira tela deverá responder:

### Hoje

- conversas recebidas;
- oportunidades identificadas;
- clientes quentes;
- conversas que exigem humano;
- valor potencial somente quando calculável com evidência.

### Oportunidades

Cada item deve mostrar:

- cliente/identificador permitido;
- origem: DM ou comentário;
- contexto;
- classificação;
- temperatura;
- evidências;
- próxima ação;
- status: nova / em atendimento / resolvida / descartada.

## 14. Comentários

Comentários serão tratados como entrada comercial separada de DMs.

Quando elegível, o sistema poderá sugerir ou enviar uma private reply dentro das regras da Meta.

A private reply não deve ser tratada como autorização para uma sequência automática ilimitada. Se o usuário responder, a conversa passa a seguir as regras normais de messaging.

## 15. Teste obrigatório antes de produção

### Meta Gate

1. conta profissional de teste conecta;
2. OAuth funciona;
3. webhook recebe DM;
4. webhook recebe comentário;
5. resposta de DM funciona;
6. private reply funciona quando elegível;
7. segunda conta profissional conecta;
8. eventos da conta A não chegam à conta B;
9. tokens permanecem isolados;
10. duplicação de webhook não duplica mensagem/oportunidade;
11. janela de resposta é respeitada;
12. envio fora da janela é bloqueado;
13. erro/429 da Meta é tratado;
14. revogação/desconexão é tratada;
15. Advanced Access é validado para conta de terceiro antes de considerar o SaaS aprovado.

## 16. Fora do MVP

- WhatsApp direto pelo VENCIVO;
- campanhas em massa;
- SMS;
- CRM completo;
- automação de marketing genérica;
- publicação de posts;
- anúncios;
- calendário de conteúdo;
- múltiplos canais simultâneos;
- follow-up automático fora das janelas permitidas;
- promessa de vendas garantidas.

WhatsApp poderá ser integrado posteriormente por API oficial/BSP, sem tornar o VENCIVO dependente de um único provedor.

## 17. Critério de sucesso do MVP

O usuário deve conseguir:

**Conectar → ensinar → ativar → receber conversa → VENCIVO entender → oportunidade aparecer → resposta segura ser enviada ou humano ser chamado.**

O produto só será considerado CONCLUÍDO quando o fluxo for testado de ponta a ponta em contas de teste adequadas, com isolamento e regras da Meta validados.

## 18. Regra de execução

Este documento define o alvo do produto. Não autoriza substituir a arquitetura de produção sem leitura prévia do código e do schema reais.

Primeiro módulo técnico desta iniciativa:

> **META-GATE-01 — mapear e validar a arquitetura real de produção e a conexão oficial do Instagram antes de criar tabelas ou alterar o agente existente.**
