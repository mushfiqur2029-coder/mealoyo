-- Pending-changes tracking for the re-approval workflow.
--
-- When a seller/driver edits a sensitive field on their profile (name / phone
-- / address) while their account is active, we flip their status to 'pending'
-- so an admin has to re-approve. Until now the admin just saw the *new*
-- profile row with no indication of what changed. This migration captures a
-- JSON diff of the changes at write-time and stores it on the row so the
-- admin modal can render "old → new" side-by-side.

-- ── Storage columns ──────────────────────────────────────────────────────
alter table public.profiles add column if not exists pending_changes jsonb;
alter table public.profiles add column if not exists changes_submitted_at timestamptz;

-- Column-scoped SELECT grant so the RPCs below (which run as invoker on read)
-- and the two side-channel helpers can return the fields to clients through
-- PostgREST. Idempotent — repeated grants are no-ops.
grant select (pending_changes, changes_submitted_at) on public.profiles to authenticated;

-- ── Basics writer, with diff tracking ────────────────────────────────────
-- Drops-and-replaces the update_my_profile_basics from 20260717. Behaviour
-- is unchanged for buyers and for non-reapproval saves; the new logic only
-- kicks in when the client passes p_request_reapproval = true.
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
  v_old_name text;
  v_old_phone text;
  v_old_a1 text;
  v_old_a2 text;
  v_old_city text;
  v_old_postcode text;
  v_old_vehicle text;
  v_changes jsonb;
begin
  select role, status, full_name, phone, address_line1, address_line2, city, postcode, vehicle_type
    into v_role, v_status, v_old_name, v_old_phone, v_old_a1, v_old_a2, v_old_city, v_old_postcode, v_old_vehicle
    from public.profiles where id = auth.uid();

  -- Compute the field-by-field diff only if this save is a reapproval
  -- submission. NULL-safe comparisons (`is distinct from`) so a null → value
  -- transition is recorded, not silently skipped.
  v_changes := '{}'::jsonb;
  if p_request_reapproval then
    if p_full_name is distinct from v_old_name then
      v_changes := v_changes || jsonb_build_object('full_name',
        jsonb_build_object('label', 'Full name', 'old', v_old_name, 'new', p_full_name));
    end if;
    if p_phone is distinct from v_old_phone then
      v_changes := v_changes || jsonb_build_object('phone',
        jsonb_build_object('label', 'Phone', 'old', v_old_phone, 'new', p_phone));
    end if;
    if p_address_line1 is distinct from v_old_a1 then
      v_changes := v_changes || jsonb_build_object('address_line1',
        jsonb_build_object('label', 'Address line 1', 'old', v_old_a1, 'new', p_address_line1));
    end if;
    if p_address_line2 is distinct from v_old_a2 then
      v_changes := v_changes || jsonb_build_object('address_line2',
        jsonb_build_object('label', 'Address line 2', 'old', v_old_a2, 'new', p_address_line2));
    end if;
    if p_city is distinct from v_old_city then
      v_changes := v_changes || jsonb_build_object('city',
        jsonb_build_object('label', 'City', 'old', v_old_city, 'new', p_city));
    end if;
    if p_postcode is distinct from v_old_postcode then
      v_changes := v_changes || jsonb_build_object('postcode',
        jsonb_build_object('label', 'Postcode', 'old', v_old_postcode, 'new', p_postcode));
    end if;
    if v_role = 'driver' and p_vehicle_type is distinct from v_old_vehicle then
      v_changes := v_changes || jsonb_build_object('vehicle_type',
        jsonb_build_object('label', 'Vehicle type', 'old', v_old_vehicle, 'new', p_vehicle_type));
    end if;
  end if;

  update public.profiles
     set full_name     = p_full_name,
         phone         = p_phone,
         address_line1 = p_address_line1,
         address_line2 = p_address_line2,
         city          = p_city,
         postcode      = p_postcode,
         vehicle_type  = case when v_role = 'driver' then p_vehicle_type else vehicle_type end,
         -- Only flip active → pending when the client asked for reapproval
         -- (i.e. a sensitive field genuinely changed).
         status        = case when p_request_reapproval and v_status = 'active' then 'pending' else status end,
         -- Store the diff when reapproving. Preserve any existing
         -- pending_changes on non-reapproval saves so a phone-only tweak
         -- doesn't wipe the earlier diff the admin still needs to see.
         pending_changes = case when p_request_reapproval then v_changes else pending_changes end,
         changes_submitted_at = case when p_request_reapproval then now() else changes_submitted_at end
   where id = auth.uid();
end;
$$;

grant execute on function public.update_my_profile_basics(text, text, text, text, text, text, text, boolean) to authenticated;
revoke execute on function public.update_my_profile_basics(text, text, text, text, text, text, text, boolean) from anon, public;

-- ── Side-channel: read own pending changes ─────────────────────────────
-- Small definer function so the seller/driver profile page can show a
-- "Your changes are awaiting admin approval" banner without depending on
-- get_my_profile_full being amended.
create or replace function public.get_my_pending_changes()
returns table (pending_changes jsonb, changes_submitted_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select pending_changes, changes_submitted_at
    from public.profiles
   where id = auth.uid();
$$;

grant execute on function public.get_my_pending_changes() to authenticated;
revoke execute on function public.get_my_pending_changes() from anon, public;

-- ── Side-channel: admin reads pending changes for one user ─────────────
create or replace function public.admin_get_pending_changes(p_user_id uuid)
returns table (pending_changes jsonb, changes_submitted_at timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Not authorised';
  end if;

  return query
    select p.pending_changes, p.changes_submitted_at
      from public.profiles p
     where p.id = p_user_id;
end;
$$;

grant execute on function public.admin_get_pending_changes(uuid) to authenticated;
revoke execute on function public.admin_get_pending_changes(uuid) from anon, public;

-- ── Admin approve: set active AND clear the diff atomically ────────────
-- Existing admin_update_profile_status still works for suspend / reactivate
-- flows; this new RPC is for the "approve pending changes" action so we
-- don't leave stale pending_changes on the row after approval.
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
end;
$$;

grant execute on function public.admin_approve_profile(uuid) to authenticated;
revoke execute on function public.admin_approve_profile(uuid) from anon, public;

NOTIFY pgrst, 'reload schema';
