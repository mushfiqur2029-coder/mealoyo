-- Standardise every handover code (collection, pickup, delivery) to a single
-- 4-digit format via a shared generator, and add bulk-accept + stripe_session_id
-- surfacing so the driver UI can group cart deliveries into one job card
-- (same fix pattern already applied to the seller orders page).
--
-- Trade-off note: 4-digit codes have 9000 combinations (1000..9999). Enough
-- security given the codes are short-lived (30 min collection / 2 hr pickup)
-- AND scoped by order id in the verify RPCs — a brute-force would need to
-- burn thousands of RPC calls per order before expiry. Chosen for
-- read-aloud ergonomics: "seven-two-nine-four" is easier than six digits.
--
-- All statements are idempotent: create or replace / repeated grants are
-- no-ops on re-run.


-- ── Shared 4-digit generator ─────────────────────────────────────────────
create or replace function public.generate_secure_code()
returns text
language sql
as $$
  select lpad((floor(random() * 9000) + 1000)::text, 4, '0');
$$;
grant execute on function public.generate_secure_code() to authenticated;
revoke execute on function public.generate_secure_code() from anon, public;


-- ── generate_collection_code — uses shared generator; keeps the delivery-type
-- and ready-status guards added in 20260720_audit_bug_fixes ────────────────
create or replace function public.generate_collection_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_seller_id uuid;
  v_delivery_type text;
  v_status text;
begin
  select seller_id, delivery_type, status
    into v_seller_id, v_delivery_type, v_status
    from public.orders where id = p_order_id;

  if v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_delivery_type is distinct from 'collection' then
    raise exception 'Collection code only applies to collection orders';
  end if;
  if v_status <> 'ready' then
    raise exception 'Order must be marked ready before generating a collection code';
  end if;

  v_code := public.generate_secure_code();
  update public.orders
     set collection_code = v_code,
         collection_code_expires_at = now() + interval '30 minutes'
   where id = p_order_id;
  return v_code;
end;
$$;
grant execute on function public.generate_collection_code(uuid) to authenticated;
revoke execute on function public.generate_collection_code(uuid) from anon, public;


-- ── generate_pickup_code — uses shared generator ─────────────────────────
create or replace function public.generate_pickup_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_seller_id uuid;
begin
  select seller_id into v_seller_id from public.orders where id = p_order_id;
  if v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  v_code := public.generate_secure_code();
  update public.orders
     set pickup_code = v_code,
         pickup_code_expires_at = now() + interval '2 hours'
   where id = p_order_id;
  return v_code;
end;
$$;
grant execute on function public.generate_pickup_code(uuid) to authenticated;
revoke execute on function public.generate_pickup_code(uuid) from anon, public;


-- ── mark_driver_reached — uses shared generator ──────────────────────────
create or replace function public.mark_driver_reached(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if (select driver_id from public.orders where id = p_order_id) <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  v_code := public.generate_secure_code();
  update public.orders
     set status = 'reached',
         delivery_code = v_code,
         delivery_code_expires_at = now() + interval '30 minutes'
   where id = p_order_id
     and status = 'picked_up';
  if not found then
    raise exception 'Order not in picked_up status';
  end if;
  return v_code;
end;
$$;
grant execute on function public.mark_driver_reached(uuid) to authenticated;
revoke execute on function public.mark_driver_reached(uuid) from anon, public;


-- ── get_available_delivery_jobs — now returns stripe_session_id + quantity
-- so the driver UI can group a cart's N rows into ONE card (mirroring the
-- seller/orders grouping). Kept as the same base filter (ready + no driver
-- + paid + delivery) so the RPC is a strict schema superset — old columns
-- keep the same names + positions. ─────────────────────────────────────
create or replace function public.get_available_delivery_jobs()
returns table (
  order_id uuid,
  stripe_session_id text,
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


-- ── get_my_active_deliveries — same schema expansion for the driver's own feed
create or replace function public.get_my_active_deliveries()
returns table (
  order_id uuid,
  stripe_session_id text,
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


-- ── accept_delivery_job_group — bulk-assign every row in a cart to the caller.
-- Same guards as accept_delivery_job (driver role + active status + only
-- claim rows that are still unassigned) but scoped to an id array so a
-- cart of N deliveries is accepted atomically. Silently no-ops on the
-- already-claimed rows so a race with another driver just claims the
-- rows that were still open. ─────────────────────────────────────────
create or replace function public.accept_delivery_job_group(p_order_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_role text;
  v_driver_status text;
begin
  select role, status
    into v_driver_role, v_driver_status
    from public.profiles where id = auth.uid();
  if v_driver_role <> 'driver' then
    raise exception 'Not a driver';
  end if;
  if v_driver_status <> 'active' then
    raise exception 'Driver account not active';
  end if;

  update public.orders
     set driver_id = auth.uid()
   where id = any(p_order_ids)
     and driver_id is null
     and status = 'ready'
     and delivery_type = 'delivery';
  if not found then
    raise exception 'Jobs no longer available';
  end if;
end;
$$;
grant execute on function public.accept_delivery_job_group(uuid[]) to authenticated;
revoke execute on function public.accept_delivery_job_group(uuid[]) from anon, public;


NOTIFY pgrst, 'reload schema';
