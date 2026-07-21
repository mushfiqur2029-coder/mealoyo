-- Defensive helpers for the driver job-grouping fix.
--
-- Motivation: the driver dashboard groups cart delivery rows into a single
-- job card by stripe_session_id (returned by get_available_delivery_jobs +
-- get_my_active_deliveries after 20260720_short_codes_and_group_accept).
-- If that earlier migration was only partially applied — or if the RPC was
-- redefined by hand somewhere else — the id might not come back on the
-- feed rows. Belt-and-braces here:
--
--   1. Re-declare get_available_delivery_jobs / get_my_active_deliveries
--      with buyer_id + stripe_session_id + quantity, so the frontend has
--      what it needs even if the previous migration didn't take.
--   2. Small helper get_order_session_ids(uuid[]) so the frontend can
--      enrich RPC output that predates this schema, without needing to
--      grant SELECT on public.orders to drivers.
--
-- All statements are idempotent (create or replace + repeated grants),
-- safe to re-run.


-- ── Fallback lookup: session ids for a batch of orders ─────────────────
-- Definer + no auth check because the id → session_id mapping is not
-- sensitive (session_id is already exposed via the job feeds) and this
-- exists purely so drivers can group jobs when other RPCs missed it.
create or replace function public.get_order_session_ids(p_order_ids uuid[])
returns table(id uuid, stripe_session_id text, buyer_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, stripe_session_id, buyer_id, created_at
    from public.orders
   where id = any(p_order_ids);
$$;
grant execute on function public.get_order_session_ids(uuid[]) to authenticated;
revoke execute on function public.get_order_session_ids(uuid[]) from anon, public;


-- ── get_available_delivery_jobs — now also returns buyer_id ──────────
-- Same schema as after 20260720_short_codes_and_group_accept, plus buyer_id.
-- Frontend uses buyer_id + created_at as a fuzzy fallback for grouping
-- when stripe_session_id is genuinely null (very rare — the webhook has
-- set it for every Stripe-paid cart since 20260701_orders_stripe_columns).
create or replace function public.get_available_delivery_jobs()
returns table (
  order_id uuid,
  stripe_session_id text,
  buyer_id uuid,
  listing_name text,
  quantity integer,
  seller_name text,
  seller_address text,
  seller_postcode text,
  delivery_address text,
  buyer_postcode text,
  total_amount numeric,
  delivery_fee numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.id,
    o.stripe_session_id,
    o.buyer_id,
    l.name,
    o.quantity,
    p.full_name,
    concat_ws(', ', p.address_line1, p.address_line2, p.city),
    p.postcode,
    o.delivery_address,
    split_part(o.delivery_address, ' ', -1),
    o.total_amount,
    o.delivery_fee,
    o.created_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.profiles p on p.id = o.seller_id
  where o.delivery_type = 'delivery'
    and o.status = 'ready'
    and o.driver_id is null
    and o.payment_status = 'paid'
  order by o.created_at asc;
$$;
grant execute on function public.get_available_delivery_jobs() to authenticated;
revoke execute on function public.get_available_delivery_jobs() from anon, public;


-- ── get_my_active_deliveries — same schema expansion ───────────────
create or replace function public.get_my_active_deliveries()
returns table (
  order_id uuid,
  stripe_session_id text,
  buyer_id uuid,
  listing_name text,
  quantity integer,
  seller_name text,
  seller_address text,
  seller_postcode text,
  delivery_address text,
  buyer_postcode text,
  total_amount numeric,
  delivery_fee numeric,
  status text,
  pickup_code text,
  delivery_code text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.id,
    o.stripe_session_id,
    o.buyer_id,
    l.name,
    o.quantity,
    p.full_name,
    concat_ws(', ', p.address_line1, p.address_line2, p.city),
    p.postcode,
    o.delivery_address,
    split_part(o.delivery_address, ' ', -1),
    o.total_amount,
    o.delivery_fee,
    o.status,
    o.pickup_code,
    o.delivery_code,
    o.created_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.profiles p on p.id = o.seller_id
  where o.driver_id = auth.uid()
    and o.status in ('ready', 'picked_up', 'reached')
  order by o.created_at asc;
$$;
grant execute on function public.get_my_active_deliveries() to authenticated;
revoke execute on function public.get_my_active_deliveries() from anon, public;


NOTIFY pgrst, 'reload schema';
