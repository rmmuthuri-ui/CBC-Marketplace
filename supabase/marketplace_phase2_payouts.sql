create extension if not exists "pgcrypto";

create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_email text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_gross numeric not null check (total_gross >= 0),
  total_fee numeric not null check (total_fee >= 0),
  total_net numeric not null check (total_net >= 0),
  status text not null default 'ready',
  payment_reference text,
  paid_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_payouts_seller_idx
  on public.seller_payouts (seller_email, status, created_at desc);

create table if not exists public.seller_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.seller_payouts(id) on delete cascade,
  ledger_entry_id uuid not null references public.seller_ledger(id) on delete restrict,
  gross_amount numeric not null check (gross_amount >= 0),
  fee_amount numeric not null check (fee_amount >= 0),
  net_amount numeric not null check (net_amount >= 0),
  created_at timestamptz not null default now(),
  unique (ledger_entry_id)
);

create index if not exists seller_payout_items_payout_idx
  on public.seller_payout_items (payout_id, created_at desc);
