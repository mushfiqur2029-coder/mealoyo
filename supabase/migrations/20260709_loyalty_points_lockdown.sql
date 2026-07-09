-- Security hardening: stop buyers from self-awarding loyalty points.
--
-- The original policy let any authenticated buyer INSERT their own loyalty_points
-- rows (with check buyer_id = auth.uid()), so a buyer could insert type='earned'
-- rows and inflate their balance, then redeem it for money off at checkout.
--
-- Points must only ever be created by the security-definer functions
-- (award_loyalty_points, apply_referral) and by the service-role Stripe webhook
-- when recording a redemption — all of which bypass RLS. No client INSERT is
-- needed, so we remove the permissive policy. The SELECT policy (buyers view
-- their own points) is unchanged.
drop policy if exists "buyers earn points via system" on public.loyalty_points;

NOTIFY pgrst, 'reload schema';
