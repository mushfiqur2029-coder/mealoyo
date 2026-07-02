-- Richer withdrawal lifecycle: approve → paid, with an uploaded bank-transfer
-- receipt and a stored rejection reason.
--
-- Builds on 20260701_withdrawals.sql. Admins now: approve a pending request,
-- then mark it paid (optionally attaching a receipt image/PDF), or reject it
-- with a reason. Sellers/drivers see the receipt + status on their earnings page.

-- ── New columns ─────────────────────────────────────────────────────────────
alter table public.withdrawal_requests add column if not exists receipt_url text;
alter table public.withdrawal_requests add column if not exists rejection_reason text;
alter table public.withdrawal_requests add column if not exists approved_at timestamptz;

-- ── Storage bucket for receipts (public read) ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admins upload receipts" on storage.objects;
create policy "admins upload receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "public read receipts" on storage.objects;
create policy "public read receipts" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'receipts');

-- ── admin_update_withdrawal: now carries an optional receipt_url and records
-- approved_at / rejection_reason across the lifecycle. Signature changes from
-- (uuid,text,text) → (uuid,text,text,text), so drop the old overload first.
drop function if exists public.admin_update_withdrawal(uuid, text, text);
create or replace function public.admin_update_withdrawal(
  p_id uuid,
  p_status text,
  p_note text default null,
  p_receipt_url text default null
)
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
  set status           = p_status,
      admin_note       = p_note,
      rejection_reason = case when p_status = 'rejected' then p_note else rejection_reason end,
      receipt_url      = coalesce(p_receipt_url, receipt_url),
      approved_at      = case when p_status = 'approved' then now() else approved_at end,
      paid_at          = case when p_status = 'paid' then now() else paid_at end
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Withdrawal request not found';
  end if;

  return v_row;
end;
$$;
revoke execute on function public.admin_update_withdrawal(uuid, text, text, text) from anon;
grant execute on function public.admin_update_withdrawal(uuid, text, text, text) to authenticated;

-- ── admin_get_withdrawals: expose the new fields to the admin UI ────────────
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
      'rejection_reason', w.rejection_reason,
      'receipt_url', w.receipt_url,
      'requested_at', w.requested_at,
      'approved_at', w.approved_at,
      'paid_at', w.paid_at,
      'profiles', json_build_object('full_name', p.full_name, 'email', p.email, 'role', p.role)
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

NOTIFY pgrst, 'reload schema';
