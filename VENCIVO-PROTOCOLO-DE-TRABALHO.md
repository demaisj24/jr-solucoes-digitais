# VENCIVO — PROTOCOLO DE TRABALHO

**Data:** 17/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch:** `main`
**Produção:** Vercel `vencivo-ai` → `vencivo.com.br`

## 1. Fonte de verdade

O GitHub é a fonte técnica de verdade do VENCIVO.

Documentos de controle:
- `VENCIVO-MASTER-STATE.md` — estado geral do projeto.
- `VENCIVO-HANDOFF.md` — ponto exato de parada e próximo passo.
- `VENCIVO-ROADMAP.md` — ordem das fases e módulos.
- `CONTEXTO-VENCIVO-CONTINUACAO.md` — contexto histórico relevante.

A conversa do ChatGPT nunca deve ser a única memória de uma decisão ou implementação.

## 2. Organização das conversas

O Projeto `VENCIVO` é o ambiente de trabalho.

Cada conversa deve ter uma missão pequena e clara, preferencialmente um módulo ou tarefa.

Não manter uma conversa gigante cobrindo várias fases.

O título exibido na barra lateral não é fonte de verdade. O estado oficial é determinado pelos documentos do GitHub.

## 3. Início de qualquer sessão

Antes de alterar código:
1. Ler `VENCIVO-MASTER-STATE.md`.
2. Ler `VENCIVO-HANDOFF.md`.
3. Consultar `VENCIVO-ROADMAP.md` quando necessário.
4. Consultar commits recentes quando necessário.
5. Identificar o módulo exato que está autorizado para a sessão.
6. Localizar e ler o arquivo efetivamente usado pela produção.

## 4. Regra de escopo

Uma sessão deve alterar somente o que foi definido para o módulo.

Não aproveitar uma tarefa visual para alterar autenticação, banco, pagamentos, IA ou integrações sem autorização explícita.

Se surgir uma necessidade fora do escopo, registrar como pendência e parar para decisão.

## 5. Preservação

Antes de editar qualquer arquivo, verificar o código atual e suas dependências.

Não reimplementar funcionalidade já existente sem motivo comprovado.

Nesta fase, preservar especialmente:
- login;
- cadastro;
- sessão/autenticação;
- Supabase;
- Asaas;
- checkout;
- Gemini;
- funcionamento dos agentes;
- fluxos funcionais existentes.

## 6. Ciclo de cada módulo

Cada módulo segue este ciclo:

**Definir → Ler → Alterar → Testar → Confirmar → Registrar → Encerrar.**

### Definir
Registrar objetivo e limites.

### Ler
Verificar o estado real do código antes de editar.

### Alterar
Modificar somente o necessário.

### Testar
Testar o comportamento afetado e verificar que funcionalidades protegidas continuam intactas.

### Confirmar
Quando aplicável, confirmar build/deploy/produção.

### Registrar
Atualizar MASTER STATE e HANDOFF com resultado, arquivos, commit, deploy e pendências.

### Encerrar
Não iniciar o próximo módulo na mesma sessão se isso tornar a conversa extensa ou misturar escopos.

## 7. Estados de conclusão

- **PENDENTE:** ainda não iniciado ou falta trabalho.
- **IMPLEMENTADO:** alteração feita, mas ainda não validada completamente.
- **TESTADO:** comportamento validado.
- **CONCLUÍDO:** testado, confirmado e registrado no GitHub.

Somente o estado **CONCLUÍDO** libera o próximo módulo dependente.

## 8. HANDOFF obrigatório

Ao concluir ou interromper uma sessão, registrar:
- data;
- módulo/conversa;
- objetivo;
- o que foi feito;
- o que foi testado;
- resultado;
- erros;
- arquivos alterados;
- commit;
- deploy;
- pendências;
- próximo passo exato;
- itens que não devem ser alterados.

## 9. Segurança de continuidade

Nunca assumir que uma conversa antiga representa o estado atual.

Nunca usar o repositório alternativo `demaisj24/vencivo-your-success-hub` como fonte da produção.

Nunca criar um novo repositório, projeto Supabase, portfólio Meta ou infraestrutura equivalente sem decisão explícita e registro no MASTER STATE.

## 10. Regra para limite de conversa

Se uma conversa ficar grande, não continuar indefinidamente.

Encerrar a sessão, registrar o HANDOFF e abrir nova conversa dentro do Projeto VENCIVO.

A nova conversa deve começar lendo MASTER STATE + HANDOFF e continuar somente do próximo passo.

## 11. Regra de produção

Nenhuma alteração é considerada concluída apenas porque foi escrita no código.

Quando aplicável, deve haver:
- teste;
- commit;
- deploy;
- confirmação de produção;
- atualização da documentação de estado.

## 12. Regra especial — Meta

Enquanto a análise/restrição atual da Meta estiver pendente:
- não criar outro portfólio;
- não remover o portfólio atual;
- não repetir convites;
- não tentar contornar a restrição;
- não tratar a hipótese Aila/e-mail/nome como causa confirmada sem evidência da Meta.

## 13. Regra final

**Uma tarefa por vez. Um escopo por conversa. Um estado oficial no GitHub. Um HANDOFF ao terminar.**
