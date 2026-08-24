# SEC-21 — Inventário de dados pessoais e minimização

> Documento técnico de conformidade e segurança. Não cria prompts, banners ou fluxos para incentivar fornecimento de dados pessoais. O objetivo é reduzir tratamento ao mínimo necessário para o funcionamento do VENCIVO.

## 1. Escopo

Inventário baseado no schema real do Supabase e no código atualmente versionado.

Nenhum dado real de usuário foi copiado para este documento. Foram analisados apenas nomes de tabelas, colunas, políticas RLS e fluxos do código.

## 2. Supabase Auth

O Supabase Auth gerencia dados de conta e sessão. Entre os campos existentes no schema gerenciado estão:

- e-mail;
- telefone, quando utilizado;
- hash/senha criptografada gerenciada pelo Supabase;
- metadados de usuário;
- datas de confirmação/login;
- sessões;
- IP e user-agent de sessão;
- tokens internos de confirmação/recuperação gerenciados pelo provedor.

### Regra operacional

O VENCIVO não deve copiar tokens internos, hashes de senha ou dados de sessão para tabelas próprias, logs ou documentação.

## 3. Tabelas públicas

### `profiles`

Campos relevantes:

- `id` — vínculo com usuário Auth;
- `full_name` — dado pessoal;
- `phone` — dado pessoal;
- `role`;
- timestamps.

RLS atual:

- usuário autenticado pode selecionar apenas `id = auth.uid()`;
- usuário autenticado pode atualizar apenas o próprio perfil.

### `agents`

Campos potencialmente pessoais ou vinculáveis a pessoa:

- `owner_id` — identificador pseudônimo de usuário;
- `company_name`;
- `whatsapp` — pode ser dado pessoal;
- `city_region`;
- `services`, `business_hours`, `objective`, `system_prompt` — podem conter texto livre e, por isso, podem receber dados pessoais acidentalmente.

RLS atual:

- SELECT/INSERT/UPDATE/DELETE limitados ao próprio `owner_id` para usuários autenticados.

### `agent_knowledge`

Campos:

- `agent_id`;
- `file_name` — pode conter dado pessoal no nome do arquivo;
- `content` — texto livre; risco alto de conter dados pessoais ou dados de terceiros;
- `content_type`;
- `size_bytes`;
- `content_hash`;
- timestamps.

RLS atual:

- SELECT/INSERT/UPDATE/DELETE dependem de o agente pertencer a `auth.uid()`.

### `agent_sessions`

Campos:

- `agent_id`;
- `session_key` — identificador pseudônimo;
- contagem de mensagens;
- timestamps.

RLS atual:

- SELECT/INSERT/UPDATE limitados ao proprietário do agente.

### `subscriptions`

Campos vinculáveis ao usuário:

- `user_id`;
- `agent_id`;
- IDs externos de cliente/assinatura/checkout;
- URL de checkout;
- `external_reference`;
- plano, preço, status e períodos de cobrança;
- timestamps.

RLS atual:

- SELECT do próprio usuário;
- alterações de backend usam service role.

### `billing_events`

Campos:

- IDs do provedor;
- tipo do evento;
- `payload` JSON completo recebido do Asaas;
- timestamps.

**Achado SEC-21-01 — prioridade alta:** o código atual persiste o webhook completo do Asaas em `billing_events.payload`. O payload do provedor pode conter informações pessoais/financeiras operacionais que não são necessárias para a lógica do VENCIVO.

Recomendação técnica:

- substituir persistência do payload bruto por metadados mínimos necessários à idempotência, reconciliação e auditoria;
- se payload bruto for temporariamente necessário para investigação, definir retenção curta e acesso administrativo restrito;
- não registrar dados de cartão. O fluxo atual usa checkout hospedado pelo Asaas e não deve receber dados do cartão diretamente.

### `usage_counters`

Campos:

- `user_id`;
- `agent_id`;
- período;
- contagem de mensagens;
- caracteres de entrada/saída.

RLS atual:

- usuário autenticado visualiza somente o próprio uso.

Não há necessidade de armazenar conteúdo das mensagens nesta tabela.

### `rate_limit_buckets`

Campos:

- `key`;
- janela;
- contagem;
- timestamp.

**Achado SEC-21-02:** o código cria chaves de rate limit baseadas em IP em alguns fluxos. Portanto `rate_limit_buckets.key` pode conter ou incorporar endereço IP, que deve ser tratado como dado técnico potencialmente pessoal.

Recomendação:

- retenção curta, limitada à janela operacional necessária;
- evitar uso da tabela como log histórico;
- considerar hash/HMAC do IP no futuro se não houver necessidade operacional de recuperar o IP original.

### `plan_catalog`

Catálogo comercial. Não contém dado pessoal de cliente.

## 4. Instagram

### `instagram_connections`

Campos relevantes:

- `owner_id`;
- `agent_id`;
- `instagram_user_id`;
- `username`;
- `access_token_encrypted`;
- scopes;
- expiração do token;
- status e timestamps.

RLS atual:

- SELECT/INSERT/UPDATE/DELETE limitados ao próprio `owner_id`.

Regras:

- token deve permanecer criptografado em repouso;
- token nunca deve aparecer em frontend, logs ou documentação;
- ao desconectar integração, revogar token quando tecnicamente aplicável e eliminar o valor armazenado conforme política operacional.

