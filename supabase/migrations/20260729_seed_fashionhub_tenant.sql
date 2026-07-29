-- Fix: Add missing is_verified column to tenant_domains (if not already present)
-- Fix: Seed the default fashionhub tenant so the storefront works

begin;

-- 1. Ensure is_verified column exists on tenant_domains
alter table if exists public.tenant_domains
  add column if not exists is_verified boolean not null default false;

alter table if exists public.tenant_domains
  add column if not exists host text;

alter table if exists public.tenant_domains
  add column if not exists domain text;

create index if not exists tenant_domains_verified_idx
  on public.tenant_domains (is_verified, tenant_id);

-- 2. Ensure tenants table has required columns
alter table if exists public.tenants
  add column if not exists sid text;

alter table if exists public.tenants
  add column if not exists tenant_code text;

alter table if exists public.tenants
  add column if not exists business_slug text;

alter table if exists public.tenants
  add column if not exists business_name text;

alter table if exists public.tenants
  add column if not exists whatsapp_number text;

alter table if exists public.tenants
  add column if not exists currency text default 'INR';

alter table if exists public.tenants
  add column if not exists logo_url text;

alter table if exists public.tenants
  add column if not exists default_delivery_charge numeric default 40;

alter table if exists public.tenants
  add column if not exists is_active boolean not null default true;

alter table if exists public.tenants
  add column if not exists created_at timestamptz not null default now();

-- 3. Seed fashionhub tenant (idempotent)
insert into public.tenants (
  sid,
  tenant_code,
  business_slug,
  business_name,
  whatsapp_number,
  currency,
  logo_url,
  default_delivery_charge,
  is_active
)
values (
  'FSNHB',
  'fashionhub',
  'fashionhub',
  'Crazy Shopperz',
  '917092244494',
  'INR',
  '',
  40,
  true
)
on conflict (tenant_code) do update
  set
    business_name           = excluded.business_name,
    whatsapp_number         = excluded.whatsapp_number,
    currency                = excluded.currency,
    default_delivery_charge = excluded.default_delivery_charge,
    is_active               = excluded.is_active;

-- 4. Ensure tenant_settings exists for fashionhub
-- (creates AdminPassword row so admin login works with ADMIN_PASSWORD env var)
-- Run after tenant is inserted:
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id from public.tenants where tenant_code = 'fashionhub' limit 1;

  if v_tenant_id is not null then
    insert into public.tenant_settings (tenant_id, key, value)
    values (v_tenant_id, 'AdminPassword', 'Sapna@1521')
    on conflict (tenant_id, key) do nothing;
  end if;
end $$;

commit;
