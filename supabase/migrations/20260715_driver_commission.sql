-- Bug 8: Driver commission — split delivery_fee into 80% driver_payout + 20%
-- driver_commission. meaLoyo keeps the 20% as additional platform revenue on
-- top of the food commission it already takes from the seller subtotal.

alter table public.orders add column if not exists driver_payout numeric default 0;
alter table public.orders add column if not exists driver_commission numeric default 0;

NOTIFY pgrst, 'reload schema';
