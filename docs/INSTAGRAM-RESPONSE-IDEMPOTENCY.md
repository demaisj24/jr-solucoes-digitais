# VENCIVO — INST-06: Idempotência da resposta externa (análise, sem código)

**Status:** só análise. Nenhum SQL aplicado, nenhum código escrito, `main` intocada.

## Cenário analisado

```
1. evento recebido
2. Gemini processa
3. resposta enviada com sucesso para o Instagram
4. VENCIVO cai antes de marcar o evento como processed
5. recovery tenta de novo
```

Risco: enviar a mesma resposta duas vezes para o cliente final.

## O que a API oficial da Meta oferece (investigado, não presumido)

Fontes: `developers.facebook.com/docs/messenger-platform/instagram/features/send-message/` (Send API, Instagram Messaging), busca adicional sobre o Send API do Messenger Platform e sobre o endpoint de leitura de conversas.

- **`message_id`:** o Send API (`POST /<IG_ID>/messages`) retorna `{"recipient_id": ..., "message_id": ...}` em caso de sucesso. É um id gerado pela Meta, conhecido **só depois** que o envio já aconteceu — útil para auditoria/prova de envio, **não** serve para evitar o envio em si numa tentativa repetida.
- **Idempotency key do lado do cliente:** **não existe.** Não há nenhum campo tipo `idempotency_key`/`client_message_id` documentado no corpo da requisição do Send API. Diferente de APIs como a da Stripe, a Meta não oferece deduplicação server-side baseada em um token que o VENCIVO forneça.
- **Mecanismo oficial de detecção de duplicado:** **não existe** um mecanismo dedicado. O que existe, indiretamente, é a possibilidade de **ler o histórico da conversa** (endpoint de conversas/mensagens, mesma família do `/messages`) — pode ser usado como verificação *best-effort* (não é uma garantia, é uma consulta adicional).
- **Janela de resposta:** confirmação (já conhecida do domínio, não nova) — só é possível responder dentro de 24h da última mensagem do usuário; passado esse prazo, o Send API rejeita com 4xx.

**Conclusão da investigação: não existe mecanismo idempotente oficial no lado da Meta.** A estratégia mais segura precisa ser inteiramente do lado do VENCIVO.

## Estratégia proposta (desenho, não implementado)

### Princípio central
Não é possível eliminar 100% o risco de duplicidade sem um idempotency key oficial — a chamada HTTP de envio e a gravação da confirmação no banco são duas operações que não podem ser atômicas entre si (problema clássico de "dual write" entre um sistema externo e o nosso banco). O objetivo realista é **minimizar a janela de risco ao mínimo tecnicamente possível** e **tratar o caso ambíguo com uma verificação extra**, não fingir que o risco é zero.

### Sequência exata (quando marcar cada coisa)

1. **`received`** — evento persistido, dedup por `provider_event_id` já garantido (INST-05B).
2. **`processing`** — setado **antes** de qualquer chamada ao Gemini. Nada muda aqui do que já foi desenhado.
3. **Chamada ao Gemini.** Nenhuma mensagem foi enviada à Meta ainda nesta etapa — qualquer falha aqui é segura de reprocessar do zero, sem risco de duplicidade externa (ver seção "erro do Gemini").
4. **Antes de chamar o Send API:** gravar a intenção — o texto de resposta que será enviado (e um hash dele, para a verificação best-effort da seção seguinte) — num estado tipo `response_status='sending'`. Isso acontece **antes** da chamada de rede.
5. **Chamar o Send API da Meta.**
6. **Resultado — três categorias, tratadas de formas diferentes:**
   - **Sucesso confirmado (200 + `message_id`):** gravar `instagram_message_id`, `response_status='sent'`, `status='processed'`, `processed_at=now()` — como a **próxima instrução de código**, sem nenhuma outra operação no meio. Essa é a menor janela de risco possível (ordem de milissegundos, não segundos). O cenário do enunciado (queda exatamente aqui) continua teoricamente possível, mas a janela é reduzida ao mínimo tecnicamente alcançável.
   - **Falha definitiva (4xx):** ver abaixo — não reenviar automaticamente.
   - **Timeout / erro de rede / 5xx:** resultado **ambíguo** — não sabemos se a Meta processou o envio antes de falhar em responder. Tratado como estado próprio, não como sucesso nem como falha (ver "timeout ambíguo" abaixo).

### Timeout ambíguo — como lidar

