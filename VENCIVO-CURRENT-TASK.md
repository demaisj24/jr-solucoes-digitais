# VENCIVO — CURRENT TASK

## TASK
`INST-04` — Fundação do webhook Instagram

## Objetivo
Preparar o recebimento seguro de eventos do Instagram para que, posteriormente, o VENCIVO processe Direct e comentários e entregue os eventos ao agente especialista.

## Contexto
- AI-01 está funcional.
- AI-02 foi implementado e validado no preview pelo dono do produto.
- Instagram é o canal prioritário.
- WhatsApp está fora do MVP atual.
- A fundação OAuth está na branch `feat/instagram-foundation` e PR #13.

## Não fazer nesta tarefa
- não alterar `main`;
- não fazer merge;
- não enviar mensagens reais para clientes;
- não implementar OAuth novamente;
- não alterar File Search/Gemini;
- não alterar checkout;
- não implementar WhatsApp;
- não criar processamento definitivo de mensagens/comentários se o contrato de webhook ainda não estiver validado;
- não executar SQL de produção;
- não expor secrets.

## Critérios de aceite
1. Endpoint de webhook possui verificação GET compatível com o fluxo Meta escolhido.
2. POST rejeita assinatura inválida.
3. POST aceita somente eventos Instagram esperados.
4. O processamento é preparado para idempotência sem duplicar eventos.
5. O endpoint não chama Gemini nem responde ao cliente nesta tarefa.
6. O payload bruto não é gravado contendo tokens/secrets.
7. Testes unitários cobrem assinatura válida, inválida e verificação GET.
8. PR Draft com diff pequeno e relatório.

## Próximo passo depois do aceite
`INST-05` — persistência/idempotência e resolução `instagram_user_id -> agent_id`.
