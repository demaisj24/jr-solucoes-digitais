# VENCIVO — Instagram-first

## Objetivo
O Instagram é o canal prioritário do VENCIVO. O produto deve transformar o agente em uma atendente especialista da empresa para Direct e comentários.

## Fluxo-alvo
1. Empresa cria/configura agente.
2. Empresa fornece conhecimento, personalidade, regras e objetivo.
3. Empresa conecta uma conta profissional do Instagram.
4. VENCIVO recebe eventos de mensagens e comentários via Webhooks.
5. O backend identifica `instagram_user_id -> agent_id`.
6. O agente consulta contexto + conhecimento + regras.
7. A resposta é enviada pela API do Instagram.
8. Conversas e leads são persistidos no VENCIVO.
9. O usuário pode transferir para humano.

## Login escolhido
Business Login for Instagram / Instagram API with Instagram Login.

Permissões planejadas para o MVP:
- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

A documentação atual consultada descreve o fluxo como autorização no Instagram, callback com `code`, troca do código por token de curta duração e posterior troca por token de longa duração. A API usa `graph.instagram.com` para chamadas do Instagram Login. citeturn1search0turn1search7

## Comentários
A API permite receber eventos de comentários por webhook e responder/gerenciar comentários. Para resposta privada iniciada por comentário existem limites de janela e de quantidade de mensagens; isso deve ser tratado como regra de produto, não ignorado. citeturn1search1turn1search2

## Segurança
- Nunca enviar `client_secret` ao navegador.
- Nunca retornar access token ao frontend.
- Estado OAuth assinado e com expiração curta.
- Access token armazenado criptografado no backend.
- RLS habilitado na tabela de conexões.
- Validar `owner_id` + `agent_id` em toda operação.
- Webhook deve validar autenticidade antes de processar eventos.
- Idempotência será obrigatória para eventos Meta.

## Infraestrutura
A branch `feat/instagram-foundation` contém apenas a fundação técnica. Não alterar `main` nem configurar callback na Meta antes da revisão e dos testes.

Variáveis previstas:
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_OAUTH_STATE_SECRET`
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes)
- `VENCIVO_PUBLIC_URL`

Callback previsto:
`https://vencivo.com.br/api/instagram-callback`

A URL acima só deve ser cadastrada na Meta depois que o endpoint estiver implantado e validado em produção.

## Fora do escopo
WhatsApp não faz parte do MVP atual e não deve receber novas implementações nesta frente.

## Próximos passos técnicos
1. Revisar fundação OAuth.
2. Criar/aplicar tabela `instagram_connections` após aprovação.
3. Criar endpoint de status da conexão.
4. Integrar botão "Conectar Instagram" no Meu Agente.
5. Implementar webhook autenticado.
6. Implementar processamento de `messages`.
7. Implementar processamento de `comments`.
8. Ligar o motor de atendimento ao agente existente.
9. Persistir conversas e leads.
10. Testar com conta Instagram de teste antes de solicitar/usar acesso para clientes.
