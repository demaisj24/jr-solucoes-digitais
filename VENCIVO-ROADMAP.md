# VENCIVO — ROADMAP OPERACIONAL

Data: 18/08/2026
Repositório oficial: `demaisj24/jr-solucoes-digitais`
Branch de produção: `main`
Vercel: `vencivo-ai`
Domínio: `vencivo.com.br`

## Objetivo
Organizar o desenvolvimento do VENCIVO em módulos curtos, independentes e rastreáveis.

## Regra central
O GitHub é a fonte técnica de verdade. O Projeto VENCIVO no ChatGPT é o ambiente de trabalho. Cada conversa deve ter uma missão limitada. Ao terminar ou interromper uma missão, registrar um HANDOFF.

## Ordem operacional

### Fase A — Controle e continuidade
- [x] Projeto VENCIVO criado no ChatGPT
- [x] Conversa `00 — CONTROLE DO PROJETO` criada
- [x] Repositório oficial confirmado
- [x] `CONTEXTO-VENCIVO-CONTINUACAO.md` existente
- [x] `VENCIVO-MASTER-STATE.md` criado
- [x] `VENCIVO-HANDOFF.md` criado
- [x] Este roadmap criado

### Fase B — HOME
- [x] HOME-01 — Tipografia e hierarquia visual
- [x] HOME-02 — Header e menu
- [x] HOME-03 — Entrar / Minha conta / Instalar app / Orçamento
- [x] HOME-04 — Hero, narrativa, CTAs e benefícios
- [x] HOME-05 — Demonstração visual/animada do agente
- [x] HOME-06 — Finalização visual e formulário preservado
- [x] HOME-07 — Prova social visual com exemplos claramente identificados
- [ ] HOME-08 — Revisão visual final desktop/mobile

### Fase C — Integrações
- [ ] Meta/WhatsApp — retomar após análise da Meta
- [ ] WhatsApp Cloud API / Embedded Signup
- [ ] Webhook e fluxo de mensagens

### Fase D — Auditoria funcional e segurança
- [ ] Autenticação completa
- [ ] Isolamento de dados entre clientes
- [ ] Supabase/RLS
- [ ] Gemini e proteção de credenciais
- [ ] Asaas/webhooks/pagamentos
- [ ] Resend/e-mails
- [ ] PWA/service worker

### Fase E — Testes de produção
- [ ] Cadastro → login → conta
- [ ] Criar agente → conhecimento → teste
- [ ] Assinatura → Asaas → retorno → plano
- [ ] Pix
- [ ] WhatsApp
- [ ] Teste de isolamento entre usuários
- [ ] Teste mobile
- [ ] Teste de recuperação de sessão
- [ ] Teste de produção ponta a ponta

### Fase F — Lançamento
- [ ] Políticas/termos/LGPD
- [ ] SEO e metadados
- [ ] Analytics
- [ ] Onboarding
- [ ] Revisão comercial
- [ ] Checklist de lançamento

## Status atual

HOME-01 a HOME-06 permanecem concluídos e publicados.

HOME-07 foi concluído e publicado. A alteração ficou restrita ao `index.html`: foi adicionada uma seção de prova social demonstrativa após o Hero/demonstração do agente, com exemplos claramente identificados para Clínica, Imobiliária e Prestadora de serviços. Nenhum cliente, depoimento ou métrica foi inventado. As integrações e comportamentos existentes foram preservados.

Commit de merge do HOME-07: `c4f183ab8f1b6a4c31fb4ef858b7729eb79d8506`.

Deployment Vercel de produção: `dpl_3RSRobwsWmpGjL3ekAXYNHpoyB5G`, estado `READY`.

## Regra de execução dos módulos
Para cada módulo:
1. Ler MASTER STATE + HANDOFF + arquivo relevante.
2. Confirmar o arquivo efetivamente usado pela produção.
3. Definir exatamente o escopo.
4. Alterar somente o necessário.
5. Testar.
6. Confirmar produção quando aplicável.
7. Atualizar MASTER STATE/HANDOFF.
8. Só então iniciar o módulo seguinte.

## Regra de conversa
Não criar uma conversa gigante para várias fases. Usar uma conversa por módulo ou por tarefa pequena. O estado oficial permanece no GitHub.
