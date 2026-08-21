# VENCIVO — Checkpoint de Continuidade

**Data:** 2026-08-21
**Estado-base registrado:** `main` em `4d7e502`
**Branch de checkpoint:** `docs/checkpoint-sec04-1-2026-08-21`

## Ponto exato de parada

O trabalho foi pausado após a implementação da **SEC-04-1 Fase 2**, antes de commit/merge/deploy.

A SEC-04 original foi endurecida para `prepare/process` de conhecimento:
- sem autenticação válida → `401`;
- agente de outro owner → `404` genérico;
- agente inexistente → mesma resposta genérica;
- agente `demo` com owner legítimo → permitido;
- agente `demo` sem owner → rejeitado;
- rate limit nominal de 20 requisições/hora por usuário;
- caminhos rejeitados não chegam a Gemini/Storage nos testes.

## SEC-04-1

Foi descoberto e reproduzido um BOLA/path traversal no `process`: a autorização validava o `agent_id`, mas o `path` recebido pelo cliente era protegido apenas por `startsWith`. Casos com `../`, `..\\` e `%2e%2e` permitiram, nos fixtures sintéticos, atravessar o prefixo e acessar/apagar conteúdo de outro agente.

A Fase 2 implementou um vínculo de operação para amarrar:

`operation_id → owner_id → agent_id → path`

A suíte reportada pelo Claude ficou em **58/58 PASS**, cobrindo:
- casos A-G;
- encoding/traversal H-M;
- vínculo da operação N-T;
- regressão completa da SEC-04;
- ausência de acesso indevido a Storage/Gemini;
- uso/expiração/reuso da operação.

## Regra para a retomada

**Não considerar SEC-04-1 encerrada ainda.** A próxima ação é uma revisão forense do diff real, sem alteração de código, sem commit, sem push, sem merge, sem deploy e sem SQL.

A revisão deve confirmar:
1. geração e entropia de `operation_id`;
2. onde a associação operação/owner/agent/path é armazenada;
3. TTL e uso único/invalidação;
4. impossibilidade de o cliente substituir os valores registrados;
5. ordem das verificações antes de Storage/Gemini;
6. tratamento seguro de `../`, `..\\`, `%2e%2e`, `%252e%252e`, `%5c`, null byte e Unicode;
7. impossibilidade de cruzar operação, path, agent ou owner;
8. expiração e reuso de `operation_id`;
9. diff limitado a `api/agents.js` e testes;
10. nenhuma alteração em Supabase/SQL/main/Instagram/WhatsApp/checkout/AI.

Se surgir qualquer bypass, **não corrigir durante essa revisão**: apenas reportar e parar.

## Estado das áreas críticas

- `main`: não alterar.
- Supabase/schema: não alterar nesta revisão.
- Instagram/WhatsApp/checkout/AI-01/AI-02: intocados.
- Não instalar dependências.
- Não colocar secrets/tokens no Git.
- Não fazer deploy.

## Contexto arquitetural recente

O VENCIVO está construindo integração Instagram com isolamento multi-tenant, conexão `instagram_connections` já migrada para `agent_id` + `access_token_encrypted`, tabela `instagram_webhook_events` aplicada com idempotência e estados de processamento/resposta, resolução `instagram_user_id → agent_id`, processamento interno Gemini e desenho da Send API. Áudio/imagem/vídeo foram registrados como requisitos futuros do agente.

Também foi concluído o INFRA-01, liberando o 12º slot de Serverless Functions no Hobby, e INST-04A migrou o webhook para Web Request/Response com validação de corpo bruto. A validação HTTP ponta a ponta do preview continua dependente da proteção SSO da Vercel e não foi contornada.

## Próximo passo oficial

**SEC-04-1 — revisão forense final do patch implementado.**

Não avançar para commit/merge/deploy antes dessa revisão e aprovação.
