# VENCIVO — CHECKPOINT OFICIAL

Data: 2026-08-20

## Fonte oficial

- Repositório: `demaisj24/jr-solucoes-digitais`
- Produção: `main`
- O GitHub é a fonte da verdade.
- Nenhuma IA deve assumir contexto de sessões anteriores sem conferir o estado real.

## Protocolo de trabalho

- `VENCIVO-MULTI-AI-PROTOCOL.md` define revisão cruzada.
- ChatGPT: arquitetura, segurança, revisão e gate.
- Claude Code: implementação e testes.
- Nenhuma IA deve fazer merge em `main` sem aprovação.

Fluxo:
ChatGPT define → Claude implementa → Claude testa → ChatGPT audita → Claude corrige se necessário → nova auditoria → teste real → merge.

## Estado concluído

### AI-01
Conhecimento/File Search funcional e validado.
Teste de regressão conhecido:
- Produto: Corte Premium VX
- Preço: R$ 147,00
- Código: VX-8472

### AI-02
Meu Agente/dashboard e gestão de documentos implementados e validados pelo dono do produto.

### INFRA-01
CONCLUÍDO E INTEGRADO NA `main`.

- Commit final da `main`: `7943629`
- `api/health.js` foi removido como função e substituído por `health.json` + rewrite.
- Produção READY.
- `/api/health` em produção responde HTTP 200 com o contrato antigo.
- `main` ficou com 11 Serverless Functions.
- O objetivo foi liberar 1 slot para Instagram no Hobby.

## Instagram

Instagram é o canal prioritário do VENCIVO.
WhatsApp está FORA do MVP atual.

### PR #9 / `feat/instagram-business-login`
É legado/referência e NÃO deve ser mergeado como está.
Problemas encontrados:
- `instagram_connections.access_token` em plaintext;
- falta `agent_id`;
- branch antiga remove `api/chat.js` para resolver limite de functions, problema já resolvido pelo INFRA-01.

### INST-04
Fundação do webhook Instagram.

Branch original:
`feat/instagram-webhook`

Commit após rebase sobre INFRA-01:
`c2d0e7f`

Não está em `main`.

### INST-04A
Correção arquitetural do webhook para Web Request/Response.

Branch:
`fix/instagram-webhook-raw-body`

Commit:
`34a55bc`

Características:
- `GET(request)` / `POST(request)`;
- leitura do corpo via Web Request;
- HMAC-SHA256;
- `timingSafeEqual`;
- limite de 1 MB;
- validação `object=instagram`;
- sem Gemini/persistência/resposta final nesta etapa;
- 18/18 testes locais passando;
- Preview Vercel READY com 12 functions.

E2E positivo do webhook continua BLOCKED pela proteção SSO da Vercel. Não usar cookie, secret de bypass ou desabilitar proteção para contornar isso.

Status correto: INST-04A = PASS técnico / E2E positivo pendente.

## INST-05 — estado atual

Fase 1 de arquitetura CONCLUÍDA, sem migration aplicada.

Branch:
`feat/instagram-identity-migration`

Commit:
`dfc8fcc`

O schema real do Supabase foi consultado somente leitura.
`instagram_connections` existe em produção, está com 0 linhas e atualmente possui:
- id
- owner_id
- instagram_user_id
- username
- access_token (plaintext — precisa ser eliminado antes de conexão real)
- token_expires_at
- scopes
- status
- created_at
- updated_at

Não existe `agent_id` atualmente.

Decisão arquitetural aprovada para revisão:
ALTERAR a tabela existente, não criar tabela paralela de conexão.

Alvo:
- `agent_id` FK composto com `owner_id` → `agents(id, owner_id)`;
- `UNIQUE(instagram_user_id)` global;
- avaliar `UNIQUE(agent_id)` conforme decisão de produto;
- substituir token plaintext por `access_token_encrypted`;
- AES-256-GCM no backend;
- chave fora do banco;
- frontend nunca recebe token;
- RLS preservada;
- `REVOKE SELECT` para roles públicas/autenticadas conforme desenho validado.

Também foi desenhada `instagram_webhook_events` para idempotência, mas NÃO deve ser aplicada ainda sem revisão.

### Próximo passo imediato

Claude deve revisar diretamente os artefatos da Fase 1 e pesquisar o repositório inteiro por:
- `instagram_connections`
- `access_token`
- `access_token_encrypted`
- `agent_id`
- `instagram_user_id`

Deve confirmar:
1. nenhum código de `main` depende de `access_token` plaintext;
2. remoção do campo não quebra APIs;
3. FK composto é válido;
4. impacto de `UNIQUE(agent_id)`;
5. `UNIQUE(instagram_user_id)`;
6. RLS + REVOKE;
7. rollback;
8. estratégia AES-256-GCM;
9. ausência de criptografia dentro da migration;
10. separação de `instagram_webhook_events`.

Se tudo passar: `INST-05 FASE 1 — APROVADA PARA APLICAÇÃO CONTROLADA`.
Ainda não aplicar migration antes dessa revisão.

## Áudio — decisão de produto

Áudio deve fazer parte do MVP Instagram.

Objetivo:
Instagram audio → obtenção da mídia → Gemini 3.1 Flash-Lite → texto/transcrição → agente VENCIVO → resposta.

Não implementar áudio dentro da migration INST-05.

O contrato futuro de mensagem deve ser multimodal:
- text
- audio
- image
- video
- attachment

A intenção é que o agente entenda como o cliente realmente conversa no Instagram, sem exigir que o cliente digite tudo.

## Arquitetura alvo Instagram

Instagram
→ webhook seguro
→ identidade
→ idempotência
→ normalização da mensagem
→ texto/áudio/imagem/vídeo
→ conhecimento + regras + personalidade + contexto
→ agente VENCIVO
→ resposta
→ conversa/lead/humano

## Regras importantes

- Não implementar WhatsApp nesta frente.
- Não criar `ia-v6`, `ia-v7` etc.; `ia-v4.html` é referência visual aprovada.
- Não duplicar OAuth/conexão Instagram.
- Não mergear PR #9 como está.
- Não executar SQL de produção sem revisão.
- Não expor tokens.
- Não usar bypass de proteção da Vercel para validar webhook.
- Não alterar AI-01/AI-02 sem necessidade explícita.

## Próximo marco comercial

Depois de fechar a fundação Instagram:
1. conexão real;
2. Direct;
3. áudio;
4. comentários;
5. agente especialista;
6. qualificação;
7. leads;
8. transferência humana;
9. testes de carga/segurança;
10. lançamento e venda.
