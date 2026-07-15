// UK/international address lookup — Google Places Autocomplete via server proxy.
//
// The browser never sees the Google Maps API key. All calls go through:
//   /api/places/autocomplete → predictions as the buyer types
//   /api/places/details      → structured address once they pick one
//
// Falls back to postcodes.io when Google returns nothing and the input looks
// like a valid UK postcode — that keeps things working during any Google
// outage / key issue, and gives us at least postcode + city so the buyer can
// finish the address by hand.

import { isValidUKPostcode } from '@/lib/pricing'

// A single row shown in the AddressLookup dropdown.
export interface AddressPrediction {
  // Stable identifier we hand to /api/places/details on click. When the row
  // came from the postcodes.io fallback we prefix it with `postcode:` so the
  // component knows to skip the details round-trip and just use the postcode.
  id: string
  source: 'google' | 'postcode'
  label: string          // full "3 Sheringham Drive, Barking, IG11 9AL"
  main_text: string      // "3 Sheringham Drive"
  secondary_text: string // "Barking, IG11 9AL, UK"
}

// The finished address AddressLookup writes back to the parent form. Kept
// identical to the previous shape so CartPanel and the profile pages don't
// need to change.
export interface AddressResult {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  label: string
}

// Typed error — the AddressLookup component switches error copy on this.
export type LookupErrorKind =
  | 'unavailable'
  | 'notfound'
  | 'misconfigured'
  | 'unauthorized'
  | 'exhausted'

export class AddressLookupError extends Error {
  kind: LookupErrorKind
  status?: number
  constructor(kind: LookupErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'AddressLookupError'
    this.kind = kind
    this.status = status
  }
}

// Per-tab session token — Google prices autocomplete + details cheaper when
// they share one token. Regenerated each mount so a distinct visitor is billed
// as one session, not many.
const sessionToken = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
})()

interface AutocompleteResponse {
  predictions?: Array<{ place_id: string; label: string; main_text: string; secondary_text: string }>
  error?: string
}

// Fetch predictions for whatever the buyer has typed so far. Empty array =
// no results (or too short an input); throws AddressLookupError on service
// failure.
export async function autocompleteAddresses(input: string, opts?: { country?: string; signal?: AbortSignal }): Promise<AddressPrediction[]> {
  const q = input.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({ input: q, sessiontoken: sessionToken })
  // Empty country → international; default in the API route is 'gb'.
  if (opts?.country !== undefined) params.set('country', opts.country)

  let res: Response
  try {
    res = await fetch(`/api/places/autocomplete?${params.toString()}`, { signal: opts?.signal })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return []
    throw new AddressLookupError('unavailable', 'Address lookup is temporarily unavailable')
  }
  if (res.status === 503) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  if (!res.ok) throw new AddressLookupError('unavailable', `Address lookup failed (${res.status})`, res.status)

  const data = (await res.json()) as AutocompleteResponse
  const list = data.predictions ?? []
  return list.map((p) => ({
    id: p.place_id,
    source: 'google' as const,
    label: p.label,
    main_text: p.main_text,
    secondary_text: p.secondary_text,
  }))
}

interface DetailsResponse {
  details?: {
    address_line1: string
    address_line2: string
    city: string
    postcode: string
    country: string
  }
  error?: string
}

// Resolve a picked prediction to a full address. Handles both real Google
// place_ids and the fallback `postcode:XXXX` synthetic ids we invent when
// postcodes.io filled in for a Google zero-result.
export async function getAddressDetails(prediction: AddressPrediction): Promise<AddressResult> {
  if (prediction.source === 'postcode') {
    // Synthetic id from resolveUKPostcodeAsPrediction — the label already
    // contains the confirmed postcode + city. We return an AddressResult with
    // empty address_line1 to signal "open manual fields for house + street".
    const [postcode, city] = prediction.id.replace(/^postcode:/, '').split('|')
    return {
      address_line1: '',
      address_line2: '',
      city: city || '',
      postcode: (postcode || '').toUpperCase(),
      label: prediction.label,
    }
  }

  let res: Response
  try {
    res = await fetch(`/api/places/details?place_id=${encodeURIComponent(prediction.id)}&sessiontoken=${encodeURIComponent(sessionToken)}`)
  } catch {
    throw new AddressLookupError('unavailable', 'Address details are temporarily unavailable')
  }
  if (res.status === 503) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  if (!res.ok) throw new AddressLookupError('unavailable', `Address details failed (${res.status})`, res.status)

  const data = (await res.json()) as DetailsResponse
  if (!data.details) throw new AddressLookupError('unavailable', 'Address details missing')
  const d = data.details
  return {
    address_line1: d.address_line1,
    address_line2: d.address_line2,
    city: d.city,
    postcode: d.postcode,
    label: prediction.label || [d.address_line1, d.city, d.postcode].filter(Boolean).join(', '),
  }
}

// UK postcode → single-row fallback prediction. Called by AddressLookup when
// Google returns nothing for what looks like a valid UK postcode. postcodes.io
// is free, unlimited, and cross-origin-friendly so it works in the browser.
interface PostcodesIoResult { postcode?: string; admin_district?: string | null; admin_ward?: string | null; parish?: string | null }
interface PostcodesIoResponse { status?: number; result?: PostcodesIoResult | null }

export async function resolveUKPostcodeAsPrediction(rawPostcode: string): Promise<AddressPrediction | null> {
  const pc = rawPostcode.trim()
  if (!pc || !isValidUKPostcode(pc)) return null
  let res: Response
  try {
    res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
  } catch {
    return null
  }
  if (res.status === 404) return null
  if (!res.ok) return null
  let data: PostcodesIoResponse
  try { data = (await res.json()) as PostcodesIoResponse } catch { return null }
  if (!data.result) return null
  const postcode = (data.result.postcode || pc).toUpperCase()
  const city =
    (data.result.admin_district && data.result.admin_district.trim()) ||
    (data.result.admin_ward && data.result.admin_ward.trim()) ||
    (data.result.parish && data.result.parish.trim()) ||
    ''
  return {
    id: `postcode:${postcode}|${city}`,
    source: 'postcode',
    label: city ? `${postcode} — ${city}` : postcode,
    main_text: postcode,
    secondary_text: city ? `${city} — use this postcode and enter your address` : 'Use this postcode and enter your address',
  }
}
