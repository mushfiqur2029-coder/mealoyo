-- Admin: permanently delete a user.
-- Logs the deletion to deletion_log, removes the profile row (which cascades to
-- listings, orders, reviews, loyalty_points, saved_listings, withdrawal_requests
-- via FK ON DELETE CASCADE) and finally removes the auth.users row so no ghost
-- auth account is left behind. Security-definer + explicit admin check so only
-- admins can run it, regardless of RLS.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorised';
  end if;
  -- Log deletion first
  insert into public.deletion_log (deleted_by, entity_type, entity_id, entity_name, metadata)
  select auth.uid(), 'user', p_user_id, full_name,
    jsonb_build_object('role', role, 'email', email, 'status', status, 'created_at', created_at)
  from public.profiles where id = p_user_id;
  -- Delete profile (cascades to listings, orders, reviews, loyalty_points, saved_listings, withdrawal_requests)
  delete from public.profiles where id = p_user_id;
  -- Delete auth user
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.admin_delete_user(uuid) to authenticated;
revoke execute on function public.admin_delete_user(uuid) from public;

NOTIFY pgrst, 'reload schema';
