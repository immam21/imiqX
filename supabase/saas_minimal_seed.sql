-- Minimal seed for SaaS auth + subscription bootstrap
-- Prerequisite: run supabase/saas_multitenant_schema.sql first.

begin;

create extension if not exists pgcrypto;

-- 1) Ensure required system roles exist (idempotent)
insert into roles (scope, key, name, is_system)
values
  ('platform', 'super_admin', 'Super Admin', true),
  ('platform', 'admin', 'Admin', true),
  ('platform', 'support', 'Support', true),
  ('platform', 'operations', 'Operations', true),
  ('tenant', 'owner', 'Owner', true),
  ('tenant', 'viewer', 'Viewer', true)
on conflict (scope, key) do nothing;

-- 2) Ensure baseline permissions exist (idempotent)
insert into permissions (scope, key, name)
values
  ('platform', 'tenant.manage', 'Manage tenants'),
  ('platform', 'subscription.manage', 'Manage subscriptions'),
  ('platform', 'revenue.read', 'Read revenue dashboard'),
  ('tenant', 'product.manage', 'Manage products'),
  ('tenant', 'order.manage', 'Manage orders'),
  ('tenant', 'settings.manage', 'Manage tenant settings')
on conflict (key) do nothing;

-- 3) Create first platform super admin user (idempotent by username/email)
-- IMPORTANT: change these values before running in production.
with upsert_user as (
  insert into users (
    tenant_id,
    user_type,
    username,
    email,
    password_hash,
    display_name,
    is_active
  )
  values (
    null,
    'platform',
    'superadmin',
    'superadmin@yourplatform.com',
    crypt('ChangeMe@123', gen_salt('bf', 12)),
    'Platform Super Admin',
    true
  )
  on conflict (tenant_id, username)
  do update set
    email = excluded.email,
    display_name = excluded.display_name,
    is_active = true
  returning id
), selected_user as (
  select id from upsert_user
  union all
  select u.id
  from users u
  where u.tenant_id is null and lower(u.username) = lower('superadmin')
  limit 1
), selected_role as (
  select id from roles where scope = 'platform' and key = 'super_admin' limit 1
)
insert into user_roles (user_id, role_id)
select su.id, sr.id
from selected_user su
cross join selected_role sr
on conflict do nothing;

-- 4) Create platform plans (idempotent)
insert into subscription_plans (
  sid,
  plan_code,
  name,
  billing_cycle,
  price,
  currency,
  features,
  limits,
  is_active
)
values
  (
    'SP101',
    'trial_plan_7days',
    'Trail Plan',
    'monthly',
    0,
    'INR',
    '{"trial_days": 7, "payment_gateway": false, "analytics": true}'::jsonb,
    '{"max_products": 50, "max_orders": 300, "max_staff_users": 1, "storage_limit_mb": 256, "banner_limit": 3, "offer_limit": 5}'::jsonb,
    true
  ),
  (
    'SP102',
    'growth_plan_399_monthly',
    'Growth Plan',
    'monthly',
    399,
    'INR',
    '{"trial_days": 0, "payment_gateway": false, "analytics": true}'::jsonb,
    '{"max_products": 1000, "max_orders": 10000, "max_staff_users": 5, "storage_limit_mb": 1024, "banner_limit": 10, "offer_limit": 20}'::jsonb,
    true
  ),
  (
    'SP103',
    'starter_plan_999_quarterly',
    'Starter Plan',
    'quarterly',
    999,
    'INR',
    '{"trial_days": 0, "payment_gateway": true, "analytics": true}'::jsonb,
    '{"max_products": 5000, "max_orders": 50000, "max_staff_users": 15, "storage_limit_mb": 5120, "banner_limit": 30, "offer_limit": 100}'::jsonb,
    true
  ),
  (
    'SP104',
    'advanced_plan_1499_quarterly',
    'Advanced Plan',
    'quarterly',
    1499,
    'INR',
    '{"trial_days": 0, "payment_gateway": true, "analytics": true, "priority_support": true}'::jsonb,
    '{"max_products": 20000, "max_orders": 200000, "max_staff_users": 50, "storage_limit_mb": 20480, "banner_limit": 100, "offer_limit": 300}'::jsonb,
    true
  )
on conflict (plan_code) do update set
  name = excluded.name,
  billing_cycle = excluded.billing_cycle,
  price = excluded.price,
  currency = excluded.currency,
  features = excluded.features,
  limits = excluded.limits,
  is_active = excluded.is_active;

-- 5) Optional helper: assign default free trial to tenants with no subscription.
-- Supports both schemas:
--   A) tenant_subscriptions.plan_id + subscription_plans
--   B) tenant_subscriptions.package_id + service_packages
do $$
declare
  has_plan_id boolean := false;
  has_package_id boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_subscriptions'
      and column_name = 'plan_id'
  ) into has_plan_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_subscriptions'
      and column_name = 'package_id'
  ) into has_package_id;

  if has_plan_id then
    insert into tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    select
      t.id,
      p.id,
      'trialing',
      now(),
      now() + interval '7 days'
    from tenants t
    cross join (
      select id from subscription_plans where plan_code = 'trial_plan_7days' limit 1
    ) p
    where not exists (
      select 1
      from tenant_subscriptions ts
      where ts.tenant_id = t.id
    )
    on conflict do nothing;
  elsif has_package_id then
    -- Backward-compatible path for existing package schema.
    insert into service_packages (
      package_code,
      package_name,
      billing_cycle,
      price_amount,
      currency,
      is_active,
      sort_order
    )
    values
      (
        'trial_plan_7days',
        'Trail Plan',
        'monthly',
        0,
        'INR',
        true,
        1
      ),
      (
        'growth_plan_399_monthly',
        'Growth Plan',
        'monthly',
        399,
        'INR',
        true,
        2
      ),
      (
        'starter_plan_999_quarterly',
        'Starter Plan',
        'quarterly',
        999,
        'INR',
        true,
        3
      ),
      (
        'advanced_plan_1499_quarterly',
        'Advanced Plan',
        'quarterly',
        1499,
        'INR',
        true,
        4
      )
    on conflict (package_code) do update set
      package_name = excluded.package_name,
      billing_cycle = excluded.billing_cycle,
      price_amount = excluded.price_amount,
      currency = excluded.currency,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

    insert into tenant_subscriptions (
      tenant_id,
      package_id,
      status,
      starts_at,
      ends_at,
      auto_renew,
      seats,
      amount,
      currency
    )
    select
      t.id,
      p.id,
      'trialing',
      now(),
      now() + interval '7 days',
      true,
      1,
      p.price_amount,
      p.currency
    from tenants t
    cross join (
      select id, price_amount, currency
      from service_packages
      where package_code = 'trial_plan_7days'
      limit 1
    ) p
    where not exists (
      select 1
      from tenant_subscriptions ts
      where ts.tenant_id = t.id
    )
    on conflict do nothing;
  end if;
end $$;

commit;
