create table public.zoriana_whatsapp_test_drafts (
  phone_number_id text not null,
  message_id text not null,
  draft text not null,
  needs_human boolean not null,
  received_at timestamptz not null default now(),
  primary key (phone_number_id, message_id)
);

alter table public.zoriana_whatsapp_test_drafts enable row level security;
revoke all on public.zoriana_whatsapp_test_drafts from public, anon, authenticated;
grant insert, select on public.zoriana_whatsapp_test_drafts to service_role;
