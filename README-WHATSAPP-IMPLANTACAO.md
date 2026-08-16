# Implantação do WhatsApp — VENCIVO AI

Fluxo implementado: criação do agente → checkout recorrente Asaas vinculado ao agente → webhook confirma pagamento → implantação liberada → guia de configuração do WhatsApp.

## Importante
A integração oficial do WhatsApp/Meta ainda precisa de um provedor/API de WhatsApp configurado no backend. A interface não deve fingir que o número foi conectado nem ativar o agente antes dessa integração.

O cliente recebe orientação para:
1. preparar o número comercial;
2. ter acesso administrativo à conta empresarial;
3. fazer a autenticação somente na página oficial do provedor;
4. testar respostas;
5. ativar somente após a conexão real.
