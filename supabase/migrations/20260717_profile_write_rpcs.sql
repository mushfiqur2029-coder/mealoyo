-- Self-scoped profile writers, security-definer style. Mirrors the
-- update_my_avatar / get_my_profile pattern: every function's WHERE clause
-- is hard-coded to auth.uid() so the caller can only mutate their own row.
--
-- Replaces the direct `supabase.from('profiles').update(...)` calls in
-- buyer/seller/driver profile pages and the OAuth completion flow, all of
-- which were failing with "permission denied for table profiles" after
-- the reads-lockdown grants pass (e3fc02d) that never re-granted UPDATE.

-- ── basics: name + phone + address (+ vehicle_type for drivers) ───────────
create or replace function public.update_my_profile_basics(
  p_full_name text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_postcode text,
  p_vehicle_type text default null,
  p_request_reapproval boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
begin
  select role, status into v_role, v_status
    from public.profiles where id = auth.uid();

  update public.profiles
     set full_name     = p_full_name,
         phone         = p_phone,
         address_line1 = p_address_line1,
         address_line2 = p_address_line2,
         city          = p_city,
         postcode      = p_postcode,
         -- vehicle_type is driver-only; leave alone for buyers/sellers
         -- regardless of what the client sent.
         vehicle_type  = case when v_role = 'driver' then p_vehicle_type else vehicle_type end,
         -- Re-approval is atomic with the field write so we can't leave a
         -- row in "new address, still active" state on partial failure.
         status        = case when p_request_reapproval and v_status = 'active' then 'pending' else status end
   where id = auth.uid();
end;
$$;

grant execute on function public.update_my_profile_basics(text, text, text, text, text, text, text, boolean) to authenticated;
revoke execute on function public.update_my_profile_basics(text, text, text, text, text, text, text, boolean) from anon, public;

-- ── bank details: seller/driver payout card ──────────────────────────────
create or replace function public.update_my_bank_details(
  p_bank_account_name text,
  p_bank_sort_code text,
  p_bank_account_number text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set bank_account_name   = p_bank_account_name,
         bank_sort_code      = p_bank_sort_code,
         bank_account_number = p_bank_account_number
   where id = auth.uid();
$$;

grant execute on function public.update_my_bank_details(text, text, text) to authenticated;
revoke execute on function public.update_my_bank_details(text, text, text) from anon, public;

-- ── address: OAuth completion best-effort save ───────────────────────────
create or replace function public.update_my_address(
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_postcode text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set address_line1 = p_address_line1,
         address_line2 = p_address_line2,
         city          = p_city,
         postcode      = p_postcode
   where id = auth.uid();
$$;

grant execute on function public.update_my_address(text, text, text, text) to authenticated;
revoke execute on function public.update_my_address(text, text, text, text) from anon, public;

NOTIFY pgrst, 'reload schema';
