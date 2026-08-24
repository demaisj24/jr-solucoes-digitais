# VENCIVO — MASTER STATE

**Data de atualização:** 24/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch de produção:** `main`
**Vercel:** `vencivo-ai`
**Produção:** `vencivo.com.br`

> Fonte resumida e permanente do estado do projeto. Atualizar após cada módulo relevante.

## 1. Produto

VENCIVO AI é um SaaS para criação de agentes de IA personalizados para empresas.

Posicionamento: agente de IA para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano. A evolução inclui canais como Instagram e WhatsApp quando as integrações estiverem tecnicamente prontas e aprovadas.

## 2. Estado técnico em `main`

### Concluído/integrado

- HOME-01 a HOME-07;
- HOME-06 revisado e integrado;
- criador de agente;
- persistência Supabase;
- autenticação Supabase;
- Vercel;
- Gemini;
- AI-01 — Base de Conhecimento;
- File Search por agente;
- chat com conhecimento real;
- SEC-19 — política de privacidade mínima;
- SEC-20 — keepalive Supabase via GitHub Actions;
- INST-04 — fundação segura do webhook Instagram;
- documentação de continuidade inicial.

### AI-01 — concluído

Preservar sem reabrir sem evidência de regressão:

- upload privado de documentos;
- PDF, DOC, DOCX, TXT, MD, CSV e RTF;
- Gemini File Search por agente;
- isolamento por agente/public_id;
- recuperação semântica;
- fallback textual compatível;
- proteção contra exposição de prompt/credenciais;
- regras contra prompt injection em documentos.

## 3. AI-02 — status corrigido

**AI-02 ainda não está integrado à `main`.**

Existe trabalho validado na branch:

`feat/ai-02-agent-dashboard`

PR existente:

`#12 — AI-02 — Dashboard e Meu Agente`

Conteúdo da branch:

- `meu-agente.html`;
- link `Gerenciar` no dashboard;
- listagem de metadados de documentos;
- `action=list` em `api/agents.js`;
- testes AI-02.

A branch foi testada anteriormente, porém ficou divergente da `main` e contém mojibake na mensagem de erro da ação `list` (`Agente ? obrigat?rio.`). Não fazer merge direto do PR #12 sem reconstrução/revisão limpa sobre a `main` atual.

### Próximo passo AI-02

Criar branch nova a partir de `main`, reaplicar somente:

1. `meu-agente.html`;
2. link `Gerenciar` em `conta.html`;
3. `action=list` segura em `api/agents.js`;
4. testes AI-02;
5. corrigir encoding;
6. executar regressão SEC-14/SEC-17/Instagram;
7. integrar via PR.

## 4. Instagram

INST-04 está concluído.

Ainda pendente para mensageria real:

1. Business Login/OAuth;
2. callback real;
3. troca segura de código por token;
4. persistência de `instagram_connections`;
5. resolução `instagram_user_id → agent_id → owner_id`;
6. idempotência persistente;
7. processamento de mensagens;
8. resposta via API Meta.

Não cadastrar callback inventado na Meta.

## 5. Billing

Código Asaas existe para checkout, webhook, assinatura e cancelamento. Antes de lançamento:

- validar sandbox × produção;
- testar checkout E2E;
- testar webhook real;
- testar ativação, inadimplência, cancelamento e reembolso conforme regra comercial;
- conferir atualização consistente do status do agente.

## 6. Segurança

Já há gates relevantes de rate limiting, tenant isolation e webhook Instagram.

Antes do lançamento executar auditoria final de:

- autenticação;
- recuperação de senha;
- autorização;
- RLS;
- tenant isolation;
- CORS;
- uploads;
- secrets;
- logs;
- rate limits;
- abuso/concurrency;
- prompt injection;
- pagamentos;
- LGPD.

## 7. Continuidade e backup

Documento oficial:

`docs/OPERACAO-MANUTENCAO-E-BACKUP.md`

Requisitos permanentes:

- código versionado;
- backup DB externo;
- backup/estratégia Storage;
- retenção;
- restore real testado;
- inventário de variáveis sem valores secretos;
- rollback documentado;
- troubleshooting para pessoa não técnica.

**Keepalive não é backup.**

## 8. Infraestrutura atual

- GitHub: `demaisj24/jr-solucoes-digitais`;
- produção Git: `main`;
- Vercel: `vencivo-ai`;
- domínio: `https://vencivo.com.br`;
- preview: `https://vencivo-ai.vercel.app`;
- Supabase project ref: `uxmlmyhiagjefuufanyg`;
- Supabase URL: `https://uxmlmyhiagjefuufanyg.supabase.co`;
- keepalive: `.github/workflows/supabase-keepalive.yml`.

## 9. Variáveis críticas conhecidas

Sem valores no Git:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_URL`;
- `GEMINI_API_KEY`;
- `ASAAS_API_KEY`;
- `ASAAS_API_URL`;
- `ASAAS_WEBHOOK_TOKEN`;
- `SITE_URL`;
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`;
- `INSTAGRAM_APP_SECRET`.

## 10. Ordem oficial até lançar

1. OPS-01 — consolidar manual operacional;
2. reconstruir/integrar AI-02;
3. backup DB;
4. backup/retensão Storage;
5. restore real;
6. inventário de infraestrutura/secrets;
7. SEC-21/LGPD;
8. autenticação/segurança final;
9. billing E2E;
10. IA/File Search E2E;
11. Instagram no estágio real disponível;
12. jornada E2E completa;
13. deploy/smoke test;
14. primeiro usuário pagante.

## 11. Estratégia comercial

MVP comercial desejado:

`criar agente → configurar → fornecer conhecimento → testar → escolher plano → pagar → usar`

Primeira meta: 5 clientes e validação comercial antes de escalar aquisição.

## 12. Regra de conclusão

O sistema não está “pronto” apenas porque testes unitários passam.

Lançamento exige evidência de:

- segurança;
- autorização/tenant isolation;
- backup + restore;
- billing;
- IA;
- integrações;
- LGPD;
- deploy;
- E2E;
- smoke test de produção.

## 13. Referências permanentes

- `VENCIVO-CONTINUITY.md`;
- `docs/OPERACAO-MANUTENCAO-E-BACKUP.md`;
- `VENCIVO-HANDOFF.md`;
- `VENCIVO-ROADMAP.md`;
- `VENCIVO-PROTOCOLO-DE-TRABALHO.md`;
- `VENCIVO-INSTAGRAM-WEBHOOK-CONTINUITY.md`;
- `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`.
