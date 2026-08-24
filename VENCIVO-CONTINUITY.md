# VENCIVO — CONTINUIDADE MESTRA

> **Checkpoint operacional:** 24/08/2026
> **Objetivo:** permitir retomar o projeto mesmo se a conversa do ChatGPT for encerrada ou apagada.

## Ponto exato de retomada

O VENCIVO está em fase de **hardening, documentação, recuperação e preparação para produção**.

Últimos trabalhos concluídos em `main`:

- HOME-06 — melhoria visual e UX do formulário de contato;
- merge HOME-06: `30d8390031568a2dc2bd3ede570c826f5240b852`;
- checkpoint de continuidade: `d4f4bef8482f95a67bb95ecadccac8e3f62020f4`.

### Correção importante encontrada em 24/08/2026

O AI-02 foi desenvolvido e testado na branch `feat/ai-02-agent-dashboard`, mas **não foi integrado à `main`**.

Evidência:

- PR #12 permanece aberto e em draft;
- branch AI-02 está 2 commits à frente e 2 atrás da `main` no checkpoint;
- arquivos/alterações que ainda não estão em `main`: `meu-agente.html`, link `Gerenciar` em `conta.html`, `action=list` em `api/agents.js` e `tests/ai-02-agent-dashboard.test.js`;
- a branch antiga contém mojibake na mensagem `Agente ? obrigat?rio.` e deve ser reconstruída/limpa antes de integração.

**Não considerar AI-02 concluído em produção até um novo PR limpo ser integrado.**

## Estado resumido

| Área | Estado real |
|---|---|
| Landing/HOME | concluído |
| HOME-06 | integrado |
| AI-01 | concluído |
| Gemini File Search | construído/hardened |
| SEC-14 | fechado |
| SEC-17 | fechado |
| SEC-19 | fechado |
| SEC-20 | fechado |
| INST-04 Instagram webhook | fechado |
| AI-02 | branch/testes existem; **integração em `main` pendente** |
| Manual operacional | OPS-01 em andamento |
| Backup DB | pendente |
| Backup Storage | pendente |
| Restore testado | pendente |
| SEC-21/LGPD | pendente |
| Billing E2E | pendente |
| Lançamento | pendente |

## Ordem atual até o lançamento

1. concluir OPS-01/documentação operacional;
2. reconstruir/integrar AI-02 sobre a `main` atual, sem mojibake;
3. implementar estratégia de backup do Supabase DB;
4. implementar estratégia de backup/retensão do Storage;
5. executar teste real de restore;
6. fechar inventário de infraestrutura/secrets;
7. executar SEC-21/LGPD;
8. auditoria final de autenticação/segurança;
9. validar billing/Asaas;
10. validar IA/File Search em jornada real;
11. validar estágio real do Instagram;
12. rodar E2E completo;
13. deploy/smoke test;
14. liberar primeiro usuário pagante.

## Manual oficial

Documento operacional permanente:

`docs/OPERACAO-MANUTENCAO-E-BACKUP.md`

Deve ser atualizado quando qualquer componente crítico mudar.

## Regra de backup

Keepalive não é backup.

Backup só será considerado confiável quando:

- existir fora do ambiente de produção;
- houver retenção definida;
- sua integridade puder ser verificada;
- uma restauração real em ambiente separado tiver sido concluída com sucesso.

## Segurança

Não registrar valores de segredos no Git. Registrar apenas nomes, finalidade e local de administração.

## Arquivos locais observados no computador anterior

Não adicionar automaticamente ao Git quando voltar ao computador original:

- `dfq`
- `sec14-local.patch`
- `supabase/`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`
- `tests/sec-20-supabase-keepalive.test.js`

Primeiro comparar cada item com `main` e identificar sua finalidade.

## Retomada em qualquer computador

Não é obrigatório ter o repositório clonado para saber o estado. A fonte oficial é o GitHub.

Quando houver acesso local:

```powershell
git checkout main
git pull origin main
git status --short
git log --oneline --decorate -10
```

Depois ler:

```powershell
Get-Content VENCIVO-CONTINUITY.md
Get-Content docs/OPERACAO-MANUTENCAO-E-BACKUP.md
```

## Próximo checkpoint esperado

- OPS-01 integrado;
- AI-02 reconstruído sobre `main` atual e integrado;
- backup/restore iniciado.
