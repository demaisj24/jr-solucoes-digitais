# VENCIVO — CONTEXTO E CONTINUIDADE — 2026-08-22

## Estado atual

Projeto: VENCIVO / jr-solucoes-digitais.

Objetivo: plataforma SaaS de agentes de IA, com foco em segurança técnica, isolamento entre clientes, controle de custos e conformidade com a LGPD brasileira.

Regra permanente: em toda nova construção, considerar simultaneamente segurança contra atacantes e conformidade com a legislação brasileira, especialmente LGPD. O sistema deve permitir ao titular entender quais dados são coletados, para que são usados, com quem são compartilhados, como são processados, como corrigir/exportar/excluir quando aplicável e como exercer seus direitos.

## Gates de segurança concluídos

### SEC-13
Rate limiting do agent-chat/fluxos relacionados já tratado anteriormente. Não remover regressões.

### SEC-14 — File Search / custo e idempotência
Trabalho de correção continua preservado localmente em stash:
`stash@{0}: WIP SEC-14 antes da SEC-17`

O stash contém somente `api/agents.js`, com 36 inserções e 2 remoções.
Também existem localmente, ainda não rastreados, artefatos/testes SEC-14:
- `sec14-local.patch`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`

NÃO apagar, resetar ou fazer stash pop sem revisar.

### SEC-16 — Password security / UX
Commit publicado:
`32f6f20 SEC-16: harden password security and UX`

Branch:
`sec-16-password-security`

Testes: 9/9 PASS.
Política final: mínimo de 8 caracteres, sem exigir artificialmente classes de caracteres. Verificação de senha comprometida usa hash local e transmite somente prefixo de 5 caracteres ao proxy/HIBP, sem senha ou hash completo.

### SEC-17 — Tenant isolation
Commit publicado:
`b47ef8a SEC-17: enforce tenant isolation for knowledge management`

Branch:
`sec-17-tenant-isolation`

Testes: 2/2 PASS.
Regra de `knowledgeAgent`: acesso exige usuário autenticado, `owner_id` presente e `owner_id === user.id`, inclusive para agentes `demo`. Nunca autorizar gestão de conhecimento apenas pelo status `demo`.

### SEC-18 — AI knowledge privacy
Branch:
`sec-18-ai-knowledge-privacy`

Commit atual:
`281dc3f SEC-18: add AI knowledge privacy regression test`

Branch sincronizada com origin.
Testes SEC-18: 2/2 PASS.
Regressão SEC-17 + SEC-18: 4/4 PASS.
`git diff --check`: PASS.

A auditoria verificou que a resposta pública do agent-chat não deve expor texto recuperado dos documentos nem identificadores internos do File Search Store. O teste protege isso. Não alterar `api/agent-chat.js` sem necessidade: a implementação atual já atende o teste.

## Estado Git relevante

Branch de trabalho mais recente: `sec-18-ai-knowledge-privacy`.
Arquivos não rastreados locais que NÃO devem ser incluídos automaticamente em commits:
- `dfq`
- `sec14-local.patch`
- `supabase/`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`

O stash da SEC-14 continua preservado.

SEC-17 já foi pushed para origin.
SEC-18 já está pushed para origin.

## LGPD — requisito permanente

O usuário pediu explicitamente que segurança técnica e LGPD sejam consideradas em toda construção.

Requisitos a manter:
- minimização de dados;
- finalidade e necessidade;
- isolamento por tenant;
- autenticação e autorização robustas;
- menor privilégio;
- proteção de credenciais e segredos;
- não registrar senhas, tokens ou conteúdo sensível desnecessariamente;
- transparência sobre dados coletados e processamento;
- mecanismo para exercício de direitos do titular;
- exclusão/anonimização somente quando juridicamente aplicável;
- retenção documentada quando houver obrigação legal/regulatória;
- auditoria de operações administrativas;
- prevenção de acesso cruzado entre clientes;
- segurança dos dados enviados a provedores externos de IA/pagamento.

## SEC-19 — próximo gate

Próximo trabalho: inventário de dados e direitos do titular LGPD antes de construir o painel administrativo.

Mapear:
- `auth.users`
- `agents`
- `agent_knowledge`
- `subscriptions`
- storage
- logs
- integrações
- demais tabelas

Para cada dado: finalidade, proprietário/tenant, retenção, compartilhamento, dependências, possibilidade de exclusão/anonimização e controles de acesso.

Depois implementar, de forma autenticada e auditável, conforme aplicável:
- confirmação de tratamento;
- acesso aos dados;
- exportação;
- correção;
- solicitação de exclusão;
- revogação de consentimento quando aplicável;
- informações sobre compartilhamento;
- tratamento de pedidos de privacidade.

Não implementar um simples "excluir tudo": avaliar hipóteses de conservação e obrigações legais antes da exclusão.

## Painel administrativo futuro

O painel administrativo será construído depois de consolidar os controles SEC-17/SEC-19.

Arquitetura pretendida:
- RBAC;
- tenant isolation;
- menor privilégio;
- auditoria de ações administrativas;
- separação entre suporte, privacidade, administração e funções técnicas;
- nenhum acesso baseado somente em IDs fornecidos pelo cliente;
- proteção de operações destrutivas com autenticação/autorização forte e trilha de auditoria.

O painel NÃO deve ser "admin vê tudo".

## Fluxo de continuidade

1. Não mexer no stash SEC-14 sem necessidade.
2. Concluir SEC-18/PR conforme política do projeto.
3. Iniciar SEC-19 com inventário real do banco e storage.
4. Definir retenção/exclusão/exportação e controles LGPD.
5. Só então construir painel administrativo seguro.
6. Depois retomar/fechar SEC-14 com testes e revisão.

## Princípio de engenharia

Não alterar código apenas para satisfazer regex de teste. Testes de segurança devem validar comportamento/regra e evitar acoplamento desnecessário à formatação da implementação.

Não misturar gates de segurança em um único commit. Cada SEC deve ter testes, diff revisado, regressão e publicação separados quando possível.
