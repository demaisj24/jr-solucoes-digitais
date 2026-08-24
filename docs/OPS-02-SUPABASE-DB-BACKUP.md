# OPS-02 — Backup criptografado do banco Supabase

## Objetivo

Criar uma cópia lógica do PostgreSQL fora do Supabase de produção sem expor dados do banco em um repositório público.

Workflow:

`.github/workflows/supabase-db-backup.yml`

## Por que o backup é criptografado

O repositório `demaisj24/jr-solucoes-digitais` é público. Portanto, nenhum dump com dados reais pode ser publicado em claro em commit, log ou artifact.

O workflow:

1. cria `pg_dump` em formato custom;
2. valida o dump com `pg_restore --list`;
3. criptografa com AES-256-CBC + PBKDF2;
4. apaga o dump em claro antes do upload;
5. calcula SHA-256 do arquivo criptografado;
6. envia somente o arquivo criptografado, checksum e metadata para artifact;
7. mantém o artifact por 30 dias.

## Secrets necessários no GitHub

Não registrar os valores neste arquivo.

### `SUPABASE_DB_URL`

Connection string PostgreSQL do projeto Supabase de produção.

Requisitos:

- usar conexão compatível com `pg_dump`;
- tratar como segredo;
- não colar em issue, commit ou log;
- ao rotacionar senha do banco, atualizar este secret.

### `BACKUP_ENCRYPTION_PASSPHRASE`

Senha dedicada exclusivamente à criptografia dos backups.

Requisitos:

- no mínimo 24 caracteres; preferir valor aleatório bem maior;
- não reutilizar senha de conta;
- guardar uma cópia em gerenciador de senhas seguro fora do GitHub;
- sem essa senha, o backup criptografado não pode ser restaurado.

## Agenda

O workflow está preparado para:

- domingo, 04:15 UTC;
- quarta-feira, 04:15 UTC;
- execução manual com `workflow_dispatch`.

A agenda pode ser revisada depois do primeiro restore testado e da definição de RPO/RTO.

## Conteúdo do artifact

Somente:

- `vencivo.dump.enc`;
- `vencivo.dump.enc.sha256`;
- `metadata.json`.

O arquivo `vencivo.dump` em claro é removido antes do upload.

## Verificação de integridade

Antes de restaurar:

```bash
sha256sum -c vencivo.dump.enc.sha256
```

O checksum confirma integridade do arquivo criptografado; não prova que o conteúdo do banco é logicamente restaurável.

## Descriptografia para teste de restore

Executar somente em computador/ambiente seguro:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 \
  -in vencivo.dump.enc \
  -out vencivo.dump \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
```

Depois:

```bash
pg_restore --list vencivo.dump
```

## Restore real — ainda pendente

OPS-02 não será considerado completamente fechado apenas porque o workflow gerou um artifact.

Antes do lançamento é obrigatório:

1. criar ambiente Supabase separado para teste de recuperação;
2. baixar um artifact real;
3. validar checksum;
4. descriptografar;
5. restaurar em ambiente separado;
6. conferir tabelas, constraints, funções/RPCs e dados de amostra;
7. verificar Auth/RLS/Storage separadamente;
8. documentar ajustes necessários;
9. registrar data e resultado do teste.

## Limitações

- este workflow trata o PostgreSQL, não os bytes do Supabase Storage;
- Storage terá gate separado;
- GitHub artifact é uma cópia externa ao Supabase, mas uma estratégia de continuidade madura poderá adicionar um segundo destino externo;
- Auth/objetos gerenciados pelo Supabase podem exigir cuidados específicos no restore; isso será validado no teste real.

## Gate de ativação

Após o workflow entrar em `main`, é necessário configurar os dois GitHub Secrets e executar manualmente uma vez.

Resultado esperado:

- job verde;
- artifact criado;
- nenhum dump em claro no artifact;
- checksum presente;
- nenhuma credencial exibida nos logs.

## Regra

**Nunca baixar/descriptografar um backup real em computador compartilhado ou não confiável.**
