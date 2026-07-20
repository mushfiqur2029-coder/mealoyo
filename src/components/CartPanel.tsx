'use client'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; a plain <img> avoids next/image remotePatterns config */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/cartStore'
import { supabase } from '@/lib/supabase'
import AddressLookup, { type AddressValue } from '@/components/AddressLookup'
import {
  serviceFee as calcServiceFee,
  isValidUKPostcode,
  lookupPostcode,
  haversineDistance,
  deliveryFeeForDistance,
  FLAT_DELIVERY_FEE,
} from '@/lib/pricing'

type DeliveryQuote =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; distance: number; fee: number }
  | { status: 'flat'; fee: number }
  | { status: 'invalid' }
  | { status: 'notfound' }

// Seller info the cart panel needs for the delivery quote + collection card.
interface SellerInfo {
  id: string
  full_name: string | null
  postcode: string | null
  address_line1: string | null
  city: string | null
}

export default function CartPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Mobile swipe-to-dismiss: while dragging we override the panel transform.
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  // ── Delivery/collection choice + address form (moved here from dish page) ──
  const [deliveryType, setDeliveryType] = useState<'collection' | 'delivery'>('collection')
  // Whole address in one object — the AddressLookup component owns the postcode
  // input, dropdown and manual fallback.
  const [address, setAddress] = useState<AddressValue>({ address_line1: '', address_line2: '', city: '', postcode: '' })
  const [quote, setQuote] = useState<DeliveryQuote>({ status: 'idle' })
  const [seller, setSeller] = useState<SellerInfo | null>(null)
  const [savedLoaded, setSavedLoaded] = useState(false)

  // Portal + body-scroll lock — same as before.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const svc = calcServiceFee(subtotal)
  const sellerName = items[0]?.sellerName ?? null
  const sellerId = items[0]?.sellerId ?? null

  // Fetch seller postcode + collection address whenever the cart opens or the
  // seller changes. Address comes from the definer RPC so it works despite the
  // profiles column lockdown.
  useEffect(() => {
    if (!isOpen || !sellerId) return
    let alive = true
    ;(async () => {
      const [{ data: pc }, { data: addrRow }] = await Promise.all([
        supabase.rpc('get_seller_postcode', { p_seller_id: sellerId }),
        supabase.rpc('get_seller_public_address', { p_seller_id: sellerId }),
      ])
      if (!alive) return
      console.log('[cart] seller lookup', { sellerId, postcode: pc, addrRow })
      setSeller({
        id: sellerId,
        full_name: sellerName,
        postcode: typeof pc === 'string' ? pc : null,
        address_line1: (addrRow?.[0]?.address_line1 as string | undefined) ?? null,
        city: (addrRow?.[0]?.city as string | undefined) ?? null,
      })
    })()
    return () => { alive = false }
  }, [isOpen, sellerId, sellerName])

  // Auto-fill from the buyer's saved profile the first time the cart opens.
  useEffect(() => {
    if (!isOpen || savedLoaded) return
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSavedLoaded(true); return }
      const { data: row } = await supabase.rpc('get_my_profile_full')
      setAddress({
        address_line1: row?.address_line1 || '',
        address_line2: row?.address_line2 || '',
        city: row?.city || '',
        postcode: row?.postcode || '',
      })
      setSavedLoaded(true)
    })()
  }, [isOpen, savedLoaded])

  // Live distance quote. Fires when delivery is selected and the postcode +
  // seller info are both ready. Debounced so we don't hit postcodes.io on
  // every keystroke.
  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      if (!active) return
      if (deliveryType !== 'delivery' || !seller) { setQuote({ status: 'idle' }); return }
      // No per-listing radius any more — every dish is deliverable
      // platform-wide. If the seller hasn't set a postcode we fall back to
      // the flat fee (settled at dispatch); otherwise we always return a
      // real tiered fee based on measured distance.
      if (!seller.postcode || !isValidUKPostcode(seller.postcode)) {
        setQuote({ status: 'flat', fee: FLAT_DELIVERY_FEE })
        return
      }
      const pc = address.postcode.trim()
      if (!pc) { setQuote({ status: 'idle' }); return }
      if (!isValidUKPostcode(pc)) { setQuote({ status: 'invalid' }); return }
      setQuote({ status: 'checking' })
      const [buyerLoc, sellerLoc] = await Promise.all([lookupPostcode(pc), lookupPostcode(seller.postcode)])
      if (!active) return
      if (!buyerLoc) { setQuote({ status: 'notfound' }); return }
      if (!sellerLoc) { setQuote({ status: 'flat', fee: FLAT_DELIVERY_FEE }); return }
      const distance = haversineDistance(buyerLoc.latitude, buyerLoc.longitude, sellerLoc.latitude, sellerLoc.longitude)
      const fee = deliveryFeeForDistance(distance)
      setQuote({ status: 'ok', distance, fee })
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [deliveryType, address.postcode, seller])

  const deliveryFee: number =
    deliveryType === 'delivery'
      ? quote.status === 'ok' || quote.status === 'flat' ? quote.fee : 0
      : 0
  const total = subtotal + svc + deliveryFee

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setDragY(delta)
  }
  const onTouchEnd = () => {
    if (dragY > 90) onClose()
    setDragY(0)
    startY.current = null
  }

  // Client-side validation before the API takes over.
  const validateForCheckout = (): string | null => {
    if (!items.length) return 'Your cart is empty.'
    if (deliveryType === 'delivery') {
      if (!address.postcode.trim() || !isValidUKPostcode(address.postcode)) return 'Please enter a valid UK postcode for delivery.'
      if (!address.address_line1.trim()) return 'Please pick or enter your street address.'
      if (quote.status === 'invalid' || quote.status === 'notfound') return 'Please enter a valid UK postcode.'
    }
    return null
  }

  const handleCheckout = async () => {
    const problem = validateForCheckout()
    if (problem) { setError(problem); return }
    setError('')
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    try {
      // Combine into the single string the driver dispatch view expects.
      // Postcode last so split_part(..., ' ', -1) still returns buyer postcode.
      const combined = deliveryType === 'delivery'
        ? [
            address.address_line1.trim(),
            address.address_line2.trim(),
            address.city.trim(),
            address.postcode.trim().toUpperCase(),
          ].filter(Boolean).join(', ')
        : ''

      const res = await fetch('/api/orders/create-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({ listingId: it.listingId, quantity: it.quantity })),
          deliveryType,
          deliveryAddress: combined,
          buyerPostcode: deliveryType === 'delivery' ? address.postcode.trim().toUpperCase() : '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.sessionUrl) throw new Error(data.error || 'Could not start checkout')
      window.location.assign(data.sessionUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.')
      setLoading(false)
    }
  }

  const panelStyle: React.CSSProperties =
    dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {}

  if (!mounted) return null

  return createPortal(
    <>
      <style>{`
        .cart-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1400;
          opacity: 0; visibility: hidden; transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s;
        }
        .cart-backdrop.open { opacity: 1; visibility: visible; }
        .cart-panel {
          position: fixed; top: 0; right: 0; height: 100vh; width: 420px; max-width: 100vw;
          background: #fff; z-index: 1401; display: flex; flex-direction: column;
          box-shadow: -8px 0 40px rgba(0,0,0,0.18);
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .cart-panel.open { transform: translateX(0); }
        .cart-grab { display: none; }
        .cart-qty-btn { transition: all 0.14s cubic-bezier(0.34,1.2,0.64,1); }
        .cart-qty-btn:active { transform: scale(0.92); }
        .cart-checkout:hover { background: #A00055 !important; }
        .cart-remove:hover { color: #C8006A !important; }
        .cart-input:focus { border-color: #C8006A !important; outline: none; background: #fff !important; }
        .cart-dt-card { transition: all 0.16s cubic-bezier(0.34,1.2,0.64,1); cursor: pointer; }
        @media (max-width: 768px) {
          .cart-panel {
            top: auto; bottom: 0; right: 0; left: 0; width: 100%; height: 92vh;
            border-radius: 20px 20px 0 0; box-shadow: 0 -8px 40px rgba(0,0,0,0.2);
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
          }
          .cart-panel.open { transform: translateY(0); }
          .cart-grab { display: block; }
        }
      `}</style>

      <div className={`cart-backdrop${isOpen ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside
        className={`cart-panel${isOpen ? ' open' : ''}`}
        style={panelStyle}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        {/* Mobile grab handle — the drag target for swipe-to-close */}
        <div
          className="cart-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ padding: '10px 0 4px', cursor: 'grab', flexShrink: 0 }}
        >
          <div style={{ width: 44, height: 5, borderRadius: 100, background: '#E0E0E0', margin: '0 auto' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px', borderBottom: '1px solid #F0F0F0', flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
              Your cart
            </h2>
            {sellerName && (
              <div style={{ fontSize: 12.5, color: '#C8006A', fontWeight: 700, marginTop: 2 }}>from {sellerName}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="cart-remove"
                style={{ background: 'none', border: 'none', fontSize: 12.5, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close cart"
              style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid #E0E0E0', background: '#fff', fontSize: 18, color: '#1A1A1A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Items / empty state */}
        {items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>🛒</div>
            <h3 style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Your cart is empty</h3>
            <p style={{ fontSize: 14, color: '#1A1A1A', opacity: 0.8, lineHeight: 1.6, marginBottom: 22, maxWidth: 260 }}>
              Add some home-cooked food and it&apos;ll show up here.
            </p>
            <Link
              href="/browse"
              onClick={onClose}
              className="cart-checkout"
              style={{ display: 'inline-flex', alignItems: 'center', height: 46, padding: '0 24px', background: '#C8006A', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 6px 18px rgba(200,0,106,0.28)' }}
            >
              Browse food →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
              {items.map((it) => (
                <div key={it.listingId} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #F5F0F3' }}>
                  {/* Image / emoji */}
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                    {it.cuisineEmoji || '🍽️'}
                    {it.imageUrl && (
                      <img
                        src={it.imageUrl}
                        alt={it.listingName}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.listingName}</div>
                      <button
                        onClick={() => removeItem(it.listingId)}
                        aria-label={`Remove ${it.listingName}`}
                        className="cart-remove"
                        style={{ background: 'none', border: 'none', fontSize: 15, color: '#1A1A1A', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 2 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.75, marginTop: 1, marginBottom: 8 }}>
                      £{it.price.toFixed(2)} each
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      {/* Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          onClick={() => updateQuantity(it.listingId, it.quantity - 1)}
                          className="cart-qty-btn"
                          aria-label="Decrease quantity"
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E0E0E0', background: '#fff', fontSize: 16, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', minWidth: 18, textAlign: 'center' }}>{it.quantity}</span>
                        <button
                          onClick={() => updateQuantity(it.listingId, it.quantity + 1)}
                          className="cart-qty-btn"
                          aria-label="Increase quantity"
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E0E0E0', background: '#fff', fontSize: 16, fontWeight: 700, color: '#C8006A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          +
                        </button>
                      </div>
                      {/* Line total */}
                      <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                        £{(it.price * it.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* ── DELIVERY / COLLECTION CHOICE ── */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', marginBottom: 10 }}>
                  How do you want to receive your order?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { type: 'collection' as const, icon: '📍', label: 'COLLECT FREE',
                      sub: seller?.address_line1
                        ? `Pick up from ${seller.full_name || 'the cook'} at ${[seller.address_line1, seller.city].filter(Boolean).join(', ')}`
                        : `Pick up from ${seller?.full_name || 'the cook'} — full address after your order is confirmed` },
                    { type: 'delivery' as const, icon: '🚴', label: 'DELIVERY',
                      sub: quote.status === 'ok' ? `£${quote.fee.toFixed(2)} — ${quote.distance.toFixed(1)} mi to your door`
                        : quote.status === 'flat' ? 'Fee confirmed at dispatch — approx £3.99'
                        : 'Fee based on distance — enter postcode below' },
                  ]).map(opt => {
                    const on = deliveryType === opt.type
                    return (
                      <div
                        key={opt.type}
                        className="cart-dt-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setDeliveryType(opt.type)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeliveryType(opt.type) } }}
                        style={{
                          minHeight: 76, padding: '14px 16px',
                          border: on ? '2px solid #C8006A' : '1.5px solid #E0E0E0',
                          borderRadius: 14, background: on ? '#FFE8F4' : '#fff',
                          display: 'flex', alignItems: 'center', gap: 14,
                          boxShadow: on ? '0 4px 16px rgba(200,0,106,0.16)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 30, flexShrink: 0 }}>{opt.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: on ? '#C8006A' : '#1A1A1A', lineHeight: 1.25, letterSpacing: '0.02em' }}>{opt.label}</div>
                          <div style={{ fontSize: 12.5, color: '#1A1A1A', opacity: 0.8, marginTop: 3, lineHeight: 1.4 }}>{opt.sub}</div>
                        </div>
                        <div aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', border: on ? '6px solid #C8006A' : '2px solid #E0E0E0', background: on ? '#fff' : 'transparent', flexShrink: 0, transition: 'all 0.16s' }}/>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── COLLECTION CONFIRMATION ── */}
              {deliveryType === 'collection' && (
                <div style={{ marginTop: 14, background: '#F0FBF3', border: '1px solid rgba(45,168,78,0.28)', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: '#1A6030', lineHeight: 1.55 }}>
                  {seller?.address_line1 ? (
                    <>📍 <strong>Collect from:</strong> {[seller.address_line1, seller.city].filter(Boolean).join(', ')}. You&apos;ll receive the exact collection details when your order is ready.</>
                  ) : (
                    <>📍 You&apos;ll receive the exact collection address after your order is confirmed by the cook.</>
                  )}
                </div>
              )}

              {/* ── DELIVERY ADDRESS — postcode-first lookup, one input ── */}
              {deliveryType === 'delivery' && (
                <div style={{ marginTop: 14 }}>
                  <AddressLookup value={address} onChange={setAddress} compact/>
                  {/* Live distance/fee feedback — driven by the debounced quote
                      that fires as soon as the postcode changes. */}
                  {quote.status === 'checking' && <p style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.75, marginTop: 10 }}>Checking distance to cook…</p>}
                  {quote.status === 'invalid' && <p style={{ fontSize: 12.5, color: '#C8006A', fontWeight: 600, marginTop: 10 }}>Enter a valid UK postcode.</p>}
                  {quote.status === 'notfound' && <p style={{ fontSize: 12.5, color: '#C8006A', fontWeight: 600, marginTop: 10 }}>We couldn&apos;t find that postcode — please check it.</p>}
                  {quote.status === 'ok' && <p style={{ fontSize: 13.5, color: '#C8006A', fontWeight: 700, marginTop: 10 }}>📍 {quote.distance.toFixed(1)} miles away — delivery £{quote.fee.toFixed(2)}</p>}
                  {quote.status === 'flat' && <p style={{ fontSize: 12.5, color: '#1A1A1A', opacity: 0.8, marginTop: 10 }}>Delivery fee confirmed at dispatch — approx £{quote.fee.toFixed(2)}.</p>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #F0F0F0', padding: '16px 20px 20px', flexShrink: 0, background: '#fff' }}>
              {error && (
                <div style={{ background: '#FFE8F4', border: '1.5px solid rgba(200,0,106,0.25)', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 12.5, color: '#C8006A', fontWeight: 600 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#1A1A1A', marginBottom: 7 }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600 }}>£{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#1A1A1A', marginBottom: 7 }}>
                <span>Service fee</span>
                <span style={{ fontWeight: 600 }}>£{svc.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#1A1A1A', marginBottom: 7 }}>
                <span>{deliveryType === 'delivery' ? 'Delivery fee' : 'Collection'}</span>
                <span style={{ fontWeight: 600 }}>
                  {deliveryType !== 'delivery'
                    ? 'Free'
                    : quote.status === 'ok' || quote.status === 'flat'
                      ? `£${deliveryFee.toFixed(2)}`
                      : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #F0F0F0', marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Total</span>
                <span style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: '#C8006A', letterSpacing: '-0.01em' }}>£{total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="cart-checkout"
                style={{ width: '100%', height: 52, background: '#C8006A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 6px 20px rgba(200,0,106,0.3)', opacity: loading ? 0.6 : 1, transition: 'background 0.16s' }}
              >
                {loading ? 'Starting checkout…' : `Pay £${total.toFixed(2)}`}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#1A1A1A', opacity: 0.7, marginTop: 10 }}>
                🔒 Secured by Stripe · Buyer protection on every order
              </p>
            </div>
          </>
        )}
      </aside>
    </>,
    document.body,
  )
}
