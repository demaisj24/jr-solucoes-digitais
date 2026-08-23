# VENCIVO — MASTER STATE

**Data de atualização:** 23/08/2026
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`
**Branch de produção:** `main`
**Vercel:** `vencivo-ai`
**Produção:** `vencivo.com.br`

> Fonte resumida e permanente do estado do projeto. Atualizar após cada módulo relevante.

## 1. Produto
Vencivo Atendimento Inteligente / Vencivo AI é um SaaS para criação de agentes de IA personalizados para empresas.

Posicionamento aprovado: não vender como simples chatbot, mas como agente de IA para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano.

Proposta central: o cliente configura o negócio, fornece conhecimento real e cria um agente que responde aos clientes com a personalidade da marca. A evolução planejada inclui atuação nos canais do negócio, especialmente Instagram e WhatsApp, quando as integrações estiverem liberadas e aprovadas.

## 2. Estado técnico atual
### CONCLUÍDO
- Home/HOME-01 a HOME-07 publicados;
- criador de agente;
- empresa/segmento/serviços;
- personalidade selecionável;
- capacidades;
- criação e persistência do agente;
- Supabase;
- Vercel;
- Gemini;
- Base de Conhecimento;
- File Search por agente;
- chat com conhecimento real;
- AI-01 concluído e integrado na `main`;
- SEC-19 — política de privacidade mínima;
- SEC-20 — keepalive do Supabase via GitHub Actions, sem consumir uma função Serverless adicional da Vercel;
- INST-04 — fundação segura do webhook Instagram, integrada na `main`.

### AI-01 — Base de Conhecimento do Agente — CONCLUÍDO
Implementado e validado:
- upload privado de documentos;
- PDF, DOC, DOCX, TXT, MD, CSV e RTF;
- Gemini File Search por agente;
- isolamento por agente/public_id;
- recuperação semântica;
- fallback textual para conhecimento compatível;
- chat utilizando conhecimento real;
- proteção contra exposição de prompt/credenciais;
- regras contra prompt injection em documentos;
- modelo validado: `gemini-3.5-flash-lite`.

Teste real aprovado com:
`Corte Premium VX` / `R$ 147,00` / `VX-8472`.

Testes aprovados:
- preço;
- código;
- serviços/produtos;
- informação inexistente sem invenção;
- prompt injection;
- contexto;
- isolamento funcional;
- upload/indexação/recuperação/resposta.

Integração:
- PR #11 — AI-01 integração final na main;
- merge concluído;
- commit `cc4ce75dfed93285ee2a8b5e4879c920740f88a0`.

**Não reabrir AI-01 sem evidência de regressão.**

### SEC-19 — Privacidade — CONCLUÍDO
- Política mínima publicada em `politica-privacidade.html`;
- canal de contato definido;
- solicitações de acesso/correção/exclusão previstas;
- não registrar segredos no documento.

### SEC-20 — Disponibilidade Supabase — CONCLUÍDO
- keepalive removido das funções Vercel para preservar o orçamento de funções;
- rotina transferida para GitHub Actions;
- execução agendada duas vezes por semana;
- credenciais usadas somente via GitHub Secrets;
- teste de regressão do keepalive criado;
- workflow integrado à `main`.

**Importante:** keepalive não é backup.

### INST-04 — Webhook Instagram — CONCLUÍDO
- GET de verificação Meta;
- HMAC-SHA256 com comparação em tempo constante;
- rejeição de assinatura ausente/inválida;
- limite de payload;
- aceitação somente de eventos `object: instagram`;
- nenhum processamento de IA no webhook de fundação;
- nenhum payload bruto persistido nessa camada;
- comportamento determinístico para duplicatas;
- 15 testes de regressão aprovados.

## 3. Próximo módulo — AI-02
**Objetivo:** transformar o núcleo funcional em produto SaaS utilizável e vendável.

Ordem inicial:
1. Dashboard mínimo pós-criação;
2. listar agentes;
3. abrir/configurar agente;
4. editar dados;
5. visualizar/gerenciar conhecimento;
6. histórico/conversas;
7. teste do agente;
8. medir latência por etapa;
9. streaming quando seguro;
10. Fast Path para perguntas simples quando comprovado por medição.

## 4. Linha paralela — Instagram
INST-04 está concluído, mas o processamento completo de mensagens não deve ser implementado antes da identidade/OAuth estar definida.

Próxima sequência:
1. Instagram Business Login / OAuth;
2. callback real do VENCIVO;
3. troca segura de código por token;
4. persistência de `instagram_connections`;
5. resolução `instagram_user_id → agent_id → owner_id`;
6. idempotência de eventos;
7. processamento de mensagens;
8. resposta via Instagram Send API.

A Meta deve receber somente uma URL de callback que exista e esteja implementada no VENCIVO. Não cadastrar URL inventada.

## 5. Performance
A latência foi identificada como próxima frente técnica, mas não deve quebrar o AI-01.

Medir antes de otimizar:
- tempo total;
- tempo Gemini;
- File Search;
- Supabase;
- primeira resposta percebida;
- erros 429/502/503;
- comportamento sob concorrência.

## 6. Monetização
Depois do AI-02:
- planos finais;
- checkout/assinatura;
- ativação após pagamento;
- limites por plano;
- cancelamento/renovação/inadimplência;
- medição de uso/custo.

## 7. Segurança e produção
Antes de escala maior:
- autenticação;
- RLS/isolamento;
- APIs;
- rate limiting;
- documentos maliciosos/prompt injection;
- segredos;
- testes E2E;
- carga/concurrency;
- monitoramento;
- custos;
- LGPD/termos/políticas;
- SEO/analytics/onboarding;
- PWA/service worker.

## 8. Continuidade, manutenção e backup — REQUISITO PERMANENTE
O sistema deverá terminar acompanhado de um manual que permita a uma pessoa sem conhecimento profundo do desenvolvimento localizar, diagnosticar, corrigir ou recuperar o sistema.

Documento oficial:
`docs/OPERACAO-MANUTENCAO-E-BACKUP.md`

O manual deverá manter:
- mapa do GitHub;
- mapa da Vercel;
- mapa do Supabase;
- tabelas, RLS e Storage;
- integrações externas;
- inventário das variáveis de ambiente sem valores secretos;
- procedimentos de diagnóstico;
- rollback;
- recuperação;
- backup do PostgreSQL;
- backup independente do Storage;
- retenção de backups;
- teste periódico de restauração.

**Regra:** código, banco, Storage e configuração não podem depender de uma única cópia ou de conhecimento informal de uma única pessoa.

Segredos nunca devem ser gravados neste documento ou no Git.

## 9. Estratégia comercial
MVP comercial desejado:
`criar agente → configurar → fornecer conhecimento → testar → escolher plano → pagar → usar`.

Primeira meta: conseguir os primeiros 5 clientes e validar o produto com venda manual antes de escalar aquisição.

## 10. HOME
HOME-01 a HOME-07 concluídos/publicados.
HOME-08 continua separado de `main` até decisão específica.

## 11. Meta técnica
Preservar funcionalidades existentes. Nunca alterar `main` sem análise e aprovação quando o trabalho envolver mudança relevante. Fazer patches localizados, testar e só então integrar.

## 12. Próximo ponto oficial
**AI-02 — Dashboard mínimo + experiência pós-criação do agente.**

A linha Instagram permanece paralela e não deve bloquear a construção do produto principal.

## 13. Referências permanentes
- `VENCIVO-HANDOFF.md`
- `VENCIVO-ROADMAP.md`
- `VENCIVO-PROTOCOLO-DE-TRABALHO.md`
- `VENCIVO-META-INSTAGRAM-HANDOFF-2026-08-18.md`
- `CONTEXTO-VENCIVO-CONTINUACAO.md`
- `VENCIVO-INSTAGRAM-WEBHOOK-CONTINUITY.md`
- `docs/OPERACAO-MANUTENCAO-E-BACKUP.md`
