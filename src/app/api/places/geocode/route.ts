import { NextResponse } from 'next/server'

// Server-side proxy for the Google Geocoding API — reverse-geocode a lat/lng
// (from the buyer's GPS button) into a postcode + city + formatted address.
// The browser POSTs lat/lng here; we tack on the key and forward.
//
// Docs: https://developers.google.com/maps/documentation/geocoding/overview

export const runtime = 'nodejs'

interface GeocodeBody {
  lat?: number
  lng?: number
}

interface RawGoogleGeocodeResponse {
  status?: string
  error_message?: string
  results?: Array<{
    address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>
    formatted_address?: string
  }>
}

function pick(
  components: NonNullable<NonNullable<RawGoogleGeocodeResponse['results']>[number]['address_components']>,
  ...types: string[]
) {
  for (const c of components) {
    if (c.types?.some((t) => types.includes(t))) return c
  }
  return undefined
}

export async function POST(request: Request) {
  let body: GeocodeBody
  try {
    body = (await request.json()) as GeocodeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const lat = typeof body.lat === 'number' ? body.lat : NaN
  const lng = typeof body.lng === 'number' ? body.lng : NaN
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 })
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ error: 'Places API is not configured' }, { status: 503 })

  const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(key)}`

  let res: Response
  try {
    res = await fetch(googleUrl)
  } catch (e) {
    console.error('[places/geocode] network error:', e)
    return NextResponse.json({ error: 'Geocoding is temporarily unavailable' }, { status: 502 })
  }
  if (!res.ok) return NextResponse.json({ error: `Geocoding failed (${res.status})` }, { status: 502 })

  const data = (await res.json()) as RawGoogleGeocodeResponse
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[places/geocode] google status:', data.status, data.error_message)
    return NextResponse.json({ error: 'Geocoding failed', google_status: data.status }, { status: 502 })
  }

  // Google returns the most-specific match first — a street address near the
  // point when possible, falling back to postal codes / localities further
  // out. Walk the results and use the first one that has a postal_code so we
  // return something the autocomplete can actually search on.
  let postcode = ''
  let city = ''
  let formatted_address = ''
  for (const r of data.results ?? []) {
    const comps = r.address_components ?? []
    const pc = pick(comps, 'postal_code')?.long_name?.toUpperCase() ?? ''
    if (!pc) continue
    postcode = pc
    city =
      pick(comps, 'postal_town')?.long_name
      ?? pick(comps, 'locality')?.long_name
      ?? pick(comps, 'sublocality')?.long_name
      ?? pick(comps, 'administrative_area_level_2')?.long_name
      ?? ''
    formatted_address = r.formatted_address ?? ''
    break
  }

  if (!postcode) return NextResponse.json({ error: 'No postcode found at that location' }, { status: 404 })

  return NextResponse.json({ postcode, city, formatted_address })
}
