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

## Próximo passo exato
**HOME-08 — revisão visual final desktop/mobile.**

Objetivo: revisar a Home completa em desktop e mobile, identificar apenas ajustes visuais finais, preservar todos os comportamentos existentes e então congelar a Home v1.

## Itens que não devem ser alterados nesta fase
- login
- cadastro
- sessão/autenticação
- Supabase
- Asaas
- checkout
- Gemini
- funcionamento dos agentes
- WhatsApp/Meta enquanto a análise estiver pendente
- PWA/service worker
- integrações funcionais existentes
