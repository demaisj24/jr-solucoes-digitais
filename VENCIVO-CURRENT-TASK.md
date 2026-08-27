# VENCIVO — CURRENT TASK

## TASK

`DR-02` — prova real de reconstrução do Gemini File Search

## Estado confirmado

- Backup e restore PostgreSQL: concluídos e provados.
- Backup Supabase Storage: concluído.
- Restore Supabase Storage: provado byte a byte no `Vencivo-Restore-Test`, run `33025138912`.
- PR #48 integrado na `main`, merge `b47eaebd57036096e773421e94fff409da1bcae7`.
- Regressão da `main` #63, run `33025545848`: SUCCESS.
- Workflow manual `Gemini File Search Rebuild` disponível com modos `plan` e `apply`.
- Primeiro `plan`, run `33025669196`, falhou com segurança porque o agente de teste antigo possui apenas placeholder e nenhuma fonte canônica recuperável.
- Nenhum store foi criado, nenhum dado foi alterado e nenhum custo Gemini foi gerado.

## Próxima ação

Preparar um agente exclusivo de teste/DR com pelo menos uma fonte canônica recuperável:

- arquivo original em `vencivo-knowledge/<agent_public_id>/...`; ou
- conteúdo textual real em `agent_knowledge.content`.

Em seguida:

1. rodar `plan`;
2. auditar o resultado;
3. rodar `apply` somente após confirmação explícita e no agente controlado;
4. testar o chat no novo store;
5. atualizar a documentação e fechar DR-02.

## Trava de decisão

Não usar agente de cliente aleatório. Se não existir agente DR adequado, criar um agente exclusivo de teste antes de continuar.

## Não refazer

- PR #48;
- backup/restore do banco;
- backup/restore do Storage;
- correção de secrets já validada;
- run `plan` do agente legado `2e68d3d2-841d-43d1-b66f-36fe9eacf146`.

## Depois do DR-02

Revisão final de infraestrutura, LGPD, autenticação e segurança; depois billing/Asaas E2E, IA E2E, Instagram E2E, smoke test e lançamento.
