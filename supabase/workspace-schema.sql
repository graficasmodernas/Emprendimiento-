-- Esquema de Emprendimiento IA. Ya aplicado al proyecto existente.
-- Para reproducir en una base vacía con una única cuenta admin creada previamente.
-- No ejecutar otra vez sobre las mismas tablas.
begin;

create table public.emprendimiento_owner_access (
 singleton boolean primary key default true check (singleton),
 user_id uuid not null unique references auth.users(id) on delete restrict
);
alter table public.emprendimiento_owner_access enable row level security;
revoke all on public.emprendimiento_owner_access from public, anon, authenticated;
grant select on public.emprendimiento_owner_access to authenticated;
create policy owner_read_access on public.emprendimiento_owner_access for select to authenticated using (user_id = (select auth.uid()));
insert into public.emprendimiento_owner_access(user_id)
select id from auth.users where raw_app_meta_data->>'role' = 'admin';
create table public.emprendimiento_workspaces (
 owner_id uuid primary key references public.emprendimiento_owner_access(user_id) on delete restrict,
 payload jsonb not null,
 revision bigint not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now(),
 constraint workspace_payload_object check (jsonb_typeof(payload) = 'object'),
 constraint workspace_version check (payload ? 'version' and payload->>'version' = '1'),
 constraint workspace_keys check (payload ?& array['products','campaigns','leads','orders','movements','approvals','events','notes','tasks','incidents']),
 constraint workspace_size check (octet_length(payload::text) <= 4194304),
 constraint workspace_products_array check (case when jsonb_typeof(payload->'products') = 'array' then jsonb_array_length(payload->'products') <= 1000 else false end),
constraint workspace_campaigns_array check (case when jsonb_typeof(payload->'campaigns') = 'array' then jsonb_array_length(payload->'campaigns') <= 1000 else false end),
constraint workspace_leads_array check (case when jsonb_typeof(payload->'leads') = 'array' then jsonb_array_length(payload->'leads') <= 1000 else false end),
constraint workspace_orders_array check (case when jsonb_typeof(payload->'orders') = 'array' then jsonb_array_length(payload->'orders') <= 1000 else false end),
constraint workspace_movements_array check (case when jsonb_typeof(payload->'movements') = 'array' then jsonb_array_length(payload->'movements') <= 1000 else false end),
constraint workspace_approvals_array check (case when jsonb_typeof(payload->'approvals') = 'array' then jsonb_array_length(payload->'approvals') <= 1000 else false end),
constraint workspace_events_array check (case when jsonb_typeof(payload->'events') = 'array' then jsonb_array_length(payload->'events') <= 1000 else false end),
constraint workspace_notes_array check (case when jsonb_typeof(payload->'notes') = 'array' then jsonb_array_length(payload->'notes') <= 1000 else false end),
constraint workspace_tasks_array check (case when jsonb_typeof(payload->'tasks') = 'array' then jsonb_array_length(payload->'tasks') <= 1000 else false end),
constraint workspace_incidents_array check (case when jsonb_typeof(payload->'incidents') = 'array' then jsonb_array_length(payload->'incidents') <= 1000 else false end)
);
alter table public.emprendimiento_workspaces enable row level security;
revoke all on public.emprendimiento_workspaces from public, anon, authenticated;
grant select, insert, update on public.emprendimiento_workspaces to authenticated;
create policy workspace_owner_select on public.emprendimiento_workspaces for select to authenticated
 using (owner_id = (select auth.uid()) and owner_id in (select user_id from public.emprendimiento_owner_access));
create policy workspace_owner_insert on public.emprendimiento_workspaces for insert to authenticated
 with check (owner_id = (select auth.uid()) and owner_id in (select user_id from public.emprendimiento_owner_access) and revision = 1);
create policy workspace_owner_update on public.emprendimiento_workspaces for update to authenticated
 using (owner_id = (select auth.uid()) and owner_id in (select user_id from public.emprendimiento_owner_access))
 with check (owner_id = (select auth.uid()) and owner_id in (select user_id from public.emprendimiento_owner_access));
create schema if not exists emprendimiento_private;
revoke all on schema emprendimiento_private from public, anon, authenticated;
create function emprendimiento_private.check_workspace_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.owner_id <> old.owner_id or new.revision <> old.revision + 1 then
   raise exception 'Workspace revision conflict' using errcode = '40001';
 end if;
 new.updated_at := pg_catalog.now();
 return new;
end;
$$;
revoke all on function emprendimiento_private.check_workspace_revision() from public, anon, authenticated;
create trigger check_workspace_revision before update on public.emprendimiento_workspaces
for each row execute function emprendimiento_private.check_workspace_revision();

commit;
