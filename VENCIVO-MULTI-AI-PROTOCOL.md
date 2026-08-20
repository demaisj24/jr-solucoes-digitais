# VENCIVO — PROTOCOLO MULTI-IA

## 1. Fonte oficial

- Repositório: `demaisj24/jr-solucoes-digitais`
- Produção: `main`
- Nenhuma IA deve considerar arquivos locais, conversas ou protótipos como fonte superior ao estado oficial do GitHub.

## 2. Papéis

### ChatGPT — arquitetura e revisão
- definir escopo e contratos;
- revisar arquitetura, segurança, UX, custos e regressões;
- revisar diffs e PRs;
- definir critérios de aceite;
- decidir se uma tarefa está pronta para integração.

### Claude Code — implementação e testes
- explorar o código real;
- implementar tarefas delimitadas;
- executar testes;
- corrigir erros próprios;
- documentar decisões;
- trabalhar somente na branch da tarefa;
- abrir PR Draft quando solicitado.

### Dono do produto
- aprovar decisões de produto, preço, posicionamento e mudanças relevantes de UX.

## 3. Regra de ouro

Nenhuma IA altera `main` diretamente.

Nenhuma IA faz merge automaticamente em `main`.

Nenhuma IA deve alterar uma segunda frente enquanto a primeira ainda está sem gate de aceite.

## 4. Cada tarefa deve conter

- TASK ID;
- objetivo;
- contexto;
- arquivos/áreas permitidos;
- áreas proibidas;
- contratos e dependências;
- critérios de aceite;
- testes obrigatórios;
- riscos conhecidos;
- condição de parada.

## 5. Ciclo de revisão cruzada

1. ChatGPT define a tarefa e critérios.
2. Claude implementa em branch isolada.
3. Claude executa testes e cria/atualiza PR Draft.
4. ChatGPT revisa diff, arquitetura, segurança e regressão.
5. Se houver problema, ChatGPT devolve uma lista objetiva de correções.
6. Claude corrige somente os itens solicitados.
7. ChatGPT revisa novamente.
8. Teste real é executado.
9. Somente depois do gate aprovado o PR pode ser integrado.

Uma IA nunca deve ser a única responsável por aprovar o próprio código.

## 6. Segurança

Nunca:

- colocar secrets no frontend;
- expor access tokens;
- desabilitar RLS para facilitar desenvolvimento;
- usar service role no navegador;
- confiar em `agent_id` sem validar propriedade;
- aceitar webhook sem validar autenticidade;
- ignorar idempotência em eventos externos;
- criar integrações falsas;
- alterar produção para testar uma hipótese;
- fazer force push.

## 7. VENCIVO Instagram-first

O canal prioritário é Instagram.

Escopo principal:

- Business Login for Instagram;
- Direct;
- comentários;
- webhooks;
- contexto da conversa;
- agente especialista;
- qualificação;
- leads;
- transferência humana.

WhatsApp está fora do MVP atual e não deve receber novas implementações nesta frente.

## 8. V4 visual

`ia-v4.html` é a referência visual aprovada pelo dono do produto.

Não criar `ia-v6`, `ia-v7` ou versões paralelas como solução de evolução sem decisão explícita. Evoluir a experiência existente e preservar a linguagem visual aprovada.

## 9. AI-01

AI-01 — conhecimento/File Search — está funcional e deve ser tratado como área protegida.

Teste de regressão conhecido:
- Produto: Corte Premium VX
- Preço: R$ 147,00
- Código: VX-8472

Qualquer mudança no motor de conhecimento deve executar esse teste antes de integração.

## 10. Estado e continuidade

Toda tarefa longa deve manter um arquivo de continuidade quando apropriado.

O arquivo deve registrar:
- branch;
- último commit;
- concluído;
- em andamento;
- pendências;
- testes;
- riscos;
- próximo passo exato.

## 11. Critério de conclusão

"Build passou" não é suficiente.

Uma tarefa só está concluída quando os critérios funcionais, de segurança, UX e regressão definidos para ela estiverem comprovados.

## 12. Regra de eficiência

Evitar retrabalho.

Antes de criar um arquivo novo, verificar se existe implementação equivalente.

Antes de alterar uma API, identificar seus consumidores.

Antes de alterar banco, identificar tabelas, RLS e dependências.

Antes de implementar integração externa, validar contrato oficial, permissões, custos e limitações.

Trabalhar em incrementos pequenos e reversíveis.
