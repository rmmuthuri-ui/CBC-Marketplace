begin;

-- 1) Keep one seller_ledger row per payment, remove duplicate payout items first.
with ranked as (
  select
    l.id,
    l.source_payment_id,
    row_number() over (
      partition by l.source_payment_id
      order by l.created_at asc, l.id asc
    ) as rn
  from public.seller_ledger l
  where l.source_payment_id is not null
),
duplicates as (
  select id
  from ranked
  where rn > 1
)
delete from public.seller_payout_items spi
using duplicates d
where spi.ledger_entry_id = d.id;

with ranked as (
  select
    l.id,
    l.source_payment_id,
    row_number() over (
      partition by l.source_payment_id
      order by l.created_at asc, l.id asc
    ) as rn
  from public.seller_ledger l
  where l.source_payment_id is not null
),
duplicates as (
  select id
  from ranked
  where rn > 1
)
delete from public.seller_ledger l
using duplicates d
where l.id = d.id;

-- 2) Recompute payout totals after duplicate item cleanup.
update public.seller_payouts p
set
  total_gross = coalesce(s.total_gross, 0),
  total_fee = coalesce(s.total_fee, 0),
  total_net = coalesce(s.total_net, 0),
  updated_at = now()
from (
  select
    payout_id,
    sum(gross_amount) as total_gross,
    sum(fee_amount) as total_fee,
    sum(net_amount) as total_net
  from public.seller_payout_items
  group by payout_id
) s
where p.id = s.payout_id;

update public.seller_payouts
set
  total_gross = 0,
  total_fee = 0,
  total_net = 0,
  updated_at = now()
where id not in (select payout_id from public.seller_payout_items);

-- 3) Enforce one ledger row per payment permanently.
create unique index if not exists seller_ledger_source_payment_unique_idx
  on public.seller_ledger (source_payment_id)
  where source_payment_id is not null;

commit;
