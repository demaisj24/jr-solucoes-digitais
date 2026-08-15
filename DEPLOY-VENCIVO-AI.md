# Deploy VENCIVO AI

1. Importar a branch `feat/vencivo-ai-real-backend` na Vercel.
2. Configurar `GEMINI_API_KEY` em Environment Variables.
3. Opcionalmente configurar `GEMINI_MODEL=gemini-3.5-flash`.
4. Fazer deploy de produção.
5. Confirmar `https://<projeto>.vercel.app/api/health`.
6. Atualizar `ia-demo-real.html` para usar a URL final `/api/chat`.
