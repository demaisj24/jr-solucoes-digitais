# VENCIVO — Manual de Operação, Manutenção e Continuidade

> Documento operacional para manter o VENCIVO funcionando, diagnosticar problemas, recuperar o sistema e permitir que outra pessoa consiga assumir a manutenção sem depender do conhecimento informal do desenvolvedor.
>
> **Regra de segurança:** este manual nunca deve conter senhas, tokens, API keys, service-role keys ou outros segredos em texto aberto.

## 1. Objetivo

Ao final da construção do VENCIVO, este documento deverá ser suficiente para responder, de forma prática:

- onde está o código;
- onde está o banco de dados;
- onde estão os arquivos/Storage;
- onde o sistema está publicado;
- quais serviços externos o sistema utiliza;
- quais variáveis de ambiente existem e para que servem;
- onde cada segredo é administrado, sem registrar o valor do segredo;
- como verificar se cada serviço está funcionando;
- como diagnosticar falhas comuns;
- como fazer rollback;
- como restaurar o banco;
- como recuperar arquivos do Storage;
- como recuperar o sistema depois de perda de acesso, erro de deploy ou corrupção;
- como executar a rotina de backup e confirmar que o backup realmente pode ser restaurado.

O manual deve ser compreensível também por uma pessoa sem conhecimento profundo de programação.

## 2. Mapa mestre do sistema

### Código-fonte

- Repositório: `https://github.com/demaisj24/jr-solucoes-digitais`
- Branch de produção: `main`
- Controle de versão: Git/GitHub
- Regra: código de produção deve estar versionado; alterações relevantes devem passar por branch/PR quando aplicável.

### Hospedagem / deploy

- Plataforma: Vercel
- Projeto: `vencivo-ai`
- URL pública atual: `https://vencivo-ai.vercel.app`
- O manual final deverá registrar também a URL do projeto no painel da Vercel e explicar onde consultar deployments, logs, variáveis de ambiente e rollback.

### Banco de dados e autenticação

- Plataforma: Supabase
- Projeto atual: `uxmlmyhiagjefuufanyg`
- URL do projeto: `https://uxmlmyhiagjefuufanyg.supabase.co`
- O manual final deverá registrar o link direto para o projeto no painel do Supabase e o mapa das tabelas, RLS, funções e Storage.

### IA e serviços externos

O manual final deverá possuir uma ficha para cada integração efetivamente usada em produção, contendo:

1. nome do serviço;
2. finalidade;
3. URL do painel;
4. variável(is) de ambiente utilizada(s);
5. onde o segredo é armazenado;
6. como testar a integração;
7. como revogar/rotacionar a credencial;
8. sintomas de falha;
9. procedimento de recuperação.

Exemplos de integrações que já aparecem no projeto ou no planejamento: Vercel, Supabase, Gemini/Google AI, Asaas, WhatsApp/Meta e Instagram/Meta. A lista definitiva deverá ser conferida contra o código real antes da versão final deste manual.

## 3. Regra de segredos

Nunca colocar neste documento:

