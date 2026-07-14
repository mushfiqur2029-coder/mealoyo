'use client'
import { useState } from 'react'
import { useCartStore } from '@/lib/cartStore'
import type { Listing, Profile } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  Bangladeshi: '🍛', Pakistani: '🫕', Indian: '🥘', Caribbean: '🍗',
  'Middle Eastern': '🧆', 'West African': '🫘', Turkish: '🥙', 'Sri Lankan': '🍚',
  Afghan: '🥟', 'East African': '🍲', Chinese: '🥡', Other: '🍽️',
}

function normalizeDelivery(d: Listing['delivery_options']): string[] {
  if (Array.isArray(d)) return d.map(String)
  if (typeof d === 'string') return d.split(',').map((x) => x.trim()).filter(Boolean)
  return []
}

/**
 * Card-level add-to-cart control. Sits inside a card-wide <Link> so all events
 * stop propagation. After the first add it flashes "Added ✓" for 1.5s and then
 * morphs into a compact [− qty +] stepper reflecting the live cart quantity —
 * so buyers can adjust without opening the cart panel. Cross-seller adds still
 * fire the confirm-and-clear flow the store exposes.
 */
export default function AddToCartButton({
  l,
  compact = false,
}: {
  l: Listing & { profiles?: Pick<Profile, 'full_name'> | null }
  compact?: boolean
}) {
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const inCart = useCartStore((s) => s.items.find((i) => i.listingId === l.id))
  const currentQty = inCart?.quantity ?? 0
  const [added, setAdded] = useState(false)

  const buildItem = () => ({
    listingId: l.id,
    listingName: l.name,
    sellerId: l.seller_id,
    sellerName: l.profiles?.full_name || 'Home cook',
    price: parseFloat(l.price),
    quantity: 1,
    imageUrl: l.image_url,
    cuisineEmoji: cuisineEmoji[l.cuisine] || '🍽️',
    deliveryOptions: normalizeDelivery(l.delivery_options),
  })

  const flashAdded = () => {
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const stop = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); e.stopPropagation() }

  const onAdd = (e: React.MouseEvent) => {
    stop(e)
    const item = buildItem()
    const res = addItem(item)
    if (res.needsConfirm) {
      const ok = window.confirm(
        `Your cart has items from ${res.existingSellerName}. Start a new cart with this item?`,
      )
      if (!ok) return
      clearCart()
      addItem(item)
    }
    flashAdded()
  }

  const dec = (e: React.MouseEvent) => { stop(e); updateQuantity(l.id, currentQty - 1) }
  const inc = (e: React.MouseEvent) => { stop(e); updateQuantity(l.id, currentQty + 1) }

  const height = compact ? 36 : 34
  const width = compact ? '100%' : undefined

  // Post-add stepper: shown when the item is in the cart AND we've cleared the
  // "Added ✓" flash. Same footprint as the add button.
  if (currentQty > 0 && !added) {
    return (
      <div
        onClick={stop}
        role="group"
        aria-label={`${l.name} quantity`}
        style={{
          height,
          width,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          padding: '0 4px',
          background: '#FFE8F4',
          border: '1.5px solid rgba(200,0,106,0.28)',
          borderRadius: 9,
          boxShadow: '0 4px 12px rgba(200,0,106,0.18)',
        }}
      >
        <button
          type="button"
          onClick={dec}
          aria-label="Decrease quantity"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            fontSize: 18,
            fontWeight: 800,
            color: '#C8006A',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          −
        </button>
        <span
          aria-live="polite"
          style={{
            fontFamily: 'Georgia,serif',
            fontSize: 15,
            fontWeight: 700,
            color: '#C8006A',
            minWidth: 20,
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {currentQty}
        </span>
        <button
          type="button"
          onClick={inc}
          aria-label="Increase quantity"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: 'none',
            background: '#C8006A',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onAdd}
      className="order-btn"
      style={{
        height,
        width,
        padding: compact ? '0' : '0 16px',
        background: added ? '#2DA84E' : '#C8006A',
        color: '#fff',
        border: 'none',
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        boxShadow: added ? '0 4px 12px rgba(45,168,78,0.3)' : '0 4px 12px rgba(200,0,106,0.3)',
        transition: 'all 0.16s',
        whiteSpace: 'nowrap',
      }}
    >
      {added ? 'Added ✓' : 'Add to cart'}
    </button>
  )
}
