-- Verification field: the exact amount Stripe charged (in pence), written by the
-- webhook on checkout.session.completed. Lets us reconcile the stored order
-- amounts (now computed server-side in /api/orders/create) against what the
-- customer actually paid. The webhook writes this best-effort in a separate
-- update, so this migration can be applied at any time without disrupting the
-- paid/pending flip.
alter table public.orders add column if not exists stripe_amount_total integer;

NOTIFY pgrst, 'reload schema';
