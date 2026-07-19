-- request_withdrawal — self-serve withdrawal insert for sellers / drivers.
--
-- SECURITY DEFINER so the insert bypasses withdrawal_requests INSERT grants
-- (which stay revoked from anon / authenticated). Copies the bank details
-- straight off the caller's own profile row so the admin's payout page has
-- everything it needs at review time without a second join. Enforces the
-- consumer-app £5.00 minimum server-side too, not just in the client, so a
-- malicious poke past the disabled button still gets rejected cleanly.
--
-- Note: this deliberately does NOT check available balance. The seller /
-- driver earnings page already computes that from the orders + existing
-- withdrawal rows and disables the button below available; keeping the RPC
-- narrow means admin can still reject over-caps via the existing
-- admin_update_withdrawal flow if a race-condition slips one through.

create or replace function public.request_withdrawal(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bank_name text;
  v_sort_code text;
  v_account_number text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select bank_account_name, bank_sort_code, bank_account_number
    into v_bank_name, v_sort_code, v_account_number
    from public.profiles where id = v_user_id;

  if v_bank_name is null or v_sort_code is null or v_account_number is null then
    raise exception 'Please add your bank details before requesting a withdrawal';
  end if;

  if p_amount is null or p_amount < 5 then
    raise exception 'Minimum withdrawal amount is £5.00';
  end if;

  insert into public.withdrawal_requests
    (user_id, amount, status,
     bank_account_name, bank_sort_code, bank_account_number)
  values
    (v_user_id, p_amount, 'pending',
     v_bank_name, v_sort_code, v_account_number);
end;
$$;

grant execute on function public.request_withdrawal(numeric) to authenticated;
revoke execute on function public.request_withdrawal(numeric) from anon, public;

NOTIFY pgrst, 'reload schema';
