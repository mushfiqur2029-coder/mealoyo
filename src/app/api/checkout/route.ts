import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Stripe needs the Node runtime (not Edge).
export const runtime = 'nodejs'

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mealoyo.com'

// Turn pounds (may arrive as a number or numeric string) into integer pence.
function toPence(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'))
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

type LineItem = {
  price_data: {
    currency: string
    product_data: { name: string; description?: string; images?: string[] }
    unit_amount: number
  }
  quantity: number
}

// Stripe rejects an empty images array and non-https URLs, and truncates long
// descriptions — so only attach each field when it's actually valid.
function productData(name: string, description?: string | null, imageUrl?: string | null) {
  const pd: { name: string; description?: string; images?: string[] } = { name }
  if (description && description.trim()) pd.description = description.trim().slice(0, 500)
  if (imageUrl && imageUrl.startsWith('https://')) pd.images = [imageUrl]
  return pd
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ── CART CHECKOUT: an array of items from a single seller ──────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      return handleCartCheckout(body)
    }

    // ── SINGLE-ITEM CHECKOUT (original flow) ───────────────────────────────
    const {
      orderId,
      listingId,
      listingName,
      amount, // food subtotal, in pounds
      deliveryFee,
      serviceFee,
      discount, // loyalty points discount in pounds (optional)
      buyerEmail,
      buyerId,
      pointsToRedeem, // optional, for the webhook to record redemption
    } = body ?? {}

    if (!orderId || !listingId || !listingName || amount == null || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const subtotalPence = toPence(amount)
    const deliveryPence = toPence(deliveryFee)
    const servicePence = toPence(serviceFee)
    const discountPence = toPence(discount)

    // Fold any loyalty discount into the food line item — Stripe Checkout does
    // not allow negative line items, so we reduce the subtotal line and label it.
    const foodPence = Math.max(0, subtotalPence - discountPence)
    const foodLabel =
      discountPence > 0
        ? `${listingName} (£${(discountPence / 100).toFixed(2)} points discount applied)`
        : listingName

    // Fetch the listing so Stripe Checkout can show the food photo + description.
    const { data: listingRow } = await supabaseAdmin
      .from('listings')
      .select('image_url, description')
      .eq('id', listingId)
      .maybeSingle()

    const line_items: LineItem[] = [
      {
        price_data: {
          currency: 'gbp',
          product_data: productData(foodLabel, listingRow?.description, listingRow?.image_url),
          unit_amount: foodPence,
        },
        quantity: 1,
      },
    ]

    if (deliveryPence > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: { name: 'Delivery fee' }, unit_amount: deliveryPence },
        quantity: 1,
      })
    }
    if (servicePence > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: { name: 'Service fee' }, unit_amount: servicePence },
        quantity: 1,
      })
    }

    const totalPence = line_items.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0)
    if (totalPence <= 0) {
      return NextResponse.json({ error: 'Order total must be greater than zero' }, { status: 400 })
    }

    const metadata: Record<string, string> = {
      orderId: String(orderId),
      listingId: String(listingId),
    }
    if (buyerId) metadata.buyerId = String(buyerId)
    if (pointsToRedeem) metadata.pointsToRedeem = String(pointsToRedeem)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: buyerEmail,
      metadata,
      // Mirror metadata onto the PaymentIntent so payment_intent.succeeded can
      // also resolve the order.
      payment_intent_data: { metadata },
      success_url: `${SITE_URL}/buyer/orders/${orderId}?payment=success`,
      cancel_url: `${SITE_URL}/dish/${listingId}?cancelled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[checkout] failed to create session:', message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

// Multiple dishes from one seller → one Stripe session with a line item per dish
// plus a single service-fee line. `orderIds` (one order row per dish, already
// created client-side) is passed to the webhook as a comma-joined list so it can
// flip them all to paid.
async function handleCartCheckout(body: {
  items: Array<{ listingId?: string; name?: string; price?: unknown; quantity?: unknown; imageUrl?: string | null }>
  orderIds?: string[]
  serviceFee?: unknown
  buyerEmail?: string
  buyerId?: string
}) {
  const { items, orderIds, serviceFee, buyerEmail, buyerId } = body

  if (!buyerEmail || !Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const line_items: LineItem[] = items.map((it) => ({
    price_data: {
      currency: 'gbp',
      product_data: productData(it.name || 'Dish', null, it.imageUrl),
      unit_amount: toPence(it.price),
    },
    quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
  }))

  const servicePence = toPence(serviceFee)
  if (servicePence > 0) {
    line_items.push({
      price_data: { currency: 'gbp', product_data: { name: 'Service fee' }, unit_amount: servicePence },
      quantity: 1,
    })
  }

  const totalPence = line_items.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0)
  if (totalPence <= 0) {
    return NextResponse.json({ error: 'Order total must be greater than zero' }, { status: 400 })
  }

  const metadata: Record<string, string> = { orderIds: orderIds.join(',') }
  if (buyerId) metadata.buyerId = String(buyerId)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items,
    customer_email: buyerEmail,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${SITE_URL}/buyer/orders?payment=success`,
    cancel_url: `${SITE_URL}/browse?cancelled=true`,
  })

  return NextResponse.json({ url: session.url })
}
