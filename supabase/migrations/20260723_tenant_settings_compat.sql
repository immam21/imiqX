-- Tenant settings compatibility migration
-- Ensures a stable key-value store for tenant-scoped website/admin configuration.

begin;

create extension if not exists pgcrypto;

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  sid text,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.tenant_settings add column if not exists id uuid default gen_random_uuid();
alter table if exists public.tenant_settings add column if not exists sid text;
alter table if exists public.tenant_settings add column if not exists tenant_id uuid;
alter table if exists public.tenant_settings add column if not exists key text;
alter table if exists public.tenant_settings add column if not exists value text;
alter table if exists public.tenant_settings add column if not exists created_at timestamptz default now();
alter table if exists public.tenant_settings add column if not exists updated_at timestamptz default now();

-- Backfill nullable columns for older rows, then enforce required columns.
update public.tenant_settings set id = gen_random_uuid() where id is null;
update public.tenant_settings set value = '' where value is null;
update public.tenant_settings set created_at = now() where created_at is null;
update public.tenant_settings set updated_at = now() where updated_at is null;

alter table public.tenant_settings alter column id set not null;
alter table public.tenant_settings alter column tenant_id set not null;
alter table public.tenant_settings alter column key set not null;
alter table public.tenant_settings alter column value set not null;
alter table public.tenant_settings alter column created_at set not null;
alter table public.tenant_settings alter column updated_at set not null;

-- Ensure PK exists on id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tenant_settings'::regclass
      and contype = 'p'
  ) then
    alter table public.tenant_settings add constraint tenant_settings_pkey primary key (id);
  end if;
end $$;

-- Keep one latest row per (tenant_id,key) before unique enforcement.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by tenant_id, key
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.tenant_settings
)
delete from public.tenant_settings t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists tenant_settings_tenant_key_uq
  on public.tenant_settings (tenant_id, key);

create unique index if not exists tenant_settings_sid_uq
  on public.tenant_settings (sid)
  where sid is not null;

create index if not exists tenant_settings_tenant_idx
  on public.tenant_settings (tenant_id);

commit;
