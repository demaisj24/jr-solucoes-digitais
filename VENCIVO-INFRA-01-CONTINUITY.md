# VENCIVO — Continuidade: INFRA-01 (orçamento de Serverless Functions)

**Branch:** `fix/vercel-function-budget`
**Base:** `main` (commit `e2b91c3`)
**Commit:** `b048a1b`

## Problema
O projeto Vercel `vencivo-ai` está no plano Hobby (limite de 12 Serverless Functions por deployment). `main` já tinha 12 arquivos em `api/`, então qualquer branch que adicionasse uma 13ª função (INST-04, `feat/instagram-foundation`) falhava o deploy com `exceeded_serverless_functions_per_deployment`.

## O que foi feito
- `api/health.js` removido (função trivial, estática, sem dependências, sem consumidor de código — só citada como checklist manual em `DEPLOY-VENCIVO-AI.md`).
- `health.json` criado na raiz com o corpo de resposta idêntico ao antigo handler.
- `vercel.json`: `rewrites` adicionado mapeando `/api/health` → `/health.json`, preservando a URL pública sem criar function nova.
- `api/deployment-status.js` **não foi tocado** — é consumido por `implantacao.html`, `whatsapp-config.html` e `whatsapp-config-v2.html`, e a tarefa veda alterar WhatsApp.

## Evidência empírica (não só teste local)
O push já disparou o Preview Deployment automático real do projeto `vencivo-ai`:
- `deployment id`: `dpl_38G21BMRsZqXcMpb1GDsGQxaSZzT`
- `readyState`: `READY` (antes, com 12 funções: `ERROR` / `exceeded_serverless_functions_per_deployment`)
- `meta.lambdaRuntimeStats`: `{"nodejs":11}`
- Build log lista exatamente 11 arquivos compilados, sem `health.js`.

## Testes executados
```
node --test tests/health-consolidation.test.js
# 7 pass, 0 fail
```
Cobre: remoção de `api/health.js`, contrato exato de `health.json`, regra de rewrite em `vercel.json`, bloco `functions` preservado, `deployment-status.js` sem diff contra `main`, contagem de 11 arquivos de função, e as 3 páginas consumidoras de `/api/deployment-status` sem diff contra `main`.

## Não verificado nesta sessão
Não confirmei o corpo HTTP real de `/api/health` (200 + JSON) contra o preview, porque os deployments deste projeto têm Vercel Authentication (SSO) habilitada e a instrução desta tarefa foi não tentar contornar proteção/autenticação. A leitura via `get_deployment`/build logs prova a contagem de funções e o sucesso do build, mas não o corpo da resposta.

## Próximo passo exato
1. Confirmar manualmente (usuário logado no navegador) que `GET /api/health` no preview `vencivo-ai-git-fix-vercel-functio-6e11ce-demaisj-7649s-projects.vercel.app` retorna `200` com `{"ok":true,"service":"vencivo-ai","model":"gemini-3.1-flash-lite"}`.
2. Após aprovação do ChatGPT: merge de `fix/vercel-function-budget` em `main` **antes** de tentar mergear `feat/instagram-webhook` (INST-04) ou `feat/instagram-foundation`, para que `main` fique em 11 funções e o webhook (12ª) caiba no limite Hobby.
3. Nenhuma alteração de código do INST-04 foi necessária nem feita.
