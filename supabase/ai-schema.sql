-- Ya aplicado a Supabase. No volver a ejecutar sobre las mismas tablas.
-- Registro privado de consultas y límites; ninguna llamada a OpenAI en este SQL.
begin;

create table public.emprendimiento_ai_runs (
 id uuid primary key,
 owner_id uuid not null references public.emprendimiento_owner_access(user_id),
 office smallint not null check (office between 0 and 5),
 model text not null check (model in ('gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna')),
 task text not null check (char_length(task) between 1 and 2000),
 answer text not null default '' check (char_length(answer)<=18000),
 status text not null default 'running' check (status in ('running','completed','incomplete','failed','uncertain')),
 input_tokens integer check(input_tokens>=0),
 output_tokens integer check(output_tokens>=0),
 cached_tokens integer check(cached_tokens>=0),
 estimated_usd numeric(12,6) not null check (estimated_usd>=0),
 reserved_usd numeric(12,6) not null check (reserved_usd>0 and reserved_usd<=0.10),
 source_revision bigint,
 error_code text,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index emprendimiento_ai_runs_owner_created on public.emprendimiento_ai_runs(owner_id,created_at desc);
alter table public.emprendimiento_ai_runs enable row level security;
revoke all on public.emprendimiento_ai_runs from public, anon, authenticated;
grant select on public.emprendimiento_ai_runs to authenticated;
grant select, insert, update on public.emprendimiento_ai_runs to service_role;
create policy owner_read_ai_runs on public.emprendimiento_ai_runs for select to authenticated
 using (owner_id=(select auth.uid()) and owner_id in (select user_id from public.emprendimiento_owner_access));
create function public.emprendimiento_reserve_ai_run(
 p_id uuid,p_owner uuid,p_office smallint,p_model text,p_task text,p_reserved numeric,p_source_revision bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.emprendimiento_ai_runs; used numeric; inserted public.emprendimiento_ai_runs;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,0));
 select * into existing from public.emprendimiento_ai_runs where id=p_id;
 if found then
  if existing.owner_id<>p_owner then raise exception 'INVALID_REQUEST'; end if;
  return pg_catalog.jsonb_build_object('created',false,'run',pg_catalog.to_jsonb(existing));
 end if;
 if not exists(select 1 from public.emprendimiento_owner_access where user_id=p_owner) then raise exception 'OWNER_REQUIRED'; end if;
 if (select count(*) from public.emprendimiento_ai_runs where owner_id=p_owner and created_at>=now()-interval '60 seconds')>=3 then raise exception 'MINUTE_LIMIT'; end if;
 if (select count(*) from public.emprendimiento_ai_runs where owner_id=p_owner and created_at>=date_trunc('day',now()))>=20 then raise exception 'DAILY_LIMIT'; end if;
 if exists(select 1 from public.emprendimiento_ai_runs where owner_id=p_owner and status='running' and created_at>now()-interval '3 minutes') then raise exception 'REQUEST_IN_PROGRESS'; end if;
 select coalesce(sum(estimated_usd),0) into used from public.emprendimiento_ai_runs where owner_id=p_owner and created_at>=date_trunc('month',now());
 if used+p_reserved>5 then raise exception 'MONTHLY_LIMIT'; end if;
 insert into public.emprendimiento_ai_runs(id,owner_id,office,model,task,estimated_usd,reserved_usd,source_revision)
 values(p_id,p_owner,p_office,p_model,p_task,p_reserved,p_reserved,p_source_revision) returning * into inserted;
 return pg_catalog.jsonb_build_object('created',true,'run',pg_catalog.to_jsonb(inserted));
end;
$$;
revoke all on function public.emprendimiento_reserve_ai_run(uuid,uuid,smallint,text,text,numeric,bigint) from public,anon,authenticated;
grant execute on function public.emprendimiento_reserve_ai_run(uuid,uuid,smallint,text,text,numeric,bigint) to service_role;

commit;
