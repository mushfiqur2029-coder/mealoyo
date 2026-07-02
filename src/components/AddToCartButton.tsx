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
 * Add-to-cart button for listing cards. Lives inside a card-wide <Link>, so it
 * stops propagation. Handles the cross-seller confirm and shows a brief
 * "Added ✓" state. `compact` renders a smaller pill for the browse rails.
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

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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

  return (
    <button
      onClick={onAdd}
      className="order-btn"
      style={{
        height: compact ? 36 : 34,
        width: compact ? '100%' : undefined,
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
