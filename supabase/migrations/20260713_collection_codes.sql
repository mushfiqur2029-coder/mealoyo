-- Collection verification codes for pickup orders.
-- The seller triggers code generation when they're ready to hand over the food;
-- the buyer sees the 6-digit code on their order page (via realtime); the seller
-- keys it in to flip the order to delivered and award loyalty points.

alter table public.orders add column if not exists collection_code text;
alter table public.orders add column if not exists collection_code_expires_at timestamptz;

create or replace function public.generate_collection_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_seller_id uuid;
begin
  select seller_id into v_seller_id from public.orders where id = p_order_id;
  if v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  update public.orders
  set collection_code = v_code,
      collection_code_expires_at = now() + interval '30 minutes'
  where id = p_order_id;
  return v_code;
end;
$$;
grant execute on function public.generate_collection_code(uuid) to authenticated;
revoke execute on function public.generate_collection_code(uuid) from public;

create or replace function public.verify_collection_code(p_order_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_seller_id uuid;
  v_stored_code text;
  v_expires_at timestamptz;
begin
  select seller_id, collection_code, collection_code_expires_at
  into v_seller_id, v_stored_code, v_expires_at
  from public.orders where id = p_order_id;

  if v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_stored_code is null then
    raise exception 'No collection code generated';
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
  where id = p_order_id;
  perform public.award_loyalty_points(p_order_id);
  return true;
end;
$$;
grant execute on function public.verify_collection_code(uuid, text) to authenticated;
revoke execute on function public.verify_collection_code(uuid, text) from public;

NOTIFY pgrst, 'reload schema';
