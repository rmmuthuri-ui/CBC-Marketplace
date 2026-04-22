create extension if not exists "pgcrypto";

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  amount numeric not null,
  resource_id text not null,
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists checkout_request_id text,
  add column if not exists mpesa_receipt text;

create unique index if not exists payments_checkout_request_id_key
  on public.payments (checkout_request_id);

create index if not exists payments_lookup_idx
  on public.payments (phone, resource_id, status, created_at desc);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text not null unique,
  phone text not null,
  resource_id text not null,
  amount numeric not null,
  status text not null default 'initiated',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_lookup_idx
  on public.payment_intents (checkout_request_id, resource_id, phone);
