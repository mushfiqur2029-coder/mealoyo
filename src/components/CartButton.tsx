'use client'
import { useEffect, useState } from 'react'
import { useCartStore } from '@/lib/cartStore'
import CartPanel from './CartPanel'

/**
 * Nav cart icon + count badge that opens the slide-in CartPanel. Drop it into
 * any nav's action row. The open/closed state lives in the cart store, so other
 * surfaces (e.g. the dish page "Add to cart" button) can open the panel too.
 */
export default function CartButton() {
  const items = useCartStore((s) => s.items)
  const isOpen = useCartStore((s) => s.isOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)

  // The badge count comes from persisted localStorage, which isn't known during
  // SSR — gate it on mount so server and first client render match.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <button
        onClick={openCart}
        aria-label={count > 0 ? `Open cart, ${count} item${count === 1 ? '' : 's'}` : 'Open cart'}
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 10,
          border: '1.5px solid #E0E0E0', background: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        {mounted && count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -6, right: -6, minWidth: 19, height: 19, padding: '0 5px',
              borderRadius: 100, background: '#C8006A', color: '#fff', fontSize: 11, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              boxShadow: '0 2px 6px rgba(200,0,106,0.4)', border: '2px solid #fff',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      <CartPanel isOpen={isOpen} onClose={closeCart} />
    </>
  )
}