### `instagram_webhook_events`

Campos incluem:

- `instagram_user_id`;
- `agent_id`;
- tipo/status;
- IDs de mensagem;
- erro de resposta;
- retry;
- `payload` JSON;
- timestamps.

A tabela está com RLS habilitado e não possui policies de usuário final no inventário atual, o que é compatível com uso exclusivo do backend/service role.

**Achado SEC-21-03:** a coluna `payload` tem potencial de armazenar texto de mensagens/comentários de clientes finais. A fundação INST-04 atual não persiste payload bruto, o que deve ser preservado como regra padrão.

Quando INST-05 for implementado:

- persistir somente campos necessários ao processamento/idempotência;
- evitar payload bruto por padrão;
- se conteúdo de mensagem for necessário para responder, definir finalidade e retenção curta;
- não reutilizar conversas para outra finalidade sem decisão específica de produto/compliance.

## 5. Storage

Bucket identificado:

`vencivo-knowledge`

Configuração atual:

- privado;
- limite do bucket: 50 MiB por arquivo;
- usado no fluxo de documentos de conhecimento.

O backend atual tenta excluir do Storage o arquivo após indexação no Gemini File Search. Portanto, o bucket funciona principalmente como área temporária de transferência.

### Risco

Documentos enviados podem conter dados pessoais ou dados de terceiros.

### Regra recomendada

- manter Storage privado;
- não tornar bucket público;
- apagar arquivo temporário após processamento concluído;
- definir limpeza de órfãos para uploads abandonados/falhos;
- não manter cópia permanente sem necessidade funcional explícita.

## 6. Provedores externos e fluxo de dados

| Provedor | Dados/identificadores que podem transitar | Finalidade |
|---|---|---|
| Supabase | conta, perfil, agentes, documentos/metadados, assinatura e uso | Auth, DB, Storage |
| Google Gemini | conteúdo necessário à IA/File Search | responder e indexar conhecimento |
| Asaas | identificadores de cobrança e dados fornecidos ao checkout hospedado | pagamento/assinatura |
| Meta Instagram | identificadores e mensagens/eventos quando integração for ativada | canal de atendimento |
| Vercel | requisições, logs técnicos e execução de backend | hospedagem/serverless |
| GitHub | código, configuração e workflows; não deve receber dados de clientes | versionamento/automação |

## 7. Retenção — estado atual

Ainda não há política técnica uniforme implementada para todas as tabelas.

### Prioridades

1. `billing_events.payload` — reduzir conteúdo armazenado;
2. `rate_limit_buckets` — limpeza automática após janela operacional;
3. `instagram_webhook_events` — definir antes de ativar persistência real;
4. uploads órfãos no `vencivo-knowledge` — rotina de limpeza;
5. sessões/uso — definir período compatível com operação e suporte;
6. exclusão de conta — mapear cascatas e dados que precisam permanecer por obrigação financeira/legal.

## 8. Direitos e atendimento

O canal de privacidade existente permanece o mecanismo de solicitação.

Do ponto de vista técnico, antes do lançamento deve existir procedimento administrativo documentado para:

- localizar dados de uma conta;
- corrigir perfil quando aplicável;
- excluir dados elimináveis;
- exportar informações quando aplicável;
- registrar quais dados não podem ser apagados imediatamente por obrigação legal/financeira.

Não é necessário criar botões chamativos ou incentivar solicitações. O requisito é existir procedimento seguro e executável quando necessário.

## 9. Controles positivos já encontrados

- RLS habilitado em todas as tabelas públicas inventariadas;
- isolamento por `owner_id` em `agents`;
- isolamento indireto em `agent_knowledge` e `agent_sessions`;
- `subscriptions` e `usage_counters` com SELECT limitado ao próprio usuário;
- `instagram_connections` isolada por proprietário;
- bucket de conhecimento privado;
- INST-04 evita log/persistência de payload bruto;
- checkout Asaas é hospedado pelo provedor, reduzindo exposição direta de cartão.

## 10. Plano técnico SEC-21

### SEC-21A — inventário

Status: **concluído neste documento**.

### SEC-21B — minimização de billing events

Alterar webhook Asaas para persistir somente campos necessários e remover `payload: body` da gravação padrão.

### SEC-21C — retenção técnica

Criar política/rotina para:

- rate-limit buckets expirados;
- eventos antigos conforme necessidade de auditoria;
- uploads órfãos.

### SEC-21D — procedimento de exclusão/exportação

Documentar query/procedimento administrativo seguro, com confirmação de identidade e sem endpoint público destrutivo desnecessário.

### SEC-21E — validação final

Confirmar que:

- nenhuma API nova expõe conteúdo de conhecimento indevidamente;
- nenhum log contém tokens/segredos;
- nenhum payload de webhook é armazenado integralmente sem necessidade;
- retenção está documentada;
- exclusão/exportação pode ser realizada de forma controlada.

## 11. Próxima mudança recomendada

**SEC-21B — minimizar `billing_events.payload`.**

É a mudança de maior benefício imediato encontrada neste inventário, pois reduz dados recebidos de terceiro armazenados sem necessidade para a lógica atual.
