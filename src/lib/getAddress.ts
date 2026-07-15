// Address lookup — Google Places Autocomplete via server proxy.
//
// The browser never sees the Google Maps API key. Every call goes through:
//   POST /api/places/autocomplete → predictions as the buyer types
//   POST /api/places/details      → structured address once they pick one
//   POST /api/places/geocode      → reverse-geocode GPS coords to a postcode
//
// No postcodes.io fallback: this build is 100% Google. If the Places API
// misbehaves, the manual entry fields open automatically instead.

// A single row shown in the AddressLookup dropdown. Matches the Google
// prediction shape verbatim so the UI can render main_text bold + secondary
// muted (Google's structured_formatting) or fall back to `description`.
export interface AddressPrediction {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

// The finished address AddressLookup writes back to the parent form. Kept
// identical to the previous shape so CartPanel and the profile pages don't
// need to change.
export interface AddressResult {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  formatted_address: string
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
// they share one token. Regenerated each mount so a distinct visitor is
// billed as one session, not many.
const sessionToken = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
})()

// ── AUTOCOMPLETE ────────────────────────────────────────────────────────────

interface AutocompleteResponse {
  predictions?: AddressPrediction[]
  error?: string
}

// Fetch predictions for whatever the buyer has typed so far. Empty array =
// no results (or too short an input); throws AddressLookupError on service
// failure.
export async function autocompleteAddresses(input: string, opts?: { signal?: AbortSignal }): Promise<AddressPrediction[]> {
  const q = input.trim()
  if (q.length < 3) return []

  let res: Response
  try {
    res = await fetch('/api/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: q, sessionToken }),
      signal: opts?.signal,
    })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return []
    throw new AddressLookupError('unavailable', 'Address lookup is temporarily unavailable')
  }
  if (res.status === 503) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  if (!res.ok) throw new AddressLookupError('unavailable', `Address lookup failed (${res.status})`, res.status)

  const data = (await res.json()) as AutocompleteResponse
  return data.predictions ?? []
}

// ── DETAILS ─────────────────────────────────────────────────────────────────

interface DetailsResponse {
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  formatted_address?: string
  error?: string
}

// Resolve a picked prediction to a full structured address.
export async function getAddressDetails(placeId: string): Promise<AddressResult> {
  let res: Response
  try {
    res = await fetch('/api/places/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId, sessionToken }),
    })
  } catch {
    throw new AddressLookupError('unavailable', 'Address details are temporarily unavailable')
  }
  if (res.status === 503) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  if (!res.ok) throw new AddressLookupError('unavailable', `Address details failed (${res.status})`, res.status)

  const data = (await res.json()) as DetailsResponse
  return {
    address_line1: data.address_line1 ?? '',
    address_line2: data.address_line2 ?? '',
    city: data.city ?? '',
    postcode: data.postcode ?? '',
    formatted_address: data.formatted_address ?? '',
  }
}

// ── REVERSE GEOCODE (GPS button) ────────────────────────────────────────────

interface GeocodeResponse {
  postcode?: string
  city?: string
  formatted_address?: string
  error?: string
}

// Reverse-geocode a lat/lng (from the browser's GPS button) into a postcode +
// city. Returns null when Google can't find a postal_code at that point —
// AddressLookup surfaces the graceful "couldn't find your postcode" message.
export async function reverseGeocodeViaPlaces(lat: number, lng: number): Promise<GeocodeResponse | null> {
  let res: Response
  try {
    res = await fetch('/api/places/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    })
  } catch {
    throw new AddressLookupError('unavailable', 'Geocoding is temporarily unavailable')
  }
  if (res.status === 404) return null
  if (res.status === 503) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  if (!res.ok) throw new AddressLookupError('unavailable', `Geocoding failed (${res.status})`, res.status)

  const data = (await res.json()) as GeocodeResponse
  if (!data.postcode) return null
  return data
}
