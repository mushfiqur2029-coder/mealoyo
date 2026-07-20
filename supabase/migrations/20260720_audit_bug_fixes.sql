-- Ship-blocking fixes surfaced by the 2026-07-20 platform audit.
--
-- All statements are idempotent (create table if not exists, create or replace
-- function, drop policy if exists) so this can be re-run without side effects.
--
-- Covers:
--   Bug 2 — deletion_log table + RLS (admin_delete_user() has always inserted
--           into it, but the table never existed → every admin delete threw)
--   Bug 3 — admin_promote_to_admin RPC (settings "Add admin" form was 404-ing)
--   Bug 4 — generate_collection_code guarded to delivery_type='collection' only
--   Bug 5 — request_withdrawal enforces available-balance cap server-side
--   Bug 8 — admin_approve_profile now unpauses listings that were auto-paused
--           by the reapproval flow (previously stayed 'pending' forever)


-- ── Bug 2: deletion_log audit trail ───────────────────────────────────────
create table if not exists public.deletion_log (
  id uuid default gen_random_uuid() primary key,
  deleted_by uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  entity_name text,
  metadata jsonb,
  deleted_at timestamptz default now()
);

alter table public.deletion_log enable row level security;

-- Admin-only reads (settings page renders the log). Drop-then-create so re-running
-- the migration doesn't error on the second pass.
drop policy if exists "admins view deletion log" on public.deletion_log;
create policy "admins view deletion log" on public.deletion_log
  for select to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Any authenticated caller can insert a log entry, but only for themselves —
-- admin_delete_user() runs as the caller (via definer + auth.uid()), and
-- src/lib/deletionLog.ts inserts client-side as the acting admin.
drop policy if exists "system can insert deletion log" on public.deletion_log;
create policy "system can insert deletion log" on public.deletion_log
  for insert to authenticated
  with check (deleted_by = auth.uid());

grant select, insert on public.deletion_log to authenticated;


-- ── Bug 3: admin_promote_to_admin ────────────────────────────────────────
-- Called from admin/settings/page.tsx's "Add admin" form. Security-definer
-- with an explicit admin role check so only an existing admin can promote.
create or replace function public.admin_promote_to_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;

  update public.profiles set role = 'admin' where email = p_email;
  if not found then
    raise exception 'No user found with that email';
  end if;
end;
$$;

grant execute on function public.admin_promote_to_admin(text) to authenticated;
revoke execute on function public.admin_promote_to_admin(text) from anon, public;


-- ── Bug 4: generate_collection_code — collection-only guard ──────────────
-- Previously would silently succeed on delivery orders (the buyer never sees
-- the code and the seller ends up with a dangling code on the row). Reject
-- the call at the RPC boundary instead.
create or replace function public.generate_collection_code(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_seller_id uuid;
  v_delivery_type text;
  v_status text;
begin
  select seller_id, delivery_type, status
    into v_seller_id, v_delivery_type, v_status
    from public.orders where id = p_order_id;

  if v_seller_id <> auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_delivery_type is distinct from 'collection' then
    raise exception 'Collection code only applies to collection orders';
  end if;
  if v_status <> 'ready' then
    raise exception 'Order must be marked ready before generating a collection code';
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  update public.orders
     set collection_code = v_code,
         collection_code_expires_at = now() + interval '30 minutes'
   where id = p_order_id;
  return v_code;
end;
$$;

grant execute on function public.generate_collection_code(uuid) to authenticated;
revoke execute on function public.generate_collection_code(uuid) from anon, public;


-- ── Bug 5: request_withdrawal — server-side balance cap ──────────────────
-- Previously the RPC only enforced the £5 minimum; a race (or a manual poke
-- past the disabled button) could submit a request larger than the caller's
-- available balance. Available = total earnings from delivered orders (seller
-- payouts + driver payouts, one of which will be zero based on role) minus
-- withdrawals not yet rejected. Matches the math in earnings pages.
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
  v_seller_earned numeric;
  v_driver_earned numeric;
  v_withdrawn numeric;
  v_available numeric;
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

  select coalesce(sum(seller_payout), 0) into v_seller_earned
    from public.orders
   where seller_id = v_user_id and status = 'delivered';

  select coalesce(sum(driver_payout), 0) into v_driver_earned
    from public.orders
   where driver_id = v_user_id and status = 'delivered';

  select coalesce(sum(amount), 0) into v_withdrawn
    from public.withdrawal_requests
   where user_id = v_user_id
     and status in ('pending', 'approved', 'paid');

  v_available := v_seller_earned + v_driver_earned - v_withdrawn;

  if p_amount > v_available then
    raise exception 'Insufficient balance — you have £% available', to_char(v_available, 'FM999999990.00');
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


-- ── Bug 8: admin_approve_profile — unpause listings on approval ──────────
-- When a seller edits sensitive fields (name/phone/address), update_my_profile_basics
-- flips their status from 'active' to 'pending' AND src/app/(seller)/seller/profile
-- also flips their listings to 'pending'. Admin approving the profile change now
-- also re-activates those paused listings. Only listings owned by this seller and
-- currently in 'pending' are touched — first-time-approval listings for OTHER
-- sellers are not affected.
create or replace function public.admin_approve_profile(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Not authorised';
  end if;

  update public.profiles
     set status = 'active',
         pending_changes = null,
         changes_submitted_at = null
   where id = p_id;

  -- Re-activate any listings this seller had auto-paused when they submitted
  -- the profile change for reapproval.
  update public.listings
     set status = 'live'
   where seller_id = p_id
     and status = 'pending';
end;
$$;

grant execute on function public.admin_approve_profile(uuid) to authenticated;
revoke execute on function public.admin_approve_profile(uuid) from anon, public;


NOTIFY pgrst, 'reload schema';