Marcar um estado distinto (`response_status='ambiguous'`), nem `sent` nem `failed`. **Antes de qualquer nova tentativa de envio**, o recovery deve:
1. Consultar o histórico da conversa (endpoint de leitura de mensagens) para aquele `recipient_id`, procurando uma mensagem com o hash/conteúdo do texto pretendido, enviada depois do `created_at` do evento.
2. Se encontrar → marcar `sent`/`processed` sem reenviar (o envio original provavelmente teve sucesso, só a confirmação que se perdeu).
3. Se não encontrar (ou a verificação falhar/não puder ser feita) → só então considerar reenviar, com backoff e limite de tentativas (abaixo). O risco residual — enviar duas vezes numa combinação de "sucesso real + falha ao verificar + retry" — é pequeno, mas **não é zero**, e isso deve ficar documentado como limitação conhecida, não escondido.

### Limite de retries

Contador de tentativas (`retry_count`, incrementado a cada tentativa de recovery), com backoff crescente e um teto (ex.: 3–5 tentativas). Ao esgotar, `status='failed'` definitivo, sem mais tentativas automáticas — precisa de alerta/intervenção humana (mecanismo de alerta não desenhado nesta tarefa).

### Tratamento por tipo de erro

- **4xx (erro do Send API):** tipicamente erro do nosso lado — payload malformado, permissão/token inválido, ou fora da janela de 24h. Retry automático não resolve (o mesmo erro se repete). Marcar `status='failed'` direto, sem consumir tentativas de retry à toa, logando o motivo (sem vazar dado sensível).
- **5xx (erro do lado da Meta):** cai na categoria "timeout ambíguo" acima — candidato a retry, mas só depois da verificação best-effort.
- **Erro do Gemini:** categoria diferente dos erros de *envio*, porque **nenhuma mensagem foi enviada à Meta ainda** nesse ponto — seguro de tratar como falha "limpa". Erro transitório (timeout, rate limit) → candidato a retry automático simples, sem risco de duplicidade externa. Erro de conteúdo/política (Gemini recusa gerar resposta) → não adianta retry; marcar `failed` e (fora de escopo desta tarefa) eventualmente rotear para atendimento humano.

## Desenho do estado de resposta (v2, aprovado o desenho de idempotência, ainda sem SQL)

### 1. Separar status do PROCESSAMENTO de status da RESPOSTA?

**Sim.** São conceitos diferentes: um evento pode ser `processed` sem nunca ter enviado resposta (decisão de que nenhuma ação era necessária); um evento pode ter o *processamento* (Gemini) bem-sucedido enquanto o *envio* está `ambiguous`; forçar os dois no mesmo campo `status` criaria combinações sem sentido (`status='processing'` não diz nada sobre se uma resposta já foi tentada, confirmada, ou está em retry). Mantém-se `status` (`received`/`processing`/`processed`/`failed`, já revisado no INST-05B) como o ciclo do **processamento**, e adiciona-se um campo **separado**, `response_status`, para o ciclo da **resposta** — nulo quando nenhuma resposta foi tentada ou é necessária.

### 2. Modelo de estados de `response_status`

`NULL` (nenhuma resposta tentada/necessária) → `sending` → `sent` | `ambiguous` | `failed`, com `ambiguous` podendo voltar para `sending` (retry) ou terminar em `sent` (verificado) ou `failed` (retries esgotados).

Não criei um estado `retrying` separado: uma nova tentativa é só `sending` de novo, com `retry_count` incrementado — inventar um estado a mais para isso seria acrescentar sem necessidade real (o retry_count já diferencia "primeira tentativa" de "tentativa N"). Também não criei um estado `retry_esgotado` separado de `failed` — é `failed` com `last_response_error` explicando o motivo ("retries esgotados"), não um estado novo — o sistema não precisa tratar esses dois motivos de forma diferente depois de chegar ao estado terminal.

### 3. Campos avaliados — o que é necessário e por quê

| Campo | Necessário? | Por quê |
|---|---|---|
| `response_status` | **Sim** | Campo central do modelo acima. |
| `instagram_message_id` | **Sim** | Único dado que a Meta retorna como prova de envio — necessário para auditoria e para eventual cross-check manual. Nulo até `sent`. |
| `response_attempted_at` | **Sim** | Ancora dupla função: (a) permite ao recovery detectar timeout (`response_status='sending' AND response_attempted_at < now() - limiar`) sem precisar de um estado "timeout" à parte; (b) define o início da janela de busca na verificação best-effort via histórico de conversa. |
| `response_confirmed_at` | **Sim** | Distinto de `processed_at` (que é do ciclo de *processamento*): responde "quando a resposta foi confirmada como enviada", útil como métrica de latência de resposta isolada, e pode ficar preenchido mesmo quando `processed_at` só é setado um instante depois (pequena limpeza adicional). Fica `NULL` para sempre em eventos que nunca precisaram de resposta — combinação esperada, não um bug. |
| `last_response_error` | **Sim** | Motivo do estado `ambiguous`/`failed` mais recente — essencial para debug/alerta sem depender de vasculhar logs do Vercel. |
| `retry_count` | **Sim** | Necessário para o teto de tentativas e para diferenciar tentativas no `response_attempted_at`. |
| `response_check_at` | **Não incluído** | Avaliado e descartado: marcaria "quando verificamos o histórico de conversa pela última vez" para um evento `ambiguous`. Redundante com `response_attempted_at` + `retry_count` para o volume esperado (casos `ambiguous` devem ser raros, não o caminho comum) — não vale a coluna extra agora. Se o volume de casos ambíguos crescer a ponto de precisar de um backoff próprio só para a verificação (distinto do backoff de reenvio), revisar então. |
| "backoff/retry timing" | **Sim, como `next_retry_at`** | Em vez de recalcular backoff exponencial toda vez que o recovery varre a tabela, `next_retry_at timestamptz` (calculado pelo código, não por trigger) permite a consulta simples e indexável `WHERE response_status IN ('sending','ambiguous') AND next_retry_at <= now()`. |

