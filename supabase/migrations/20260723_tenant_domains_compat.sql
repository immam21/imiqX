-- Tenant domain compatibility migration
-- Guarantees storage for platform-admin-managed custom domain mapping metadata.

begin;

create extension if not exists pgcrypto;

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  host text,
  domain text,
  type text not null default 'custom' check (type in ('custom', 'subdomain')),
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verification_token text,
  verified_at timestamptz,
  ssl_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.tenant_domains add column if not exists id uuid default gen_random_uuid();
alter table if exists public.tenant_domains add column if not exists tenant_id uuid;
alter table if exists public.tenant_domains add column if not exists host text;
alter table if exists public.tenant_domains add column if not exists domain text;
alter table if exists public.tenant_domains add column if not exists type text default 'custom';
alter table if exists public.tenant_domains add column if not exists is_primary boolean default false;
alter table if exists public.tenant_domains add column if not exists is_verified boolean default false;
alter table if exists public.tenant_domains add column if not exists verification_token text;
alter table if exists public.tenant_domains add column if not exists verified_at timestamptz;
alter table if exists public.tenant_domains add column if not exists ssl_status text;
alter table if exists public.tenant_domains add column if not exists created_at timestamptz default now();
alter table if exists public.tenant_domains add column if not exists updated_at timestamptz default now();

update public.tenant_domains set id = gen_random_uuid() where id is null;
update public.tenant_domains set host = lower(trim(domain)) where (host is null or trim(host) = '') and domain is not null;
update public.tenant_domains set domain = lower(trim(host)) where (domain is null or trim(domain) = '') and host is not null;
update public.tenant_domains set type = 'custom' where type is null;
update public.tenant_domains set created_at = now() where created_at is null;
update public.tenant_domains set updated_at = now() where updated_at is null;

alter table public.tenant_domains alter column id set not null;
alter table public.tenant_domains alter column tenant_id set not null;
alter table public.tenant_domains alter column type set not null;
alter table public.tenant_domains alter column is_primary set not null;
alter table public.tenant_domains alter column is_verified set not null;
alter table public.tenant_domains alter column created_at set not null;
alter table public.tenant_domains alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tenant_domains'::regclass
      and contype = 'p'
  ) then
    alter table public.tenant_domains add constraint tenant_domains_pkey primary key (id);
  end if;
end $$;

create unique index if not exists tenant_domains_host_uq
  on public.tenant_domains (lower(host))
  where host is not null and trim(host) <> '';

create unique index if not exists tenant_domains_domain_uq
  on public.tenant_domains (lower(domain))
  where domain is not null and trim(domain) <> '';

create unique index if not exists tenant_domains_primary_per_tenant_uq
  on public.tenant_domains (tenant_id)
  where is_primary = true;

create index if not exists tenant_domains_tenant_idx
  on public.tenant_domains (tenant_id);

create index if not exists tenant_domains_verified_idx
  on public.tenant_domains (is_verified, tenant_id);

commit;
