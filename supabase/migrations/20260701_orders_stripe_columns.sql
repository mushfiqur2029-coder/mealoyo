-- Stripe payment tracking on orders.
-- stripe_session_id doubles as the idempotency gate for the webhook's one-time
-- side effects (loyalty award + listing order_count) — those run only when it
-- is still null. payment_status: 'unpaid' at order creation (pending_payment),
-- flipped to 'paid' by the webhook once Stripe confirms the charge.

alter table public.orders add column if not exists stripe_payment_id text;
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists payment_status text default 'unpaid';

NOTIFY pgrst, 'reload schema';
