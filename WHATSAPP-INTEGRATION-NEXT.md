# Próxima etapa obrigatória — WhatsApp

O fluxo comercial e de pagamento agora separa corretamente:
- agente em demonstração;
- checkout Asaas por agente;
- assinatura vinculada ao agente;
- webhook de pagamento;
- liberação da implantação;
- configuração guiada.

Ainda falta escolher e integrar um provedor oficial de WhatsApp Business/Meta (Cloud API ou BSP). Sem essa integração, não é seguro marcar `whatsapp_status=connected` ou `status=active` apenas porque o cliente marcou caixas na tela.

Depois de configurar o provedor, o botão de conexão deve abrir a autorização oficial e o callback/webhook do provedor deve atualizar `agents.whatsapp_status` para `connected`; somente então o VENCIVO deve permitir a ativação real.
