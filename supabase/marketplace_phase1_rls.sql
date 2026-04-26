-- Phase 1 hardening: enable RLS on seller marketplace tables.
-- Run this in Supabase SQL editor after marketplace_phase1.sql.

alter table public.seller_applications enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.seller_resources enable row level security;
alter table public.seller_ledger enable row level security;

-- Seller applications: user can read and write only their own row.
drop policy if exists seller_applications_select_own on public.seller_applications;
create policy seller_applications_select_own
on public.seller_applications
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists seller_applications_insert_own on public.seller_applications;
create policy seller_applications_insert_own
on public.seller_applications
for insert
to authenticated
with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists seller_applications_update_own on public.seller_applications;
create policy seller_applications_update_own
on public.seller_applications
for update
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'))
with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- Seller profiles: only own profile visible.
drop policy if exists seller_profiles_select_own on public.seller_profiles;
create policy seller_profiles_select_own
on public.seller_profiles
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Seller resources: seller can read and create their own rows.
drop policy if exists seller_resources_select_own on public.seller_resources;
create policy seller_resources_select_own
on public.seller_resources
for select
to authenticated
using (lower(seller_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists seller_resources_insert_own on public.seller_resources;
create policy seller_resources_insert_own
on public.seller_resources
for insert
to authenticated
with check (lower(seller_email) = lower(auth.jwt() ->> 'email'));

-- Seller ledger: seller can only read own ledger.
drop policy if exists seller_ledger_select_own on public.seller_ledger;
create policy seller_ledger_select_own
on public.seller_ledger
for select
to authenticated
using (lower(seller_email) = lower(auth.jwt() ->> 'email'));
