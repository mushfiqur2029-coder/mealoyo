-- Self-scoped avatar_url writer, security-definer style.
--
-- Mirrors the get_my_profile / get_my_profile_full pattern already used
-- everywhere in the codebase: a SECURITY DEFINER function whose body only
-- touches the CALLER's own row via auth.uid(). Bypasses RLS + column grants
-- (that's the whole point — no matter which environment forgets to grant
-- update on avatar_url, this still works) while remaining inherently safe
-- because the WHERE clause is hard-coded to auth.uid().
--
-- Replaces the /api/avatar/update Node route which kept hitting cookie /
-- Bearer plumbing edge cases on Vercel.

create or replace function public.update_my_avatar(p_avatar_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set avatar_url = p_avatar_url
   where id = auth.uid();
$$;

grant execute on function public.update_my_avatar(text) to authenticated;
revoke execute on function public.update_my_avatar(text) from anon, public;

NOTIFY pgrst, 'reload schema';
