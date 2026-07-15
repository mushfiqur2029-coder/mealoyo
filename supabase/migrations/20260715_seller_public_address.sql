-- Public collection-address lookup for the cart panel.
--
-- The profiles column grant hides address_line1/city from cross-user reads
-- (privacy), but for the cart's "Collect from" line we need to show a seller's
-- collection address to the buyer BEFORE they order. The seller has already
-- consented to this by listing publicly.
--
-- Returns only the coarse collection fields (address_line1, city) for a
-- seller — never postcode/phone/bank/address_line2. security definer bypasses
-- the column grant; the role='seller' clause + hard-coded column list mean
-- nothing else leaks. Safe for anon (the browse page is public).

create or replace function public.get_seller_public_address(p_seller_id uuid)
returns table (address_line1 text, city text)
language sql security definer set search_path = public stable as $$
  select address_line1, city
  from public.profiles
  where id = p_seller_id and role = 'seller';
$$;

grant execute on function public.get_seller_public_address(uuid) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
