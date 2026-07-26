-- Migration: support tickets comments + order tracking/payment compatibility + status checks
-- Date: 2026-07-22
-- Safe to run multiple times.

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Support ticket comments
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Orders tracking and payment columns
-- ------------------------------------------------------------
alter table if exists orders add column if not exists payment_method text;
alter table if exists orders add column if not exists payment_status text;
alter table if exists orders add column if not exists tracking_id text;
alter table if exists orders add column if not exists courier_name text;
alter table if exists orders add column if not exists tracking_barcode text;
alter table if exists orders add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- tenant_subscriptions status compatibility
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- orders status compatibility
-- ------------------------------------------------------------
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

commit;
