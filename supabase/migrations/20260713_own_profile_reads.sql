-- Own-profile & seller-postcode reads after the profiles column lockdown.
--
-- The column grant on public.profiles only exposes (id, full_name, avatar_url)
-- to anon/authenticated. That correctly stops one user reading another's
-- address/phone/bank, but it ALSO broke the app's own-profile reads: the
-- profile, earnings and dish pages read the caller's own address / bank /
-- postcode with a direct `select`, which now returns 42501 (permission denied
-- for column) → surfaced in the browser as a 403.
--
-- get_my_profile() only returns identity columns (full_name, phone, email,
-- role, status) — NOT address/postcode/bank — so it can't cover these reads.
-- The correct, row-safe fix is a security-definer RPC that returns the caller's
-- OWN full row (self-scoped to auth.uid()), bypassing the column grant without
-- exposing anyone else's data.

-- Caller's own complete profile row. security definer → bypasses the column
-- grant; the WHERE auth.uid() clause guarantees a user only ever gets their own
-- row, so no cross-row leak. authenticated only (anon has no auth.uid()).
create or replace function public.get_my_profile_full()
returns public.profiles
language sql security definer set search_path = public stable as $$
  select * from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_profile_full() to authenticated;
revoke execute on function public.get_my_profile_full() from anon, public;

-- A seller's postcode, for the dish page's distance-based delivery quote. The
-- postcode column isn't granted for direct reads (privacy: it would expose every
-- user's postcode). Expose ONLY a seller's postcode, one id at a time, via this
-- definer RPC. Returns null for non-sellers / unknown ids. Safe for anon since
-- the dish page is public.
create or replace function public.get_seller_postcode(p_seller_id uuid)
returns text
language sql security definer set search_path = public stable as $$
  select postcode from public.profiles where id = p_seller_id and role = 'seller';
$$;

grant execute on function public.get_seller_postcode(uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
