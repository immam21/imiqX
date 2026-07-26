-- Platform communications / broadcast notices
-- Stores messages shown to tenant admins on login.

begin;

create extension if not exists pgcrypto;

create table if not exists public.platform_comms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  target_tenant_id uuid references public.tenants(id) on delete cascade,
  status text not null default 'active' check (status in ('draft', 'active', 'scheduled', 'expired', 'deleted')),
  start_at timestamptz,
  end_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.platform_comms add column if not exists id uuid default gen_random_uuid();
alter table if exists public.platform_comms add column if not exists title text;
alter table if exists public.platform_comms add column if not exists body text;
alter table if exists public.platform_comms add column if not exists image_url text;
alter table if exists public.platform_comms add column if not exists target_tenant_id uuid;
alter table if exists public.platform_comms add column if not exists status text default 'active';
alter table if exists public.platform_comms add column if not exists start_at timestamptz;
alter table if exists public.platform_comms add column if not exists end_at timestamptz;
alter table if exists public.platform_comms add column if not exists created_by_user_id uuid;
alter table if exists public.platform_comms add column if not exists created_at timestamptz default now();
alter table if exists public.platform_comms add column if not exists updated_at timestamptz default now();

update public.platform_comms set id = gen_random_uuid() where id is null;
update public.platform_comms set status = 'active' where status is null;
update public.platform_comms set created_at = now() where created_at is null;
update public.platform_comms set updated_at = now() where updated_at is null;

alter table public.platform_comms alter column id set not null;
alter table public.platform_comms alter column title set not null;
alter table public.platform_comms alter column body set not null;
alter table public.platform_comms alter column status set not null;
alter table public.platform_comms alter column created_at set not null;
alter table public.platform_comms alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.platform_comms'::regclass
      and contype = 'p'
  ) then
    alter table public.platform_comms add constraint platform_comms_pkey primary key (id);
  end if;
end $$;

create index if not exists platform_comms_status_idx
  on public.platform_comms (status, start_at, end_at);

create index if not exists platform_comms_target_tenant_idx
  on public.platform_comms (target_tenant_id);

create index if not exists platform_comms_created_at_idx
  on public.platform_comms (created_at desc);

commit;