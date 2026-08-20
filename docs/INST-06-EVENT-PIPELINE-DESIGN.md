# VENCIVO — INST-06 Event Pipeline Design

**Status:** DESENHO — NÃO IMPLEMENTADO
**Branch:** `feat/instagram-idempotency-design`
**Base:** `feat/instagram-identity-migration`

## Objetivo

Definir como o VENCIVO receberá eventos do Instagram, responderá rapidamente ao webhook da Meta e processará Direct/comentários de forma assíncrona, idempotente e isolada por agente.

O desenho deve suportar o crescimento inicial do produto sem transformar o webhook em um endpoint que espera Gemini, download de mídia ou envio de resposta antes de retornar `200`.

## Evidência de infraestrutura atual

O projeto Supabase real possui as extensões `pgmq`, `pg_net` e `pg_cron` instaladas. Isso foi confirmado por consulta somente leitura em 20/08/2026.

Não há atualmente uma tabela `instagram_webhook_events` em `public`, e a migration dessa tabela ainda não foi aplicada.

A tabela `instagram_connections` já foi migrada e possui `agent_id` e `access_token_encrypted`, com 0 linhas no momento desta análise.

## Arquitetura proposta

```text
Meta Instagram
      |
      v
Vercel /api/instagram-webhook
      |
      | 1. validar assinatura
      | 2. validar payload
      | 3. dedupe/registro durável
      | 4. publicar job
      v
Supabase Postgres
  instagram_webhook_events
      |
      +---- pgmq queue ----------------+
      |                                 |
      v                                 v
estado/auditoria                 Edge Function worker
                                        |
                         +--------------+--------------+
                         |                             |
                    resolver agent              processar mídia
                         |                             |
                         v                             v
                    agente certo                  Gemini
                         |                             |
                         +--------------+--------------+
                                        |
                                        v
                                  responder Meta
```

## Por que separar webhook de processamento

O webhook não deve executar o fluxo completo de atendimento. Uma mensagem pode exigir consulta ao banco, recuperação de mídia, transcrição de áudio, chamada ao Gemini e chamada posterior à API do Instagram.

O receptor deve fazer apenas o trabalho necessário para autenticar, validar, deduplicar e enfileirar o evento. O processamento pesado fica no worker.

Isso também permite que uma falha do Gemini ou da API do Instagram seja repetida sem exigir que a Meta reencontre o mesmo evento por causa de um timeout do webhook.

## Idempotência

`provider_event_id` continua sendo único em `instagram_webhook_events`.

O fluxo lógico é:

1. receber evento;
2. calcular `dedupeKeyForEntry(entry)`;
3. tentar registrar o evento uma única vez;
4. se já existir como `processed`, não processar novamente;
5. se existir como `processing` e o lease ainda estiver válido, não duplicar o trabalho;
6. se existir como `processing` com lease expirado, permitir recuperação;
7. publicar/enfileirar o trabalho de forma que o worker possa repetir com segurança;
8. marcar `processed` somente depois da conclusão do processamento exigido.

A operação de claim deve ser atômica. Nunca usar `SELECT` seguido de `UPDATE` separado para decidir quem ganhou o evento.

## Queue: decisão arquitetural

O Supabase real já possui `pgmq` instalado. A documentação atual do Supabase descreve Queues como uma fila baseada em Postgres e mostra consumo por Edge Functions, inclusive em conjunto com Cron.

Portanto, o desenho preferido é:

- `instagram_webhook_events` = registro durável, idempotência e estado operacional/auditável;
- `pgmq` = transporte de trabalho entre recepção e worker;
- Supabase Edge Function = worker de processamento;
- `pg_cron`/`pg_net` = mecanismo de acionamento periódico/recovery quando necessário.

Não criar uma segunda tabela manual de fila se `pgmq` cobrir a necessidade real.

## Garantia contra perda entre banco e fila

Não assumir que duas operações independentes (`INSERT` no evento + `pgmq.send`) são atomicamente uma única transação.

Antes da implementação, escolher explicitamente uma das estratégias:

### Estratégia preferida

Fazer a gravação do evento e o envio para a fila dentro de uma unidade transacional suportada pelo banco, usando as funções SQL adequadas do `pgmq`, ou encapsular as duas operações em uma função SQL transacional.

### Alternativa

Usar `instagram_webhook_events.status='received'` como outbox e um worker de publicação que encontre eventos ainda não publicados e os envie para `pgmq`.

A alternativa é mais simples de recuperar, mas acrescenta uma etapa de polling.

**Não implementar nenhuma das duas por suposição. A próxima tarefa deve confirmar as APIs `pgmq` disponíveis no projeto antes de escrever a migration/worker.**

