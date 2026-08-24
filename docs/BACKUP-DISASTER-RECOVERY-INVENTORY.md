# VENCIVO — Inventário de Backup e Disaster Recovery

Checkpoint: 24/08/2026

Este documento registra o estado técnico real necessário para desenhar e testar o backup do VENCIVO. Ele não contém valores de chaves, tokens, senhas ou conteúdo de usuários.

## 1. Objetivo

Garantir que o sistema possa ser reconstruído mesmo em caso de perda do repositório local, erro humano em produção, exclusão/corrupção do banco, perda do projeto Supabase, perda do Storage, perda de acesso ao provedor, deploy defeituoso ou comprometimento de segredo.

**Regra:** backup só será considerado válido depois de um restore real em ambiente separado.

## 2. Estado atual do código

Fonte principal:

- GitHub: `demaisj24/jr-solucoes-digitais`;
- branch de produção: `main`.

Risco atual:

- GitHub é a fonte primária do código, mas ainda precisa existir uma cópia/espelho externo ou procedimento periódico de clone/espelhamento.

## 3. Estado real do Supabase

Projeto:

- ref: `uxmlmyhiagjefuufanyg`;
- região documentada: `sa-east-1`;
- banco PostgreSQL + Auth + Storage.

### 3.1 Tabelas públicas relevantes

Inventário observado em 24/08/2026:

| Tabela | Linhas | RLS |
|---|---:|---|
| `agents` | 55 | habilitada |
| `agent_knowledge` | 31 | habilitada |
| `agent_sessions` | 0 | habilitada |
| `profiles` | 5 | habilitada |
| `subscriptions` | 8 | habilitada |
| `billing_events` | 1 | habilitada |
| `usage_counters` | 0 | habilitada |
| `instagram_connections` | 0 | habilitada |
| `instagram_webhook_events` | 0 | habilitada |
| `rate_limit_buckets` | 0 | habilitada |
| `plan_catalog` | 1 | habilitada |

Auth:

- `auth.users`: 5 usuários no checkpoint.

Essas contagens servem apenas como baseline operacional; não devem ser tratadas como limites nem reproduzidas como dados de negócio.

### 3.2 Tamanho atual

O banco é pequeno no checkpoint atual. Maiores relações observadas:

- `public.agents`: ~264 kB;
- `auth.users`: ~256 kB;
- `auth.refresh_tokens`: ~192 kB;
- `public.subscriptions`: ~136 kB;
- `storage.objects`: ~112 kB;
- `public.agent_knowledge`: ~96 kB.

Conclusão: o volume atual permite backup lógico frequente com custo operacional baixo. O desenho deve continuar válido quando o volume crescer.

## 4. Migrations — gap crítico de reconstrução

O Supabase registra 21 migrations até este checkpoint.

Última migration observada:

- `20260824140203_sec20_plan_catalog_public_select_permissive`.

### HIGH de continuidade

O histórico completo das migrations não está versionado na `main`. Portanto o GitHub, sozinho, ainda não é suficiente para reconstruir integralmente o schema do Supabase.

Ação obrigatória futura:

1. exportar/capturar o schema real;
2. versionar migrations futuras no repositório;
3. criar um baseline de schema restaurável;
4. nunca inventar SQL histórico que não possa ser comprovado;
5. validar a reconstrução em projeto separado.

## 5. Storage

Bucket identificado:

- `vencivo-knowledge`;
- privado;
- 0 objetos no checkpoint;
- 0 bytes no checkpoint.

O fluxo atual usa esse bucket como armazenamento temporário de documentos antes da indexação no Gemini File Search e tenta excluir o objeto após o processamento.

Consequência:

- hoje não existe conteúdo persistente para copiar desse bucket;
- isso pode mudar no futuro;
- o backup de Storage deve ser separado do backup PostgreSQL;
- objetos temporários não devem ser retidos sem necessidade.

## 6. O que o backup do Supabase precisa cobrir

### 6.1 Banco de aplicação

Incluir schema, tabelas públicas, funções/RPCs, triggers, constraints, índices, policies RLS, grants relevantes e dados necessários da aplicação.

### 6.2 Auth

Auth precisa ser considerado explicitamente no restore. Perder apenas `public.profiles` sem restaurar `auth.users`, ou vice-versa, pode quebrar relações e login.

O procedimento de restore deve validar usuários, identidades e relações entre `auth.users` e `public.profiles`. Sessões não precisam necessariamente ser preservadas como requisito funcional, mas a decisão deve ser explícita.

