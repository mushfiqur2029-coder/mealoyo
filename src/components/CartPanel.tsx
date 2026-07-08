'use client'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; a plain <img> avoids next/image remotePatterns config */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/cartStore'
import { supabase } from '@/lib/supabase'
import { serviceFee as calcServiceFee, commission as calcCommission } from '@/lib/pricing'

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

  // Render into document.body via a portal. The panel is `position: fixed`, but
  // the navs that host <CartButton> use `backdrop-filter`, which establishes a
  // containing block and would otherwise trap the panel inside the ~66px nav
  // (breaking the mobile bottom-sheet). Portalling to body keeps `fixed`
  // relative to the viewport. Gated on mount so SSR and first client render match.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Lock the page behind the cart while it's open.
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const svc = calcServiceFee(subtotal)
  const total = subtotal + svc
  const sellerName = items[0]?.sellerName ?? null

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setDragY(delta) // only track downward drags
  }
  const onTouchEnd = () => {
    if (dragY > 90) onClose() // dragged far enough → dismiss
    setDragY(0)
    startY.current = null
  }

  const handleCheckout = async () => {
    if (!items.length) return
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
      // One order row per dish (per-seller accounting stays correct). The whole
      // cart's service fee rides on the first order so displayed == charged.
      const orderIds: string[] = []
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx]
        const lineSub = it.price * it.quantity
        const comm = calcCommission(lineSub)
        const svcForOrder = idx === 0 ? svc : 0
        const { data: order, error: oErr } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            seller_id: it.sellerId,
            listing_id: it.listingId,
            quantity: it.quantity,
            total_amount: lineSub + svcForOrder,
            delivery_fee: 0,
            service_fee: svcForOrder,
            platform_commission: comm,
            seller_payout: lineSub - comm,
            status: 'pending_payment',
            payment_status: 'unpaid',
            delivery_type: it.deliveryPref || 'collection',
            delivery_address: null,
            notes: null,
          })
          .select()
          .single()
        if (oErr || !order) throw new Error(oErr?.message || 'Could not create your order')
        orderIds.push(order.id)
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds,
          items: items.map((it) => ({
            listingId: it.listingId,
            name: it.listingName,
            price: it.price,
            quantity: it.quantity,
            imageUrl: it.imageUrl,
          })),
          serviceFee: svc,
          buyerEmail: user.email,
          buyerId: user.id,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.assign(data.url)
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
          position: fixed; top: 0; right: 0; height: 100vh; width: 380px; max-width: 100vw;
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
        @media (max-width: 768px) {
          .cart-panel {
            top: auto; bottom: 0; right: 0; left: 0; width: 100%; height: 85vh;
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
              <div style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.7, marginBottom: 12 }}>
                🚴 Delivery fee calculated at checkout
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
                {loading ? 'Starting checkout…' : `Checkout · £${total.toFixed(2)}`}
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
