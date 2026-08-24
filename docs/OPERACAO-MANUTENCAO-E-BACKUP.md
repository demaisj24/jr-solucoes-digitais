# VENCIVO — Manual de Operação, Manutenção, Backup e Recuperação

> Documento operacional para manter o VENCIVO funcionando, diagnosticar problemas, recuperar o sistema e permitir que outra pessoa assuma a manutenção sem depender do conhecimento informal do desenvolvedor.
>
> **Regra de segurança:** este manual nunca deve conter senhas, tokens, API keys, service-role keys ou outros segredos em texto aberto.

## 1. Objetivo

Este manual deve responder, de forma prática:

- onde está o código;
- onde o sistema está publicado;
- onde ficam banco, autenticação e arquivos;
- quais serviços externos existem;
- quais variáveis de ambiente são necessárias;
- como testar cada componente;
- como diagnosticar falhas;
- como fazer rollback;
- como executar backup;
- como restaurar banco e Storage;
- como recuperar o sistema após erro humano, perda de acesso ou falha de serviço.

## 2. Mapa mestre do sistema

| Componente | Serviço | Identificação atual | Observação |
|---|---|---|---|
| Código | GitHub | `demaisj24/jr-solucoes-digitais` | `main` é a branch de produção |
| Deploy | Vercel | projeto `vencivo-ai` | funções em `api/` e frontend estático |
| Domínio | Web | `https://vencivo.com.br` | domínio principal documentado no código |
| Preview Vercel | Vercel | `https://vencivo-ai.vercel.app` | usado também na allowlist CORS |
| Banco/Auth/Storage | Supabase | projeto `uxmlmyhiagjefuufanyg` | URL: `https://uxmlmyhiagjefuufanyg.supabase.co` |
| IA | Google Gemini | Gemini API + File Search | chave somente no backend |
| Pagamentos | Asaas | API Asaas | checkout, assinatura e webhook |
| Instagram | Meta | webhook Instagram | fundação INST-04 pronta; processamento completo pendente |
| WhatsApp | Meta | integração em evolução | não considerar concluída sem teste E2E real |

## 3. Arquitetura prática

### Frontend

Arquivos HTML principais na raiz do repositório. Exemplos relevantes:

- `index.html` — landing page;
- `conta.html` — autenticação, dashboard e assinatura;
- `agente.html` — experiência de teste/conversa;
- `ia*.html` — criação/configuração do agente;
- `planos.html` — oferta comercial;
- `politica-privacidade.html`, `termos-de-uso.html` e outras páginas legais;
- `meu-agente.html` — existe na branch AI-02, mas **ainda não está integrada à `main` no checkpoint de 24/08/2026**.

### Backend serverless

A Vercel publica as rotas JavaScript em `api/`. No checkpoint atual, o `vercel.json` configura `maxDuration: 20` para:

- `api/chat.js`;
- `api/agent-chat.js`;
- `api/agents.js`;
- `api/asaas-checkout.js`;
- `api/subscription-cancel.js`;
- `api/webhooks/asaas.js`.

A rota `/api/health` é reescrita para `/health.json`, evitando uma função serverless adicional.

### Disponibilidade do Supabase

Workflow versionado em:

`.github/workflows/supabase-keepalive.yml`

Agenda atual:

- segunda-feira às 09:00 UTC;
- quinta-feira às 09:00 UTC;
- execução manual via `workflow_dispatch`.

Arquitetura oficial do SEC-20:

- GitHub Actions chama diretamente a REST API do Supabase;
- usa `SUPABASE_ANON_KEY`, nunca `SUPABASE_SERVICE_ROLE_KEY`;
- consulta somente `plan_catalog?select=code&active=eq.true&limit=1`;
- não consulta `agents` nem tabelas com dados de usuário;
- a policy `plan_catalog_public_active_select` precisa ser `PERMISSIVE` para conceder a leitura pública pretendida; essa correção é rastreada pela migration `20260824140203_sec20_plan_catalog_public_select_permissive.sql`;
- não cria Vercel Cron nem nova Serverless Function;
- timeouts e falha HTTP são explícitos.

**Keepalive não é backup.** Ele reduz o risco de pausa por inatividade, mas não protege contra perda, corrupção ou exclusão de dados.

## 4. Inventário de variáveis de ambiente

Não registrar valores neste arquivo.

