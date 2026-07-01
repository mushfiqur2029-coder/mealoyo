import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

// Stripe needs the Node runtime (not Edge).
export const runtime = 'nodejs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mealoyo.com'

// Turn pounds (may arrive as a number or numeric string) into integer pence.
function toPence(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'))
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
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

    const line_items: Array<{
      price_data: { currency: string; product_data: { name: string }; unit_amount: number }
      quantity: number
    }> = [
      {
        price_data: { currency: 'gbp', product_data: { name: foodLabel }, unit_amount: foodPence },
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
