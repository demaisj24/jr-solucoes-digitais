# VENCIVO AI — MVP

Arquitetura do MVP:

- Frontend estático no GitHub Pages.
- `ia-demo.html` para a experiência visual.
- `ia-demo-real.html` para o teste conectado ao endpoint serverless.
- `api/chat.js` como função serverless Vercel.
- Chave `GEMINI_API_KEY` somente no servidor.
- Modelo configurável por `GEMINI_MODEL` (padrão: `gemini-3.5-flash`).
- Limite simples de 10 mensagens por IP por janela de 1 hora.

## Variáveis na Vercel

`GEMINI_API_KEY` — obrigatória.

`GEMINI_MODEL` — opcional; padrão `gemini-3.5-flash`.

## Próximo passo

Publicar este backend na Vercel, configurar as variáveis e apontar o frontend para a URL de produção da função `/api/chat`.

<!-- deploy sync -->