| Variável | Uso | Onde deve existir | Sensível |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | acesso privilegiado do backend ao Supabase | Vercel | SIM |
| `SUPABASE_URL` | URL do Supabase usada pelo keepalive | GitHub Actions | não contém credencial, mas administrar como configuração |
| `SUPABASE_ANON_KEY` | leitura pública mínima do `plan_catalog` no keepalive | GitHub Actions | chave pública de baixo privilégio; não imprimir em logs |
| `GEMINI_API_KEY` | Gemini / File Search | Vercel | SIM |
| `ASAAS_API_KEY` | chamadas à API Asaas | Vercel | SIM |
| `ASAAS_API_URL` | permite fixar sandbox/produção | Vercel | NÃO, mas deve corresponder à chave |
| `ASAAS_WEBHOOK_TOKEN` | autenticação do webhook Asaas | Vercel + configuração do webhook no Asaas | SIM |
| `SITE_URL` | URLs de retorno do checkout | Vercel | NÃO |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | verificação GET do webhook Meta | Vercel + painel Meta | SIM |
| `INSTAGRAM_APP_SECRET` | HMAC-SHA256 dos webhooks Instagram | Vercel | SIM |

### Regras

- segredos nunca em HTML, documentação, issue, commit ou mensagem de log;
- frontend só pode receber chaves públicas adequadas ao navegador;
- usar sempre a credencial de menor privilégio suficiente para a tarefa;
- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser usada em keepalive ou rotina que possa funcionar com chave pública/RLS;
- rotação de segredo deve ser feita no provedor e depois no ambiente de produção;
- após rotação, executar smoke test do fluxo correspondente.

## 5. Integrações e teste rápido

### Supabase

**Finalidade:** banco PostgreSQL, Auth, Storage e RPCs.

Teste operacional:

1. abrir o projeto no painel Supabase;
2. confirmar projeto ativo;
3. verificar Auth;
4. verificar tabelas principais;
5. verificar Storage;
6. executar apenas consultas de leitura durante diagnóstico inicial;
7. verificar o último run de `.github/workflows/supabase-keepalive.yml` quando houver dúvida de disponibilidade.

Sintomas comuns:

- 401/403: sessão, RLS, credencial ou autorização;
- 5xx/timeout: indisponibilidade, função/RPC ou problema de rede;
- agente sem dados: conferir `owner_id`, `public_id`, status e filtros usados pela API.

### Gemini

**Finalidade:** respostas de IA e Gemini File Search.

Verificar:

- `GEMINI_API_KEY` configurada;
- quota e billing do projeto Google;
- criação/acesso ao File Search Store;
- erro 429, 5xx ou timeout nos logs;
- documento realmente indexado antes de culpar o chat.

### Asaas

**Finalidade:** checkout, assinatura, eventos de pagamento e cancelamento.

Configuração importante encontrada no código:

- chave sandbox deve começar com `$aact_hmlg_`;
- chave produção deve começar com `$aact_prod_`;
- sandbox usa `https://api-sandbox.asaas.com/v3`;
- produção usa `https://api.asaas.com/v3`;
- `ASAAS_API_URL` e `ASAAS_API_KEY` devem pertencer ao mesmo ambiente.

Webhook:

- endpoint: `api/webhooks/asaas.js`;
- cabeçalho esperado: `asaas-access-token`;
- token comparado com `ASAAS_WEBHOOK_TOKEN`.

### Instagram

**Finalidade atual:** validar webhook Meta.

A fundação INST-04:

- aceita GET de verificação;
- valida `x-hub-signature-256` com HMAC-SHA256;
- limita payload a 1 MiB;
- aceita somente `object: instagram`;
- não persiste payload bruto;
- não chama Gemini;
- não responde ao cliente final.

**Não considerar mensagens Instagram concluídas.** OAuth/identidade, persistência/idempotência real e envio de resposta ainda são etapas futuras.

## 6. Backup — requisito permanente

### 6.1 Código

Fonte principal: GitHub.

Procedimento mínimo:

- manter `main` versionada;
- usar branches/PRs em mudanças relevantes;
- marcar commits estáveis importantes;
- manter uma cópia/espelho adicional do repositório fora da máquina de desenvolvimento.

Recuperação:

1. localizar último commit estável;
2. criar branch a partir dele;
3. validar diferença contra produção;
4. fazer redeploy/rollback.

### 6.2 Banco PostgreSQL Supabase

**Status atual:** estratégia externa ainda precisa ser implementada e testada.

Requisitos antes do lançamento:

- backup lógico externo periódico;
- arquivo armazenado fora do Supabase de produção;
- múltiplas versões por data/hora;
- retenção definida;
- checksum ou outra verificação de integridade;
- teste de restauração em ambiente separado.

**Regra:** backup só é considerado válido após restauração real bem-sucedida.

### 6.3 Supabase Storage

Storage deve ser tratado separadamente do PostgreSQL.

Requisitos:

- inventariar buckets;
- copiar bytes dos arquivos para destino externo;
- preservar caminho/nome e metadados necessários;
- manter retenção;
- testar restauração de pelo menos um conjunto real de arquivos.

Bucket já identificado no código:

- `vencivo-knowledge` — documentos enviados para conhecimento do agente.

O fluxo atual envia o arquivo ao Storage, processa/indexa no Gemini e tenta apagar o objeto temporário depois. Portanto, a política de backup deve distinguir **arquivos temporários** de **arquivos que realmente precisam de retenção**.

