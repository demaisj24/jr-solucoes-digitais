# VENCIVO — CONTINUIDADE MESTRA

> **Checkpoint operacional:** 25/08/2026
> **Objetivo:** permitir retomar o projeto mesmo se a conversa do ChatGPT for encerrada ou apagada.

## Ponto exato de retomada

O VENCIVO está em fase de **hardening final, disaster recovery e preparação para produção**.

Último HEAD confirmado antes deste checkpoint:

`a560feee2f9ade2fba086a1c8ef6b9ac55b5cb71` — merge do PR #41, que habilitou o backup diário criptografado do Supabase.

## Trabalho concluído desde o checkpoint anterior

### AI-02 reconstruído e integrado

O AI-02 antigo divergente foi substituído por uma reconstrução limpa sobre a `main` atual.

- PR #35 — `AI-02R: reconstruir gestão do agente sobre a main atual` — **MERGED**;
- inclui `meu-agente.html`;
- inclui `action=list` segura em `api/agents.js`;
- autorização via proprietário do agente;
- listagem retorna somente metadados, sem conteúdo dos documentos;
- correção de mojibake;
- testes de regressão específicos.

Portanto, a observação antiga de que AI-02 ainda não estava em `main` está superada.

### SEC-21/LGPD técnico avançado

Já foram integrados trabalhos de minimização/privacidade, incluindo:

- retenção curta de `rate_limit_buckets`;
- minimização de `billing_events`;
- operações administrativas de acesso/correção/exclusão documentadas;
- proteção para conhecimento considerar SQL + Storage + Gemini File Search.

### INFRA-02 CI permanente

PR #29 integrado. O repositório roda regressão Node em PR/main, incluindo `node --check` e `node --test tests/*.test.js`.

### OPS-02 — backup de banco e restore real

OPS-02 passou de pendente para **VALIDADO**.

Fluxo implantado:

- backup lógico via Supabase CLI fixada em `2.115.0`;
- dumps de `roles.sql`, `schema.sql`, `data.sql`, `history_schema.sql`, `history_data.sql`;
- bundle criptografado com GPG/AES-256;
- SHA-256;
- plaintext removido antes do artifact;
- artifact com retenção de 30 dias;
- secrets usados no GitHub: `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_PASSPHRASE` e `SUPABASE_RESTORE_DB_URL`;
- nunca registrar os valores desses secrets em Git/documentação.

Primeiro backup real validado:

- workflow run de backup usado no drill: `32792682857`;
- artifact criptografado validado por checksum;
- não havia SQL em claro no artifact.

Ambiente isolado criado no Supabase:

- `Vencivo-Restore-Test`;
- separado da produção;
- usado exclusivamente para provar recuperação.

Restore drill real:

- PRs #36 a #40 criaram e endureceram o workflow de restore;
- primeiras tentativas falharam somente por problemas operacionais seguros (artifact/checksum, GPG não interativo, IPv6 endpoint direto);
- nenhuma dessas falhas executou SQL em produção;
- conexão de restore foi alterada para Shared/Session pooler;
- quinta tentativa: workflow run `32797657905` — **SUCCESS**;
- isolamento produção/restore passou;
- `schema.sql` restaurado;
- `data.sql` restaurado;
- validação final encontrou **11 tabelas públicas**;
- material descriptografado foi removido ao final.

Após o restore real:

- PR #41 — **MERGED**;
- backup automático diário habilitado;
- cron: `17 6 * * *` (06:17 UTC / 03:17 BRT);
- `workflow_dispatch` manual permanece;
- RPO operacional alvo: até 24h;
- regressão final do PR passou após atualização do teste OPS-02 para o estado pós-restore.

## Estado resumido atual

| Área | Estado real em 25/08/2026 |
|---|---|
| Landing/HOME | concluído |
| HOME-06 | integrado |
| AI-01 | concluído |
| AI-02 | reconstruído e integrado via PR #35 |
| Gemini File Search | construído/hardened; DR externo ainda precisa ser fechado |
| SEC-14 | fechado |
| SEC-17 | fechado |
| SEC-19 | fechado |
| SEC-20 | fechado |
| SEC-21/LGPD técnico | avançado/integrado em várias subetapas; revisar gate final |
| Instagram webhook | fundação e hardening já avançaram além do INST-04 antigo |
| INFRA-02 CI | concluído |
| Backup Supabase DB | **concluído e automático** |
| Restore Supabase DB | **testado com sucesso em ambiente separado** |
| Backup Supabase Storage | **pendente** |
| DR Gemini File Search | **pendente** |
| Billing E2E | pendente |
| E2E geral | pendente |
| Lançamento | pendente |

## Próxima tarefa exata

Continuar o bloco de **Disaster Recovery** sem mexer em produção desnecessariamente.

Ordem recomendada para amanhã:

1. auditar o Supabase Storage atual e confirmar buckets/objetos relevantes;
2. definir e implementar backup/recuperação do Storage, com retenção e teste real;
3. definir estratégia de reconstrução do Gemini File Search a partir da fonte canônica dos documentos;
4. atualizar `docs/OPERACAO-MANUTENCAO-E-BACKUP.md` com o procedimento final de recuperação;
5. fechar inventário de infraestrutura/secrets sem registrar valores;
6. executar revisão final SEC-21/LGPD;
7. auditoria final de autenticação e segurança;
8. validar billing/Asaas E2E;
9. validar IA/File Search em jornada real;
10. revisar estado real do Instagram e executar E2E do canal;
11. E2E completo do produto;
12. deploy/smoke test;
13. liberar primeiro usuário pagante.

## Regra de DR

Keepalive não é backup.

Um componente só pode ser marcado como recuperável quando:

- houver cópia fora do ambiente primário ou mecanismo equivalente de reconstrução;
- retenção estiver definida;
- integridade puder ser verificada;
- restauração/reconstrução tiver sido testada em ambiente separado quando aplicável.

O banco PostgreSQL já atende esse gate. Storage e Gemini File Search ainda não.

## Segurança

- Nunca versionar secrets, senhas, connection strings ou passphrases.
- Registrar apenas nome/finalidade/local de administração dos secrets.
- O secret `SUPABASE_RESTORE_DB_URL` deve sempre apontar para o ambiente isolado de restore, preferencialmente via Shared/Session pooler.
- O workflow de restore exige confirmação `RESTORE-TEST-ONLY` e possui travas para separar produção e restore.

## Arquivos locais observados no computador anterior

Não adicionar automaticamente ao Git quando voltar ao computador original:

- `dfq`
- `sec14-local.patch`
- `supabase/`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`
- `tests/sec-20-supabase-keepalive.test.js`

Primeiro comparar cada item com `main` e identificar sua finalidade.

## Retomada em qualquer computador

A fonte oficial do estado é o GitHub.

Quando houver acesso local:

```powershell
git checkout main
git pull origin main
git status --short
git log --oneline --decorate -15
```

Depois ler:

```powershell
Get-Content VENCIVO-CONTINUITY.md
Get-Content VENCIVO-CURRENT-TASK.md
Get-Content docs/OPERACAO-MANUTENCAO-E-BACKUP.md
```

## Checkpoint para amanhã

**Não refazer OPS-02.** Banco e restore já passaram.

Retomar diretamente em:

`DR-02 — Supabase Storage + reconstrução Gemini File Search`.
