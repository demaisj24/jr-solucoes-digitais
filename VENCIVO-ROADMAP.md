# VENCIVO — ROADMAP OPERACIONAL

Data: 17/08/2026
Repositório oficial: `demaisj24/jr-solucoes-digitais`
Branch de produção: `main`
Vercel: `vencivo-ai`
Domínio: `vencivo.com.br`

## Objetivo

Organizar o desenvolvimento do VENCIVO em módulos curtos, independentes e rastreáveis, evitando que uma conversa do ChatGPT seja usada como memória técnica do projeto.

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
- [ ] HOME-02 — Header e menu
- [ ] HOME-03 — Entrar / Minha conta / Instalar app / Orçamento
- [ ] HOME-04 — Hero, narrativa, CTAs e benefícios
- [ ] HOME-05 — Demonstração visual/animada do agente
- [ ] HOME-06 — Formulário de contato
- [ ] HOME-07 — Prova social visual com exemplos claramente identificados
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

HOME-01 foi concluído e publicado em produção no commit `7fcc544b4836b267a259067880997b8953d7ebb8`. A alteração foi visual/CSS, sem mudança de lógica funcional.

Próximo módulo: **HOME-02 — Header e menu**.

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

Não criar uma conversa gigante para várias fases. Usar uma conversa por módulo ou por tarefa pequena. Os nomes visuais das conversas podem ser renomeados manualmente no ChatGPT; o estado oficial, porém, permanece no GitHub.
