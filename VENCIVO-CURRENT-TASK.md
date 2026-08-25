# VENCIVO — CURRENT TASK

## TASK
`DR-02` — Supabase Storage + reconstrução Gemini File Search

## Objetivo
Fechar o restante do disaster recovery do VENCIVO depois da validação real do backup/restore PostgreSQL.

## Estado confirmado antes de iniciar

- OPS-02 do banco está concluído.
- Backup real criptografado foi validado.
- Restore real passou no ambiente isolado `Vencivo-Restore-Test`.
- Workflow run de restore aprovado: `32797657905`.
- Restore validou 11 tabelas públicas.
- Backup diário está habilitado via PR #41.
- Cron atual do backup DB: `17 6 * * *`.
- RPO operacional alvo do banco: até 24h.
- AI-02 foi reconstruído e integrado via PR #35.

## Escopo desta tarefa

1. Auditar buckets/objetos reais do Supabase Storage.
2. Identificar quais arquivos são fonte canônica e quais são derivados/recriáveis.
3. Definir backup, retenção e recuperação do Storage com menor privilégio.
4. Testar recuperação em ambiente separado antes de marcar como concluído.
5. Auditar a relação entre documentos do Storage/SQL e stores do Gemini File Search.
6. Definir procedimento determinístico para reconstruir File Search após perda do store externo.
7. Atualizar o manual operacional e a continuidade.

## Não fazer

- não restaurar nada sobre produção;
- não apagar objetos de produção;
- não versionar chaves, senhas, connection strings ou passphrases;
- não considerar Gemini File Search como backup primário de documentos;
- não habilitar automação destrutiva sem teste isolado;
- não refazer OPS-02, salvo se uma regressão real for encontrada.

## Critérios de aceite

1. Inventário de Storage conhecido.
2. Estratégia de backup/retenção documentada e implementada quando necessária.
3. Restore/reconstrução do Storage testado quando houver objetos reais relevantes.
4. Fonte canônica de documentos definida.
5. Procedimento de reconstrução do Gemini File Search documentado e verificável.
6. Nenhum secret ou conteúdo sensível exposto no Git.
7. CI/regressão continua verde.
8. `VENCIVO-CONTINUITY.md` atualizado ao final.

## Próximo passo após DR-02

Revisão final de infraestrutura/LGPD/segurança e depois validações E2E de billing, IA e Instagram antes do lançamento.
