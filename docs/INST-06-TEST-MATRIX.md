# VENCIVO — INST-06 Test Matrix

**Status:** PLANEJAMENTO — NÃO IMPLEMENTADO
**Branch:** `feat/instagram-idempotency-design`

## Objetivo

Definir os testes que precisam existir antes do primeiro processamento real de Instagram pelo VENCIVO.

## 1. Webhook authentication

| Caso | Esperado |
|---|---|
| GET com verify token correto | challenge devolvido |
| GET com token errado | rejeitado |
| GET sem parâmetros obrigatórios | rejeitado |
| POST sem assinatura | rejeitado |
| POST com assinatura inválida | rejeitado |
| POST com corpo alterado após assinatura | rejeitado |
| POST `object != instagram` | ignorado sem processamento |
| payload acima do limite | rejeitado |

## 2. Idempotência

| Caso | Esperado |
|---|---|
| primeiro evento | 1 registro + 1 job |
| mesmo evento repetido | 1 registro + nenhum segundo processamento |
| dois requests simultâneos do mesmo evento | somente um claim |
| evento já `processed` | não processar novamente |
| evento `processing` com lease válido | não duplicar |
| evento `processing` com lease expirado | permitir recuperação |
| evento `failed` recuperável | nova tentativa limitada |
| erro permanente | não entrar em retry infinito |

## 3. Multi-tenant

| Caso | Esperado |
|---|---|
| conta Instagram ativa ligada ao agente A | evento chega somente ao agente A |
| conta Instagram de outro owner | nunca resolver para agente errado |
| agent_id inexistente | falha fechada |
| conexão revogada | não processar |
| conexão sem agente | não processar como agente genérico |
| dois agentes tentando a mesma conta Instagram | banco impede |

## 4. Queue / worker

| Caso | Esperado |
|---|---|
| job publicado | worker consegue recuperar evento |
| worker cai antes de concluir | job/evento recuperável |
| worker cai depois de Gemini e antes de ack | retry não produz resposta duplicada |
| fila indisponível | evento não desaparece silenciosamente |
| worker processa lote | isolamento por evento preservado |
| dois workers concorrentes | somente um claim válido |

## 5. Resposta externa

A resposta para o Instagram é uma chamada externa e não participa da transação do banco.

Antes de implementação, definir e testar uma chave de idempotência de resposta ou um registro de resposta enviada, para impedir duplicação quando o worker não souber se a chamada externa foi concluída.

Casos mínimos:

- timeout antes de envio;
- timeout depois do envio;
- HTTP 4xx permanente;
- HTTP 5xx recuperável;
- retry após resposta externa bem-sucedida;
- duas tentativas concorrentes.

## 6. Áudio

| Caso | Esperado |
|---|---|
| áudio curto válido | texto normalizado |
| áudio com ruído | texto sem invenção de conteúdo |
| números/preços/códigos | preservados |
| MIME inesperado | rejeitado |
| arquivo acima do limite | rejeitado antes do Gemini |
| URL de mídia inválida | rejeitada |
| token de mídia indisponível | falha fechada |
| Gemini indisponível | retry controlado |
| áudio duplicado | não processar duas vezes |

## 7. Segurança

Nenhum teste pode aceitar como sucesso:

- access token em resposta HTTP;
- access token em log;
- chave de criptografia em log;
- URL privada de mídia em log;
- texto integral do cliente em log operacional;
- evento de um agente sendo processado pelo agente de outro owner.

## 8. Critério de release

INST-06 só pode avançar para produção quando:

1. todos os testes de autenticação passarem;
2. concorrência de claim estiver demonstrada;
3. recuperação de worker estiver demonstrada;
4. resposta externa tiver estratégia de idempotência definida;
5. isolamento multi-tenant estiver demonstrado;
6. nenhum segredo aparecer em logs/respostas;
7. o fluxo de áudio tiver limites e falhas testados;
8. `main` continuar sem alteração até aprovação explícita do merge.
