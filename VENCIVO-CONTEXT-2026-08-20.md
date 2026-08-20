# VENCIVO — CHECKPOINT OFICIAL

Data: 2026-08-20

## Fonte oficial

- Repositório: `demaisj24/jr-solucoes-digitais`
- Produção: `main`
- GitHub é a fonte da verdade.
- Nenhuma IA deve assumir contexto de sessões anteriores sem conferir o estado real.

## Protocolo

- `VENCIVO-MULTI-AI-PROTOCOL.md` define revisão cruzada.
- ChatGPT: arquitetura, segurança, revisão e gates.
- Claude Code: implementação e testes.
- Fluxo: ChatGPT define → Claude implementa → Claude testa → ChatGPT audita → correções → teste real → merge aprovado.
- Nenhuma IA deve fazer merge em `main` sem aprovação explícita.

## Estado concluído

### AI-01
Conhecimento/File Search funcional e validado.
Regressão conhecida:
- Produto: Corte Premium VX
- Preço: R$ 147,00
- Código: VX-8472

### AI-02
Meu Agente/dashboard e gestão de documentos implementados e validados pelo dono do produto.

### INFRA-01
CONCLUÍDO E INTEGRADO NA `main`.
- Commit de integração informado: `7943629`.
- `api/health.js` substituído por `health.json` + rewrite.
- Produção READY.
- `/api/health` em produção preserva HTTP 200 e contrato.
- `main` passou a 11 Serverless Functions, liberando 1 slot no Hobby para Instagram.

## Instagram — regras

Instagram é o canal prioritário do VENCIVO.
WhatsApp está FORA do MVP atual.

### PR #9 / feat/instagram-business-login
LEGADO/REFERÊNCIA. NÃO mergear como está.
Problemas: token plaintext, ausência de `agent_id` e remoção indevida de `api/chat.js` para resolver limite de functions, problema já resolvido pelo INFRA-01.

### INST-04
Branch `feat/instagram-webhook`, commit `c2d0e7f` após rebase sobre INFRA-01. Não está em `main`.
Fundação do webhook: GET Meta verification, POST, HMAC-SHA256, timingSafeEqual, limite 1MB, validação `object=instagram`, sem Gemini/persistência/resposta final.

### INST-04A
Branch `fix/instagram-webhook-raw-body`, commit `34a55bc`.
Migrado para `GET(request)`/`POST(request)` Web Request/Response; 18/18 testes locais; Preview READY com 12 functions.
E2E positivo permanece BLOCKED pela proteção SSO da Vercel. Não usar bypass/cookie/secret de bypass para contornar.

## INST-05 — identidade Instagram

### Fase 1
APROVADA.
Branch `feat/instagram-identity-migration`.
A arquitetura foi revisada contra schema real do Supabase.

### Fase 2
**CONCLUÍDA/APLICADA E VALIDADA.**
Migration: `instagram_connections_agent_identity`.
A tabela `instagram_connections` continua com 0 linhas.

Schema final confirmado:
- `agent_id uuid NOT NULL`;
- FK composto `(agent_id, owner_id) → agents(id, owner_id)`;
- `UNIQUE(instagram_user_id)` global;
- `UNIQUE(agent_id)`;
- `access_token` plaintext removido;
- `access_token_encrypted` adicionado e NOT NULL;
- `agents(id, owner_id)` recebeu unique composto necessário ao FK;
- RLS mantida;
- `authenticated` e `anon` sem SELECT na tabela, inclusive no token;
- `service_role` mantém acesso para operação backend;
- guard transacional de tabela vazia validado no desenho;
- nenhuma linha existente foi migrada porque havia 0 conexões.

### Segurança do token

A estratégia aprovada é AES-256-GCM no backend, chave fora do banco, frontend nunca recebe token. Formato planejado: `iv.tag.ciphertext` em base64url. `decrypt()` ainda não foi implementado e NÃO deve ser usado antes de uma implementação/auditoria específica.

### INST-05B — próximo gate

`docs/sql/instagram-webhook-events.sql` existe como proposta e NÃO foi aplicada.
A tabela proposta é `instagram_webhook_events`, separada semanticamente de `instagram_connections` e de `billing_events`.
Antes de aplicar, revisar: idempotência, provider_event_id, payload mínimo/PII, retenção, índices, RLS e estados de processamento.

## Backend atual relevante

`api/agent-chat.js` em `main` é o endpoint atual do agente de teste/site. Ele consulta `agents` e `agent_knowledge`, usa File Search quando `knowledge_store_name` existe e chama o modelo configurado no código. Não alterar esse fluxo sem necessidade explícita.

## Áudio — requisito obrigatório do MVP Instagram

Áudio deve fazer parte do MVP Instagram.
Objetivo:
Instagram audio → obtenção da mídia → Gemini multimodal → texto/transcrição → agente VENCIVO → resposta.

A documentação oficial atual do Gemini confirma suporte a áudio como entrada, transcrição e resposta textual; para arquivos maiores que 20 MB, a orientação é usar Files API. Não assumir um nome/modelo específico sem verificar o modelo atualmente configurado no repositório e a documentação oficial.

Contrato futuro de mensagem:
- text
- audio
- image
- video
- attachment

Não implementar áudio dentro da migration de identidade.

## Arquitetura alvo Instagram

Instagram
→ webhook seguro
→ idempotência
→ resolução `instagram_user_id → agent_id/owner_id`
→ normalização multimodal
→ conhecimento + regras + personalidade + contexto
→ agente VENCIVO
→ resposta Instagram
→ conversa/lead/humano

## Regras

- Não implementar WhatsApp nesta frente.
- Não criar `ia-v6`, `ia-v7` etc.; `ia-v4.html` é a referência visual aprovada.
- Não duplicar OAuth/conexão Instagram.
- Não mergear PR #9 como está.
- Não executar SQL de produção sem revisão.
- Não expor tokens.
- Não usar bypass da proteção da Vercel para validar webhook.
- Não alterar AI-01/AI-02 sem necessidade explícita.

## Próximos marcos

1. INST-05B — eventos/idempotência.
2. Conexão Instagram/OAuth segura, usando a tabela corrigida.
3. Direct real.
4. AUDIO-01 — prova isolada de áudio → Gemini → texto.
5. Direct multimodal.
6. Comentários.
7. Agente especialista por negócio.
8. Qualificação/leads.
9. Transferência humana.
10. Testes de carga/segurança.
11. Empacotamento comercial, lançamento e vendas.
