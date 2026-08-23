# VENCIVO — Continuidade: Webhook Instagram

**Task:** `INST-04` — Fundação do webhook Instagram
**Branch:** `feat/instagram-webhook`
**Base:** `main` (commit `9061dd6`)
**Autor desta rodada:** Claude Code (implementador)

## Concluído

- Endpoint `api/instagram-webhook.js`:
  - `GET` — verificação do webhook (`hub.mode`/`hub.verify_token`/`hub.challenge`).
  - `POST` — validação de `X-Hub-Signature-256` (HMAC-SHA256, tempo constante), aceite somente de `object === 'instagram'`, limite de 1 MB, sem processamento definitivo.
  - `dedupeKeyForEntry(entry)` exportada — chave pura/determinística para o INST-05 usar em persistência/idempotência real.
- Testes: `tests/instagram-webhook.test.js` — 15/15 passando com `node --test`.
- Documentação técnica: `docs/INSTAGRAM-WEBHOOK-FOUNDATION.md`.
- Nenhum arquivo de AI-01, AI-02, checkout ou WhatsApp foi alterado.
- Nenhuma tabela criada, nenhum SQL executado, nenhuma variável de produção alterada, nenhum deploy feito.

## Em andamento / pendente

- PR #18 aberto para `main` e pronto para merge após revisão.
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` e `INSTAGRAM_APP_SECRET` **não foram configurados em nenhum ambiente** (nem local, nem Vercel) — isso é esperado nesta tarefa.
- Nada foi cadastrado no App Dashboard da Meta.

## Testes executados

```
node --test tests/instagram-webhook.test.js
# 15 pass, 0 fail
```

`node --check` nos dois arquivos novos: sem erro de sintaxe. Não há lint configurado no repositório (sem `.eslintrc`/`eslint.config.*`), então nenhum lint foi rodado. Não há `package.json`/build no repositório (funções Vercel simples), então nenhum build foi necessário.

## Riscos conhecidos

- `feat/vencivo-instagram-intelligence` é uma branch remota antiga e não integrada, com uma implementação de webhook divergente e alterações fora do escopo (AI-01/agentes). Documentado em `docs/INSTAGRAM-WEBHOOK-FOUNDATION.md`; nenhuma ação tomada sobre ela.
- A fundação OAuth (`feat/instagram-foundation`, PR #13) ainda não está mergeada em `main`. Este webhook não depende dela para funcionar, mas o INST-05 (resolução `instagram_user_id -> agent_id`) vai depender da tabela `instagram_connections` definida naquela branch.

## Próximo passo exato

1. Um humano (ou uma sessão com `gh`/token configurado) abre o PR Draft de `feat/instagram-webhook` para `main` usando o corpo descrito no relatório desta sessão.
2. ChatGPT revisa o diff (`api/instagram-webhook.js`, `tests/instagram-webhook.test.js`, `docs/INSTAGRAM-WEBHOOK-FOUNDATION.md`, este arquivo).
3. Após aprovação: configurar `INSTAGRAM_APP_SECRET` e `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` na Vercel (não nesta tarefa).
4. Só depois disso, cadastrar a URL do webhook (`/api/instagram-webhook`) no App Dashboard da Meta.
5. Iniciar `INST-05` — persistência real (tabela de eventos + `instagram_connections`), idempotência com `dedupeKeyForEntry`, e resolução `instagram_user_id -> agent_id`.
