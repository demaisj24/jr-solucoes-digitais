# SEC-21D — Procedimento administrativo de privacidade

> Procedimento interno para atender solicitações relacionadas a dados pessoais de forma controlada. Não cria endpoint público destrutivo nem incentiva o usuário a fornecer dados adicionais.

## 1. Princípios

- confirmar a identidade do solicitante antes de acessar, corrigir, exportar ou excluir dados;
- usar o menor privilégio possível;
- não pedir senha, token, código de autenticação ou chave secreta;
- não enviar dumps integrais do banco ao solicitante;
- não apagar registros financeiros sem verificar obrigações de retenção aplicáveis;
- registrar internamente a execução da solicitação sem copiar conteúdo desnecessário.

## 2. Identificador principal

O vínculo técnico principal da conta é `auth.users.id`.

Após confirmar a identidade, localizar o UUID do usuário pelo painel administrativo seguro do Supabase/Auth. Não expor service-role key nem executar consultas administrativas no navegador do usuário.

## 3. Mapa de dados por usuário

Relações confirmadas no schema:

- `profiles.id → auth.users.id` — `ON DELETE CASCADE`;
- `agents.owner_id → auth.users.id` — `ON DELETE CASCADE`;
- `subscriptions.user_id → auth.users.id` — `ON DELETE CASCADE`;
- `usage_counters.user_id → auth.users.id` — `ON DELETE CASCADE`;
- `instagram_connections.owner_id → auth.users.id` — `ON DELETE CASCADE`.

Relações por agente:

- `agent_knowledge.agent_id → agents.id` — `ON DELETE CASCADE`;
- `agent_sessions.agent_id → agents.id` — `ON DELETE CASCADE`;
- `usage_counters.agent_id → agents.id` — `ON DELETE CASCADE`;
- `instagram_connections(agent_id, owner_id) → agents(id, owner_id)` — `ON DELETE CASCADE`;
- `subscriptions.agent_id → agents.id` — `ON DELETE SET NULL`;
- `instagram_webhook_events.agent_id → agents.id` — `ON DELETE SET NULL`.

### Implicação

Excluir o usuário Auth dispara cascatas para perfil, agentes, conhecimento, sessões, uso e conexões Instagram. Porém `subscriptions` e `instagram_webhook_events` podem permanecer com `agent_id = NULL` ou por sua própria relação/necessidade de auditoria. A exclusão nunca deve ser feita sem uma revisão prévia desses registros.

## 4. Solicitação de acesso/exportação

### Procedimento

1. confirmar identidade;
2. obter `user_id`;
3. consultar somente registros vinculados ao usuário;
4. excluir campos técnicos internos e segredos da exportação;
5. produzir resposta estruturada e compreensível;
6. entregar por canal seguro.

### Dados normalmente elegíveis à exportação

- perfil: nome e telefone, se existentes;
- agentes pertencentes à conta;
- configuração do agente que não contenha segredo interno;
- metadados de documentos do próprio agente;
- assinatura: plano, status e datas relevantes;
- contadores de uso;
- conexão Instagram: identificadores e status, **nunca token**.

### Nunca exportar diretamente

- `SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo de servidor;
- hashes/senhas/tokens do Supabase Auth;
- `access_token_encrypted` do Instagram;
- tokens Asaas/Meta/Gemini;
- dados de outros usuários;
- payloads brutos de terceiros sem necessidade e revisão.

## 5. Solicitação de correção

Preferir correção específica ao invés de regravar o registro inteiro.

Exemplos:

- nome/telefone no perfil;
- dados da empresa/agente pertencentes à conta;
- dados de contato configurados no agente.

Antes de alterar:

1. conferir `owner_id`;
2. registrar valor/campo a corrigir;
3. alterar apenas o campo solicitado;
4. validar o resultado.

## 6. Solicitação de exclusão

### Antes de excluir

1. confirmar identidade novamente;
2. verificar assinatura ativa/past_due;
3. cancelar recorrência no provedor quando necessário;
4. verificar obrigações de retenção financeira/fiscal e disputas abertas;
5. revogar integrações/tokens externos quando aplicável;
6. registrar quais dados serão eliminados e quais precisam permanecer por prazo obrigatório;
7. fazer backup operacional conforme política, sem transformar backup em retenção indefinida de dado apagado.

### Ordem operacional recomendada

1. suspender/cancelar integrações externas;
2. cancelar assinatura/recorrência quando aplicável;
3. remover arquivos temporários/órfãos do Storage;
4. eliminar dados específicos que não sejam cobertos por cascata, se necessário;
5. excluir o usuário Auth somente após confirmar o impacto das cascatas;
6. validar que registros vinculados foram removidos/anonimizados conforme esperado;
7. verificar registros financeiros/auditoria que permaneceram por obrigação;
8. registrar conclusão.

### Regra crítica

**Nunca executar `DELETE` em produção usando apenas e-mail digitado pelo solicitante.** Resolver primeiro o usuário autenticado/confirmado e o UUID correto.

## 7. Billing e eventos

`billing_events` é uma tabela de backend e não possui policy de usuário final.

SEC-21B está reduzindo a persistência para metadados mínimos. Eventos financeiros/auditoria não devem ser apagados automaticamente apenas porque a conta foi removida; a retenção deve seguir necessidade operacional/legal definida antes do lançamento.

## 8. Instagram

Ao desconectar ou excluir conta:

- invalidar/revogar token na Meta quando a API permitir/for aplicável;
- remover conexão armazenada;
- nunca devolver o token ao usuário em exportação;
- eventos técnicos sem necessidade devem seguir política de retenção;
- conteúdo bruto de mensagem não deve ser mantido por padrão.

## 9. Storage e Gemini File Search

Documentos do agente podem existir em mais de uma camada durante processamento:

- Supabase Storage temporário;
- metadados/texto em `agent_knowledge`;
- índice/File Search no provedor Gemini.

Uma exclusão completa de conhecimento deve considerar todas as camadas efetivamente utilizadas. A exclusão da linha SQL, sozinha, não deve ser presumida como remoção do índice externo.

Antes do lançamento, o fluxo de exclusão do conhecimento/File Search deve receber teste próprio.

## 10. Checklist de execução

- [ ] identidade confirmada;
- [ ] `user_id` correto identificado;
- [ ] escopo da solicitação confirmado;
- [ ] assinatura/obrigações verificadas;
- [ ] integrações externas consideradas;
- [ ] operação executada com menor privilégio possível;
- [ ] resultado validado;
- [ ] nenhum segredo incluído na resposta;
- [ ] conclusão registrada.

## 11. Sem endpoint público automático por enquanto

No MVP, este procedimento é administrativo. Isso reduz a superfície de ataque de uma rota de exclusão/exportação altamente privilegiada.

Automação futura só deve ser criada se houver necessidade de escala e depois de:

- reautenticação forte;
- proteção contra CSRF/abuso;
- confirmação explícita;
- tratamento correto de billing e integrações;
- auditoria de autorização;
- testes E2E destrutivos em ambiente isolado.

## 12. Gate pendente

SEC-21D fica documentado com base no schema atual. Antes do lançamento, executar ao menos um ensaio com uma **conta de teste descartável**, validando exportação e exclusão em ambiente controlado antes de usar o procedimento com conta real.
