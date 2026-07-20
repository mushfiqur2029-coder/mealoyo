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

// Distance → delivery fee. Every listing is deliverable platform-wide now,
// so no per-seller radius cap and no null return — the buyer chooses
// collection vs delivery at checkout regardless of distance. Tiered up to
// 5mi; anything further gets the top tier.
export function deliveryFeeForDistance(miles: number): number {
  if (miles < 1) return 2.49
  if (miles < 2) return 3.49
  if (miles < 3) return 4.49
  if (miles < 5) return 5.49
  return 6.99
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

// postcodes.io BULK lookup — up to 100 postcodes per request. Returns a
// {postcode → {latitude,longitude} | null} map so callers can look up
// distances for a whole listing feed in one round trip instead of N.
// Normalises keys with .toUpperCase().replace(' ', '') so a match works
// regardless of how the seller typed their postcode.
export async function lookupPostcodesBulk(pcs: string[]): Promise<Map<string, { latitude: number; longitude: number } | null>> {
  const out = new Map<string, { latitude: number; longitude: number } | null>()
  const uniq = Array.from(new Set(pcs.map(p => p?.trim()).filter((p): p is string => !!p)))
  if (!uniq.length) return out
  const norm = (p: string) => p.toUpperCase().replace(/\s+/g, '')
  // postcodes.io caps at 100 per POST — chunk here so a huge feed doesn't fail.
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100)
    try {
      const res = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: chunk }),
      })
      if (!res.ok) { for (const p of chunk) out.set(norm(p), null); continue }
      const json = await res.json()
      const results = Array.isArray(json?.result) ? json.result : []
      for (const r of results) {
        const query = typeof r?.query === 'string' ? norm(r.query) : null
        if (!query) continue
        const hit = r?.result
        if (hit && typeof hit.latitude === 'number' && typeof hit.longitude === 'number') {
          out.set(query, { latitude: hit.latitude, longitude: hit.longitude })
        } else {
          out.set(query, null)
        }
      }
    } catch {
      for (const p of chunk) out.set(norm(p), null)
    }
  }
  return out
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

// Extended postcodes.io lookup returning administrative fields we use to
// auto-fill address forms (city). postcodes.io has no street-level data —
// address_line1/2 must still be typed manually.
export interface PostcodeAddress {
  postcode: string
  city: string | null
  region: string | null
  country: string | null
  latitude: number
  longitude: number
}
export async function lookupPostcodeAddress(pc: string): Promise<PostcodeAddress | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc.trim())}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json?.status !== 200 || !json?.result) return null
    const r = json.result
    if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null
    return {
      postcode: r.postcode,
      city: r.admin_district ?? r.admin_ward ?? r.parish ?? null,
      region: r.region ?? null,
      country: r.country ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
    }
  } catch {
    return null
  }
}

// Reverse geocode a coordinate to the nearest postcode. Used by the "use my
// location" button on delivery / profile forms.
export async function reverseGeocodePostcode(lat: number, lng: number): Promise<PostcodeAddress | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json?.status !== 200 || !Array.isArray(json?.result) || !json.result.length) return null
    const r = json.result[0]
    return {
      postcode: r.postcode,
      city: r.admin_district ?? r.admin_ward ?? r.parish ?? null,
      region: r.region ?? null,
      country: r.country ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
    }
  } catch {
    return null
  }
}
