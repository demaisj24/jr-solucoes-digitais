# VENCIVO — CONTINUIDADE MESTRA

> **Checkpoint operacional:** 23/08/2026
> **Objetivo:** permitir retomar o projeto mesmo se a conversa do ChatGPT for encerrada ou apagada.

## Ponto exato de retomada

O VENCIVO está em fase de **hardening, documentação e preparação para produção**. O HOME-06 foi concluído, publicado e integrado à `main`.

Último trabalho concluído:
- HOME-06 — melhoria visual e UX do formulário de contato.
- Commit de feature: `58f9745`.
- PR integrado à `main`: merge `30d8390031568a2dc2bd3ede570c826f5240b852`.
- Branch de trabalho: `feat/home-06-contact-form`.

**Próxima ação:** auditar o estado mestre do projeto e continuar os gates de produção, começando pela documentação/continuidade e depois pelos gates de backup, recuperação, LGPD e lançamento.

## O que já foi construído / fechado

| Área | Estado | Evidência / observação |
|---|---|---|
| Landing page / HOME | CONCLUÍDO | `index.html` em produção de código; HOME-06 integrado na `main`. |
| HOME-06 formulário | CONCLUÍDO | Melhorias de labels, campos, responsividade, CTA WhatsApp/e-mail e nota informativa. |
| Dashboard / Meu Agente | CONCLUÍDO | `meu-agente.html` e integração com dashboard existentes. |
| AI-02 listagem de documentos | CONCLUÍDO | Listagem segura de metadados, sem retornar conteúdo dos documentos. |
| Gemini File Search | CONSTRUÍDO + HARDENING | Criação de store e processamento isolados em funções protegidas. |
| SEC-14 | FECHADO | Rate limits, gates de processamento e proteções de File Search testados. |
| SEC-17 tenant isolation | FECHADO | Rotas de knowledge exigem autenticação e proprietário do agente. |
| Instagram webhook | TESTADO | Suite com 15 testes passou; assinatura, verify token, payload inválido, duplicidade e limites cobertos. |
| SEC-20 Supabase Keepalive | FECHADO | Keepalive validado; não substitui backup. |
| Documentação de manutenção | EM ANDAMENTO | Deve ser consolidada no repositório e mantida junto do sistema. |

## O que ainda falta antes do lançamento ao usuário final

| Gate | O que fazer | Status |
|---|---|---|
| 1. Documentação mestre | Consolidar arquitetura, deploy, manutenção, troubleshooting e continuidade. | PRÓXIMO |
| 2. Backup do Supabase DB | Definir backup confiável e procedimento operacional. | PENDENTE |
| 3. Backup do Storage | Garantir estratégia para arquivos/documentos enviados. | PENDENTE |
| 4. Disaster Recovery | Fazer restauração real/testada; não considerar backup confiável sem restore testado. | PENDENTE |
| 5. Inventário de infraestrutura/secrets | Mapear Supabase, Vercel, Gemini, Instagram e secrets necessários, sem registrar valores secretos. | PENDENTE |
| 6. LGPD / SEC-21 | Inventariar dados pessoais, fluxos, retenção, exclusão/correção/exportação e auditoria. | PRÓXIMO BLOCO |
| 7. Autenticação final | Auditoria de credenciais, senhas fracas, recuperação e proteção de sessão para produção. | PENDENTE / AUDITORIA FINAL |
| 8. Billing/assinaturas | Validar fluxo comercial, plano, pagamento, status de assinatura e bloqueios. | PENDENTE |
| 9. IA em produção | Validar criação do agente, conhecimento, consultas, limites, erros e custos reais. | PENDENTE |
| 10. Instagram em produção | Validar configuração real, webhook, assinatura, idempotência e tratamento de falhas. | PENDENTE |
| 11. E2E | Testar jornada completa: cadastro → agente → conhecimento → uso → cobrança → operação. | PENDENTE |
| 12. Segurança final | Revisar autorização, tenant isolation, rate limits, exposição de secrets, CORS, uploads e abuso. | PENDENTE |
| 13. Observabilidade | Garantir logs úteis, erros rastreáveis e métricas mínimas sem vazar dados sensíveis. | PENDENTE |
| 14. Deploy/produção | Validar variáveis, domínio, HTTPS, funções serverless, Supabase e Vercel. | PENDENTE |
| 15. Smoke test de produção | Executar testes reais com uma conta de teste e dados controlados. | PENDENTE |
| 16. Lançamento | Liberar para primeiro usuário pagante e acompanhar operação. | ÚLTIMO GATE |

## Ordem recomendada até começar a ganhar dinheiro

1. Fechar documentação e continuidade.
2. Fechar backup + restore do Supabase DB e Storage.
3. Fazer inventário de infraestrutura e secrets.
4. Executar SEC-21/LGPD.
5. Auditoria final de autenticação e segurança.
6. Validar billing/assinatura e limites comerciais.
7. Validar IA/File Search com dados reais controlados.
8. Validar Instagram em ambiente real.
9. Rodar E2E completo.
10. Fazer deploy/smoke test de produção.
11. Abrir para o primeiro usuário pagante.
12. Corrigir apenas problemas bloqueadores encontrados no uso real.
13. Começar aquisição/vendas enquanto a operação inicial é monitorada.

## Regra de conclusão

O VENCIVO **não deve ser considerado terminado apenas porque os testes unitários passam**. Para lançamento, todos os gates críticos precisam estar validados: segurança, autorização/tenant isolation, IA, integrações, backup/restore, LGPD, billing, deploy e jornada E2E.

## Arquivos locais não rastreados no checkpoint anterior

Não adicionar automaticamente ao Git. Primeiro determinar a finalidade de cada item:

- `dfq`
- `sec14-local.patch`
- `supabase/`
- `tests/sec-14-document-idempotency.test.js`
- `tests/sec-14-ensure-store-cas.test.js`
- `tests/sec-20-supabase-keepalive.test.js`

## Comandos úteis para retomada

```powershell
git checkout main
git pull origin main
git status --short
git log --oneline --decorate -10
```

Depois verificar este arquivo:

```powershell
Get-Content VENCIVO-CONTINUITY.md
```

## Princípio operacional

Não apagar, sobrescrever ou incorporar artefatos de segurança sem antes identificar a origem e comparar com `main`. Cada gate deve terminar com evidência: teste, revisão, commit/PR ou procedimento documentado.

**Próximo checkpoint esperado:** após concluir o bloco de documentação/backup/restore e iniciar SEC-21.
