# VENCIVO — HANDOFF META / INSTAGRAM

**Data:** 18/08/2026
**Repositório:** `demaisj24/jr-solucoes-digitais`
**Produção:** `vencivo-ai` → `vencivo.com.br`

## Estado
O portfólio Meta `Vencivo Atendimento Inteligente` está restrito. A Meta informou em 17/08/2026 que manteve as restrições; não descrever como análise pendente.

Foi criado um novo App `VENCIVO` / `VENCIVO-IG` na conta Meta atualmente usada. Caso de uso: **Gerenciar mensagens e conteúdo no Instagram**.

Permissões adicionadas pelo assistente da Meta:
- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

A etapa **Configurar o login da empresa no Instagram** foi aberta. A Meta solicitou uma URL de redirecionamento/callback OAuth.

## Decisão
Não preencher URL inventada. A investigação do código do `main` não encontrou uma rota Instagram OAuth/callback pronta. Antes de configurar a Meta, é necessário definir e implementar o callback real do VENCIVO.

## Correções de orientação
- Não usar automaticamente a conta pessoal/profissional do Marcos como representante do VENCIVO.
- Não presumir que a conta da Aila é a conta de teste sem distinguir o fluxo de teste do Business Login for Instagram para clientes.
- Não confundir Business Login for Instagram com Facebook Login for Business.
- Não tentar contornar a restrição anterior da Meta.

## Próximo passo exato
1. Consultar documentação oficial atual da Meta sobre **Instagram API with Instagram Login / Business Login for Instagram**, especialmente redirect URI e troca de código por token.
2. Mapear o backend real no `main`: autenticação, sessões, Supabase e endpoints `/api`.
3. Definir a rota callback.
4. Criar branch técnica e preparar patch localizado, sem alterar `main` sem aprovação.
5. Implementar/testar callback.
6. Só então configurar a URL correspondente na Meta.
7. Avaliar separadamente Standard/Advanced Access e impacto da restrição anterior, sem evasão.

## Continuidade
A próxima conversa deve ler `VENCIVO-MASTER-STATE.md`, `VENCIVO-HANDOFF.md`, `VENCIVO-ROADMAP.md`, `VENCIVO-PROTOCOLO-DE-TRABALHO.md` e este arquivo antes de continuar.
