# VENCIVO — VISÃO OFICIAL DO PRODUTO

**Data:** 18/08/2026  
**Repositório oficial:** `demaisj24/jr-solucoes-digitais`  
**Branch de produção:** `main`  
**Vercel:** `vencivo-ai`  
**Produção:** `vencivo.com.br`

> Documento de direção de produto. Define a visão do VENCIVO e orienta a evolução do SaaS. Não autoriza, por si só, alterações de código em produção.

---

## 1. Decisão de produto

O produto continua se chamando **VENCIVO**.

Não haverá uma nova marca para a nova fase. A infraestrutura, domínio, identidade, conta, agentes, autenticação, Supabase, Gemini, Asaas, PWA e demais ativos já construídos serão reaproveitados sempre que tecnicamente adequado.

A visão evolui de:

> **agente de IA isolado**

para:

> **funcionário digital do negócio.**

O agente continua sendo uma parte importante do VENCIVO, mas deixa de ser apresentado como o produto inteiro.

---

## 2. Promessa central

### **Seu negócio continua funcionando. O VENCIVO cuida do trabalho repetitivo, encontra oportunidades e avisa quando você precisa decidir.**

O VENCIVO deve produzir três sensações no usuário:

1. **Ganhei dinheiro.**
2. **Economizei tempo.**
3. **Reduzi uma dor que eu tinha todos os dias.**

A tecnologia deve ficar em segundo plano. O cliente não precisa entender IA, RAG, agentes, prompts ou automações para perceber valor.

---

## 3. Princípio de experiência

O usuário deve conseguir entrar, testar e compreender o valor do VENCIVO visualmente antes de comprar.

A experiência deve responder rapidamente:

- O que o VENCIVO encontrou?
- O que ele fez?
- Quanto dinheiro pode gerar ou preservar?
- Quanto tempo pode economizar?
- O que ainda precisa de uma decisão humana?

A métrica principal da experiência não é quantidade de funcionalidades.

É **valor percebido em poucos minutos**.

---

## 4. Conceito: AUTOPILOT

O núcleo estratégico do VENCIVO será o **VENCIVO Autopilot**.

O usuário não deve precisar aprender a criar automações complexas.

Ele poderá definir uma intenção como:

> “Não deixe nenhum orçamento sem acompanhamento.”

> “Cuide dos meus clientes que estão deixando de voltar.”

> “Toda segunda-feira me mostre o que aconteceu na empresa.”

> “Avise quando alguma despesa fugir muito do normal.”

O VENCIVO deverá transformar essas intenções em processos configuráveis.

### Modelo mental

**Observar → Entender → Priorizar → Sugerir/Executar → Medir**

---

## 5. Níveis de autonomia

O VENCIVO deverá trabalhar com três níveis de autonomia.

### Nível 1 — Observar

Lê dados e identifica situações relevantes, sem executar ações.

### Nível 2 — Sugerir

Apresenta uma ação recomendada e aguarda aprovação humana.

### Nível 3 — Executar

Depois de uma regra/autorização explícita, executa automaticamente ações permitidas.

A autonomia deve aumentar conforme o usuário ganha confiança no sistema.

---

## 6. O que o VENCIVO deve encontrar

A V1 não precisa resolver tudo. O motor deve começar procurando situações que tenham relação clara com dinheiro, tempo ou risco operacional.

Exemplos:

### Receita em risco
- clientes recorrentes que não retornaram;
- oportunidades comerciais paradas;
- orçamentos sem acompanhamento;
- horários ou capacidade ociosa, quando houver dados;
- quedas relevantes de recorrência.

### Dinheiro
- despesas fora do padrão;
- serviços/produtos com comportamento anormal;
- oportunidades de receita não acompanhadas;
- valores que exigem atenção.

### Tempo
- tarefas repetitivas;
- relatórios recorrentes;
- conferências manuais;
- rotinas que podem ser automatizadas.

### Operação
- tarefas pendentes;
- eventos importantes;
- situações fora das regras definidas pelo negócio.

O VENCIVO não deve apresentar uma lista infinita de alertas. Deve priorizar poucas situações de alto valor.

---

## 7. Resultado antes da tecnologia

A tela principal deve priorizar resultados.

Exemplo conceitual:

### Hoje o VENCIVO trabalhou enquanto você cuidava do negócio

**R$ 8.420**  
Oportunidades identificadas

**R$ 3.280**  
Receita em risco

**6h 20min**  
Tempo potencialmente economizado

**31**  
Ações executadas

### Você precisa decidir apenas 3 coisas

1. Aprovar orçamento de R$ 8.900.
2. Revisar cliente importante sem retorno.
3. Conferir despesa 27% acima do padrão.

