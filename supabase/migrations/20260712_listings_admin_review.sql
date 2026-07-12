-- Admin listing moderation: store the moderation note + timestamp on each
-- listing, and expose one security-definer RPC that flips a listing's status
-- (live / pending / suspended) and records the note in a single call.
--
-- The seller's listings page reads listings with `select *`, so `admin_note`
-- surfaces to them automatically once an admin requests changes.

alter table public.listings add column if not exists admin_note text;
alter table public.listings add column if not exists admin_reviewed_at timestamptz;

-- Set a listing's status and (optionally) attach/clear the moderation note.
--   'live'      → approve; note cleared
--   'pending'   → request changes; p_note tells the seller what to fix
--   'suspended' → take down; note cleared
-- security definer so it bypasses RLS, but guarded to admins only — otherwise
-- any authenticated user could flip any listing live. (The task stub used
-- `language sql` with no guard; that would be an authorisation hole, so this is
-- plpgsql with the same admin check as admin_delete_user.)
create or replace function public.admin_update_listing_status(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;
  if p_status not in ('live', 'pending', 'suspended') then
    raise exception 'Invalid status: %', p_status;
  end if;
  update public.listings
  set status = p_status,
      admin_note = case when p_status = 'pending' then p_note else null end,
      admin_reviewed_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.admin_update_listing_status(uuid, text, text) to authenticated;
revoke execute on function public.admin_update_listing_status(uuid, text, text) from public;

NOTIFY pgrst, 'reload schema';
