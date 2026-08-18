# VENCIVO — HANDOFF OFICIAL

**Data:** 18/08/2026  
**Repositório:** `demaisj24/jr-solucoes-digitais`  
**Produção:** Vercel `vencivo-ai` → `vencivo.com.br`

## Estado
HOME-07 está concluído em `main`. HOME-08 permanece separado e não foi promovido nesta sessão.

## Módulo atual
**AI-01 — Base de Conhecimento do Agente**

Estado: **IMPLEMENTAÇÃO EM BRANCH / VALIDAÇÃO TÉCNICA**.

Branch:
`feat/ai-01-knowledge-base`

`main` não foi alterada.

## Arquitetura real confirmada
`ia-v3.html → /api/agents → Supabase (agents + agent_knowledge) → /api/agent-chat → Gemini`.

Schema confirmado:
- `agents.knowledge_store_name` foi adicionado para identificar a base File Search do agente.
- `agent_knowledge` continua relacionado por `agent_id`.
- RLS existente de `agents` e `agent_knowledge` permanece preservado.

## Implementação realizada na branch
- Nova experiência `ia-v4.html`, inspirada no visual de referência fornecido pelo usuário: dark premium, gradientes, cards, builder + chat, responsivo e foco em demonstração.
- `ia-v3.html` redireciona para `ia-v4.html`, preservando links antigos.
- Upload de PDF, DOC, DOCX, TXT, MD, CSV e RTF.
- Upload direto para bucket privado `vencivo-knowledge` via URL assinada, evitando o limite de payload das Serverless Functions.
- Indexação no Gemini File Search com um store separado por agente.
- Recuperação semântica integrada ao `/api/agent-chat`.
- Conhecimento legado em `agent_knowledge` continua como fallback.
- Endpoint legado `api/chat.js` foi removido da branch e sua configuração retirada de `vercel.json`, porque não faz parte do fluxo atual de agentes e excedia o limite de Serverless Functions do plano Hobby.

## Banco / infraestrutura
Migration aplicada no projeto Supabase:
- `agents.knowledge_store_name` (`text`)
- bucket privado `vencivo-knowledge`
- limite de armazenamento por arquivo: 50 MB

## Vercel
Preview da branch chegou a `READY` após corrigir o limite de 12 Serverless Functions do plano Hobby.
Deployment de validação atual:
`dpl_GKJxd4QhQeaAtfr4Fq6qtHQcGDow`

Build concluído sem erro.

## Testes realizados
- Build Vercel: **OK**.
- Limite de funções: **corrigido**; preview atual `READY`.
- Schema Supabase: **confirmado**.
- Bucket privado: **confirmado**.
- Produção: sem runtime errors nas últimas 2 horas verificadas.

## Pendências de validação antes do merge
1. Teste ponta a ponta de criação de agente.
2. Upload real de TXT/MD.
3. Upload real de PDF/DOC/DOCX.
4. Indexação real no Gemini File Search.
5. Pergunta baseada no documento e confirmação de recuperação semântica.
6. Teste de isolamento entre dois agentes.
7. Teste de prompt injection dentro de documento.
8. Teste mobile/desktop da nova experiência.
9. Revisão final do diff antes de qualquer merge em `main`.

## Regra de promoção
Nenhuma alteração desta branch deve ser promovida para `main` até os testes acima passarem e o diff final ser revisado.