> Os números acima são exemplos de interface e não representam resultados reais de clientes.

---

## 8. Regra de transparência de resultados

O VENCIVO nunca deve apresentar estimativa como dinheiro efetivamente recuperado.

Toda métrica deverá ser classificada quando necessário como:

- **Confirmado** — resultado observado no sistema.
- **Estimado** — cálculo baseado nos dados disponíveis.
- **Potencial** — oportunidade identificada, ainda não realizada.

Isso é obrigatório para preservar confiança comercial.

---

## 9. Entrada de dados

A estratégia inicial é evitar exigir que o cliente abandone seus sistemas atuais.

Primeiras fontes possíveis:

- Excel;
- CSV;
- Google Sheets;
- dados cadastrados dentro do próprio VENCIVO;
- documentos e informações fornecidos pelo cliente.

Integrações específicas serão adicionadas depois de validar demanda e economia de implantação.

### Princípio

> **O cliente já tem os dados. O VENCIVO deve trabalhar sobre eles.**

Não devemos começar obrigando o cliente a cadastrar manualmente centenas de registros.

---

## 10. IA

Gemini continuará sendo parte da infraestrutura de IA já existente, mas não será usado indiscriminadamente.

### Regra

- regra determinística quando código resolve;
- cálculo quando matemática resolve;
- classificação simples quando algoritmo resolve;
- Gemini quando interpretação, contexto, priorização ou linguagem realmente agregarem valor.

A IA é infraestrutura do VENCIVO, não o produto que o cliente compra.

---

## 11. Agente de IA existente

O agente de IA já construído não será descartado.

Ele será reposicionado como um dos componentes do **funcionário digital**.

O usuário poderá configurar, conforme a capacidade de cada fase:

- nome do agente;
- função;
- conhecimento;
- regras;
- permissões;
- ações que exigem aprovação;
- ações que podem ser automáticas.

A evolução deve preservar o que já funciona e ampliar a capacidade de ação gradualmente.

---

## 12. WhatsApp

WhatsApp não será tratado como o produto inteiro.

Enquanto a situação da Meta permanecer pendente, não haverá tentativa de contornar restrições ou criar nova infraestrutura fora das regras já registradas no MASTER STATE.

Quando retomado, WhatsApp será tratado como **canal de execução/comunicação**, e não como o cérebro do VENCIVO.

A arquitetura do produto deve continuar útil mesmo sem WhatsApp.

Isso reduz dependência de fornecedor e protege a economia do SaaS.

---

## 13. Experiência “uau”

A Home e o produto deverão permitir uma demonstração visual.

Exemplo:

1. usuário escolhe um tipo de negócio;
2. VENCIVO apresenta uma empresa demonstrativa;
3. dados simulados são analisados;
4. oportunidades aparecem em tempo real;
5. o usuário pode abrir cada descoberta;
6. o sistema mostra o que poderia automatizar;
7. mostra o possível impacto em dinheiro/tempo;
8. apresenta a criação do funcionário digital.

A demonstração deve deixar claro que os dados são demonstrativos.

Não serão usados depoimentos, clientes, números ou resultados inventados como se fossem reais.

---

## 14. Público inicial

O VENCIVO deve poder atender diferentes negócios, mas o desenvolvimento inicial precisa começar com casos simples e generalizáveis.

Possíveis perfis:

- barbearias e salões;
- clínicas e estética, respeitando requisitos específicos de privacidade;
- oficinas e serviços técnicos;
- prestadores de serviço;
- pequenas empresas comerciais;
- empresas B2B.

A expansão para operações maiores deverá ocorrer pela mesma base tecnológica, adicionando dados, permissões, integrações e governança, não criando um produto diferente para cada segmento.

---

## 15. Modelo comercial preliminar

O objetivo é manter a compra simples: **somente dois planos**.

Os valores abaixo são uma hipótese comercial inicial e deverão ser confirmados antes do lançamento.

### VENCIVO Essencial — R$ 89,90/mês

Para pequenos negócios.

Foco:
- funcionário digital básico;
- análise do negócio;
- oportunidades e alertas;
- automações essenciais;
- relatórios;
- conhecimento do negócio;
- uso dentro da plataforma.

### VENCIVO Pro — R$ 189,90/mês

Para negócios com maior volume e necessidade de automação.

Foco:
- tudo do Essencial;
- mais automações;
- maior volume de dados;
- mais ações automáticas;
- recursos avançados de gestão;
- equipe/permissões conforme a arquitetura validada;
- integrações adicionais conforme disponibilidade.

> Os preços são hipótese de produto, não promessa de margem. Antes do lançamento, custo de IA, infraestrutura, canais externos e limites de uso deverão ser recalculados.

---

## 16. Regra econômica

