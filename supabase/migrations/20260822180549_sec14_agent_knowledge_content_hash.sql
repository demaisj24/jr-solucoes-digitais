-- SEC-14 HIGH #2: idempotência de documento por conteúdo (SHA-256).
--
-- Aditiva, idempotente (IF NOT EXISTS) — não altera nenhuma linha existente.
-- Linhas antigas ficam com content_hash NULL e continuam válidas; o índice
-- único é parcial (WHERE content_hash IS NOT NULL) exatamente por isso: não
-- há histórico de hash para reconstruir retroativamente, só passa a valer
-- para documentos processados a partir desta migration em diante.
--
-- Aplicada ao Supabase (projeto uxmlmyhiagjefuufanyg) em 2026-08-22, versão
-- 20260822180549 — este arquivo representa no repositório o que já está em
-- produção, não uma migration nova a aplicar.
alter table public.agent_knowledge
  add column if not exists content_hash text;

create unique index if not exists agent_knowledge_agent_id_content_hash_key
  on public.agent_knowledge (agent_id, content_hash)
  where content_hash is not null;