- `SUPABASE_SERVICE_ROLE_KEY` real;
- `SUPABASE_ANON_KEY`/publishable key quando houver motivo para tratá-la como inventário sensível;
- `GEMINI_API_KEY` real;
- `ASAAS_ACCESS_TOKEN` real;
- `INSTAGRAM_APP_SECRET` real;
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` real;
- senhas;
- tokens de GitHub, Vercel, Meta ou outros serviços.

O manual deverá registrar somente o **nome da variável**, a **finalidade** e o **local seguro onde o valor é administrado**.

Exemplo:

| Variável | Finalidade | Onde administrar | Valor no manual |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | acesso privilegiado do backend | Vercel / GitHub Actions conforme uso | nunca registrar |
| `INSTAGRAM_APP_SECRET` | validar assinatura do webhook | Vercel | nunca registrar |

## 4. Backup — requisito permanente

Backup não é opcional. O objetivo é reduzir ao mínimo o risco de perda do VENCIVO por erro humano, exclusão acidental, falha de serviço, credencial comprometida, corrupção ou alteração incorreta.

### 4.1 Código

O GitHub é a fonte versionada do código, mas não deve ser considerado o único mecanismo de continuidade.

A estratégia final deverá manter pelo menos:

- histórico Git no GitHub;
- proteção da branch `main`;
- possibilidade de rollback para commit estável;
- cópia adicional/espelho do repositório quando a estratégia de continuidade for implementada;
- documentação suficiente para reconstruir o deploy.

### 4.2 Banco Supabase

O backup do banco deverá ser tratado separadamente do código.

A estratégia final deverá prever:

- backup nativo disponível no plano utilizado, quando aplicável;
- backup lógico externo periódico do PostgreSQL;
- armazenamento do backup fora do banco de produção;
- retenção de múltiplas versões;
- identificação por data/hora;
- teste periódico de restauração.

**Importante:** o keepalive do Supabase criado no SEC-20 serve para manter o projeto ativo; ele **não substitui backup**.

### 4.3 Supabase Storage

Arquivos do Storage devem ter estratégia própria.

O manual deverá tratar Storage separadamente porque backup do PostgreSQL não deve ser presumido como backup dos bytes armazenados no Storage.

A estratégia final deverá prever:

- inventário dos buckets;
- backup externo dos arquivos importantes;
- retenção de versões;
- procedimento de restauração;
- teste periódico de restauração.

### 4.4 Configurações e infraestrutura

Também deverão ser preservados, de forma segura e sem expor segredos:

- `vercel.json`;
- workflows do GitHub Actions;
- documentação de deploy;
- esquema SQL/migrations;
- configuração de integrações;
- nomes das variáveis de ambiente;
- domínios e URLs importantes;
- configuração relevante de Supabase;
- configuração relevante de Meta/Instagram/WhatsApp;
- configuração relevante de Asaas.

## 5. Inventário operacional que será completado ao longo da construção

| Item | Onde está | Link | Backup | Como recuperar | Status |
|---|---|---|---|---|---|
| Código | GitHub | repositório acima | Git + cópia adicional | clone/checkout de commit | definido |
| Deploy | Vercel | painel do projeto | configuração versionada + documentação | novo deploy/rollback | pendente de completar |
| Banco | Supabase | projeto acima | a definir/implementar | restauração PostgreSQL | pendente |
| Storage | Supabase | projeto acima | a definir/implementar | restauração de arquivos | pendente |
| Segredos | gestores de ambiente/segredos | não registrar segredo | inventário + rotação | recriar/rotacionar | pendente |
| IA | provedor utilizado | registrar no manual final | conforme integração | trocar/reconfigurar chave | pendente |
| Pagamentos | Asaas | registrar no manual final | configuração/documentação | reconfigurar credencial/webhook | pendente |
| Meta | Instagram/WhatsApp | registrar no manual final | configuração/documentação | reconfigurar App/Webhook | pendente |

## 6. Procedimento básico para uma pessoa leiga

Quando algo parar de funcionar, seguir esta ordem:

1. **Não apagar arquivos nem alterar produção imediatamente.**
2. Abrir o VENCIVO e identificar exatamente o que falhou.
3. Verificar o status do deploy na Vercel.
4. Verificar logs da função/endpoint afetado.
5. Verificar status do Supabase.
6. Verificar se o problema é autenticação, banco, integração externa ou frontend.
7. Consultar o capítulo correspondente deste manual.
8. Se a última alteração causou o problema, identificar o commit/deploy anterior estável.
9. Fazer rollback somente seguindo o procedimento documentado.
10. Registrar o incidente e a solução.

## 7. Checklist de recuperação

### Sistema fora do ar

- [ ] Vercel está operacional?
- [ ] Último deployment está `Ready`?
- [ ] Há erro nos logs?
- [ ] O domínio responde?
- [ ] Supabase está operacional?
- [ ] Variáveis de ambiente estão presentes?
- [ ] Alguma integração externa está indisponível?

### Usuário não consegue entrar

- [ ] Supabase Auth está operacional?
- [ ] Endpoint/página de conta está funcionando?
- [ ] Erro ocorre para todos ou somente um usuário?
- [ ] RLS/policies foram alteradas?
- [ ] Alguma variável pública/configuração foi alterada?

### Agente de IA não responde

- [ ] Backend responde?
- [ ] Banco responde?
- [ ] Conhecimento do agente está disponível?
- [ ] Credencial do provedor de IA está configurada?
- [ ] Há erro de quota/limite?
- [ ] Logs mostram falha de integração?

### Webhook não funciona

- [ ] Endpoint público responde?
- [ ] Segredo/configuração está presente?
- [ ] Assinatura está sendo validada?
- [ ] URL cadastrada no provedor está correta?
- [ ] Logs mostram recebimento?
- [ ] Evento está sendo persistido corretamente?

## 8. Regra de mudança segura

Antes de qualquer mudança relevante:

1. verificar branch atual;
2. verificar `git status`;
3. garantir que não existem alterações locais inesperadas;
4. criar branch específica;
5. executar testes antes da mudança quando possível;
6. alterar somente o escopo necessário;
7. executar testes;
8. revisar `git diff --check`;
9. revisar o diff;
10. registrar a alteração em commit;
11. abrir PR quando aplicável;
12. somente então integrar em `main`.

## 9. Rotina de continuidade

A versão final deste manual deverá incluir uma rotina operacional com pelo menos:

- verificação de saúde do sistema;
- verificação dos últimos deployments;
- verificação do banco;
- verificação dos backups;
- confirmação de que o último backup é legível;
- teste periódico de restauração;
- revisão de segredos e credenciais;
- revisão de integrações externas;
- atualização do inventário quando uma nova tecnologia for adicionada.

## 10. Regra de ouro

**Se somente uma pessoa sabe como recuperar o sistema, a continuidade ainda não está pronta.**

O objetivo deste manual é transformar o conhecimento do projeto em procedimento documentado, versionado e recuperável.

---

## Estado atual — agosto de 2026

- SEC-19 — política de privacidade: concluído.
- SEC-20 — keepalive do Supabase sem criar uma função Vercel adicional: concluído e integrado à `main`.
- INST-04 — fundação segura do webhook Instagram: PR #18 aprovado/mergeado em `main`.
- Manual de manutenção/continuidade: **criado como documento-base; inventário e procedimentos de backup ainda serão completados durante as próximas etapas.**

### Próximos trabalhos relacionados a este documento

1. mapear todas as tabelas e políticas do Supabase;
2. mapear buckets e arquivos críticos do Storage;
3. inventariar todas as variáveis de ambiente sem registrar valores;
4. documentar Vercel, GitHub, Supabase, Asaas, Meta/Instagram/WhatsApp e provedor de IA;
5. implementar backup externo do banco;
6. implementar backup externo do Storage;
7. definir retenção e rotina de testes de restauração;
8. realizar pelo menos um teste real de recuperação antes do lançamento;
9. finalizar este manual com links operacionais e procedimentos passo a passo.
