create extension if not exists "pgcrypto";

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text,
  bio text,
  subjects text[] not null default '{}',
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_applications_status_idx
  on public.seller_applications (status, created_at desc);

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.seller_applications(id) on delete set null,
  display_name text not null,
  email text not null unique,
  phone text,
  payout_phone text,
  payout_method text not null default 'mpesa',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_profiles_status_idx
  on public.seller_profiles (status, created_at desc);

create table if not exists public.seller_resources (
  id uuid primary key default gen_random_uuid(),
  seller_email text not null,
  seller_name text not null,
  title text not null,
  description text not null,
  subject text not null,
  grade text not null,
  price numeric not null check (price > 0),
  file_url text,
  review_status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_resources_review_idx
  on public.seller_resources (review_status, created_at desc);

create table if not exists public.seller_ledger (
  id uuid primary key default gen_random_uuid(),
  seller_email text not null,
  source_payment_id uuid references public.payments(id) on delete set null,
  resource_id text,
  gross_amount numeric not null check (gross_amount >= 0),
  commission_amount numeric not null check (commission_amount >= 0),
  net_amount numeric not null check (net_amount >= 0),
  entry_type text not null default 'sale',
  status text not null default 'accrued',
  created_at timestamptz not null default now()
);

create index if not exists seller_ledger_lookup_idx
  on public.seller_ledger (seller_email, status, created_at desc);
