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

// Runtime lookup. Rejects when the API key is missing so callers can show a
// meaningful message rather than a 401 from getAddress.
export async function findAddressesByPostcode(rawPostcode: string): Promise<AddressResult[]> {
  const key = process.env.NEXT_PUBLIC_GETADDRESS_API_KEY
  if (!key) throw new Error('Address lookup is not configured')
  const pc = rawPostcode.trim().toUpperCase()
  if (!pc) return []
  const url = `https://api.getaddress.io/find/${encodeURIComponent(pc)}?api-key=${encodeURIComponent(key)}&expand=true`
  const res = await fetch(url)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`)
  const data = (await res.json()) as RawFindResponse
  const postcode = (data.postcode || pc).toUpperCase()
  const list = Array.isArray(data.addresses) ? data.addresses : []
  return list.map((a) => toAddressResult(postcode, a))
}
