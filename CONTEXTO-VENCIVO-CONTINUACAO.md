# VENCIVO — CONTEXTO DE CONTINUAÇÃO

Data: 17/08/2026

## 1. Objetivo
Vencivo Atendimento Inteligente / Vencivo AI é um SaaS para criar agentes de IA personalizados para empresas. Posicionamento: não vender como simples chatbot, mas como agente treinado para o negócio, com conhecimento da empresa, atendimento, qualificação e encaminhamento humano.

Frase de posicionamento já aprovada:
> Ensine como sua empresa funciona, teste as respostas e conecte seu WhatsApp para começar a atender seus clientes automaticamente.

## 2. Regra principal para a continuação
Preservar tudo que já funciona. O trabalho atual pedido é principalmente interface/implantação visual.

NÃO alterar nesta etapa:
- login
- cadastro
- sessão/autenticação
- Supabase
- Asaas
- checkout
- Gemini
- funcionamento atual do agente
- fluxos funcionais já existentes

Qualquer mudança deve ser controlada e somente no que for solicitado.

## 3. Repositório
GitHub: `demaisj24/jr-solucoes-digitais`
Branch principal usada: `main`

Arquivos relevantes já encontrados:
- `agente.html`
- `conta.html`
- `conta-fix.js`
- `ia-demo.html`
- `ia-demo-real.html`
- `ia-v2.html`
- `ia-v3.html` (existe no repositório)
- `DEPLOY-VENCIVO-AI.md`
- `README-VENCIVO-AI.md`
- `README-WHATSAPP-IMPLANTACAO.md`
- `WHATSAPP-INTEGRATION-NEXT.md`
- `NEXT-VENCIVO-AI.txt`

Antes de editar qualquer arquivo, localizar/ler a versão atualmente usada pela aplicação e preservar a lógica existente.

## 4. Estado de implantação/interface
O fluxo atual de implantação está sendo conduzido sem mexer no funcionamento do agente.

### Meta / WhatsApp
Foi escolhido o caminho oficial da Meta para WhatsApp Cloud API / Embedded Signup.
Foi criado o portfólio empresarial `Vencivo Atendimento Inteligente`.
Ainda não foi criado/adicionado número WhatsApp ao portfólio.

Houve uma restrição na empresa da Meta em 17/08/2026. A Meta informou que a empresa não poderia criar/veicular anúncios, usar/compartilhar públicos, usar Pixel, usar SDKs para eventos, turbinar posts e gerenciar ativos de publicidade/pessoas. A justificativa mostrada foi detecção de conta criada/usada com automação incompatível com as regras.

Foi solicitada análise e enviada identidade para verificação. Resposta da Meta: análise em andamento, normalmente em menos de 4 dias, podendo demorar mais. A empresa permanece restrita enquanto analisam.

IMPORTANTE: não fazer mudanças precipitadas na empresa/portfólio durante essa análise.

### Contas Meta
O erro ocorreu durante a tentativa de usar uma conta pessoal de Marcos associada a um cadastro em que aparecia o nome de Aila. Depois foi criada uma conta para Aila e tentamos convidá-la para o portfólio, mas o convite apresentou erro.

A conta atualmente visualizada em uma das telas ainda pode mostrar o perfil pessoal de Marcos. Não assumir que nomes digitados no portfólio representam uma conta Facebook real.

A orientação atual é ser conservador e não colocar o portfólio em risco enquanto a análise da Meta está pendente.

## 5. Resend
Resend está sendo usado para e-mails do projeto.
Tela mostrada: Resend > Emails > Receiving. A conta estava sem e-mails recebidos. Não assumir menus que não aparecem na interface atual; orientar somente por elementos visíveis nas capturas.

Domínio `vencivo.com.br` já está registrado no Registro.br e aparece como publicado, com DNS `a.sec.dns.br` e `c.sec.dns.br`. Registro criado em 12/08/2026, expiração 12/08/2027, alteração 14/08/2026.

## 6. Tela inicial — trabalho visual atual
O usuário quer trabalhar visualmente na HOME, mantendo funcionamento.

Problemas/alterações solicitadas:

