-- Server-side atomic handover for whole cart groups.
--
-- Until now, verify_delivery_code and verify_collection_code only touched
-- the primary order row. Sibling rows in the same cart (same
-- stripe_session_id) had to be synced by the frontend after the RPC
-- returned true. Any failure between the two calls would leave siblings
-- stuck at 'ready' or 'reached' — reappearing to the driver / seller as
-- ghost orders.
--
-- These RPCs do the whole thing in one transaction: verify the code on
-- the primary, then flip the primary AND every sibling in the same
-- session to 'delivered', clear the codes, and award loyalty points per
-- row. Idempotent — safe to re-run the migration.


-- ── deliver_order_group: driver-side, delivery orders ──────────────────
create or replace function public.deliver_order_group(p_primary_order_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
  v_stored_code text;
  v_expires_at timestamptz;
  v_driver_id uuid;
  v_order_id uuid;
begin
  select driver_id, delivery_code, delivery_code_expires_at, stripe_session_id
    into v_driver_id, v_stored_code, v_expires_at, v_session_id
    from public.orders where id = p_primary_order_id;

  if v_driver_id is null or v_driver_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_stored_code is null then
    raise exception 'No delivery code generated yet';
  end if;
  if now() > v_expires_at then
    raise exception 'Delivery code has expired';
  end if;
  if v_stored_code <> p_code then
    return false;
  end if;

  -- Flip the primary AND every sibling in the same cart owned by this
  -- driver. The `id = p_primary_order_id OR stripe_session_id = ...`
  -- pattern covers legacy rows that never got a stripe_session_id (only
  -- the primary matches then). driver_id = auth.uid() guards against a
  -- sibling that was somehow reassigned mid-flight.
  update public.orders
     set status = 'delivered',
         delivery_code = null,
         delivery_code_expires_at = null
   where (id = p_primary_order_id or stripe_session_id = v_session_id)
     and driver_id = auth.uid();

  -- Award loyalty points for every row we just delivered in this session.
  -- Idempotent DB-side; no-ops if the loyalty SQL isn't installed yet.
  for v_order_id in
    select id from public.orders
      where (id = p_primary_order_id or stripe_session_id = v_session_id)
        and driver_id = auth.uid()
        and status = 'delivered'
  loop
    perform public.award_loyalty_points(v_order_id);
  end loop;

  return true;
end;
$$;
grant execute on function public.deliver_order_group(uuid, text) to authenticated;
revoke execute on function public.deliver_order_group(uuid, text) from anon, public;


-- ── collect_order_group: seller-side, collection orders ────────────────
create or replace function public.collect_order_group(p_primary_order_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
  v_stored_code text;
  v_expires_at timestamptz;
  v_seller_id uuid;
  v_order_id uuid;
begin
  select seller_id, collection_code, collection_code_expires_at, stripe_session_id
    into v_seller_id, v_stored_code, v_expires_at, v_session_id
    from public.orders where id = p_primary_order_id;

  if v_seller_id is null or v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_stored_code is null then
    raise exception 'No collection code generated yet';
  end if;
  if now() > v_expires_at then
    raise exception 'Collection code has expired';
  end if;
  if v_stored_code <> p_code then
    return false;
  end if;

  update public.orders
     set status = 'delivered',
         collection_code = null,
         collection_code_expires_at = null
   where (id = p_primary_order_id or stripe_session_id = v_session_id)
     and seller_id = auth.uid();

  for v_order_id in
    select id from public.orders
      where (id = p_primary_order_id or stripe_session_id = v_session_id)
        and seller_id = auth.uid()
        and status = 'delivered'
  loop
    perform public.award_loyalty_points(v_order_id);
  end loop;

  return true;
end;
$$;
grant execute on function public.collect_order_group(uuid, text) to authenticated;
revoke execute on function public.collect_order_group(uuid, text) from anon, public;


-- ── accept_delivery_job_group: defensive — also claim any siblings ────
-- The frontend passes all order_ids it currently sees, but if the driver's
-- data is stale (a sibling row just got added to the DB but hasn't been
-- refetched), the un-passed sibling would stay unassigned and reappear as
-- a phantom "orphan" job the next time the driver refreshes. Redeclare
-- the RPC to also sweep any siblings sharing a stripe_session_id with
-- the explicitly-passed rows.
create or replace function public.accept_delivery_job_group(p_order_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_role text;
  v_driver_status text;
  v_session_ids text[];
  v_claimed_count integer;
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

  -- First pass: claim every row explicitly passed in.
  update public.orders
     set driver_id = auth.uid()
   where id = any(p_order_ids)
     and driver_id is null
     and status = 'ready'
     and delivery_type = 'delivery';

  -- Second pass: sweep any siblings in the same Stripe sessions that
  -- weren't in the frontend's passed list. Only sessions belonging to
  -- rows we just successfully claimed — never merge unrelated carts.
  select array_agg(distinct stripe_session_id)
    into v_session_ids
    from public.orders
   where id = any(p_order_ids)
     and driver_id = auth.uid()
     and stripe_session_id is not null;

  if v_session_ids is not null and array_length(v_session_ids, 1) > 0 then
    update public.orders
       set driver_id = auth.uid()
     where stripe_session_id = any(v_session_ids)
       and driver_id is null
       and status = 'ready'
       and delivery_type = 'delivery';
  end if;

  -- Diagnostics: did we actually claim anything?
  select count(*)::int
    into v_claimed_count
    from public.orders
   where id = any(p_order_ids)
     and driver_id = auth.uid();

  if v_claimed_count = 0 then
    raise exception 'Jobs no longer available';
  end if;
end;
$$;
grant execute on function public.accept_delivery_job_group(uuid[]) to authenticated;
revoke execute on function public.accept_delivery_job_group(uuid[]) from anon, public;


NOTIFY pgrst, 'reload schema';
