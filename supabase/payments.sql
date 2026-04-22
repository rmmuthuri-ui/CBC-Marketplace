create extension if not exists "pgcrypto";

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  amount numeric not null,
  resource_id text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_lookup_idx
  on public.payments (phone, resource_id, status, created_at desc);
