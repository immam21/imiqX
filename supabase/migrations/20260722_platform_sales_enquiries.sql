-- Platform landing enquiries table
-- Stores sales form submissions from the root landing page.

create table if not exists platform_sales_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  whatsapp text not null,
  city text not null,
  message text not null,
  source text not null default 'platform_enquiry',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists platform_sales_enquiries_created_at_idx
  on platform_sales_enquiries (created_at desc);

create index if not exists platform_sales_enquiries_whatsapp_idx
  on platform_sales_enquiries (whatsapp);
