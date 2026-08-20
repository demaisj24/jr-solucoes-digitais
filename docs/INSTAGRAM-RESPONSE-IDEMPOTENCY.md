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

## Impacto esperado no schema (não implementado agora)

Provável necessidade de colunas adicionais em `instagram_webhook_events` (ou uma tabela relacionada) na próxima revisão: `response_status` (`pending`/`sending`/`sent`/`ambiguous`/`failed`), `instagram_message_id`, `retry_count`, hash do texto de resposta pretendido. Isso é uma extensão do desenho já revisado (INST-05B), não uma tabela nova — fica registrado aqui para a próxima rodada de revisão de schema, **não desenhado como SQL nesta tarefa**, conforme instruído.
