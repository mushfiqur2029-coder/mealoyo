// UK postcode lookup — free, no API key required.
//
// Royal Mail's Postcode Address File (PAF) is licensed data. Every UK service
// that returns a LIST of street addresses per postcode (getAddress.io,
// Ideal Postcodes, Loqate, PostcodeAnywhere) pays for PAF and passes on the
// cost. There is no free equivalent — doogal.co.uk removed their address
// endpoint years ago, and Nominatim only returns one centroid match per
// postcode.
//
// So instead of pretending to have a dropdown of street-level addresses, we
// validate the postcode with postcodes.io (which gives us the confirmed
// postcode + city / admin_district) and hand the buyer a pre-filled manual
// form for their house number and street name. It's Deliveroo-shaped: enter
// postcode, then enter your address.
//
// This module keeps the same AddressResult shape and findAddressesByPostcode
// signature the UI expects, so no wiring changes are needed elsewhere. When
// the postcode is valid we return exactly one AddressResult with the city +
// postcode filled and an empty address_line1 (the buyer's cue to type it).

// The normalised shape the UI consumes. Kept identical to the previous
// implementation so the components don't need to change.
export interface AddressResult {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  // Human label for the picker row — with no street data we just show
  //   "RM8 2AR — Barking and Dagenham".
  label: string
}

// A typed error the caller can react to. The union is kept wide to match the
// old paid-API contract so AddressLookup's error branches still typecheck —
// but in this free-lookup implementation we only ever throw 'unavailable',
// 'notfound', or 'misconfigured'.
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

// Loose postcodes.io response shape — we only touch a handful of fields.
interface PostcodesIoResponse {
  status?: number
  error?: string
  result?: {
    postcode?: string
    admin_district?: string | null
    admin_ward?: string | null
    parish?: string | null
    country?: string | null
  } | null
}

// Runtime lookup. Throws AddressLookupError with a specific `.kind` on
// service failures; returns an empty array only when postcodes.io explicitly
// says the postcode doesn't exist (404 with body).
export async function findAddressesByPostcode(rawPostcode: string): Promise<AddressResult[]> {
  const pc = rawPostcode.trim()
  if (!pc) return []
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new AddressLookupError('unavailable', 'Postcode lookup is temporarily unavailable')
  }

  // postcodes.io returns a proper JSON body on both 200 and 404, so we always
  // parse — no risk of getting an empty response like getAddress.io gave us.
  let data: PostcodesIoResponse | null = null
  try {
    data = (await res.json()) as PostcodesIoResponse
  } catch {
    throw new AddressLookupError('unavailable', 'Postcode lookup returned unreadable data')
  }

  if (res.status === 404) return []
  if (!res.ok || !data?.result) {
    throw new AddressLookupError('unavailable', `Postcode lookup failed (${res.status})`, res.status)
  }

  const r = data.result
  const postcode = (r.postcode || pc).toUpperCase()
  const city =
    (r.admin_district && r.admin_district.trim()) ||
    (r.admin_ward && r.admin_ward.trim()) ||
    (r.parish && r.parish.trim()) ||
    ''
  const label = city ? `${postcode} — ${city}` : postcode

  // Exactly one result: the confirmed postcode + city. address_line1 stays
  // empty so the UI knows to open the manual house/street fields.
  return [
    {
      address_line1: '',
      address_line2: '',
      city,
      postcode,
      label,
    },
  ]
}
