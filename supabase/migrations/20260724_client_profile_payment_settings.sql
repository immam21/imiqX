alter table if exists public.business_profiles
  add column if not exists client_status text not null default 'active' check (client_status in ('active', 'inactive', 'expired', 'deleted')),
  add column if not exists payment_gateway text,
  add column if not exists payment_modes jsonb not null default '[]'::jsonb,
  add column if not exists razorpay_key_id text,
  add column if not exists razorpay_enabled boolean not null default false;

update public.business_profiles
set client_status = 'active'
where client_status is null;

alter table public.business_profiles
  alter column client_status set not null;