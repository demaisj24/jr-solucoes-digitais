# VENCIVO — DIREÇÃO DE PRODUTO

## 1. Objetivo executivo

Transformar o VENCIVO em um produto comercial claro e funcional, sem sacrificar segurança, estabilidade ou integrações existentes.

A Home deve vender principalmente a ideia de um **agente de IA trabalhando para o negócio**, e não apenas explicar tecnologia.

Mensagem central:

> **Não contrate um chatbot. Crie um agente para o seu negócio.**

Em poucos segundos, o visitante deve entender que o VENCIVO cria um agente que conhece a empresa, atende clientes 24h, qualifica oportunidades e encaminha para a equipe quando necessário.

## 2. Referência visual aprovada

Foi analisada uma referência visual de anúncio mobile de um produto de IA integrado ao WhatsApp.

A referência deve ser usada somente como inspiração estratégica/comercial, não como cópia de marca, texto ou layout.

Elementos a aproveitar:

- impacto imediato;
- benefício concreto antes da explicação técnica;
- agente visualmente trabalhando;
- WhatsApp como contexto comercial quando pertinente;
- demonstração de conversa;
- benefícios empresariais claros;
- CTA forte;
- sensação de produto real em funcionamento.

Direção visual do VENCIVO:

**escuro + tecnológico + limpo + profissional + premium**.

Evitar excesso de neon, poluição visual, animações agressivas e aparência genérica de anúncio de IA.

## 3. Arquitetura desejada da Home v1

1. Header — concluído.
2. Hero — concluído, com evolução futura somente se houver ganho claro.
3. Demonstração visual do agente — HOME-05 concluído.
4. Benefícios comerciais — continuar refinando conforme necessidade.
5. Ensine seu agente sobre sua empresa — oportunidade de evolução visual/comercial.
6. Outras soluções — existente, sem prioridade imediata.
7. Como funciona — existente, podendo evoluir para uma narrativa mais orientada ao produto.
8. Valores — existente, sujeito a decisão comercial posterior.
9. FAQ — existente.
10. Contato/orçamento — HOME-06 pendente.

## 4. Narrativa comercial desejada

A comunicação deve seguir preferencialmente:

**problema/oportunidade → promessa → demonstração → benefícios → ação**

Exemplo da demonstração:

**Cliente pergunta → agente entende → agente responde → agente qualifica → equipe recebe quando necessário.**

A Home não deve depender de explicações técnicas para demonstrar valor.

## 5. Estado atual dos módulos

- HOME-01 — CONCLUÍDO
- HOME-02 — CONCLUÍDO
- HOME-03 — CONCLUÍDO
- HOME-04 — CONCLUÍDO
- HOME-05 — CONCLUÍDO
- HOME-06 — PENDENTE
- HOME-07 — PENDENTE

HOME-06 já foi analisado e aprovado apenas para UX/visual, mas a implementação está temporariamente bloqueada porque o ambiente de edição disponível não permite aplicar patch seguro no `index.html` monolítico sem substituir o arquivo inteiro.

**Não substituir o `index.html` inteiro às cegas.**

## 6. Prioridade imediata

1. Resolver método seguro de edição/patch do código.
2. Executar HOME-06 somente em UX/visual.
3. Depois avaliar HOME-07 e revisão final da Home.
4. Congelar a Home v1.
5. Migrar o foco para o produto SaaS.

## 7. Fases do produto

### Fase A — Home v1

Objetivo: tornar a Home comercialmente clara e pronta para apresentação.

### Fase B — Produto

Validar o fluxo real:

**cadastro → login → dashboard → criação do agente → configuração → conhecimento → teste → publicação/uso**.

### Fase C — Operação

Validar:

**assinatura/pagamento → WhatsApp/integrações → conversas → leads → segurança → testes E2E → lançamento**.

## 8. Segurança e preservação

Alterações visuais não devem alterar lógica funcional sem autorização específica.

Preservar, salvo escopo explicitamente aprovado:

- autenticação;
- Supabase;
- Asaas;
- Gemini;
- WhatsApp/Meta;
- PWA/service worker;
- JavaScript funcional;
- IDs e hrefs existentes;
- fluxos de formulário;
- integrações.

Toda alteração deve seguir:

**Ler → Definir → Alterar → Revisar diff → Testar → Confirmar → Registrar → Encerrar.**

Para arquivos monolíticos, nunca substituir o arquivo inteiro sem revisão explícita do diff.

## 9. Regra de eficiência

O projeto já possui documentação de continuidade suficiente. Não criar planejamento excessivo antes de executar.

Trabalhar em blocos curtos e objetivos:

**análise curta → aprovação → execução → teste → registro → próximo bloco**.

Uma conversa não deve ser usada como memória permanente do projeto. O GitHub é a fonte de continuidade.

## 10. Próximo objetivo

**Destravar e concluir HOME-06 com edição segura.**

Não iniciar HOME-07 antes disso, salvo decisão explícita posterior.