**Onde vive isso — colunas na própria linha, ou uma tabela de tentativas separada?** Avaliei as duas: (a) colunas na própria linha de `instagram_webhook_events` — mais simples, mas cada nova tentativa sobrescreve o registro da tentativa anterior (só o estado mais recente fica visível); (b) uma tabela `instagram_response_attempts` (1 evento → N tentativas) — preserva histórico completo de cada tentativa, mais rica para auditoria, mas mais uma tabela para manter e consultar. **Recomendo (a)** para o MVP: o que o sistema precisa para decidir a próxima ação é o **estado atual**, não o histórico completo de tentativas; `last_response_error` já cobre o motivo da tentativa mais recente, que é o que importa operacionalmente agora. Migrar para uma tabela de tentativas depois, se auditoria completa vier a ser necessária, é uma extensão aditiva, não uma mudança destrutiva.

### 4. Máquina de transição completa

```
NULL ──(decide enviar resposta)──> sending [response_attempted_at=now(), retry_count=0]

sending ──(200 + message_id)──> sent
    [instagram_message_id=<id>, response_confirmed_at=now()]

sending ──(4xx)──> failed
    [last_response_error='4xx: <motivo>']   -- sem retry

sending ──(timeout | 5xx)──> ambiguous
    [last_response_error='timeout' | '5xx: <motivo>']

ambiguous ──(verificação via histórico ENCONTRA a mensagem)──> sent
    [response_confirmed_at=now()]   -- momento da confirmação, não do envio real

ambiguous ──(não encontrada, retry_count < limite)──> sending
    [retry_count+=1, response_attempted_at=now()]   -- só quando now() >= next_retry_at

ambiguous ──(retry_count >= limite)──> failed
    [last_response_error='retries esgotados']

sent, failed são terminais — response_status não muda mais.
```

### 5. Exemplos dos cenários críticos

**A — sucesso limpo:** `sending(T0)` → Send API 200 em T0+150ms → `sent`, `instagram_message_id=X`, `response_confirmed_at=T0+150ms` → (processamento) `status=processed`.

**B — 4xx (ex.: fora da janela de 24h):** `sending` → Send API 400 → `failed`, `last_response_error='4xx: outside 24h window'` — sem retry, `status=failed` no evento inteiro.

**C — timeout, recovery confirma que FOI enviado:** `sending(T0)` → sem resposta em 10s → recovery marca `ambiguous` → verificação no histórico de conversa encontra mensagem enviada em T0+3s → `sent`, `response_confirmed_at=<agora>` (não T0+3s — é o momento em que *nós* confirmamos, não o do envio real, que só é uma inferência).

**D — timeout, não confirma, retry, aí sim confirma:** `sending` → timeout → `ambiguous` → verificação não encontra nada → `sending` (retry_count=1) → Send API 200 dessa vez → `sent`. Risco residual aceito e já documentado: se a 1ª tentativa na verdade tinha funcionado mas a verificação não encontrou (atraso de propagação, por exemplo), o cliente recebe duas respostas — pequeno, não-zero, sem solução com as ferramentas que a Meta oferece hoje.

**E — retries esgotados:** `sending` → `ambiguous` → retry(1) → `ambiguous` → retry(2) → `ambiguous` → retry_count atinge o limite → `failed`, `last_response_error='retries esgotados'` — precisa de alerta humano (mecanismo de alerta fora do escopo desta tarefa).

**F — o cenário original do enunciado** (sucesso confirmado pela Meta, VENCIVO cai antes de gravar): `sending(T0)` → Send API 200 em T0+150ms → processo cai **antes** de gravar `sent` → linha fica presa em `sending` → recovery, mais tarde, vê `response_attempted_at` antigo, trata como timeout aparente → marca `ambiguous` → verificação **encontra** a mensagem (porque ela foi mesmo enviada) → `sent`, sem reenviar. É exatamente o mecanismo desenhado para resolver o cenário pedido — mitigação real, não garantia absoluta.