### 6.3 Storage

Metadados do Storage no Postgres não substituem os bytes dos objetos. Backup do banco não restaura arquivos apagados do Storage.

## 7. Estratégia recomendada

### Camada A — código

- GitHub como fonte principal;
- espelho/clone periódico em destino independente;
- tags ou commits estáveis identificados antes de releases importantes.

### Camada B — banco

Para o plano Free, usar backup lógico periódico e off-site.

Supabase recomenda que projetos Free façam exportações regulares com `supabase db dump`/`pg_dump` e mantenham cópia fora do projeto de produção.

Requisitos mínimos do job futuro:

- execução automática;
- saída criptografada ou armazenada em destino privado;
- nome por data/hora;
- checksum SHA-256;
- retenção com múltiplas gerações;
- falha visível/alertável;
- nunca imprimir senha/connection string em logs.

### Camada C — Storage

Quando houver objetos persistentes:

- listar buckets;
- copiar objetos para destino off-site;
- preservar bucket/path/metadados necessários;
- validar quantidade e checksum quando possível.

### Camada D — configuração

Manter inventário sem valores reais de Vercel env vars, GitHub Actions secrets, Supabase API keys, Gemini, Asaas, Meta/Instagram, domínios e webhooks.

O manual deve dizer ONDE cada segredo fica e COMO rotacionar, nunca o valor.

## 8. Destino off-site escolhido

Foi criada no Google Drive do proprietário uma pasta privada chamada:

- `VENCIVO - Backups`.

Verificação no checkpoint:

- pasta não compartilhada;
- somente o proprietário possui permissão;
- está fora de Supabase, GitHub e Vercel;
- ainda não existe automação de upload nem credencial de máquina configurada.

A pasta foi escolhida como **destino operacional inicial**, não como implementação final de automação. Antes de conectar qualquer robô/CI ao Google Drive, validar autenticação de menor privilégio, criptografia do arquivo, retenção e processo de restore. Não colocar credencial do Drive no repositório.

## 9. RPO e RTO iniciais propostos

Enquanto o volume é baixo:

- RPO alvo do banco: até 24h;
- backup lógico: diário;
- retenção inicial: 7 diários + 4 semanais + 3 mensais;
- RTO alvo inicial: 4h para reconstrução assistida.

Esses números são objetivos operacionais iniciais e devem ser revistos quando houver clientes pagantes/maior volume.

## 10. Restore test obrigatório

O teste de Disaster Recovery deve ocorrer em projeto/ambiente separado.

Ordem:

1. criar ambiente vazio;
2. restaurar schema;
3. restaurar dados;
4. validar Auth;
5. validar policies/RLS;
6. validar funções/triggers/RPCs;
7. restaurar Storage quando aplicável;
8. configurar segredos por mecanismo seguro;
9. subir uma aplicação de teste;
10. executar smoke tests;
11. comparar contagens e invariantes;
12. registrar duração e falhas encontradas.

Nunca testar recuperação destrutiva diretamente em produção.

## 11. Achados atuais

### HIGH — histórico de migrations não versionado integralmente

Impacto: reconstrução do schema depende hoje do estado vivo do Supabase e não apenas do GitHub.

### MEDIUM — backup externo do banco ainda não existe

Impacto: o destino off-site foi criado, mas ainda não há dump automático/validado armazenado nele.

### LOW atual / pode crescer — Storage sem rotina de backup

No checkpoint há zero objetos no bucket `vencivo-knowledge`, portanto não há bytes persistidos a proteger agora. O risco muda se novos buckets ou retenção de arquivos forem introduzidos.

## 12. Próximos gates

1. definir método seguro de conexão ao Postgres para `pg_dump`/Supabase CLI;
2. gerar primeiro backup lógico real sem expor connection string;
3. produzir checksum SHA-256;
4. copiar o backup protegido para `VENCIVO - Backups`;
5. definir retenção operacional;
6. criar automação apenas depois de validar o processo manual;
7. executar restore em ambiente separado;
8. atualizar `OPERACAO-MANUTENCAO-E-BACKUP.md` com procedimento para leigo;
9. só então marcar BACKUP/DISASTER RECOVERY como concluído.

## 13. Fontes técnicas

- Supabase Database Backups: projetos Free devem exportar regularmente e manter backups off-site;
- Supabase: backups do banco não incluem os bytes armazenados pela Storage API;
- inventário de tabelas, migrations, políticas e Storage deste documento foi levantado diretamente do projeto `uxmlmyhiagjefuufanyg` em 24/08/2026.
