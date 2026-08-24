# VENCIVO — CURRENT TASK

## TASK
`OPS-02` — Backup e Disaster Recovery

## Objetivo
Transformar o VENCIVO em um sistema recuperável: código, banco, Auth, Storage, configurações e procedimentos devem poder ser restaurados sem depender de conhecimento informal ou de uma única máquina.

## Estado atual
- Manual operacional já existe em `docs/OPERACAO-MANUTENCAO-E-BACKUP.md`.
- Inventário técnico do backup está em `docs/BACKUP-DISASTER-RECOVERY-INVENTORY.md` nesta branch.
- Supabase Free exige estratégia própria de export/backup off-site.
- O bucket `vencivo-knowledge` está vazio no checkpoint de 24/08/2026.
- O Supabase registra 21 migrations, mas a `main` ainda não versiona o histórico completo: este é o maior gap de reconstrução identificado.
- PR #23 corrige/reconcilia o SEC-20 keepalive na `main` com menor privilégio; não misturar essa correção com este gate.
- SEC-21/LGPD segue em trilho próprio; aqui só aplicamos minimização e segurança técnica ao backup.

## Não fazer nesta tarefa
- não alterar `main` diretamente;
- não executar restore destrutivo em produção;
- não copiar dados pessoais para documentação ou logs;
- não colocar senhas/connection strings/secrets no Git;
- não tratar keepalive como backup;
- não inventar migrations históricas;
- não escolher destino off-site sem validar segurança, retenção, custo e restore.

## Critérios de aceite do OPS-02
1. Inventário real de banco/Auth/Storage/migrations documentado.
2. Destino off-site de backup escolhido e privado.
3. Backup lógico automático implementado com timeout/falha visível.
4. Arquivo de backup protegido e acompanhado de checksum.
5. Política de retenção definida.
6. Storage tratado separadamente do PostgreSQL.
7. Restore executado em ambiente separado e validado.
8. Manual atualizado com procedimento que uma pessoa não técnica consiga seguir.
9. Nenhum segredo ou conteúdo de usuário versionado.

## Ordem de execução
1. inventário — em revisão;
2. escolher destino off-site;
3. desenhar workflow de backup;
4. primeiro backup real;
5. verificação de integridade;
6. restore test;
7. manual para leigo;
8. aprovação final.

## Trabalho paralelo
Instagram, SEC-21 e demais iniciativas podem continuar em branches/worktrees próprios. Cada iniciativa deve manter branch/worktree isolado para evitar colisões de checkout, rebase e staging.
