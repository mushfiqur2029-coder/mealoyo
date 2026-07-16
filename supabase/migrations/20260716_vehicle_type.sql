-- Vehicle type on driver profiles.
--
-- Feeds two things:
--   1. Profile-completion scoring (drivers can't hit 100% without it).
--   2. Future dispatch logic — a moped can accept jobs a bicycle can't, a van
--      can handle catering orders that don't fit on a bike.
--
-- Enum-style values are constrained by a CHECK so bad values never land in
-- the column. NULL is legal (drivers created before this migration).

alter table public.profiles
  add column if not exists vehicle_type text
  check (vehicle_type in ('bicycle', 'moped', 'car', 'van'));

NOTIFY pgrst, 'reload schema';
