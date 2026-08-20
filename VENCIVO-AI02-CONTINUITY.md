# VENCIVO — AI-02 CONTINUIDADE

**Última atualização:** 20/08/2026
**Branch:** `feat/ai-02-agent-dashboard` (criada a partir de `main`, nunca mesclada)
**Último commit:** `13339b3` — "feat(ai-02): pagina Meu Agente + link no dashboard existente"
**Commit anterior:** `bd48ce3` — "feat(ai-02): adicionar listagem de documentos do agente (somente leitura)"
**main não foi tocada. Nenhum merge, nenhum force push.**

## Objetivo atual
AI-02 — Dashboard + experiência "Meu Agente", conforme `VENCIVO-MASTER-STATE.md` / `VENCIVO-HANDOFF.md`, sem quebrar AI-01 (Base de Conhecimento / File Search, integrado na `main` em `cc4ce75`).

## Investigação obrigatória feita antes de codar
Antes de qualquer alteração, li os 5 documentos exigidos (MASTER-STATE, HANDOFF, ROADMAP, PROTOCOLO-DE-TRABALHO, CONTEXTO-CONTINUACAO) e examinei o repositório real (não confiei em memória de conversa). Achados relevantes que mudaram o plano original:

1. **`ia.html` (produção) redireciona para `ia-v5.html`**, que é um script que busca `ia-v3.html` via `fetch()` e faz um monkey-patch de texto na função `step2()` antes de renderizar com `document.write()`. O criador de agente "rico" (múltiplos arquivos, personalidade em cards) que foi trabalhado em sessões anteriores **existe apenas em `ia-v4.html`, na branch `feat/ai-01-knowledge-base`, e nunca foi ligado à produção real.** Isso é uma decisão de produto pendente, não uma tarefa técnica — registrado aqui, não decidido nem executado.
2. **`conta.html` já era um dashboard mínimo funcional** (login/cadastro via Supabase, lista `GET /api/agents?mine=1`, assinatura via Asaas). Por isso **evoluí em vez de recriar**, conforme instrução da missão.
3. **`agente.html` é só o widget de chat público de teste** (sem auth, sem identidade/conhecimento/canais).
4. **Não existe `/api/knowledge.js` separado.** Tudo passa por `/api/agents`, multiplexado pelo campo `action` no corpo do POST (`prepare`, `process`, e agora `list`; sem `action` = criar agente). Confirmado lendo o arquivo inteiro, não por suposição.
5. **Não existia nenhuma forma de listar ou remover documentos** de um agente antes desta sessão — só adicionar.
6. `api/agent-chat.js` não persiste histórico de conversa no banco — o histórico só existe no array que o próprio frontend reenvia a cada mensagem. Por isso a página "Meu Agente" mostra "Histórico de conversas ainda não disponível" em vez de inventar um histórico.

## O que já foi concluído (testado no que era possível testar localmente)

### 1. `api/agents.js` — nova ação `list` (commit `bd48ce3`)
Adiciona `action==='list'` ao handler POST existente: lista os documentos (`agent_knowledge`) de um agente, reaproveitando a função `knowledgeAgent()` já existente para checar posse (dono via `owner_id` + Bearer token). **Não altera** `prepare`, `process`, criação de agente, `ensureStore`, `processKnowledge` nem nenhuma linha do mecanismo de File Search/Gemini. Diff de 1 arquivo, aditivo.

- Testado: `node --check api/agents.js` passou (sintaxe válida). `git diff` revisado linha a linha antes do commit — só a nova ação foi adicionada, nada removido/alterado.
- **NÃO testado contra o Supabase/Gemini reais** — não há credenciais neste ambiente. Precisa de teste manual em preview deployment antes de qualquer merge.

### 2. `meu-agente.html` — nova página "Meu Agente" (commit `13339b3`)
Página privada (`?id=<public_id>`), autenticada via Supabase (mesmo padrão de `conta.html`). Seções:
- **Identidade**: nome do agente, empresa, segmento, status, personalidade (lê `GET /api/agents?id=`, que é público — a privacidade real da página vem de exigir login e das checagens de posse nas ações de conhecimento, não deste GET).
- **Conhecimento**: contador/lista de documentos (via nova `action:'list'`, com Bearer token), upload de múltiplos documentos reaproveitando o fluxo `prepare`→PUT→`process` já existente (agora **com** `Authorization: Bearer` — o fluxo antigo em `ia-v4.html` nunca enviava esse header, o que teria falhado com 403 para qualquer agente com `owner_id` definido; corrigido aqui).
- **Atendimento**: link "Testar agente" para `agente.html?id=` (existente, inalterado). Nota explícita: "Histórico de conversas ainda não disponível nesta versão."
- **Canais**: Site (link direto, copiável — real e funcional), Instagram e WhatsApp mostrados como **"Não conectado"**, sem botão de OAuth, sem link fingindo integração ativa (`VENCIVO-MASTER-STATE.md` confirma que ambos permanecem isolados).
- **Remoção de documento**: propositalmente **não implementada** — nota explícita na UI ("A remoção de documentos ainda não está disponível nesta versão"). Motivo técnico: `processKnowledge()` não persiste o `document_name` do Gemini File Search na tabela `agent_knowledge` (só grava um texto marcador), então não há como apagar o lado Gemini com segurança sem alterar essa função — e eu não tenho credenciais Gemini neste ambiente para testar uma chamada nova de delete antes de shippar. Registrei em vez de inventar.

