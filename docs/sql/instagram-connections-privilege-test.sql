-- VENCIVO / INST-05 — Teste de privilégios de instagram_connections
-- Só leitura. Seguro para rodar antes E depois de aplicar
-- instagram-connections-agent-identity.sql (não altera nada).
--
-- has_table_privilege()/has_column_privilege() calculam o privilégio
-- EFETIVO (considerando a interação grant de tabela x grant de coluna),
-- diferente de consultar pg_class.relacl/pg_attribute.attacl direto — é
-- exatamente o mecanismo cuja falta de uso causou o FAIL original (um
-- REVOKE de coluna parecia correto lendo o SQL, mas o grant de tabela
-- continuava valendo por baixo).

select
  has_table_privilege('authenticated', 'public.instagram_connections', 'SELECT') as authenticated_tabela_inteira,
  has_table_privilege('anon',          'public.instagram_connections', 'SELECT') as anon_tabela_inteira,
  has_column_privilege('authenticated', 'public.instagram_connections', 'access_token_encrypted', 'SELECT') as authenticated_le_token,
  has_column_privilege('anon',          'public.instagram_connections', 'access_token_encrypted', 'SELECT') as anon_le_token,
  has_column_privilege('authenticated', 'public.instagram_connections', 'status', 'SELECT') as authenticated_le_status,
  has_column_privilege('authenticated', 'public.instagram_connections', 'instagram_user_id', 'SELECT') as authenticated_le_instagram_user_id;

-- =========================================================================
-- Resultado ANTES da correção (estado real hoje, confirmado empiricamente
-- em 2026-08-20, com a coluna antiga access_token em vez de
-- access_token_encrypted — a mesma consulta, na coluna antiga):
-- =========================================================================
--  authenticated_tabela_inteira | anon_tabela_inteira | authenticated_le_token (access_token)
--  true                         | true                | true      <- BUG: authenticated já
--                                                                    consegue ler o token hoje,
--                                                                    mesmo em texto puro.
--
-- =========================================================================
-- Resultado ESPERADO depois de aplicar a v2 corrigida (REVOKE de tabela
-- inteira, sem grant substituto):
-- =========================================================================
--  authenticated_tabela_inteira | anon_tabela_inteira | authenticated_le_token | anon_le_token | authenticated_le_status | authenticated_le_instagram_user_id
--  false                        | false               | false                  | false         | false                   | false
--
-- Ou seja: depois da correção, authenticated e anon não têm NENHUM acesso
-- de SELECT à tabela — nem ao token, nem a nenhuma outra coluna. Isso é
-- intencional (ver seção 7 da migration e "Decisão A/B" do plano): não há
-- consumidor de frontend/API hoje que precise ler esta tabela
-- diretamente; todo acesso passa por endpoint de backend com service
-- role, que ignora GRANT/REVOKE e RLS.
--
-- Um resultado com `authenticated_tabela_inteira = true` E
-- `authenticated_le_token = false` seria o sintoma exato do bug original
-- (grant de tabela mascarando revoke de coluna) — não deve mais
-- acontecer, porque não há mais nenhum GRANT de tabela para
-- authenticated/anon.
