import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@/lib/supabase-server'
import {
  serviceFee as calcServiceFee,
  commission as calcCommission,
  sellerReceives,
  lookupPostcode,
  haversineDistance,
  deliveryFeeForDistance,
  isValidUKPostcode,
  FLAT_DELIVERY_FEE,
} from '@/lib/pricing'
import { maxRedeemablePounds, poundsToPoints } from '@/lib/loyalty'

// Server-authoritative order creation + Stripe checkout. The client sends only
// inputs (which dish, how many, delivery choice) — every price, fee, discount,
// commission and payout is computed HERE from the database, so a tampered
// request can never store wrong amounts or be charged less than it should be.
export const runtime = 'nodejs'

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mealoyo.com'

// pounds → integer pence.
function toPence(n: number): number {
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

// Stripe rejects empty images arrays and non-https URLs, and truncates long
// descriptions — only attach each field when it's valid.
function productData(name: string, description?: string | null, imageUrl?: string | null) {
  const pd: { name: string; description?: string; images?: string[] } = { name }
  if (description && description.trim()) pd.description = description.trim().slice(0, 500)
  if (imageUrl && imageUrl.startsWith('https://')) pd.images = [imageUrl]
  return pd
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      listingId,
      quantity: rawQuantity,
      deliveryType: rawDeliveryType,
      deliveryAddress,
      notes,
      buyerPostcode,
      pointsToRedeem: rawPoints,
    } = body ?? {}

    if (!listingId) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
    }

    // 1. Authenticated user (from the session cookie).
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to order.' }, { status: 401 })
    }

    // 2. Listing — real price + status, straight from the DB.
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, name, price, status, delivery_radius_miles, image_url, description')
      .eq('id', listingId)
      .maybeSingle()
    if (!listing) {
      return NextResponse.json({ error: 'Dish not found.' }, { status: 404 })
    }
    if (listing.status !== 'live') {
      return NextResponse.json({ error: 'This dish is not available right now.' }, { status: 400 })
    }
    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot order your own dish.' }, { status: 400 })
    }

    // 3. Seller must be active; grab their postcode for the distance calc.
    const { data: seller } = await supabaseAdmin
      .from('profiles')
      .select('id, status, postcode')
      .eq('id', listing.seller_id)
      .maybeSingle()
    if (!seller || seller.status !== 'active') {
      return NextResponse.json({ error: 'This cook is not accepting orders right now.' }, { status: 400 })
    }

    const quantity = Math.max(1, Math.min(50, Math.floor(Number(rawQuantity) || 1)))
    const unitPrice = parseFloat(listing.price)
    if (!isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: 'This dish has an invalid price.' }, { status: 400 })
    }
    const subtotal = Math.round(unitPrice * quantity * 100) / 100

    // 4. Delivery fee — computed server-side from postcode distance.
    const deliveryType = rawDeliveryType === 'delivery' ? 'delivery' : 'collection'
    const radius = listing.delivery_radius_miles ?? 3
    let deliveryFee = 0
    if (deliveryType === 'delivery') {
      if (radius <= 0) {
        return NextResponse.json({ error: 'This cook offers collection only.' }, { status: 400 })
      }
      const sellerPc = typeof seller.postcode === 'string' ? seller.postcode.trim() : ''
      const buyerPc = typeof buyerPostcode === 'string' ? buyerPostcode.trim() : ''
      if (sellerPc && buyerPc && isValidUKPostcode(sellerPc) && isValidUKPostcode(buyerPc)) {
        const [sLoc, bLoc] = await Promise.all([lookupPostcode(sellerPc), lookupPostcode(buyerPc)])
        if (sLoc && bLoc) {
          const miles = haversineDistance(sLoc.latitude, sLoc.longitude, bLoc.latitude, bLoc.longitude)
          const fee = deliveryFeeForDistance(miles, radius)
          if (fee === null) {
            return NextResponse.json({ error: 'Delivery is not available to your postcode. Try collection.' }, { status: 400 })
          }
          deliveryFee = fee
        } else {
          // A postcode didn't resolve — fall back to the flat fee (settled at dispatch).
          deliveryFee = FLAT_DELIVERY_FEE
        }
      } else {
        deliveryFee = FLAT_DELIVERY_FEE
      }
    }

    // 5. Service fee.
    const svcFee = calcServiceFee(subtotal)

    // 6. Loyalty discount — verify the buyer actually holds the points.
    let discount = 0
    let pointsRedeemed = 0
    const requestedPounds = Math.floor((Number(rawPoints) || 0) / 100) // points → whole pounds
    if (requestedPounds > 0) {
      const { data: bal } = await supabaseAdmin.rpc('get_points_balance', { p_buyer_id: user.id })
      const balance = typeof bal === 'number' ? bal : 0
      discount = Math.min(requestedPounds, maxRedeemablePounds(balance, subtotal))
      pointsRedeemed = poundsToPoints(discount)
    }

    // 7. Commission + seller payout (on the food subtotal only).
    const platformCommission = calcCommission(subtotal)
    const sellerPayout = sellerReceives(subtotal)

    // 7b. Driver split of the delivery fee: 80% payout / 20% platform commission.
    // Both are 0 on collection orders.
    const driverPayout = Math.round(deliveryFee * 0.8 * 100) / 100
    const driverCommission = Math.round(deliveryFee * 0.2 * 100) / 100

    const total = Math.max(0, Math.round((subtotal + svcFee + deliveryFee - discount) * 100) / 100)

    // 8. Persist the order with the server-computed amounts (service role → RLS bypass).
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: listing.seller_id,
        listing_id: listing.id,
        quantity,
        total_amount: total,
        delivery_fee: deliveryFee,
        driver_payout: driverPayout,
        driver_commission: driverCommission,
        service_fee: svcFee,
        platform_commission: platformCommission,
        seller_payout: sellerPayout,
        status: 'pending_payment',
        payment_status: 'unpaid',
        delivery_type: deliveryType,
        delivery_address:
          deliveryType === 'delivery' && typeof deliveryAddress === 'string'
            ? deliveryAddress.trim() || null
            : null,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) || null : null,
      })
      .select('id')
      .single()
    if (orderErr || !order) {
      console.error('[orders/create] order insert failed:', orderErr?.message)
      return NextResponse.json({ error: 'Could not create your order. Please try again.' }, { status: 500 })
    }

    // 9. Stripe Checkout session. Fold any discount into the food line (Stripe
    // rejects negative line items).
    const foodPence = Math.max(0, toPence(subtotal) - toPence(discount))
    const foodLabel =
      discount > 0
        ? `${listing.name} (£${discount.toFixed(2)} points discount applied)`
        : listing.name

    const line_items = [
      {
        price_data: {
          currency: 'gbp',
          product_data: productData(foodLabel, listing.description, listing.image_url),
          unit_amount: foodPence,
        },
        quantity: 1,
      },
    ]
    if (toPence(deliveryFee) > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: productData('Delivery fee'), unit_amount: toPence(deliveryFee) },
        quantity: 1,
      })
    }
    if (toPence(svcFee) > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: productData('Service fee'), unit_amount: toPence(svcFee) },
        quantity: 1,
      })
    }

    const metadata: Record<string, string> = {
      orderId: String(order.id),
      listingId: String(listing.id),
      buyerId: String(user.id),
    }
    if (pointsRedeemed > 0) metadata.pointsToRedeem = String(pointsRedeemed)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: user.email,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${SITE_URL}/buyer/orders/${order.id}?payment=success`,
      cancel_url: `${SITE_URL}/dish/${listing.id}?cancelled=true`,
    })

    return NextResponse.json({ orderId: order.id, total, sessionUrl: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orders/create] failed:', message)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
