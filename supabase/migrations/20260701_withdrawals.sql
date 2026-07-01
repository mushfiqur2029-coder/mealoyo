-- Manual withdrawal payouts for sellers & drivers.
--
-- Sellers/drivers accrue a balance (seller: sum of seller_payout on delivered
-- orders; driver: sum of delivery_fee on delivered orders). They request a
-- withdrawal, which snapshots their bank details into a withdrawal_requests
-- row with status 'pending'. An admin later marks it 'paid' (after sending the
-- bank transfer by hand) or 'rejected' with a reason. There is NO Stripe
-- Connect — payouts are settled manually off-platform.
--
-- The withdrawal_requests table and the profiles.bank_* columns already exist;
-- this migration only (re)creates the RPCs and locks down their grants.

-- Balance already committed to a pending/approved/paid request is not available
-- again; only 'rejected' frees the money back up.

create or replace function public.request_withdrawal(p_amount numeric)
returns public.withdrawal_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_sort text;
  v_acct text;
  v_earned numeric;
  v_committed numeric;
  v_available numeric;
  v_row public.withdrawal_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role, bank_account_name, bank_sort_code, bank_account_number
  into v_role, v_name, v_sort, v_acct
  from public.profiles where id = v_uid;

  if v_role not in ('seller', 'driver') then
    raise exception 'Only sellers and drivers can request withdrawals';
  end if;

  if v_name is null or v_sort is null or v_acct is null
     or btrim(v_name) = '' or btrim(v_sort) = '' or btrim(v_acct) = '' then
    raise exception 'Please add your bank details before requesting a withdrawal';
  end if;

  -- Lifetime earnings from delivered orders, by role.
  if v_role = 'seller' then
    select coalesce(sum(seller_payout), 0) into v_earned
    from public.orders where seller_id = v_uid and status = 'delivered';
  else
    select coalesce(sum(delivery_fee), 0) into v_earned
    from public.orders where driver_id = v_uid and status = 'delivered';
  end if;

  -- Money already tied up in non-rejected requests.
  select coalesce(sum(amount), 0) into v_committed
  from public.withdrawal_requests
  where user_id = v_uid and status <> 'rejected';

  v_available := v_earned - v_committed;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid withdrawal amount';
  end if;

  if p_amount > v_available then
    raise exception 'Amount exceeds your available balance of £%', to_char(v_available, 'FM999999990.00');
  end if;

  insert into public.withdrawal_requests
    (user_id, amount, status, bank_account_name, bank_sort_code, bank_account_number, requested_at)
  values
    (v_uid, p_amount, 'pending', v_name, v_sort, v_acct, now())
  returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function public.request_withdrawal(numeric) from anon;
grant execute on function public.request_withdrawal(numeric) to authenticated;

-- Caller's own withdrawal history, newest first.
create or replace function public.get_my_withdrawals()
returns setof public.withdrawal_requests
language sql security definer set search_path = public stable as $$
  select * from public.withdrawal_requests
  where user_id = auth.uid()
  order by requested_at desc;
$$;
revoke execute on function public.get_my_withdrawals() from anon;
grant execute on function public.get_my_withdrawals() to authenticated;

-- Admin: every withdrawal request, joined with the requester's name/email.
-- Returns json so the requester profile can be nested (matches the UI's
-- WithdrawalRequest.profiles shape).
create or replace function public.admin_get_withdrawals()
returns setof json
language plpgsql security definer set search_path = public stable as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;

  return query
    select json_build_object(
      'id', w.id,
      'user_id', w.user_id,
      'amount', w.amount,
      'status', w.status,
      'bank_account_name', w.bank_account_name,
      'bank_sort_code', w.bank_sort_code,
      'bank_account_number', w.bank_account_number,
      'admin_note', w.admin_note,
      'requested_at', w.requested_at,
      'paid_at', w.paid_at,
      'profiles', json_build_object('full_name', p.full_name, 'email', p.email)
    )
    from public.withdrawal_requests w
    left join public.profiles p on p.id = w.user_id
    order by
      case w.status when 'pending' then 0 when 'approved' then 1 else 2 end,
      w.requested_at desc;
end;
$$;
revoke execute on function public.admin_get_withdrawals() from anon;
grant execute on function public.admin_get_withdrawals() to authenticated;

-- Admin: update a request's status. Sets paid_at when marking as paid; stores
-- the reason in admin_note when rejecting.
create or replace function public.admin_update_withdrawal(p_id uuid, p_status text, p_note text)
returns public.withdrawal_requests
language plpgsql security definer set search_path = public as $$
declare
  v_row public.withdrawal_requests;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;

  if p_status not in ('pending', 'approved', 'paid', 'rejected') then
    raise exception 'Invalid status';
  end if;

  update public.withdrawal_requests
  set status = p_status,
      admin_note = case when p_status = 'rejected' then p_note else admin_note end,
      paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Withdrawal request not found';
  end if;

  return v_row;
end;
$$;
revoke execute on function public.admin_update_withdrawal(uuid, text, text) from anon;
grant execute on function public.admin_update_withdrawal(uuid, text, text) to authenticated;

NOTIFY pgrst, 'reload schema';
