# VENCIVO — HANDOFF OFICIAL

**Data de atualização:** 18/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch:** `main`
**Produção:** Vercel `vencivo-ai` → `vencivo.com.br`

## Último módulo concluído
**HOME-07 — Prova social visual demonstrativa**

## Resultado
A Home recebeu uma seção de prova social demonstrativa imediatamente após o Hero/demonstração do agente:
1. título `Um agente. Diferentes negócios.`;
2. três exemplos demonstrativos: Clínica, Imobiliária e Prestadora de serviços;
3. identificação explícita de que os exemplos são demonstrativos;
4. nenhum cliente, depoimento ou métrica foi inventado.

## Preservação funcional
- `id="authLink"` preservado.
- `id="installBtn"` preservado.
- `id="menuBtn"` preservado.
- `id="leadForm"` preservado.
- `id="emailBtn"` preservado.
- `id="formMsg"` preservado.
- hrefs existentes preservados.
- WhatsApp/Gmail preservados.
- Supabase/auth preservado.
- PWA/service worker preservado.
- JavaScript funcional preservado.

## Arquivo de aplicação alterado
`index.html`

## Diff final
Comparação de `home-07-prova-social` contra `main` anterior confirmou:
- 1 arquivo alterado: `index.html`;
- nova seção HOME-07;
- ajuste de newline final;
- nenhum backend/integrador alterado.

## Git
- Branch de trabalho: `home-07-prova-social`.
- PR: #5.
- PR mergeado em `main`.
- Commit de merge em produção: `c4f183ab8f1b6a4c31fb4ef858b7729eb79d8506`.

## Testes e produção
Validação estrutural:
- página compilou no Vercel;
- deployment de produção ficou `READY`;
- produção `www.vencivo.com.br` respondeu HTTP 200;
- aliases `vencivo.com.br` e `www.vencivo.com.br` confirmados;
- preview da branch também ficou `READY` e respondeu HTTP 200.

Vercel:
- projeto `vencivo-ai`;
- deployment de produção `dpl_3RSRobwsWmpGjL3ekAXYNHpoyB5G`;
- estado `READY`;
- commit `c4f183ab8f1b6a4c31fb4ef858b7729eb79d8506`.

Limitação: não houve screenshot automatizado neste ambiente; a confirmação visual subjetiva em navegador real continua recomendada para o HOME-08.

## Sessão de 18/08/2026 — ponto de parada atual
**Módulo em andamento: HOME-08 — revisão visual final desktop/mobile.**

### Trabalho realizado na branch `home-08-service-previews`
- Previews interativos da seção `Outras soluções` implementados e testados.
- Cards dos serviços abrem a demonstração somente por clique.
- Hover não abre a demonstração.
- Cursor de mão (`pointer`) nos cards foi corrigido em `service-previews-v2.js`.
- Botão `Instalar app` foi removido do header e movido para o rodapé, preservando `id="installBtn"` e seu JavaScript.
- Texto da área de conhecimento do criador foi atualizado para `Dê conhecimento ao seu agente`.
- A interface ainda aceita somente TXT/Markdown nesta etapa; não foi anunciado suporte a PDF/DOC/DOCX.

### Commits relevantes da sessão
- Correção do cursor dos cards: `d06969d7a6f4a30b68866b272e4a13a39a4de98f`.
- As demais alterações visuais do HOME-08 permanecem na branch `home-08-service-previews` e ainda não foram promovidas para `main`.

### Validação realizada
- Preview da branch validado pelo usuário.
- Cursor de mão nos cards da seção `Outras soluções`: **funcionando**.
- `Instalar app` no final da página: **funcionando visualmente**.
- Nenhuma alteração de backend, Gemini, Supabase, autenticação, pagamentos ou WhatsApp foi feita nesta sessão.

## Próximo módulo técnico planejado — AI-01
**AI-01 — Base de Conhecimento do Agente**

Objetivo preliminar:
- suportar PDF, DOC, DOCX, TXT e Markdown;
- permitir múltiplos documentos por agente;
- armazenar o conhecimento de forma associada ao agente/cliente;
- extrair e normalizar conteúdo corretamente;
- recuperar somente os trechos relevantes durante a conversa;
- integrar a recuperação ao Gemini;
- garantir isolamento de conhecimento entre agentes/clientes;
- permitir substituição/exclusão de documentos;
- testar documentos reais e comportamento ponta a ponta.

### Arquitetura a validar antes de implementar
Foi localizada uma implementação de backend Gemini na branch `feat/vencivo-ai-real-backend`, com `api/chat.js`, `api/health.js`, `GEMINI_API_KEY`, `GEMINI_MODEL` e endpoint `/api/chat`. Essa branch **não é a branch de produção `main`** e não deve ser promovida ou integrada sem validação explícita.

A implementação atual encontrada usa Gemini como modelo de geração e limita o `system_prompt` enviado ao backend a 12.000 caracteres. Portanto, documentos grandes não devem ser simplesmente concatenados no prompt.

A direção técnica a avaliar para AI-01 é uma base de conhecimento/RAG, potencialmente usando o File Search da Gemini API, em vez de colocar documentos inteiros no `system_prompt`. Essa decisão deve ser validada contra a arquitetura real de produção antes de qualquer alteração.

## Próximo passo exato
1. Nova conversa dentro do Projeto VENCIVO.
2. Ler `VENCIVO-MASTER-STATE.md`, este `VENCIVO-HANDOFF.md`, `VENCIVO-ROADMAP.md` e `VENCIVO-PROTOCOLO-DE-TRABALHO.md`.
3. Confirmar a arquitetura efetivamente usada pela produção em `main`.
4. Mapear o fluxo real `ia-v3.html` → criação/salvamento do agente → backend → Gemini.
5. Definir formalmente o escopo de **AI-01 — Base de Conhecimento do Agente** antes de editar código.
6. Não iniciar a implementação de PDF/DOC/DOCX/RAG até essa validação.

## Itens que não devem ser alterados sem autorização específica
- login
- cadastro
- sessão/autenticação
- Supabase
- Asaas
- checkout
- Gemini em produção
- funcionamento dos agentes
- WhatsApp/Meta enquanto a análise estiver pendente
- PWA/service worker
- integrações funcionais existentes
