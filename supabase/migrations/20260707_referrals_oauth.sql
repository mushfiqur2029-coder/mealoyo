-- ============================================================================
-- meaLoyo — Referral points system + OAuth profile completion
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent (create or replace / if exists).
-- ============================================================================

-- ── FEATURE 2: Referral points ──────────────────────────────────────────────

-- Each buyer gets a shareable code; referred_by links them to whoever invited.
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);

-- Auto-assign a referral code (first 8 chars of the uuid) on new profiles.
create or replace function public.generate_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substring(new.id::text, 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists set_referral_code on public.profiles;
create trigger set_referral_code
  before insert on public.profiles
  for each row execute function public.generate_referral_code();

-- Backfill codes for profiles that pre-date the trigger.
update public.profiles
  set referral_code = upper(substring(id::text, 1, 8))
  where referral_code is null;

-- Link the calling buyer to a referrer by code. Ignores self-referral and only
-- sets referred_by once (never overwrites an existing link).
create or replace function public.apply_referral(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_referrer uuid;
begin
  if v_me is null then return; end if;
  select id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null or v_referrer = v_me then return; end if;
  update public.profiles set referred_by = v_referrer where id = v_me and referred_by is null;
end;
$$;
grant execute on function public.apply_referral(text) to authenticated;
revoke execute on function public.apply_referral(text) from public;

-- Award 150 points (£1) to the referrer when the referred buyer's FIRST order is
-- delivered. Idempotent per (referrer, referred-buyer). Called from
-- award_loyalty_points below, so it fires automatically on delivery.
create or replace function public.award_referral_points(p_buyer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_referrer_id uuid;
  v_order_count integer;
begin
  select referred_by into v_referrer_id from public.profiles where id = p_buyer_id;
  if v_referrer_id is null then return; end if;
  select count(*) into v_order_count from public.orders
    where buyer_id = p_buyer_id and status = 'delivered';
  if v_order_count <> 1 then return; end if;
  -- Already credited for this referred buyer? Skip.
  if exists (
    select 1 from public.loyalty_points
    where buyer_id = v_referrer_id and description = 'Referral:' || p_buyer_id::text
  ) then return; end if;
  insert into public.loyalty_points (buyer_id, points, type, description)
  values (v_referrer_id, 150, 'earned', 'Referral:' || p_buyer_id::text);
end;
$$;
grant execute on function public.award_referral_points(uuid) to authenticated;
revoke execute on function public.award_referral_points(uuid) from public;

-- Extend the existing delivery reward to ALSO trigger referral points, so every
-- place that marks an order delivered (seller dashboard, driver, etc.) credits
-- the referrer without any app-code change.
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
  -- Referral bonus is evaluated on every delivery (its own idempotency guard
  -- makes sure it only pays out once, on the buyer's first delivered order).
  perform public.award_referral_points(v_buyer_id);
  if exists (select 1 from public.loyalty_points where order_id = p_order_id and type = 'earned') then return; end if;
  v_points := floor(v_subtotal * 11);
  insert into public.loyalty_points (buyer_id, order_id, points, type, description)
  values (v_buyer_id, p_order_id, v_points, 'earned', 'Order #' || left(p_order_id::text, 8));
end;
$$;
grant execute on function public.award_loyalty_points(uuid) to authenticated;

-- ── FEATURE 1: OAuth profile completion ─────────────────────────────────────

-- Called from /auth/complete-profile after a first Google/Facebook sign-in.
-- Sets the caller's name/phone/role (role changes aren't allowed through a
-- normal client update, hence security definer). Creates the row if the
-- new-user trigger somehow didn't.
create or replace function public.complete_oauth_profile(p_full_name text, p_phone text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_role not in ('buyer','seller','driver') then raise exception 'Invalid role'; end if;

  update public.profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        phone     = nullif(trim(p_phone), ''),
        role      = p_role,
        status    = case when p_role = 'buyer' then 'active' else 'pending' end
  where id = v_me;

  if not found then
    insert into public.profiles (id, email, full_name, phone, role, status)
    select v_me, u.email, nullif(trim(p_full_name), ''), nullif(trim(p_phone), ''), p_role,
           case when p_role = 'buyer' then 'active' else 'pending' end
    from auth.users u where u.id = v_me;
  end if;
end;
$$;
grant execute on function public.complete_oauth_profile(text, text, text) to authenticated;
revoke execute on function public.complete_oauth_profile(text, text, text) from public;

NOTIFY pgrst, 'reload schema';
