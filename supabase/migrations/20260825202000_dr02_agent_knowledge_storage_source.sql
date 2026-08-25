alter table public.agent_knowledge
  add column if not exists storage_path text,
  add column if not exists gemini_document_name text;

comment on column public.agent_knowledge.storage_path is
  'Caminho privado do arquivo canônico no Supabase Storage; nulo para conhecimento textual salvo diretamente no banco ou legado sem cópia preservada.';

comment on column public.agent_knowledge.gemini_document_name is
  'Identificador do documento derivado no Gemini File Search; pode ser recriado a partir da fonte canônica.';
