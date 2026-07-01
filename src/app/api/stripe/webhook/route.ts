import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Stripe signature verification needs the raw request body and the Node runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set — cannot verify signature')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Raw body (NOT JSON-parsed) is required for signature verification.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
    }
    // Other event types are acknowledged with 200 so Stripe stops retrying.
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[webhook] error handling ${event.type}:`, message)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// Primary handler. Owns the one-time side effects (loyalty redemption + order
// count) — gated on stripe_session_id being null so it runs exactly once, even
// if payment_intent.succeeded arrives first or Stripe retries this event.
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId
  if (!orderId) {
    console.warn('[webhook] checkout.session.completed missing orderId metadata')
    return
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, stripe_session_id, listing_id')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    console.warn(`[webhook] order ${orderId} not found for checkout.session.completed`)
    return
  }

  // Already processed this session → idempotent no-op.
  if (order.stripe_session_id === session.id) return

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  const { error: updErr } = await supabaseAdmin
    .from('orders')
    .update({
      stripe_session_id: session.id,
      stripe_payment_id: paymentIntentId,
      payment_status: 'paid',
      // Flip out of pending_payment here too, in case the payment_intent event
      // has not arrived yet.
      status: order.status === 'pending_payment' ? 'pending' : order.status,
    })
    .eq('id', orderId)

  if (updErr) {
    console.error(`[webhook] failed to update order ${orderId}:`, updErr.message)
    return
  }

  // --- One-time side effects (only reached because stripe_session_id was null) ---
  const buyerId = session.metadata?.buyerId
  const pointsToRedeem = parseInt(session.metadata?.pointsToRedeem ?? '0', 10)

  if (buyerId && pointsToRedeem > 0) {
    const { error: loyErr } = await supabaseAdmin.from('loyalty_points').insert({
      buyer_id: buyerId,
      order_id: orderId,
      points: pointsToRedeem,
      type: 'redeemed',
      description: `Redeemed on order #${String(orderId).slice(0, 8)}`,
    })
    if (loyErr) console.error('[webhook] loyalty redemption insert failed:', loyErr.message)
  }

  // Bump the listing's lifetime order count (powers "Most popular"). The
  // auth-gated RPC can't run under the service role, so update directly.
  const listingId = order.listing_id ?? session.metadata?.listingId
  if (listingId) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('order_count')
      .eq('id', listingId)
      .single()
    if (listing) {
      await supabaseAdmin
        .from('listings')
        .update({ order_count: (listing.order_count ?? 0) + 1 })
        .eq('id', listingId)
    }
  }
}

// Secondary handler: flips the order out of pending_payment. Does NOT run side
// effects — those belong solely to checkout.session.completed.
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId
  if (!orderId) return

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (!order || order.status !== 'pending_payment') return

  await supabaseAdmin
    .from('orders')
    .update({ status: 'pending', payment_status: 'paid', stripe_payment_id: pi.id })
    .eq('id', orderId)
}
