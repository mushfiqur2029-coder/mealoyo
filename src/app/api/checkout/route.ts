import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serviceFee as calcServiceFee } from '@/lib/pricing'
import { maxRedeemablePounds, poundsToPoints } from '@/lib/loyalty'

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
      deliveryFee,
      discount, // loyalty points discount in pounds (optional)
      buyerEmail,
      buyerId,
    } = body ?? {}

    if (!orderId || !listingId || !listingName || !buyerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // SECURITY: never trust client-supplied prices. Derive the food subtotal from
    // the DB listing price × the order's quantity, and recompute the service fee.
    // (The order row is created client-side before checkout; we read its quantity
    // and re-price it here so a tampered request can't be charged less.)
    const { data: orderRow } = await supabaseAdmin
      .from('orders')
      .select('quantity')
      .eq('id', orderId)
      .maybeSingle()
    const { data: listingRow } = await supabaseAdmin
      .from('listings')
      .select('image_url, description, price')
      .eq('id', listingId)
      .maybeSingle()
    if (!listingRow) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 400 })
    }

    const quantity = Math.max(1, Math.floor(Number(orderRow?.quantity) || 1))
    const subtotalPence = toPence(listingRow.price) * quantity
    const deliveryPence = toPence(deliveryFee)
    const servicePence = toPence(calcServiceFee(subtotalPence / 100))

    // Cap the loyalty discount at the buyer's real points balance (100 pts = £1),
    // capped again by the subtotal — a client can't discount points it lacks.
    let discountPence = toPence(discount)
    if (discountPence > 0) {
      const { data: bal } = buyerId
        ? await supabaseAdmin.rpc('get_points_balance', { p_buyer_id: String(buyerId) })
        : { data: 0 }
      const balance = typeof bal === 'number' ? bal : 0
      const maxDiscountPence = maxRedeemablePounds(balance, subtotalPence / 100) * 100
      discountPence = Math.min(discountPence, maxDiscountPence)
    }
    // Recompute the points actually redeemed from the (capped) discount so the
    // webhook records the correct amount, not whatever the client claimed.
    const pointsToRedeem = poundsToPoints(discountPence / 100)

    // Fold any loyalty discount into the food line item — Stripe Checkout does
    // not allow negative line items, so we reduce the subtotal line and label it.
    const foodPence = Math.max(0, subtotalPence - discountPence)
    const foodLabel =
      discountPence > 0
        ? `${listingName} (£${(discountPence / 100).toFixed(2)} points discount applied)`
        : listingName

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
  items: Array<{ listingId?: string; name?: string; quantity?: unknown; imageUrl?: string | null }>
  orderIds?: string[]
  buyerEmail?: string
  buyerId?: string
}) {
  const { items, orderIds, buyerEmail, buyerId } = body

  if (!buyerEmail || !Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // SECURITY: never trust client-supplied item prices. Re-price every line from
  // the DB listing so a tampered cart can't be charged less than it should be.
  const listingIds = [...new Set(items.map((it) => it.listingId).filter(Boolean) as string[])]
  const { data: dbListings } = await supabaseAdmin
    .from('listings')
    .select('id, name, price, description, image_url')
    .in('id', listingIds)
  const priceMap = new Map((dbListings ?? []).map((l) => [l.id, l]))

  let subtotalPence = 0
  const line_items: LineItem[] = []
  for (const it of items) {
    const dbl = it.listingId ? priceMap.get(it.listingId) : undefined
    if (!dbl) {
      return NextResponse.json({ error: 'One or more items are no longer available' }, { status: 400 })
    }
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1))
    const unitPence = toPence(dbl.price)
    subtotalPence += unitPence * quantity
    line_items.push({
      price_data: {
        currency: 'gbp',
        product_data: productData(dbl.name || it.name || 'Dish', dbl.description, dbl.image_url || it.imageUrl),
        unit_amount: unitPence,
      },
      quantity,
    })
  }

  // Recompute the service fee server-side from the DB subtotal.
  const servicePence = toPence(calcServiceFee(subtotalPence / 100))
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
