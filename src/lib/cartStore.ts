import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// A single line in the buyer's cart. Prices are plain numbers (pounds) — the
// checkout API converts to pence. `deliveryPref` is the buyer's stated
// preference from the dish page; the actual delivery fee is settled at checkout.
export interface CartItem {
  listingId: string
  listingName: string
  sellerId: string
  sellerName: string
  price: number
  quantity: number
  imageUrl: string | null
  cuisineEmoji: string
  deliveryOptions: string[]
  deliveryPref?: 'collection' | 'delivery'
}

// addItem tells the caller when the new item belongs to a different seller than
// what's already in the cart — the UI then asks to start a fresh cart. meaLoyo
// carts are single-seller (one Stripe checkout = one cook's kitchen).
export interface AddResult {
  needsConfirm: boolean
  existingSellerName?: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: CartItem) => AddResult
  removeItem: (listingId: string) => void
  updateQuantity: (listingId: string, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  // Computed
  getTotal: () => number
  getItemCount: () => number
  getSellerName: () => string | null
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const { items } = get()
        // Cross-seller guard: block (and ask) if the cart already holds another
        // cook's food.
        if (items.length > 0 && items[0].sellerId !== item.sellerId) {
          return { needsConfirm: true, existingSellerName: items[0].sellerName }
        }
        const existing = items.find((i) => i.listingId === item.listingId)
        if (existing) {
          set({
            items: items.map((i) =>
              i.listingId === item.listingId
                ? { ...i, quantity: i.quantity + item.quantity, deliveryPref: item.deliveryPref ?? i.deliveryPref }
                : i,
            ),
          })
        } else {
          set({ items: [...items, item] })
        }
        return { needsConfirm: false }
      },

      removeItem: (listingId) =>
        set({ items: get().items.filter((i) => i.listingId !== listingId) }),

      updateQuantity: (listingId, quantity) =>
        set({
          items:
            quantity <= 0
              ? get().items.filter((i) => i.listingId !== listingId)
              : get().items.map((i) => (i.listingId === listingId ? { ...i, quantity } : i)),
        }),

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSellerName: () => get().items[0]?.sellerName ?? null,
    }),
    {
      name: 'mealoyo-cart',
      // Only the items are durable — the open/closed state resets each session.
      partialize: (s) => ({ items: s.items }),
    },
  ),
)
