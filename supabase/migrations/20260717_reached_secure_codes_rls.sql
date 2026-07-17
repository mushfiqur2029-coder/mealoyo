-- ============================================================================
-- Bug 1: Own-profile UPDATE policy
-- ----------------------------------------------------------------------------
-- After the column lockdown, some deployments lost a full row-level UPDATE
-- policy — direct .update() calls (e.g. avatar_url from AvatarUpload) failed
-- with "permission denied for table profiles" even for the row's owner.
-- Add an explicit self-update policy so authenticated users can always write
-- their own row. Column-level GRANT UPDATE still limits which columns they
-- can touch; RLS just decides which ROWS.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'users update own profile'
  ) then
    create policy "users update own profile" on public.profiles
      for update to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Column-level UPDATE grant — allow the fields the profile pages, avatar
-- uploader and OAuth complete flow write. `status` and `role` are
-- deliberately excluded (only admin RPCs mutate those).
grant update (
  full_name, phone, avatar_url,
  address_line1, address_line2, city, postcode,
  bank_account_name, bank_sort_code, bank_account_number,
  vehicle_type
) on public.profiles to authenticated;

-- ============================================================================
-- Bug 6: 'reached' order status
-- ----------------------------------------------------------------------------
-- Driver marks "Reached" when they arrive at the buyer's door. That flip
-- generates the delivery code and signals the buyer to read it out. Before
-- this, drivers were both generating the code AND verifying against it in
-- one screen with no visible "I'm here" state — buyers never got the
-- realtime nudge to open their code.
-- ============================================================================

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'pending_payment', 'pending', 'accepted', 'cooking',
    'ready', 'picked_up', 'reached', 'delivered', 'cancelled'
  ));

-- ============================================================================
-- Bug 7: 8-character cryptographically-secure code columns + generator
-- ----------------------------------------------------------------------------
-- floor(random() * 1000000) → 1M combinations. At 8 digits we jump to 100M
-- and use gen_random_bytes for a CSPRNG source. Collision check against
-- currently-active orders keeps duplicate codes out of the wild — with 100M
-- combinations and typical concurrent-order counts, retries should be
-- astronomically rare, but the guard is cheap.
-- ============================================================================

alter table public.orders alter column collection_code type varchar(8);
alter table public.orders alter column pickup_code     type varchar(8);
alter table public.orders alter column delivery_code   type varchar(8);

create or replace function public.generate_secure_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_random bytea;
begin
  loop
    -- One gen_random_bytes(4) call → 32 random bits → % 100M for 8 digits.
    v_random := gen_random_bytes(4);
    v_code := lpad((
      (get_byte(v_random, 0)::bigint * 16777216
       + get_byte(v_random, 1)::bigint * 65536
       + get_byte(v_random, 2)::bigint * 256
       + get_byte(v_random, 3)::bigint)
      % 100000000
    )::text, 8, '0');

    -- Collision guard: reject if this exact code is already in use on any
    -- active order across any of the three code columns. At 100M combos
    -- with typical concurrent-order counts this loop should exit on the
    -- first iteration essentially always.
    if not exists (
      select 1 from public.orders
      where (collection_code = v_code or pickup_code = v_code or delivery_code = v_code)
        and status not in ('delivered', 'cancelled')
    ) then
      return v_code;
    end if;

    v_attempts := v_attempts + 1;
    if v_attempts >= 10 then
      raise exception 'Could not generate a unique code after 10 attempts';
    end if;
  end loop;
end;
$$;

grant execute on function public.generate_secure_code() to authenticated;

-- ============================================================================
-- Rewrite the three existing code-generation RPCs to use the secure generator.
-- Signatures, permissions and expiry windows are preserved.
-- ============================================================================

create or replace function public.generate_collection_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_seller_id uuid;
begin
  select seller_id into v_seller_id from public.orders where id = p_order_id;
  if v_seller_id <> auth.uid() then raise exception 'Not authorised'; end if;
  v_code := public.generate_secure_code();
  update public.orders
  set collection_code = v_code,
      collection_code_expires_at = now() + interval '30 minutes'
  where id = p_order_id;
  return v_code;
end; $$;

create or replace function public.generate_pickup_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_seller_id uuid;
begin
  select seller_id into v_seller_id from public.orders where id = p_order_id;
  if v_seller_id <> auth.uid() then raise exception 'Not authorised'; end if;
  v_code := public.generate_secure_code();
  update public.orders
  set pickup_code = v_code,
      pickup_code_expires_at = now() + interval '2 hours'
  where id = p_order_id;
  return v_code;
end; $$;

create or replace function public.generate_delivery_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_driver_id uuid;
begin
  select driver_id into v_driver_id from public.orders where id = p_order_id;
  if v_driver_id is null or v_driver_id <> auth.uid() then raise exception 'Not authorised'; end if;
  v_code := public.generate_secure_code();
  update public.orders
  set delivery_code = v_code,
      delivery_code_expires_at = now() + interval '2 hours'
  where id = p_order_id;
  return v_code;
end; $$;

grant execute on function public.generate_collection_code(uuid) to authenticated;
grant execute on function public.generate_pickup_code(uuid)     to authenticated;
grant execute on function public.generate_delivery_code(uuid)   to authenticated;

-- ============================================================================
-- Bug 6: mark_driver_reached — driver "I'm here" button.
-- Sets status='reached' AND generates the delivery code in one atomic flip so
-- the buyer's realtime UPDATE stream sees both together. Returns the code so
-- the driver's UI can show it immediately without a follow-up read.
-- ============================================================================

create or replace function public.mark_driver_reached(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_driver_id uuid; v_status text;
begin
  select driver_id, status
    into v_driver_id, v_status
    from public.orders
    where id = p_order_id;
  if v_driver_id is null or v_driver_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_status <> 'picked_up' then
    raise exception 'Order must be picked up before you can mark it reached';
  end if;

  v_code := public.generate_secure_code();
  update public.orders
  set status = 'reached',
      delivery_code = v_code,
      delivery_code_expires_at = now() + interval '30 minutes'
  where id = p_order_id and status = 'picked_up';
  return v_code;
end;
$$;

grant execute on function public.mark_driver_reached(uuid) to authenticated;
revoke execute on function public.mark_driver_reached(uuid) from public;

-- ============================================================================
-- Bug 6: get_my_active_deliveries needs to include status='reached' too so
-- the driver's active list keeps the order after they mark reached.
-- ============================================================================

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
    and o.status in ('ready', 'picked_up', 'reached')
  order by o.created_at asc;
$$;
grant execute on function public.get_my_active_deliveries() to authenticated;

NOTIFY pgrst, 'reload schema';
