# VENCIVO — CONTINUIDADE MESTRA

> **Checkpoint operacional:** 25/08/2026 (fim da sessão)
> **Objetivo:** permitir retomar o projeto mesmo se a conversa do ChatGPT for encerrada ou apagada.

## Ponto exato de retomada

O VENCIVO está em **hardening final, disaster recovery e preparação para produção**.

### DR-02 — estado exato

O backup/restore do PostgreSQL já foi provado anteriormente e não deve ser refeito.

No DR-02 de Storage/Gemini, o estado atual é:

1. Foi identificado que o bucket privado `vencivo-knowledge` deve ser a fonte canônica dos arquivos originais; Gemini File Search deve ser tratado como índice derivado/reconstruível.
2. A tabela `agent_knowledge` recebeu suporte a `storage_path` e `gemini_document_name` para documentos novos, sem quebrar registros legados.
3. PR #43 integrou backup criptografado do Supabase Storage.
4. Primeiro backup Storage real: run `32912262280` — SUCCESS.
5. Artifact auditado: somente pacote `.gpg`, checksum SHA-256 e metadata técnica; plaintext/manifesto sensível não fica exposto fora da criptografia.
6. PR #44 integrou o Storage Restore Drill com ambiente isolado `Vencivo-Restore-Test`.
7. Secrets do ambiente de restore já cadastrados no GitHub: `SUPABASE_RESTORE_URL` e `SUPABASE_RESTORE_SERVICE_ROLE_KEY` (NUNCA registrar valores).
8. Sentinel DR criado com sucesso pelo workflow Storage DR Seed: run `32915229426`.
9. Novo backup contendo o sentinel: run `32915356948` — SUCCESS.
10. Primeira execução do Storage Restore Drill: run `32915498291` — FAILURE segura.
11. Nessa falha passaram: safety gates, isolamento produção/restore, download do artifact, checksum, descriptografia e confirmação de que o sentinel estava dentro do backup.
12. A falha ocorreu somente em `Ensure restore bucket exists`: HTTP 404 ao preparar/criar `vencivo-knowledge` no projeto `Vencivo-Restore-Test`. O upload/restore não chegou a ocorrer.
13. Cleanup executou com sucesso. Não houve restauração em produção.
14. Branch de correção já criada: `fix/dr-02-storage-bucket-create`.

## Próxima tarefa EXATA

Retomar em `fix/dr-02-storage-bucket-create`.

Corrigir a etapa `Ensure restore bucket exists` de `.github/workflows/supabase-storage-restore-drill.yml` para a API atual do Supabase Storage, mantendo as travas de isolamento.

Fluxo obrigatório:

1. corrigir somente a preparação/criação do bucket de restore;
2. adicionar/ajustar teste de regressão do workflow;
3. rodar CI;
4. revisar diff de segurança;
5. integrar à `main` somente se verde;
6. repetir o Storage Restore Drill usando o backup já válido `32915356948` e confirmação `RESTORE-STORAGE-TEST-ONLY`;
7. exigir prova byte-a-byte do sentinel no `Vencivo-Restore-Test`;
8. confirmar cleanup dos sentinels e plaintext;
9. somente então marcar Supabase Storage como recuperável;
10. depois avançar para reconstrução do Gemini File Search a partir do Storage canônico.

**Não refazer o seed nem o backup antes da correção**, salvo se a auditoria mostrar necessidade. O backup `32915356948` já contém o sentinel e passou checksum/descriptografia.

## Trabalho concluído anteriormente

### AI-02

- PR #35 — reconstrução limpa sobre `main` — MERGED.
- `meu-agente.html`, listagem segura, autorização por proprietário e regressões integradas.

### INFRA-02

CI permanente integrado; regressão Node em PR/main.

### OPS-02 — PostgreSQL

**VALIDADO.**

- backup lógico Supabase CLI;
- bundle GPG/AES-256;
- SHA-256;
- retenção 30 dias;
- backup diário `17 6 * * *` UTC;
- restore real no `Vencivo-Restore-Test`;
- run de restore bem-sucedido `32797657905`;
- `schema.sql` + `data.sql` restaurados;
- 11 tabelas públicas validadas;
- material descriptografado removido.

## Estado resumido

| Área | Estado |
|---|---|
| Landing/HOME/HOME-06 | concluído/integrado |
| AI-01 | concluído |
| AI-02 | integrado |
| SEC-14/17/19/20 | fechados |
| SEC-21/LGPD técnico | avançado; gate final pendente |
| INFRA-02 CI | concluído |
| Backup Supabase DB | concluído e automático |
| Restore Supabase DB | provado em ambiente separado |
| Backup Supabase Storage | implementado e backup real SUCCESS |
| Restore Supabase Storage | **em correção; primeira tentativa falhou na criação/preparação do bucket de restore** |
| DR Gemini File Search | pendente após Storage |
| Billing E2E | pendente |
| Instagram E2E | pendente |
| E2E geral | pendente |
| Lançamento | pendente |

## Ideia de produto registrada

Foi discutida uma futura camada de retenção chamada conceitualmente **VENCIVO Radar**: notícias/tendências relevantes ao nicho do cliente, oportunidades e transformação dessas tendências em conteúdo/ações. Boa hipótese de retenção, mas **não deve desviar o caminho crítico atual de lançamento**. Avaliar após infraestrutura, segurança, canais e jornada comercial estarem fechados.

## Ordem até lançamento

1. fechar Restore Supabase Storage;
2. fechar reconstrução Gemini File Search;
3. atualizar documentação operacional/DR;
4. inventário final de infraestrutura e secrets sem valores;
5. revisão final SEC-21/LGPD;
6. auditoria final de autenticação e segurança;
7. billing/Asaas E2E;
8. IA/File Search em jornada real;
9. Instagram E2E;
10. E2E completo do produto;
11. deploy + smoke test;
12. liberar primeiro usuário pagante.

## Segurança

- Nunca versionar secrets, senhas, connection strings ou passphrases.
- `Vencivo-Restore-Test` é ambiente isolado de recuperação.
- Nunca apontar secrets `SUPABASE_RESTORE_*` para produção.
- Restore deve sempre provar isolamento antes de escrever.
- Keepalive não é backup.
- Só marcar componente como recuperável após teste real de recuperação/reconstrução.

## Arquivos locais antigos a não adicionar automaticamente

No computador anterior foram observados itens untracked que exigem auditoria antes de qualquer `git add`:

- `dfq`
- `sec14-local.patch`
- `supabase/`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`
- `tests/sec-20-supabase-keepalive.test.js`

## Retomada

Fonte oficial: GitHub.

Ao voltar:

```powershell
git checkout main
git pull origin main
git status --short
git log --oneline --decorate -15
```

Depois ler `VENCIVO-CONTINUITY.md`, `VENCIVO-CURRENT-TASK.md` e `docs/OPERACAO-MANUTENCAO-E-BACKUP.md`.

**Retomar diretamente na branch `fix/dr-02-storage-bucket-create` e na correção do HTTP 404 do Storage Restore Drill.**
