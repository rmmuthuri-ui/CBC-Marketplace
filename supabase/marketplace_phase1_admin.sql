alter table public.seller_resources
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_product_id text;
