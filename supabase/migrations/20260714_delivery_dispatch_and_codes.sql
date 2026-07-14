-- Delivery dispatch (BUG 0) + two-code delivery verification (BUG 6).
--
-- Flow for delivery orders:
--   1. Seller marks 'ready'.
--   2. Order surfaces in the driver's job feed (get_available_delivery_jobs).
--   3. Driver accepts (accept_delivery_job): driver_id gets set, status stays 'ready'.
--   4. Driver arrives at seller: seller generates pickup_code, driver enters it
--      (verify_pickup_code → status='picked_up').
--   5. Driver arrives at buyer: driver generates delivery_code, buyer sees it,
--      driver enters what buyer shows them (verify_delivery_code → status='delivered').
--
-- Note on accept semantics: the original spec's SQL set status='picked_up' on accept,
-- but that would skip the seller→driver handshake in step 4. Kept status='ready'
-- on accept so the pickup_code flow actually gates the pickup.

alter table public.orders add column if not exists pickup_code text;
alter table public.orders add column if not exists pickup_code_expires_at timestamptz;
alter table public.orders add column if not exists delivery_code text;
alter table public.orders add column if not exists delivery_code_expires_at timestamptz;

-- ── PICKUP CODE (seller → driver) ──

create or replace function public.generate_pickup_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_seller_id uuid;
begin
  select seller_id into v_seller_id from public.orders where id = p_order_id;
  if v_seller_id <> auth.uid() then raise exception 'Not authorised'; end if;
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  update public.orders
  set pickup_code = v_code, pickup_code_expires_at = now() + interval '2 hours'
  where id = p_order_id;
  return v_code;
end; $$;
grant execute on function public.generate_pickup_code(uuid) to authenticated;
revoke execute on function public.generate_pickup_code(uuid) from public;

create or replace function public.verify_pickup_code(p_order_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_driver_id uuid; v_stored_code text; v_expires_at timestamptz;
begin
  select driver_id, pickup_code, pickup_code_expires_at
  into v_driver_id, v_stored_code, v_expires_at
  from public.orders where id = p_order_id;
  if v_driver_id is null or v_driver_id <> auth.uid() then raise exception 'Not authorised'; end if;
  if v_stored_code is null then raise exception 'No pickup code generated yet'; end if;
  if now() > v_expires_at then raise exception 'Pickup code has expired'; end if;
  if v_stored_code <> p_code then return false; end if;
  update public.orders
  set status = 'picked_up', pickup_code = null, pickup_code_expires_at = null
  where id = p_order_id;
  return true;
end; $$;
grant execute on function public.verify_pickup_code(uuid, text) to authenticated;
revoke execute on function public.verify_pickup_code(uuid, text) from public;

-- ── DELIVERY CODE (driver → buyer) ──

create or replace function public.generate_delivery_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_driver_id uuid;
begin
  select driver_id into v_driver_id from public.orders where id = p_order_id;
  if v_driver_id is null or v_driver_id <> auth.uid() then raise exception 'Not authorised'; end if;
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  update public.orders
  set delivery_code = v_code, delivery_code_expires_at = now() + interval '2 hours'
  where id = p_order_id;
  return v_code;
end; $$;
grant execute on function public.generate_delivery_code(uuid) to authenticated;
revoke execute on function public.generate_delivery_code(uuid) from public;

create or replace function public.verify_delivery_code(p_order_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_driver_id uuid; v_stored_code text; v_expires_at timestamptz;
begin
  select driver_id, delivery_code, delivery_code_expires_at
  into v_driver_id, v_stored_code, v_expires_at
  from public.orders where id = p_order_id;
  if v_driver_id is null or v_driver_id <> auth.uid() then raise exception 'Not authorised'; end if;
  if v_stored_code is null then raise exception 'No delivery code generated yet'; end if;
  if now() > v_expires_at then raise exception 'Delivery code has expired'; end if;
  if v_stored_code <> p_code then return false; end if;
  update public.orders
  set status = 'delivered', delivery_code = null, delivery_code_expires_at = null
  where id = p_order_id;
  perform public.award_loyalty_points(p_order_id);
  return true;
end; $$;
grant execute on function public.verify_delivery_code(uuid, text) to authenticated;
revoke execute on function public.verify_delivery_code(uuid, text) from public;

-- ── DRIVER DISPATCH ──

create or replace function public.get_available_delivery_jobs()
returns table (
  order_id uuid,
  listing_name text,
  seller_name text,
  seller_address text,
  seller_postcode text,
  delivery_address text,
  buyer_postcode text,
  total_amount numeric,
  delivery_fee numeric,
  created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    o.id,
    l.name,
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
revoke execute on function public.get_available_delivery_jobs() from public;

-- Returns the driver's own in-progress deliveries (ready-with-me or picked_up)
-- with the same joined columns as the available-jobs feed, plus the current status.
create or replace function public.get_my_active_deliveries()
returns table (
  order_id uuid,
  listing_name text,
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
language sql security definer set search_path = public stable as $$
  select
    o.id,
    l.name,
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
    and o.status in ('ready', 'picked_up')
  order by o.created_at asc;
$$;
grant execute on function public.get_my_active_deliveries() to authenticated;
revoke execute on function public.get_my_active_deliveries() from public;

create or replace function public.accept_delivery_job(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_driver_role text; v_driver_status text;
begin
  select role, status into v_driver_role, v_driver_status
  from public.profiles where id = auth.uid();
  if v_driver_role <> 'driver' then raise exception 'Not a driver'; end if;
  if v_driver_status <> 'active' then raise exception 'Driver account not active'; end if;
  -- Only assign the driver; keep status='ready' so the pickup-code handshake at
  -- the seller is what moves the order to picked_up.
  update public.orders
  set driver_id = auth.uid()
  where id = p_order_id
    and driver_id is null
    and status = 'ready'
    and delivery_type = 'delivery';
  if not found then raise exception 'Job no longer available'; end if;
end; $$;
grant execute on function public.accept_delivery_job(uuid) to authenticated;
revoke execute on function public.accept_delivery_job(uuid) from public;

NOTIFY pgrst, 'reload schema';