O VENCIVO não deve assumir custos variáveis ilimitados dentro de uma assinatura fixa.

Especialmente:

- mensagens de terceiros;
- SMS;
- voz;
- APIs tarifadas por unidade de uso;
- serviços externos com cobrança proporcional ao volume.

Quando houver custo variável significativo, deverá existir uma destas soluções:

1. limite de uso por plano;
2. custo repassado ao cliente;
3. módulo adicional;
4. cobrança específica por uso;
5. arquitetura alternativa com custo previsível.

O preço de R$89,90 só será mantido se a economia unitária continuar saudável.

---

## 17. Métrica principal do produto

A métrica mais importante será:

# **Valor gerado por cliente por mês**

O VENCIVO deverá tentar demonstrar:

- dinheiro recuperado;
- dinheiro preservado;
- oportunidades encontradas;
- tempo economizado;
- tarefas executadas;
- problemas evitados.

O objetivo é que o cliente consiga responder:

> **“Quanto o VENCIVO valeu para minha empresa este mês?”**

---

## 18. MVP — primeiro núcleo

O MVP não será “automatizar a empresa inteira”.

O primeiro núcleo deverá fazer muito bem:

### 1. Importar
Receber dados simples.

### 2. Entender
Normalizar e interpretar a estrutura.

### 3. Detectar
Encontrar oportunidades, riscos e tarefas repetitivas.

### 4. Explicar
Mostrar por que aquilo importa.

### 5. Sugerir
Propor a ação.

### 6. Executar
Executar somente ações autorizadas.

### 7. Medir
Registrar o resultado.

Esse ciclo é o coração do VENCIVO.

---

## 19. O que não entra no primeiro MVP

Não tentar construir imediatamente:

- ERP completo;
- CRM completo;
- contabilidade;
- emissão fiscal;
- prontuário médico;
- sistema próprio de agenda para todos os nichos;
- dezenas de integrações;
- automação irrestrita de WhatsApp;
- agente totalmente autônomo sem aprovação;
- infraestrutura enterprise completa.

Esses itens poderão entrar posteriormente se houver justificativa econômica e técnica.

---

## 20. Segurança e autonomia

Nenhuma ação de alto impacto deverá ser executada apenas porque a IA “acha” que deve.

A arquitetura deverá separar:

- leitura;
- recomendação;
- autorização;
- execução;
- auditoria.

Toda automação importante deverá ter rastreabilidade suficiente para saber:

- o que aconteceu;
- qual regra acionou;
- qual decisão foi tomada;
- qual ação foi executada;
- quando ocorreu;
- qual resultado foi produzido.

Dados de diferentes clientes/agentes devem permanecer isolados.

---

## 21. Reaproveitamento do VENCIVO existente

A evolução deve aproveitar o máximo possível do que já foi construído:

- domínio;
- frontend;
- identidade visual;
- autenticação;
- conta do usuário;
- Supabase;
- Gemini;
- agentes;
- conhecimento;
- Asaas;
- checkout recorrente;
- Pix;
- Resend;
- PWA;
- componentes da Home;
- experiência de criação de agente;
- estrutura existente de backend quando validada.

Não reescrever componentes existentes sem necessidade comprovada.

---

## 22. Ordem de evolução

A direção do produto passa a ser:

**HOME final → Base de conhecimento → Motor de inteligência → Autopilot → Ações → Medição de valor → Integrações → Segurança → Testes → Lançamento.**

A ordem técnica oficial continua subordinada ao MASTER STATE, HANDOFF, ROADMAP e PROTOCOLO. Este documento define a visão de produto; não substitui os documentos de controle operacional.

---

## 23. Critérios para considerar o produto pronto para venda

O VENCIVO só deverá ser considerado pronto quando:

- o onboarding estiver claro;
- o cliente conseguir importar/fornecer dados;
- o sistema gerar valor perceptível;
- as ações automáticas estiverem limitadas e auditáveis;
- o isolamento entre clientes estiver validado;
- autenticação estiver auditada;
- pagamentos estiverem testados;
- custos unitários estiverem conhecidos;
- limites de uso estiverem definidos;
- produção estiver testada ponta a ponta;
- termos, privacidade e LGPD estiverem preparados;
- a proposta comercial estiver coerente com o valor entregue.

---

## 24. Regra final de produto

> **O VENCIVO não deve impressionar o cliente dizendo que tem IA. Deve impressioná-lo mostrando o que a IA fez por ele.**

O objetivo final é o cliente pensar:

> **“Isso me fez ganhar dinheiro, economizou meu tempo e tirou uma tarefa da minha cabeça. Eu quero isso no meu negócio para sempre.”**

Esse é o padrão de qualidade que deverá orientar as próximas decisões do VENCIVO.
