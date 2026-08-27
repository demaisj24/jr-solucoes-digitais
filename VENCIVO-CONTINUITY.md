# VENCIVO — CONTINUIDADE MESTRA

> **Checkpoint operacional:** 26/08/2026 (fim da sessão)
> **Fonte oficial:** GitHub `demaisj24/jr-solucoes-digitais`
> **Objetivo:** retomar o projeto sem depender do computador ou do histórico do chat.

## Ponto exato de retomada

O VENCIVO está em **hardening final, disaster recovery e preparação para produção**.

A parte de backup e restauração do PostgreSQL e do Supabase Storage está tecnicamente provada. O mecanismo seguro de reconstrução do Gemini File Search também já foi integrado. A próxima etapa é preparar uma fonte canônica controlada para executar a prova real do Gemini.

## DR-02 — estado confirmado

### PostgreSQL

- Backup lógico, criptografia GPG/AES-256, SHA-256 e retenção implementados.
- Backup diário: `17 6 * * *` UTC.
- Restore real aprovado no projeto isolado `Vencivo-Restore-Test`.
- Run aprovada: `32797657905`.
- 11 tabelas públicas validadas.
- Material descriptografado removido ao final.

### Supabase Storage

- Bucket privado `vencivo-knowledge` definido como fonte canônica dos arquivos.
- Gemini File Search permanece somente como índice derivado/reconstruível.
- Backup criptografado e restore isolado integrados.
- Correções do Restore Drill integradas pelos PRs #45, #46 e #47.
- PR #47 mergeado no commit `4eb1d304d6ea162a355d838d53c61dcd6e3403bb`.
- Primeira execução após o merge, run `33019934414`, falhou com segurança por formato inválido do secret de restore.
- Após correção do secret, o Storage Restore Drill passou:
  - run `33025138912`;
  - job `98364572107`;
  - prova: bytes do sentinel idênticos no projeto isolado;
  - criação/preparação do bucket aprovada;
  - upload, validação e cleanup aprovados;
  - nenhum restore foi feito em produção.

**Conclusão:** Backup e restore do Supabase Storage estão tecnicamente provados.

### Gemini File Search

PR #48, **DR-02: reconstrução segura do Gemini File Search**, foi criado, revisado e integrado.

- PR: https://github.com/demaisj24/jr-solucoes-digitais/pull/48
- Branch: `dr-02-gemini-file-search-rebuild`
- Head revisado: `e01bfb66fece54732ed8931808af2616124db8a0`
- Merge commit: `b47eaebd57036096e773421e94fff409da1bcae7`
- Regressão do PR: run `33025451290` — SUCCESS.
- Regressão da `main`: run `33025545848` / #63 — SUCCESS.
- GitHub Pages após merge: run `33025544793` — SUCCESS.

Arquivos integrados:

- `scripts/rebuild-gemini-file-search.mjs`
- `.github/workflows/gemini-file-search-rebuild.yml`
- `tests/dr-02-gemini-rebuild.test.js`

Travas implementadas:

- execução somente manual e um agente por run;
- `plan` como padrão, sem criação de store ou custo Gemini;
- `apply` exige `REBUILD-GEMINI-FILE-SEARCH`;
- concorrência serializada por agente;
- limite de 100 documentos e 50 MB por documento;
- validação do `public_id` e do prefixo de Storage;
- suporte a fonte canônica em Storage ou conteúdo SQL;
- recusa de registros legados que tenham somente placeholder;
- troca de `agents.knowledge_store_name` somente após todos os uploads;
- store antigo não é apagado automaticamente;
- secrets e conteúdo não são impressos nos logs.

## Prova `plan` já executada

Foi localizado um agente identificado como teste e executado o modo `plan`:

- agente: `2e68d3d2-841d-43d1-b66f-36fe9eacf146`;
- run: `33025669196`;
- job: `98366263110`;
- resultado: FAILURE segura;
- diagnóstico: a única linha de conhecimento continha somente `[Documento indexado no Gemini File Search]`, sem `storage_path` e sem texto original recuperável.

O workflow recusou corretamente a reconstrução com a mensagem de ausência de fonte canônica. Não criou store, não gerou embeddings, não alterou o banco e não gerou custo Gemini.

## Próxima tarefa EXATA

Preparar um **agente exclusivo de teste/DR** com ao menos um documento ou texto real salvo como fonte canônica no Supabase.

Depois:

1. executar `Gemini File Search Rebuild` em modo `plan`;
2. auditar o plano e confirmar que a fonte canônica é recuperável;
3. executar `apply` somente no agente controlado, com a confirmação exata;
4. validar a criação do novo File Search Store;
5. confirmar no banco os novos `gemini_document_name` e `knowledge_store_name`;
6. testar o chat desse agente contra o store reconstruído;
7. confirmar que o store anterior não foi apagado;
8. atualizar `docs/OPERACAO-MANUTENCAO-E-BACKUP.md`;
9. somente então encerrar DR-02.

**Não executar `apply` em agente de cliente ou agente não identificado.**

## Estado resumido

| Área | Estado |
|---|---|
| Landing/HOME/HOME-06 | concluído/integrado |
| AI-01 | concluído |
| AI-02 | integrado |
| SEC-14/17/19/20 | fechados |
| SEC-21/LGPD técnico | avançado; gate final pendente |
| INFRA-02 CI | concluído |
| Backup/restore Supabase DB | concluído e provado |
| Backup Supabase Storage | concluído e automático |
| Restore Supabase Storage | concluído e provado byte a byte |
| Ferramenta DR Gemini | integrada e falha segura comprovada |
| Reconstrução Gemini real | pendente de agente DR com fonte canônica |
| Billing E2E | pendente |
| Instagram E2E | pendente |
| E2E geral | pendente |
| Lançamento | pendente |

## Ordem até lançamento

1. concluir prova real de reconstrução do Gemini;
2. atualizar documentação operacional/DR;
3. inventário final de infraestrutura e secrets sem valores;
4. revisão final SEC-21/LGPD;
5. auditoria final de autenticação e segurança;
6. billing/Asaas E2E;
7. IA/File Search em jornada real;
8. Instagram E2E;
9. E2E completo;
10. deploy e smoke test;
11. liberar primeiro usuário pagante.

## Segurança permanente

- Nunca versionar secrets, senhas, connection strings ou passphrases.
- `Vencivo-Restore-Test` é ambiente isolado de recuperação.
- Nunca apontar `SUPABASE_RESTORE_*` para produção.
- Restore deve provar isolamento antes de escrever.
- Keepalive não é backup.
- Gemini File Search não é fonte canônica.
- Só marcar componente como recuperável após teste real.
- Não usar agente de cliente para drill destrutivo ou com custo sem identificação explícita.

## Retomada amanhã

Ler primeiro este arquivo e `VENCIVO-CURRENT-TASK.md`.

Retomar diretamente na preparação de um agente controlado com fonte canônica para o Gemini. Não refazer backup, restore, PR #48 nem o primeiro `plan`.
