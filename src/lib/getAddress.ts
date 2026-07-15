// getAddress.io UK postcode → street-level address lookup.
//
// postcodes.io only returns coordinates + admin_district (city). getAddress.io
// is the paid service that actually gives us the list of addresses at a given
// postcode. The API key is a public "browser" key exposed via
// NEXT_PUBLIC_GETADDRESS_API_KEY (the getAddress.io dashboard rate-limits and
// scopes it to the app's domain, so client-side use is fine).
//
// Endpoint (with expand=true, so each address arrives as a structured object
// rather than a formatted string):
//   https://api.getaddress.io/find/{postcode}?api-key={key}&expand=true

// One address returned by getAddress.io — trimmed to the fields we actually
// use. See https://documentation.getaddress.io/ for the full shape.
interface RawExpandedAddress {
  line_1?: string
  line_2?: string
  line_3?: string
  line_4?: string
  building_number?: string
  sub_building_name?: string
  building_name?: string
  thoroughfare?: string
  premise?: string
  locality?: string
  town_or_city?: string
  county?: string
  formatted_address?: string[]
}

interface RawFindResponse {
  postcode?: string
  latitude?: number
  longitude?: number
  addresses?: RawExpandedAddress[]
}

// The normalised shape the UI consumes.
export interface AddressResult {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  // Human label for the dropdown row — e.g.
  //   "3 Sheringham Drive, Barking, IG11 9AL".
  label: string
}

// A typed error the caller can react to. `.kind` lets the UI pick between
// "we're offline, try manual entry" and "that postcode has no listings".
export type LookupErrorKind =
  | 'unauthorized'   // 401/403 — key rejected or domain not allowed
  | 'exhausted'      // 429 — daily plan limit
  | 'unavailable'    // 404-with-empty-body, 5xx, network — service down
  | 'notfound'       // genuine "no addresses for this postcode"
  | 'misconfigured'  // NEXT_PUBLIC_GETADDRESS_API_KEY is missing at runtime

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

// Best-effort formatter for the dropdown label. getAddress.io returns
// premise/thoroughfare/town/etc. as separate fields; we pick the tidiest
// combination so it reads like a normal UK postal address.
function toAddressResult(pc: string, a: RawExpandedAddress): AddressResult {
  // address_line1: prefer line_1 (it already combines number + street), else
  // build it from premise + thoroughfare.
  const line1 =
    (a.line_1 && a.line_1.trim()) ||
    [a.premise || a.building_number || a.sub_building_name, a.thoroughfare]
      .filter(Boolean)
      .join(' ')
      .trim()
  // address_line2: building name or sub-building name if line_1 didn't already
  // capture it, or the next filled line from formatted_address.
  const line2 =
    (a.line_2 && a.line_2.trim()) ||
    (a.building_name && a.building_name.trim()) ||
    ''
  const city =
    (a.town_or_city && a.town_or_city.trim()) ||
    (a.locality && a.locality.trim()) ||
    (a.county && a.county.trim()) ||
    ''
  const postcode = pc.toUpperCase()
  const label = [line1, city, postcode].filter(Boolean).join(', ')
  return { address_line1: line1, address_line2: line2, city, postcode, label }
}

// Runtime lookup. Throws AddressLookupError with a specific `.kind` so the UI
// can pick the right fallback message; the caller catches and translates.
export async function findAddressesByPostcode(rawPostcode: string): Promise<AddressResult[]> {
  const key = process.env.NEXT_PUBLIC_GETADDRESS_API_KEY
  if (!key) throw new AddressLookupError('misconfigured', 'Address lookup is not configured')
  const pc = rawPostcode.trim().toUpperCase()
  if (!pc) return []
  // Strip the space too — getAddress.io accepts either form but the redirect
  // adds latency and the log line looks cleaner without it.
  const spaceless = pc.replace(/\s+/g, '')
  const url = `https://api.getaddress.io/find/${encodeURIComponent(spaceless)}?api-key=${encodeURIComponent(key)}&expand=true`

  // Log the URL with the key redacted so we can debug from the browser console
  // without leaking the credential.
  const safeUrl = url.replace(/api-key=[^&]+/, 'api-key=[REDACTED]')
  console.log('[getAddress] request', safeUrl)

  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    console.error('[getAddress] network error', e)
    throw new AddressLookupError('unavailable', 'Address lookup is temporarily unavailable')
  }

  const contentLength = res.headers.get('content-length')
  console.log('[getAddress] response', { status: res.status, contentLength })

  // 401/403 → the key is rejected (bad key, or domain restriction mismatch).
  if (res.status === 401 || res.status === 403) {
    throw new AddressLookupError('unauthorized', 'Address lookup key was rejected', res.status)
  }
  // 429 → the plan's daily/monthly quota is exhausted.
  if (res.status === 429) {
    throw new AddressLookupError('exhausted', 'Address lookup daily limit reached', 429)
  }

  // 404 — could be a genuine "postcode has no addresses" OR the service
  // returning 404 with content-length: 0 when the key/plan is bad. We can't
  // read the response as JSON to disambiguate in the second case, so use the
  // body: a real "not found" from getAddress.io returns a JSON body with a
  // Message; a plan/key failure returns 0 bytes.
  if (res.status === 404) {
    // Empty body → treat as unavailable so the UI shows a "try manual entry"
    // message instead of the misleading "no addresses found for this postcode".
    if (contentLength === '0') {
      throw new AddressLookupError('unavailable', 'Address lookup is temporarily unavailable (empty 404)', 404)
    }
    // Otherwise it really is "no addresses for that postcode".
    return []
  }

  if (!res.ok) {
    throw new AddressLookupError('unavailable', `Address lookup failed (${res.status})`, res.status)
  }

  let data: RawFindResponse
  try {
    data = (await res.json()) as RawFindResponse
  } catch {
    throw new AddressLookupError('unavailable', 'Address lookup returned unreadable data')
  }
  const postcode = (data.postcode || pc).toUpperCase()
  const list = Array.isArray(data.addresses) ? data.addresses : []
  return list.map((a) => toAddressResult(postcode, a))
}