### 3. `conta.html` — link "Gerenciar" (commit `13339b3`)
Cada agente listado ganhou um botão **"Gerenciar"** → `meu-agente.html?id=`, ao lado do botão existente (renomeado de "Abrir" para "Testar", mesmo destino `agente.html?id=`, mesmo comportamento). Nada foi removido.

## Testes executados nesta sessão
- `meu-agente.html` carregada isoladamente no navegador: **zero erros de console**, módulo ES (`import` do Supabase via CDN) executa corretamente, branch "não logado" (mostra tela de login) confirmada via inspeção real do DOM (`classList`), não apenas leitura de texto.
- Funções auxiliares testadas isoladamente: `personalityLabel()` (formatos `{tone,traits,formality}` e `{personality,formality}`) e `fmtSize()` — encontrei e corrigi um bug real: o segundo formato perdia a informação de personalidade antes da correção.
- `conta.html` recarregada: zero erros de console; injeção de dados simulados confirmou que os links `Gerenciar`/`Testar` renderizam com os `href` corretos.
- Sem rolagem horizontal em mobile (375px) em `meu-agente.html`.
- `node --check` em `api/agents.js` (sintaxe válida).

## Testes que NÃO foram executados (limitação real do ambiente, não negligência)
Não tenho credenciais Supabase/Gemini nem acesso ao deployment Vercel real neste ambiente local. Portanto **não testei**:
- login/cadastro reais;
- criação de agente ponta a ponta;
- upload real de documento através da nova página;
- a nova `action:'list'` contra o banco real;
- o teste de regressão obrigatório "Corte Premium VX / R$ 147,00 / VX-8472" do AI-01.

**Isso precisa ser feito manualmente (ou por uma sessão com acesso a preview deployment) antes de qualquer merge em `main`.** Não afirmo que essas partes "funcionam em produção" — só que o código foi revisado, é aditivo e não toca nos arquivos/funções do AI-01 além da adição isolada descrita acima.

## Erros conhecidos / decisões registradas (não resolvidas automaticamente)
1. **`ia-v4.html` nunca foi ligado à produção.** Decisão de produto pendente (trocar `ia.html` para apontar para uma versão nova do criador é uma mudança de roteamento que a missão não autorizou explicitamente — fora do escopo de AI-02).
2. **Remoção de documento** — pendente, motivo técnico registrado acima.
3. `capabilities` do agente (array) e histórico de conversas **não são exibidos** em "Meu Agente" ainda — não inventei UI para eles.
4. Edição de dados do agente (roadmap item 4, "editar dados") **não foi implementada** nesta sessão — só visualização. Precisaria de um novo endpoint PATCH em `api/agents.js`, que não foi criado por prudência de escopo/tempo.

## O que falta (próximos passos, em ordem)
1. **Testar manualmente em ambiente com credenciais reais** (login, criar agente, abrir "Meu Agente", listar/adicionar documento, testar o agente, e confirmar que o teste de regressão do AI-01 — Corte Premium VX / R$ 147,00 / VX-8472 — continua passando).
2. Se os testes passarem: abrir PR de `feat/ai-02-agent-dashboard` para `main` **sem mergear automaticamente** — aguardar revisão humana.
3. Módulo seguinte do roadmap (após "Meu Agente" validado): "editar dados do agente" (precisa de endpoint PATCH novo, cuidado extra por alterar dados existentes) e "histórico/conversas" (precisa decidir se e como persistir histórico — mudança de schema, fora do escopo desta sessão).
4. Decisão de produto pendente (registrar, não resolver sozinho): o que fazer com `ia-v4.html`/`ia-v5.html`/`ia-v3.html` — hoje há três criadores de agente diferentes no repositório e só um está de fato em produção.

## Próximo passo EXATO
Se esta sessão for retomada: rodar os testes manuais listados acima em um ambiente com acesso real ao Supabase/Vercel/Gemini. Se aprovados, abrir o PR (sem merge). Se reprovados, corrigir apenas o que falhar, sem expandir escopo, e atualizar este arquivo com o resultado exato de cada teste antes de tentar de novo.
