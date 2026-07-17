-- Belt-and-braces re-grant of the reads + writes profile pages need.
--
-- The "permission denied for table profiles" error means the caller has
-- zero grants on the table — not "permission denied for column X" (which is
-- what a partial column-grant miss produces). That points at the column-
-- level GRANT SELECT being missing on this environment, so any
-- .select('avatar_url') / .select('anything') fails at load time before
-- the buyer ever picks a file.
--
-- Yesterday's migration explicitly granted UPDATE on the mutable columns.
-- This one re-grants SELECT on the columns the app actually reads
-- (id, full_name, avatar_url) so direct reads stop tripping, and re-asserts
-- the UPDATE grant so the two are always applied together. Idempotent — safe
-- to re-run.
--
-- Sensitive columns (phone, address_*, city, postcode, bank_*, vehicle_type,
-- role, status) STAY behind the get_my_profile_full() security-definer RPC.
-- Nothing in this migration exposes those to cross-user reads.

-- SELECT — only the three columns everything on the app renders publicly.
grant select (id, full_name, avatar_url) on public.profiles to authenticated;
grant select (id, full_name, avatar_url) on public.profiles to anon;

-- UPDATE — the writeable set from yesterday's migration, re-applied so the
-- two grants are always paired. Postgres treats repeated grants as
-- idempotent no-ops.
grant update (
  full_name, phone, avatar_url,
  address_line1, address_line2, city, postcode,
  bank_account_name, bank_sort_code, bank_account_number,
  vehicle_type
) on public.profiles to authenticated;

-- Ensure the row-level UPDATE policy is in place too, mirroring
-- 20260717_reached_secure_codes_rls.sql. Idempotent do-block.
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

-- Reload PostgREST so the schema cache sees the fresh grants immediately.
NOTIFY pgrst, 'reload schema';
