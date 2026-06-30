-- Loyalty points system.
-- Buyers earn floor(food-subtotal * 11) points per delivered order and can
-- redeem points for money off at checkout (100 points = £1).

create table if not exists public.loyalty_points (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  type text check (type in ('earned','redeemed')) not null,
  description text,
  created_at timestamptz default now()
);

alter table public.loyalty_points enable row level security;

create policy "buyers view own points" on public.loyalty_points
  for select to authenticated using (buyer_id = auth.uid());

create policy "buyers earn points via system" on public.loyalty_points
  for insert to authenticated with check (buyer_id = auth.uid());

create or replace function public.award_loyalty_points(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_buyer_id uuid;
  v_subtotal numeric;
  v_points integer;
begin
  select buyer_id, (total_amount - coalesce(delivery_fee,0) - coalesce(service_fee,0))
  into v_buyer_id, v_subtotal
  from public.orders where id = p_order_id and status = 'delivered';
  if v_buyer_id is null then return; end if;
  if exists (select 1 from public.loyalty_points where order_id = p_order_id and type = 'earned') then return; end if;
  v_points := floor(v_subtotal * 11);
  insert into public.loyalty_points (buyer_id, order_id, points, type, description)
  values (v_buyer_id, p_order_id, v_points, 'earned', 'Order #' || left(p_order_id::text, 8));
end;
$$;
grant execute on function public.award_loyalty_points(uuid) to authenticated;

create or replace function public.get_points_balance(p_buyer_id uuid)
returns integer language sql security definer set search_path = public stable as $$
  select coalesce(sum(case when type = 'earned' then points else -points end), 0)::integer
  from public.loyalty_points where buyer_id = p_buyer_id;
$$;
grant execute on function public.get_points_balance(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
