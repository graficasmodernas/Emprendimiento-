alter table public.zoriana_messenger_inbox
  add column suggestion text,
  add column draft_only boolean not null default false,
  add column response_text text,
  add column outbound_id text,
  add column example_text text,
  add column corrected boolean not null default false,
  add column corrected_at timestamptz,
  add column delivery_error text;
alter table public.zoriana_messenger_inbox drop constraint zoriana_messenger_inbox_status_check;
alter table public.zoriana_messenger_inbox add constraint zoriana_messenger_inbox_status_check
  check (status in ('pending','draft','human','sending','sent','failed'));
-- Existing draft rows were claimed by the old sender and can have an unknown delivery outcome.
update public.zoriana_messenger_inbox set status = 'failed', delivery_error = 'unknown'
where status = 'draft' or (status = 'failed' and delivery_error is null);

create table public.zoriana_messenger_settings (
  page_id text primary key check (page_id = '1388984880973050'),
  automatic boolean not null default false,
  instructions text not null default '' check (length(instructions) <= 4000),
  revision uuid not null default gen_random_uuid(),
  automatic_since timestamptz
);
insert into public.zoriana_messenger_settings (page_id) values ('1388984880973050');
alter table public.zoriana_messenger_settings enable row level security;
revoke all on public.zoriana_messenger_settings from anon, authenticated;
grant select on public.zoriana_messenger_settings to authenticated;
grant select, update on public.zoriana_messenger_settings to service_role;
create policy owner_reads_messenger_settings on public.zoriana_messenger_settings
  for select to authenticated using (
    exists (select 1 from public.emprendimiento_owner_access a where a.user_id = (select auth.uid()))
  );
