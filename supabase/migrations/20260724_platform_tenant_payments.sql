-- Platform tenant payments ledger for subscription billing and receipt tracking.
create table if not exists platform_tenant_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subscription_id uuid null references tenant_subscriptions(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'overdue')),
  method text null,
  reference text null,
  payment_date timestamptz null,
  due_date timestamptz null,
  notes text null,
  receipt_number text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_tenant_payments_tenant on platform_tenant_payments (tenant_id);
create index if not exists idx_platform_tenant_payments_status on platform_tenant_payments (status);
create index if not exists idx_platform_tenant_payments_payment_date on platform_tenant_payments (payment_date desc);

-- Keep timestamps fresh for updates.
create or replace function set_platform_tenant_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_platform_tenant_payments_updated_at on platform_tenant_payments;
create trigger trg_platform_tenant_payments_updated_at
before update on platform_tenant_payments
for each row
execute function set_platform_tenant_payments_updated_at();
