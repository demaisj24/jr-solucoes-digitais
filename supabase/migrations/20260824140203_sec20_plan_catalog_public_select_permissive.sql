drop policy if exists plan_catalog_public_active_select on public.plan_catalog;

create policy plan_catalog_public_active_select
on public.plan_catalog
as permissive
for select
to anon, authenticated
using (active = true);