## 7. Plano de Disaster Recovery

### Cenário A — deploy quebrado

1. não editar produção diretamente;
2. identificar último deployment saudável;
3. comparar commit saudável × commit atual;
4. fazer rollback na Vercel ou reverter por Git;
5. executar smoke test.

### Cenário B — banco corrompido/apagado

1. bloquear alterações destrutivas adicionais;
2. registrar horário aproximado do incidente;
3. preservar evidências/logs;
4. restaurar backup em projeto/ambiente separado primeiro;
5. validar tabelas, constraints, RLS e amostra de dados;
6. só então planejar retorno à produção.

### Cenário C — segredo comprometido

1. revogar/rotacionar no provedor;
2. atualizar Vercel/GitHub Secrets conforme uso;
3. redeploy se necessário;
4. verificar logs por uso indevido;
5. testar integração;
6. documentar incidente sem registrar o segredo antigo ou novo.

### Cenário D — perda do Storage

1. parar rotinas que possam sobrescrever caminhos;
2. restaurar arquivos para bucket/ambiente de teste;
3. validar quantidade e amostra de conteúdo;
4. restaurar produção;
5. validar referências no banco.

## 8. Diagnóstico para pessoa não técnica

Quando algo falhar:

1. não apagar nada;
2. identificar qual tela/ação falhou;
3. verificar se `https://vencivo.com.br` abre;
4. verificar último deployment Vercel;
5. verificar Supabase;
6. verificar logs da função correspondente;
7. conferir se o problema começou após um deploy específico;
8. consultar a integração correspondente neste manual;
9. preferir rollback conhecido a alterações aleatórias em produção.

## 9. Segurança operacional

Antes de qualquer mudança relevante:

1. confirmar branch/base;
2. revisar estado atual no GitHub;
3. criar branch específica;
4. alterar somente o escopo necessário;
5. executar testes disponíveis;
6. revisar diff;
7. verificar ausência de segredos;
8. abrir PR;
9. integrar somente após validação.

### Nunca fazer

- colocar service-role key no frontend;
- usar service-role quando uma chave pública/RLS suficiente resolver a mesma tarefa;
- desabilitar autorização apenas para “fazer funcionar”;
- liberar RLS indiscriminadamente;
- copiar payloads com dados de clientes para logs públicos;
- apagar tabelas/buckets durante diagnóstico;
- presumir que keepalive é backup;
- presumir que backup funciona sem teste de restore.

## 10. Estado real dos módulos em 24/08/2026

| Módulo | Estado real em `main` |
|---|---|
| HOME-01 a HOME-07 | concluídos |
| HOME-06 revisado | integrado |
| AI-01 | concluído |
| SEC-19 | concluído |
| SEC-20 | keepalive existente em `main`; reconciliação de menor privilégio em revisão na PR correspondente |
| INST-04 | concluído |
| AI-02 | **ainda não integrado à `main`**; branch `feat/ai-02-agent-dashboard` e PR #12 existem |
| Manual operacional | criado e integrado; deve ser atualizado a cada mudança crítica |
| Backup externo DB | pendente |
| Backup Storage | pendente |
| Restore testado | pendente |
| Inventário de secrets conferido | pendente |
| SEC-21 / LGPD | pendente como conformidade técnica/legal; não requer UX intrusiva |
| E2E comercial | pendente |

### Nota AI-02

Durante a auditoria de continuidade foi encontrado que a branch AI-02 contém o trabalho validado, porém a `main` atual ainda não possui `meu-agente.html` nem a ação `list` correspondente em `api/agents.js`. O PR #12 permanece aberto/draft. Antes de integrar, revisar a branch porque há um texto de erro com mojibake (`Agente ? obrigat?rio.`) na implementação da ação `list`.

## 11. Checklist mínimo pré-lançamento

- [ ] AI-02 integrado de forma limpa e testada;
- [ ] SEC-20 reconciliado na `main` com chave anônima + `plan_catalog`;
- [ ] backup externo do DB implementado;
- [ ] backup/estratégia do Storage implementada;
- [ ] restore real testado;
- [ ] inventário de secrets conferido na Vercel/GitHub;
- [ ] SEC-21/LGPD concluído como requisito técnico/legal;
- [ ] autenticação e recuperação de senha auditadas;
- [ ] checkout Asaas testado em ambiente correto;
- [ ] webhook Asaas testado;
- [ ] IA/File Search testados com conta controlada;
- [ ] Instagram validado no estágio efetivamente liberado;
- [ ] jornada E2E executada;
- [ ] smoke test em produção;
- [ ] logs sem exposição de dados/segredos;
- [ ] primeiro cliente piloto acompanhado.

## 12. Regra de ouro

**Se somente uma pessoa sabe como recuperar o sistema, a continuidade ainda não está pronta.**

Este manual deve ser atualizado toda vez que uma nova integração, variável, banco, bucket, domínio ou procedimento crítico entrar em produção.
