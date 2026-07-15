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

// Server-authoritative CART checkout. Mirrors /api/orders/create but for the
// multi-item cart: the client sends only { items: [{ listingId, quantity,
// deliveryType }] } and every price, fee, commission and payout is computed HERE
// from the database. One order row is created per dish (per-seller accounting),
// with the whole cart's service fee on the first order, and a single Stripe
// session covers them all.
export const runtime = 'nodejs'

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mealoyo.com'

function toPence(n: number): number {
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function productData(name: string, description?: string | null, imageUrl?: string | null) {
  const pd: { name: string; description?: string; images?: string[] } = { name }
  if (description && description.trim()) pd.description = description.trim().slice(0, 500)
  if (imageUrl && imageUrl.startsWith('https://')) pd.images = [imageUrl]
  return pd
}

type CartInput = { listingId?: string; quantity?: unknown }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items: CartInput[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
    }
    // Cart-level checkout inputs: single delivery choice for the whole cart
    // (Deliveroo-style — the buyer picks once, not per dish).
    const deliveryType = body?.deliveryType === 'delivery' ? 'delivery' : 'collection'
    const rawDeliveryAddress = typeof body?.deliveryAddress === 'string' ? body.deliveryAddress : ''
    const rawBuyerPostcode = typeof body?.buyerPostcode === 'string' ? body.buyerPostcode : ''

    // 1. Authenticated buyer (from the session cookie).
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to order.' }, { status: 401 })
    }

    // 2. Load every listing by id (real price + status + seller), service role.
    const listingIds = [...new Set(items.map((it) => it.listingId).filter(Boolean) as string[])]
    if (listingIds.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
    }
    const { data: dbListings } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, name, price, status, image_url, description')
      .in('id', listingIds)
    const listingMap = new Map((dbListings ?? []).map((l) => [l.id, l]))

    // 3. Validate: all present, all live, all the same (active) seller, and not
    //    the buyer's own cook. meaLoyo carts are single-seller.
    const sellerIds = new Set<string>()
    for (const it of items) {
      const l = it.listingId ? listingMap.get(it.listingId) : undefined
      if (!l) return NextResponse.json({ error: 'One or more items are no longer available.' }, { status: 400 })
      if (l.status !== 'live') return NextResponse.json({ error: `"${l.name}" is not available right now.` }, { status: 400 })
      sellerIds.add(l.seller_id)
    }
    if (sellerIds.size > 1) {
      return NextResponse.json({ error: 'Your cart contains items from more than one cook.' }, { status: 400 })
    }
    const sellerId = [...sellerIds][0]
    if (sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot order your own dishes.' }, { status: 400 })
    }
    const { data: seller } = await supabaseAdmin
      .from('profiles')
      .select('id, status, postcode')
      .eq('id', sellerId)
      .maybeSingle()
    if (!seller || seller.status !== 'active') {
      return NextResponse.json({ error: 'This cook is not accepting orders right now.' }, { status: 400 })
    }

    // 3b. Delivery fee — computed server-side from postcode distance. The
    // whole cart shares one delivery drop, so we quote once and put the entire
    // fee on the first order row (like the service fee).
    let deliveryFee = 0
    if (deliveryType === 'delivery') {
      // Use the smallest delivery_radius_miles across the cart's dishes (all
      // from the same seller) as the constraint. If any dish is collection-only
      // (radius=0), we bail out.
      const { data: cartListings } = await supabaseAdmin
        .from('listings')
        .select('delivery_radius_miles')
        .in('id', listingIds)
      const radii = (cartListings || []).map(l => l.delivery_radius_miles ?? 3)
      const radius = radii.length ? Math.min(...radii) : 3
      if (radius <= 0) {
        return NextResponse.json({ error: 'This cook offers collection only.' }, { status: 400 })
      }
      const sellerPc = typeof seller.postcode === 'string' ? seller.postcode.trim() : ''
      const buyerPc = rawBuyerPostcode.trim()
      if (!buyerPc || !isValidUKPostcode(buyerPc)) {
        return NextResponse.json({ error: 'Please enter a valid UK postcode for delivery.' }, { status: 400 })
      }
      if (sellerPc && isValidUKPostcode(sellerPc)) {
        const [sLoc, bLoc] = await Promise.all([lookupPostcode(sellerPc), lookupPostcode(buyerPc)])
        if (sLoc && bLoc) {
          const miles = haversineDistance(sLoc.latitude, sLoc.longitude, bLoc.latitude, bLoc.longitude)
          const fee = deliveryFeeForDistance(miles, radius)
          if (fee === null) {
            return NextResponse.json({ error: 'Sorry, this cook doesn\'t deliver to your area.' }, { status: 400 })
          }
          deliveryFee = fee
        } else {
          deliveryFee = FLAT_DELIVERY_FEE
        }
      } else {
        deliveryFee = FLAT_DELIVERY_FEE
      }
    }
    const driverPayout = Math.round(deliveryFee * 0.8 * 100) / 100
    const driverCommission = Math.round(deliveryFee * 0.2 * 100) / 100

    // 4. Price every line from the DB and build the per-dish order rows.
    const cartSubtotal = items.reduce((sum, it) => {
      const l = listingMap.get(it.listingId as string)!
      const qty = Math.max(1, Math.min(50, Math.floor(Number(it.quantity) || 1)))
      return sum + Math.round(parseFloat(l.price) * qty * 100) / 100
    }, 0)
    const svcFee = calcServiceFee(cartSubtotal)

    const orderRows = items.map((it, idx) => {
      const l = listingMap.get(it.listingId as string)!
      const qty = Math.max(1, Math.min(50, Math.floor(Number(it.quantity) || 1)))
      const lineSub = Math.round(parseFloat(l.price) * qty * 100) / 100
      const svcForOrder = idx === 0 ? svcFee : 0 // whole-cart service fee rides on the first order
      // Whole-cart delivery fee + address ride on the first order row so
      // dispatch has one drop to fulfil (like the service fee).
      const feeForOrder = idx === 0 ? deliveryFee : 0
      const payoutForOrder = idx === 0 ? driverPayout : 0
      const commissionForOrder = idx === 0 ? driverCommission : 0
      const addressForOrder = idx === 0 && deliveryType === 'delivery'
        ? (rawDeliveryAddress.trim() || null)
        : null
      return {
        buyer_id: user.id,
        seller_id: sellerId,
        listing_id: l.id,
        quantity: qty,
        total_amount: Math.round((lineSub + svcForOrder + feeForOrder) * 100) / 100,
        delivery_fee: feeForOrder,
        driver_payout: payoutForOrder,
        driver_commission: commissionForOrder,
        service_fee: svcForOrder,
        platform_commission: calcCommission(lineSub),
        seller_payout: sellerReceives(lineSub),
        status: 'pending_payment',
        payment_status: 'unpaid',
        delivery_type: deliveryType,
        delivery_address: addressForOrder,
        notes: null,
      }
    })

    // 5. Persist all order rows (service role → RLS bypass).
    const { data: created, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert(orderRows)
      .select('id')
    if (orderErr || !created || created.length === 0) {
      console.error('[orders/create-cart] insert failed:', orderErr?.message)
      return NextResponse.json({ error: 'Could not create your order. Please try again.' }, { status: 500 })
    }
    const orderIds = created.map((o) => o.id)

    // 6. One Stripe session, a line per dish (DB price × qty) + a service-fee line.
    const line_items = items.map((it) => {
      const l = listingMap.get(it.listingId as string)!
      const qty = Math.max(1, Math.min(50, Math.floor(Number(it.quantity) || 1)))
      return {
        price_data: {
          currency: 'gbp',
          product_data: productData(l.name || 'Dish', l.description, l.image_url),
          unit_amount: toPence(parseFloat(l.price)),
        },
        quantity: qty,
      }
    })
    if (toPence(svcFee) > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: productData('Service fee'), unit_amount: toPence(svcFee) },
        quantity: 1,
      })
    }
    if (toPence(deliveryFee) > 0) {
      line_items.push({
        price_data: { currency: 'gbp', product_data: productData('Delivery fee'), unit_amount: toPence(deliveryFee) },
        quantity: 1,
      })
    }

    const metadata: Record<string, string> = {
      orderIds: orderIds.join(','),
      buyerId: String(user.id),
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: user.email,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${SITE_URL}/buyer/orders?payment=success`,
      cancel_url: `${SITE_URL}/browse?cancelled=true`,
    })

    const total = Math.round((cartSubtotal + svcFee + deliveryFee) * 100) / 100
    return NextResponse.json({ orderIds, total, sessionUrl: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orders/create-cart] failed:', message)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
