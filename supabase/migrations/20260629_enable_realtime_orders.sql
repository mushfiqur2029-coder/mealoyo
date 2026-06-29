-- Enable Supabase Realtime for the `orders` table.
--
-- Required by:
--   • src/app/(buyer)/buyer/orders/[id]/page.tsx  — live order status tracking
--   • src/app/(seller)/seller/orders/page.tsx     — instant new-order notifications
--
-- Realtime only broadcasts changes for tables that belong to the
-- `supabase_realtime` publication. Run this once in the Supabase SQL editor
-- (Dashboard → SQL Editor) or via the CLI. It is idempotent.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- Emit the full row on UPDATE so filtered subscriptions and old-record access
-- behave predictably. (Realtime still enforces the table's existing RLS
-- policies, so buyers only receive events for their own orders and sellers
-- only for orders placed with them.)
alter table public.orders replica identity full;