### Header/menu superior
- Letras do menu estão pequenas; aumentar de forma geral.
- Melhorar visualmente o menu superior.
- `Entrar` / `Minha conta` deve ficar em destaque.
- `Instalar app` deve ser o ÚLTIMO botão/ação do menu.
- Manter `Orçamento` com destaque adequado.
- O header deve parecer SaaS profissional, moderno e claro.

### Conteúdo repetido
Atualmente há repetição de mensagens/benefícios do agente em blocos diferentes.
Remover a sensação de repetição e organizar a narrativa.

### Bloco principal de posicionamento
O usuário quer destacar a frase:
> Não contrate um chatbot.
> Crie um agente para o seu negócio.

Depois apresentar, de forma melhor organizada, a proposta:
> Seu atendimento pode trabalhar por você.
> Criamos um agente de IA que aprende o seu negócio, conversa com seus clientes e atende com a personalidade da sua marca.

CTAs:
- `Criar meu agente de IA →`
- `Ver como funciona`

Benefícios:
- `✓ Conhece seu negócio`
- `✓ Atendimento 24h`
- `✓ Encaminha ao humano`

### Área visual do lado direito
A área atual é um mockup de conversa com:
- AI
- Seu agente de IA
- demonstração online
- Olá! Como posso ajudar você hoje?
- Quais serviços vocês oferecem?
- resposta sobre serviços/preços/informações
- Responde / Humaniza / Qualifica / Encaminha

O usuário quer substituir ou evoluir essa área para algo mais convincente e animado, preferencialmente uma demonstração visual/vídeo do agente trabalhando, respondendo um cliente e usando o nome da empresa. Se vídeo real não for implementado agora, pode-se criar uma simulação animada em HTML/CSS/JS sem alterar o backend.

### Formulário de contato
Adicionar na HOME um formulário de contato com o Vencivo, com aparência profissional e coerente com o SaaS. Não conectar/alterar backend sem solicitação explícita; nesta fase pode ser somente interface se necessário.

### Prova social
Adicionar simulações de comentários/depoimentos de redes sociais com aparência realista, sem alegar que são comentários reais. Devem parecer exemplos visuais e não criar falsa prova social.

## 7. Direção visual
A captura atual mostra tema escuro, fundo quase preto, gradientes cyan/azul/roxo, cards com bordas suaves e estética SaaS/AI.

Objetivo: aumentar legibilidade e percepção premium sem exagerar em elementos.

As letras estão pequenas. Prioridade é hierarquia tipográfica, espaçamento e clareza.

Não gerar imagens conceituais quando o usuário estiver pedindo implementação de código/interface. Trabalhar diretamente no HTML/CSS/JS existente.

## 8. Fila de melhorias visuais
1. HOME — tipografia maior e melhor hierarquia.
2. HOME — redesign do header/menu.
3. HOME — destacar Entrar/Minha conta.
4. HOME — mover Instalar app para último.
5. HOME — eliminar repetição dos blocos sobre agente.
6. HOME — reorganizar hero com “Não contrate um chatbot. Crie um agente para o seu negócio.”
7. HOME — melhorar texto/CTAs/benefícios do bloco “Seu atendimento pode trabalhar por você”.
8. HOME — substituir/evoluir mockup direito para demonstração animada do agente.
9. HOME — adicionar formulário de contato.
10. HOME — adicionar prova social visual com comentários simulados claramente tratados como exemplos.
11. Depois da HOME, continuar as demais melhorias visuais da interface, sem tocar nos sistemas funcionais proibidos acima.

## 9. Forma de trabalho combinada
O usuário quer praticidade e quer que o contexto seja mantido entre chats.
Não ficar redirecionando para links que não existem; usar as telas fornecidas para orientar.
Quando houver código, modificar apenas o necessário e preservar funcionalidades.
Quando possível, trabalhar diretamente no repositório existente e fazer commits controlados.

## 10. Próximo passo ao abrir novo chat
Começar dizendo que o contexto deste arquivo foi recuperado e perguntar/identificar qual tela está sendo trabalhada. Se o usuário disser para continuar a HOME, localizar o arquivo da HOME atual no repositório, ler o código antes de alterar e implementar somente as mudanças visuais da fila acima.
