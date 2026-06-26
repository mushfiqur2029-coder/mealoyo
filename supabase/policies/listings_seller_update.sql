-- Seller UPDATE policy for the `listings` table.
--
-- Context: the repo has no migrations; schema/policies were configured directly
-- in the Supabase dashboard. From the app environment we could confirm RLS is
-- ENABLED on public.listings (an unauthenticated UPDATE affects 0 rows with no
-- error), but we could NOT introspect pg_policies to confirm whether a seller
-- UPDATE policy already exists.
--
-- 1) CHECK FIRST — run this in the Supabase SQL editor to see existing policies:
--
--      select polname, cmd, qual, with_check
--      from pg_policies
--      where schemaname = 'public' and tablename = 'listings';
--
--    If a row with cmd = 'UPDATE' that scopes to `auth.uid() = seller_id`
--    already exists, you do NOT need to run the block below.
--
-- 2) APPLY (idempotent) — safe to run whether or not the policy exists.
--    `drop policy if exists` makes re-running a no-op replace.

alter table public.listings enable row level security;

drop policy if exists "Sellers can update their own listings" on public.listings;

create policy "Sellers can update their own listings"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);
