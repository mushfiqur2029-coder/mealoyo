-- verify_pickup_code — server-side sibling sync + diagnostic errors.
--
-- Old signature (from 20260714_delivery_dispatch_and_codes):
--   verify_pickup_code(order_id, code) → boolean
--   Only flipped the primary row to picked_up. Sibling cart rows sharing
--   stripe_session_id were left on 'ready' and reappeared as ghost jobs
--   the next time the driver refreshed.
--
-- New behaviour:
--   Same signature, same success return (true) and code-mismatch return
--   (false). On successful verify, ALSO flips every sibling in the same
--   stripe_session_id (owned by the same driver) to picked_up. Error
--   messages now name the exact failure so the driver knows what went
--   wrong when the RPC throws.
--
-- Idempotent — safe to re-run.

create or replace function public.verify_pickup_code(p_order_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_stored_code text;
  v_expires_at timestamptz;
  v_session_id text;
begin
  select driver_id, pickup_code, pickup_code_expires_at, stripe_session_id
    into v_driver_id, v_stored_code, v_expires_at, v_session_id
    from public.orders where id = p_order_id;

  if v_driver_id is null then
    raise exception 'Order not assigned to any driver yet';
  end if;
  if v_driver_id <> auth.uid() then
    raise exception 'Not authorised — this order is assigned to a different driver';
  end if;
  if v_stored_code is null then
    raise exception 'No pickup code has been generated yet — ask the cook to tap "Show pickup code"';
  end if;
  if now() > v_expires_at then
    raise exception 'Pickup code has expired — ask the cook to generate a new one';
  end if;
  if v_stored_code <> p_code then
    return false;
  end if;

  -- Flip the primary AND every sibling in the same cart (owned by this
  -- driver) to picked_up. The (id = p_order_id OR stripe_session_id = ...)
  -- pattern covers legacy rows that never got a stripe_session_id (only
  -- the primary matches then). driver_id = auth.uid() guards against a
  -- sibling that somehow got reassigned.
  update public.orders
     set status = 'picked_up',
         pickup_code = null,
         pickup_code_expires_at = null
   where (id = p_order_id or stripe_session_id = v_session_id)
     and driver_id = auth.uid()
     and status = 'ready';

  return true;
end;
$$;
grant execute on function public.verify_pickup_code(uuid, text) to authenticated;
revoke execute on function public.verify_pickup_code(uuid, text) from anon, public;

NOTIFY pgrst, 'reload schema';
