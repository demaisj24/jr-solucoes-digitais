# VENCIVO — AUDIO-01 Design

Status: DESENHO — NÃO IMPLEMENTADO
Branch: `docs/audio-01-design`

## Objetivo

Permitir que um cliente envie áudio pelo Instagram Direct e que o agente VENCIVO entenda o conteúdo sem exigir transcrição manual.

Fluxo alvo:

Instagram Direct audio
→ webhook
→ validação/idempotência
→ resolução `instagram_user_id → agent_id`
→ obtenção segura da mídia Meta
→ validação de MIME/tamanho/duração
→ Gemini multimodal
→ texto normalizado
→ pipeline existente do agente
→ resposta Instagram

## Decisão arquitetural

Não criar um segundo produto de transcrição para o MVP se o Gemini atualmente contratado/configurado atender ao caso. A documentação oficial do Gemini confirma compreensão de áudio, transcrição e geração de texto a partir de áudio.

Para arquivos inline, a documentação atual indica limite total de 20 MB por requisição; acima disso, usar a Files API. O fluxo Instagram deve impor limites próprios mais conservadores para proteger custo, latência e abuso.

Não assumir que o modelo atualmente configurado no VENCIVO é o mesmo modelo citado na documentação. `api/agent-chat.js` deve ser tratado como fonte do modelo efetivamente usado pelo produto até uma revisão específica.

## Contrato interno de mensagem

Normalizar toda entrada do Instagram para um formato interno, sem acoplar o agente ao payload da Meta:

```text
{
  channel: "instagram",
  type: "audio",
  external_event_id: "...",
  instagram_user_id: "...",
  agent_id: "...",
  owner_id: "...",
  media: {
    url: "backend-only",
    mime_type: "audio/...",
    size_bytes: 0,
    duration_ms: null
  },
  text: null,
  received_at: "..."
}
```

Depois da compreensão do áudio:

```text
media.audio
→ audio understanding
→ normalized.text
→ pipeline do agente
```

O agente deve receber o texto transcrito como mensagem do cliente, mas o sistema deve manter internamente que a origem foi `audio` para observabilidade e futura UX.

## Segurança

- Nunca expor access token do Instagram ao navegador.
- Nunca registrar URL privada da mídia em logs.
- Nunca registrar conteúdo integral do áudio.
- Validar MIME real e tamanho antes de enviar ao modelo.
- Aplicar timeout e limite de duração.
- Impedir SSRF: a URL da mídia deve ser aceita somente quando originada do fluxo Meta esperado e validada pelo backend.
- Não aceitar uma URL arbitrária fornecida pelo usuário como mídia.
- Não persistir áudio por padrão; usar processamento transitório quando possível.
- Se houver armazenamento temporário, definir TTL explícito e exclusão.
- Fail closed quando token, mídia ou identidade não puderem ser validados.

## Prompt de transcrição

A transcrição deve ser mínima e determinística. O objetivo primário é transformar voz em texto para o agente, não pedir ao modelo para responder diretamente ao cliente nessa etapa.

Requisitos:

1. transcrever em português quando essa for a língua falada;
2. preservar nomes próprios, números, preços, códigos e termos comerciais;
3. não inventar trechos inaudíveis;
4. marcar trecho incompreensível de forma explícita;
5. não resumir;
6. não responder ao cliente;
7. devolver texto limpo para o pipeline do agente.

Uma etapa posterior pode usar o áudio para sinais adicionais, mas isso não é requisito do MVP.

## Latência

Não fazer duas chamadas Gemini se uma chamada multimodal puder alimentar diretamente o pipeline com qualidade aceitável.

A meta inicial deve ser medir:

- download da mídia Meta;
- upload/entrada no Gemini;
- tempo Gemini;
- tempo total;
- tamanho do áudio;
- duração;
- taxa de falha.

O endpoint atual `api/agent-chat.js` possui timeout de 8 segundos para a chamada Gemini. Isso é relevante para o futuro fluxo de áudio e deve ser revisado especificamente antes de reutilizar o mesmo limite para mídia.

## Custo

Não estimar custo final sem:

- modelo exato em produção;
- duração média dos áudios;
- volume mensal de mensagens de áudio;
- preço atual do modelo/endpoint escolhido.

O Gemini documenta atualmente 32 tokens por segundo de áudio como referência de representação, mas o custo efetivo precisa ser calculado usando o modelo/preçário efetivamente escolhido.

## Teste AUDIO-01

Antes de integrar Instagram:

1. obter 3–5 áudios reais ou sintéticos em português;
2. incluir áudio curto, médio e com ruído;
3. testar números/preços/códigos;
4. medir latência;
5. medir transcrição correta;
6. testar MIME;
7. testar arquivo acima do limite escolhido;
8. testar áudio inválido;
9. testar timeout;
10. registrar resultados sem armazenar conteúdo sensível.

Critério de aprovação:

- transcrição correta nos casos críticos;
- nenhuma exposição de segredo;
- timeout controlado;
- custo mensurável;
- integração possível sem alterar AI-01.

## Não implementar nesta etapa

- OAuth Meta;
- webhook final;
- resposta Instagram;
- comentários;
- voz de saída/TTS;
- CRM;
- leads;
- persistência permanente de áudio;
- alteração de `api/agent-chat.js`;
- alteração de `main`.

## Observação sobre modelos

A documentação oficial atual do Gemini mostra suporte multimodal e exemplos recentes com modelos da família Gemini Flash. O modelo efetivamente usado pelo VENCIVO deve ser confirmado no código/configuração de produção antes do teste. Não alterar o modelo apenas por causa deste documento.
