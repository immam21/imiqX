-- Multi-tenant SaaS schema foundation
-- Safe to apply incrementally. Does not alter existing business tables.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Core role and permission model
-- ------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform', 'tenant')),
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, key)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform', 'tenant')),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- ------------------------------------------------------------
-- Platform user and auth model
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  user_type text not null check (user_type in ('platform', 'tenant')),
  username text not null,
  email text,
  password_hash text not null,
  display_name text,
  phone text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, username),
  unique (tenant_id, email)
);

create unique index if not exists users_platform_username_uq
  on users (lower(username))
  where tenant_id is null;

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_token_id uuid references refresh_tokens(id) on delete set null,
  user_agent text,
  ip_address text
);

-- ------------------------------------------------------------
-- Tenant domain and subscription model
-- ------------------------------------------------------------
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  sid text unique,
  plan_code text not null unique,
  name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'quarterly', 'half_yearly', 'yearly')),
  price numeric(12,2) not null default 0,
  currency text not null default 'INR',
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain text not null unique,
  type text not null check (type in ('subdomain', 'custom')),
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verification_token text,
  verified_at timestamptz,
  ssl_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_domains_primary_per_tenant_uq
  on tenant_domains (tenant_id)
  where is_primary = true;

create table if not exists tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id) on delete restrict,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_subscriptions_tenant_idx on tenant_subscriptions (tenant_id);
create index if not exists tenant_subscriptions_status_idx on tenant_subscriptions (status);

-- ------------------------------------------------------------
-- Tenant business profile and operational tables
-- ------------------------------------------------------------
create table if not exists business_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  business_name text not null,
  email text,
  phone text,
  address text,
  tax_id text,
  logo_url text,
  theme jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  actor_type text not null check (actor_type in ('platform', 'tenant', 'system')),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_idx on audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  sid text unique,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  subject text not null,
  description text not null,
  status text not null check (status in ('open', 'in_progress', 'resolved', 'closed')) default 'open',
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  assigned_to_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_tenant_idx on support_tickets (tenant_id, status);

-- ------------------------------------------------------------
-- Compatibility patches for incremental rollouts
-- ------------------------------------------------------------

-- Support ticket comment threads used by tenant + platform support workflows.
create table if not exists support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  author_type text not null check (author_type in ('tenant', 'platform')),
  author_user_id uuid references users(id) on delete set null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_comments_ticket_idx
  on support_ticket_comments (ticket_id, created_at desc);

create index if not exists support_ticket_comments_tenant_idx
  on support_ticket_comments (tenant_id, created_at desc);

-- Order tracking + payment details used by admin and customer tracking pages.
alter table if exists orders add column if not exists payment_method text;
alter table if exists orders add column if not exists payment_status text;
alter table if exists orders add column if not exists tracking_id text;
alter table if exists orders add column if not exists courier_name text;
alter table if exists orders add column if not exists tracking_barcode text;
alter table if exists orders add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Extend tenant subscription statuses for HOLD/DEACTIVATE modes.
do $$
declare
  c record;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tenant_subscriptions'
  ) then
    for c in
      select distinct con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.tenant_subscriptions'::regclass
        and con.contype = 'c'
        and att.attname = 'status'
    loop
      execute format('alter table public.tenant_subscriptions drop constraint if exists %I', c.conname);
    end loop;

    alter table public.tenant_subscriptions
      add constraint tenant_subscriptions_status_check
      check ((status::text) in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'hold', 'deactivate'));
  end if;
end $$;

-- Extend order status lifecycle for tracking workflow.
do $$
declare
  c record;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orders'
  ) then
    for c in
      select distinct con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.orders'::regclass
        and con.contype = 'c'
        and att.attname = 'status'
    loop
      execute format('alter table public.orders drop constraint if exists %I', c.conname);
    end loop;

    alter table public.orders
      add constraint orders_status_check
      check ((status::text) in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'delivered', 'returned', 'cancelled'));
  end if;
end $$;

-- ------------------------------------------------------------
-- Optional table to decouple tenant admin credentials from settings key/value
-- ------------------------------------------------------------
create table if not exists tenant_admins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  login_id text not null,
  password_hash text not null,
  role text not null default 'owner',
  is_active boolean not null default true,
  last_login_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, login_id)
);

-- ------------------------------------------------------------
-- Seed minimum internal roles and sample permissions
-- ------------------------------------------------------------
insert into roles (scope, key, name, is_system)
values
  ('platform', 'super_admin', 'Super Admin', true),
  ('platform', 'admin', 'Admin', true),
  ('platform', 'support', 'Support', true),
  ('platform', 'operations', 'Operations', true),
  ('tenant', 'owner', 'Owner', true),
  ('tenant', 'viewer', 'Viewer', true)
on conflict (scope, key) do nothing;

insert into permissions (scope, key, name)
values
  ('platform', 'tenant.manage', 'Manage tenants'),
  ('platform', 'subscription.manage', 'Manage subscriptions'),
  ('platform', 'revenue.read', 'Read revenue dashboard'),
  ('tenant', 'product.manage', 'Manage products'),
  ('tenant', 'order.manage', 'Manage orders'),
  ('tenant', 'settings.manage', 'Manage tenant settings')
on conflict (key) do nothing;