## Worker

O worker deve receber somente um identificador do evento, não um payload arbitrário enviado pelo navegador.

Sequência:

1. obter mensagem da fila;
2. localizar `instagram_webhook_events` pelo ID/chave;
3. fazer claim atômico;
4. resolver `instagram_user_id -> instagram_connections -> agent_id`;
5. confirmar que a conexão está `active`;
6. descriptografar o token somente no backend quando necessário;
7. interpretar o tipo de evento;
8. recuperar mídia somente quando o evento exigir;
9. normalizar para o contrato interno do VENCIVO;
10. executar o pipeline do agente;
11. enviar resposta pelo canal Instagram;
12. marcar evento como `processed`;
13. confirmar/remover a mensagem da fila somente depois da conclusão segura.

Em falha recuperável:

```text
worker
  -> failed/retry
  -> mensagem permanece ou é reenfileirada
  -> nova tentativa
```

Em falha permanente (payload inválido, conexão revogada, evento não suportado):

```text
worker
  -> failed
  -> código de erro seguro
  -> não repetir indefinidamente
```

## Concorrência

O sistema não deve garantir apenas "não duplicar o webhook"; deve garantir também que dois workers não respondam duas vezes à mesma mensagem.

O claim deve usar uma condição de estado/lease e retornar o evento somente para um worker.

O envio da resposta para a Meta é uma operação externa e não pode ser considerada transacional com o Postgres. Portanto, a etapa de resposta precisa ser idempotente por desenho. Antes de enviar uma resposta, o worker deve ter uma estratégia para impedir que um retry após timeout gere uma segunda resposta ao cliente.

Esse ponto é **BLOCKER de arquitetura antes do primeiro processamento real**.

## Multi-tenant

Toda resolução começa pelo `instagram_user_id` da conta profissional que recebeu o evento.

Nunca resolver apenas por `owner_id` recebido de uma requisição externa.

A integridade já aplicada no banco exige que `instagram_connections.agent_id` e `owner_id` pertençam ao mesmo agente/dono por FK composto.

Depois da resolução:

```text
Instagram account
      -> instagram_connections
      -> agent_id
      -> agents
      -> agent_knowledge
```

O `agent_id` deve permanecer explícito durante todo o pipeline para evitar fallback por usuário, sessão global ou agente "primeiro encontrado".

## Conteúdo de conversa

`instagram_webhook_events.payload` não deve armazenar automaticamente o payload bruto da Meta.

A política de retenção de mensagens/conversas deve ser definida antes de persistir texto integral, áudio, imagem ou vídeo do cliente.

O pipeline pode carregar o conteúdo apenas pelo tempo necessário para processar a interação.

## Áudio

Áudio não será um caminho separado do webhook.

Ele entra pelo mesmo pipeline:

```text
Instagram event
 -> event normalization
 -> media resolver
 -> audio validation
 -> Gemini audio understanding
 -> normalized text
 -> agent pipeline
 -> Instagram response
```

O desenho detalhado de áudio está em `docs/AUDIO-01-DESIGN.md`.

## Falhas e observabilidade

Registrar somente metadados operacionais:

- event id interno;
- provider event id;
- instagram user id;
- agent id;
- tipo do evento;
- tentativa;
- status;
- código de erro;
- timestamps;
- duração do processamento.

Não registrar:

- access token;
- chave de criptografia;
- URL privada de mídia;
- áudio bruto;
- texto integral da conversa em logs.

## Critérios para INST-06

Antes de considerar o pipeline pronto:

- webhook autenticado;
- evento persistido de forma idempotente;
- fila configurada sem duplicação de trabalho;
- claim atômico testado sob concorrência;
- recuperação de lease expirado testada;
- isolamento `instagram_user_id -> agent_id` testado;
- conexão revogada falha fechadamente;
- worker não depende de `main` ter sido alterada manualmente;
- falhas do Gemini não fazem o webhook retornar erro à Meta depois que o evento já foi duravelmente aceito;
- estratégia de idempotência da resposta externa definida e testada;
- nenhum segredo aparece em resposta ou log.

## Não implementar nesta fase

- OAuth novo;
- resposta automática em produção;
- áudio em produção;
- comentários em produção;
- alteração de `main`;
- merge de PR #9;
- WhatsApp;
- alteração de AI-01/AI-02.

## Próximo passo exato

1. Inspecionar as APIs `pgmq` disponíveis no banco real (somente leitura).
2. Definir o contrato transacional entre `instagram_webhook_events` e `pgmq`.
3. Definir a estratégia de idempotência da resposta externa do Instagram.
4. Só então finalizar a migration de eventos e o worker.
