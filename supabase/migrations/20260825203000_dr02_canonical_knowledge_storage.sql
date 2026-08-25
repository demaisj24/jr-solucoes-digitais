-- DR-02: keep uploaded knowledge files in private Supabase Storage as the canonical source.
-- Gemini File Search is treated as a derived/rebuildable index.

alter table public.agent_knowledge
  add column if not exists storage_path text,
  add column if not exists gemini_document_name text;

comment on column public.agent_knowledge.storage_path is
  'Private path in Supabase Storage bucket vencivo-knowledge. Canonical source for uploaded documents.';

comment on column public.agent_knowledge.gemini_document_name is
  'Derived Gemini File Search document identifier. Rebuildable from storage_path.';

create index if not exists agent_knowledge_storage_path_idx
  on public.agent_knowledge (storage_path)
  where storage_path is not null;
