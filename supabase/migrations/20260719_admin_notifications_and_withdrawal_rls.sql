-- Admin notification RPC + withdrawal_requests SELECT policy fix.
--
-- Two independent problems bundled together because they were both blocking
-- the pending-approval workflow on the same day:
--
--   1. Admin needs a single cheap RPC to feed the notification-bell badge —
--      one round trip, five COUNTs, all filtered by the same "pending"
--      predicate on the tables the admin actually cares about.
--
--   2. Sellers / drivers cannot see their own `paid` withdrawal rows (the
--      receipt_url, paid_at). The current SELECT policy is either missing
--      or too narrow, so the client's get_my_withdrawals returns rows that
--      don't include enough data for the "Download receipt" link. The fix
--      is a wildcard SELECT policy on withdrawal_requests scoped to the
--      caller's user_id — the same rows the client already tries to read,
--      just no longer filtered by column.

-- ── admin_get_notification_counts ─────────────────────────────────────
-- Returns a single json blob so the client can destructure once. Split
-- between "brand-new registrations" (pending profile with an empty
-- pending_changes) and "resubmitted change requests" (pending profile
-- WITH a diff) so the bell dropdown can label them differently.

create or replace function public.admin_get_notification_counts()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_pending_sellers integer;
  v_pending_drivers integer;
  v_pending_changes integer;
  v_pending_withdrawals integer;
  v_pending_listings integer;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;

  select count(*) into v_pending_sellers
    from public.profiles
   where role = 'seller' and status = 'pending'
     and (pending_changes is null or pending_changes = '{}'::jsonb);

  select count(*) into v_pending_drivers
    from public.profiles
   where role = 'driver' and status = 'pending'
     and (pending_changes is null or pending_changes = '{}'::jsonb);

  select count(*) into v_pending_changes
    from public.profiles
   where status = 'pending'
     and pending_changes is not null
     and pending_changes <> '{}'::jsonb;

  select count(*) into v_pending_withdrawals
    from public.withdrawal_requests
   where status = 'pending';

  select count(*) into v_pending_listings
    from public.listings
   where status = 'pending';

  return json_build_object(
    'pending_sellers',     v_pending_sellers,
    'pending_drivers',     v_pending_drivers,
    'pending_changes',     v_pending_changes,
    'pending_withdrawals', v_pending_withdrawals,
    'pending_listings',    v_pending_listings,
    'total',
      v_pending_sellers + v_pending_drivers + v_pending_changes + v_pending_withdrawals + v_pending_listings
  );
end;
$$;

grant execute on function public.admin_get_notification_counts() to authenticated;
revoke execute on function public.admin_get_notification_counts() from anon, public;

-- ── withdrawal_requests: caller reads their own rows ─────────────────
alter table public.withdrawal_requests enable row level security;

drop policy if exists "users view own withdrawals" on public.withdrawal_requests;
create policy "users view own withdrawals"
  on public.withdrawal_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Plain column SELECT so the columns the seller / driver earnings page
-- reads (receipt_url, paid_at, rejection_reason) can be returned. If a
-- narrower column grant was in place from an earlier lockdown pass, this
-- widens it — idempotent otherwise.
grant select on public.withdrawal_requests to authenticated;

NOTIFY pgrst, 'reload schema';
