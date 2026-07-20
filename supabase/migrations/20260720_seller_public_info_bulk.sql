-- Bulk variant of get_seller_postcode for the browse + homepage feeds.
--
-- The public feeds want to render seller name + postcode alongside every
-- listing (postcode is needed for the buyer-side distance filter). Before
-- the 20260717 profiles lockdown, both pages joined
--   .from('listings').select('*, profiles:seller_id(full_name, postcode)')
-- but postcode is now behind the column-grant wall — anon can only read
-- (id, full_name, avatar_url) directly. PostgREST returns 42501 on the
-- whole embedded read, so `data` came back null and both feeds silently
-- rendered "No live dishes yet" for logged-out visitors.
--
-- get_seller_postcode(uuid) already exposes a single seller's postcode via a
-- definer RPC scoped to role='seller' — safe for anon since the dish page
-- is public. This migration adds the array-batched variant so we can
-- resolve N sellers in one round trip instead of N-per-page.
--
-- Idempotent — create or replace + repeated grants are no-ops.

create or replace function public.get_seller_public_info(p_ids uuid[])
returns table(id uuid, full_name text, postcode text)
language sql
security definer
set search_path = public
stable
as $$
  select id, full_name, postcode
    from public.profiles
   where id = any(p_ids)
     and role = 'seller';
$$;

grant execute on function public.get_seller_public_info(uuid[]) to anon, authenticated;
revoke execute on function public.get_seller_public_info(uuid[]) from public;

NOTIFY pgrst, 'reload schema';
