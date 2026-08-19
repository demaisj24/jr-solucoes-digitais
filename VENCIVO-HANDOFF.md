# VENCIVO — HANDOFF OFICIAL

**Data:** 19/08/2026  
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

## Correção aplicada em 19/08/2026
O teste manual revelou dois problemas reais no chat: respostas intermitentes por timeout e respostas com informações não solicitadas misturadas à pergunta atual.

Arquivo alterado:
`api/agent-chat.js`

Commit:
`f399d5c27e71daf60103cddf9e5fec22227dddc1`

Correções:
- histórico enviado ao Gemini reduzido para as últimas 8 mensagens e 1600 caracteres por mensagem;
- limite de saída reduzido para 220 tokens para respostas mais rápidas e objetivas;
- timeout interno ajustado para 18,5 segundos, dentro do `maxDuration` configurado para a função;
- File Search mantido como fonte oficial por agente;
- prompt reforçado para responder somente à pergunta atual;
- perguntas de serviços devem retornar diretamente os serviços encontrados, sem mostrar nome de arquivo ou instrução técnica;
- perguntas de preço devem retornar somente o preço/fato solicitado;
- perguntas sem informação oficial, como endereço não cadastrado, devem receber resposta clara de ausência de informação, sem erro genérico;
- erros 429 da Gemini passaram a retornar mensagem específica de indisponibilidade temporária;
- timeout passou a registrar evidência técnica nos logs.

## Vercel
Deployment da correção:
`dpl_CVKQbXhLSMLCAGhG3bF7V1rSY8nu`

Estado: **READY**.

Branch alias:
`vencivo-ai-git-feat-ai-01-knowledge-base-demaisj-7649s-projects.vercel.app`

Build: **OK**, sem erro de compilação.

## Testes observados
- Criação do agente: **OK**.
- Upload e indexação do `teste2.txt`: **OK**.
- Recuperação de preço do documento: **OK**; o agente retornou `R$ 47,90`.
- Código de teste: **recuperado**, porém respostas anteriores apresentaram instabilidade em algumas requisições.
- Timeout intermitente: **reproduzido no teste manual** e tratado no código.
- Resposta com assunto não solicitado: **reproduzida** e tratada no prompt.
- Build do deployment corrigido: **OK**.

## Próximo teste obrigatório
Usar o deployment atualizado e executar novamente, no mesmo agente/documento:
1. `Quais serviços vocês oferecem?`
2. `Qual é o código de teste VENCIVO?`
3. `Quanto custa o prato especial de teste?`
4. `Qual é o endereço da empresa?`

Critério:
- serviços = itens reais do documento, sem nome de arquivo;
- código = fato existente no documento;
- preço = `R$ 47,90`;
- endereço inexistente = admitir ausência, sem inventar;
- nenhuma resposta deve misturar fatos não solicitados;
- nenhuma requisição deve apresentar timeout/erro genérico durante uma sequência normal de testes.

## Pendências de validação antes do merge
1. Repetir o teste acima no deployment corrigido.
2. Upload real de PDF/DOC/DOCX.
3. Teste de isolamento entre dois agentes.
4. Teste de prompt injection dentro de documento.
5. Teste mobile/desktop da nova experiência.
6. Revisão final do diff antes de qualquer merge em `main`.

## Regra de promoção
Nenhuma alteração desta branch deve ser promovida para `main` até os testes acima passarem e o diff final ser revisado.
