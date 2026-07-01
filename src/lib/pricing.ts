// Central pricing + distance logic shared by the seller listing forms (commission
// preview), the dish page (distance-based delivery fee + service fee at checkout)
// and order persistence. Keeping it here means the numbers can never drift
// between where they're shown and where they're charged.

export const COMMISSION_RATE = 0.12 // platform commission on food subtotal
export const SELLER_RATE = 1 - COMMISSION_RATE // 0.88

export const SERVICE_FEE_RATE = 0.05 // 5% of food subtotal
export const SERVICE_FEE_MIN = 0.49
export const SERVICE_FEE_MAX = 1.99

// Flat fallback when the seller hasn't set a postcode yet, so we can't measure
// distance. Exact fee is settled at dispatch.
export const FLAT_DELIVERY_FEE = 3.99
export const MAX_DELIVERY_MILES = 5

// 12% commission / 88% payout on a price (per-portion or subtotal).
export function commission(amount: number): number {
  return Math.round(amount * COMMISSION_RATE * 100) / 100
}
export function sellerReceives(amount: number): number {
  return Math.round(amount * SELLER_RATE * 100) / 100
}

// meaLoyo service fee: 5% of the food subtotal, clamped to [£0.49, £1.99].
export function serviceFee(subtotal: number): number {
  if (subtotal <= 0) return 0
  const raw = subtotal * SERVICE_FEE_RATE
  const clamped = Math.min(SERVICE_FEE_MAX, Math.max(SERVICE_FEE_MIN, raw))
  return Math.round(clamped * 100) / 100
}

// Straight-line (great-circle) distance in miles.
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8 // miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Distance → delivery fee, gated by the seller's delivery radius.
// Returns null when delivery isn't available (beyond the seller radius or > 5mi).
export function deliveryFeeForDistance(miles: number, radiusMiles: number): number | null {
  if (radiusMiles <= 0) return null // seller is collection-only
  if (miles > MAX_DELIVERY_MILES || miles > radiusMiles) return null
  if (miles < 1) return 2.49
  if (miles < 2) return 3.49
  if (miles < 3) return 4.49
  return 5.49 // 3–5 miles
}

// UK postcode format validation (server-side normalised form). Accepts with or
// without the space, case-insensitive. e.g. "E3 4SS", "sw1a1aa".
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
export function isValidUKPostcode(pc: string): boolean {
  return UK_POSTCODE_RE.test(pc.trim())
}

// ── UK bank details (for manual withdrawal payouts) ──
// Format free-typed digits into a UK sort code XX-XX-XX as the user types.
export function formatSortCode(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 6)
  return digits.replace(/(\d{2})(?=\d)/g, '$1-')
}
// A valid UK sort code is exactly 6 digits (shown as XX-XX-XX).
export function isValidSortCode(v: string): boolean {
  return /^\d{6}$/.test(v.replace(/\D/g, ''))
}
// A valid UK account number is exactly 8 digits.
export function isValidAccountNumber(v: string): boolean {
  return /^\d{8}$/.test(v.replace(/\D/g, ''))
}

// postcodes.io lookup → { latitude, longitude } | null (not found / invalid).
export async function lookupPostcode(pc: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc.trim())}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json?.status !== 200 || !json?.result) return null
    const { latitude, longitude } = json.result
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
    return { latitude, longitude }
  } catch {
    return null
  }
}
