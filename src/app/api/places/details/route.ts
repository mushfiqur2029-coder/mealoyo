import { NextResponse } from 'next/server'

// Server-side proxy for the Google Places Details API. Called once the buyer
// picks a suggestion from the autocomplete dropdown — Details returns the
// structured address_components we need to fill address_line1, city and
// postcode. Same reasoning as the autocomplete proxy: keep the API key
// server-only.
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/details
//
// Query params:
//   place_id     — required, from the autocomplete response
//   sessiontoken — optional, same value as the autocomplete call (Google
//                  bundles them under one session for cheaper billing)

export const runtime = 'nodejs'

// The normalised response the browser consumes. Matches the AddressResult
// shape AddressLookup already knows about.
export interface AddressDetails {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  country: string
}

interface RawGoogleDetailsResponse {
  status?: string
  error_message?: string
  result?: {
    address_components?: Array<{
      long_name?: string
      short_name?: string
      types?: string[]
    }>
    formatted_address?: string
  }
}

// Pull the first component whose `types` array contains any of the given keys.
function pick(components: NonNullable<NonNullable<RawGoogleDetailsResponse['result']>['address_components']>, ...types: string[]) {
  for (const c of components) {
    if (c.types?.some((t) => types.includes(t))) return c
  }
  return undefined
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const placeId = (url.searchParams.get('place_id') || '').trim()
  const sessiontoken = url.searchParams.get('sessiontoken') || ''
  if (!placeId) return NextResponse.json({ error: 'Missing place_id' }, { status: 400 })

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ error: 'Places API is not configured' }, { status: 503 })

  // Ask for only address_components + formatted_address so we're on Google's
  // cheaper "Basic" data tier and never leak the buyer's coordinates back
  // through the proxy.
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'address_components,formatted_address',
    key,
  })
  if (sessiontoken) params.set('sessiontoken', sessiontoken)

  const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`

  let res: Response
  try {
    res = await fetch(googleUrl)
  } catch (e) {
    console.error('[places/details] network error:', e)
    return NextResponse.json({ error: 'Places lookup is temporarily unavailable' }, { status: 502 })
  }
  if (!res.ok) return NextResponse.json({ error: `Places lookup failed (${res.status})` }, { status: 502 })

  const data = (await res.json()) as RawGoogleDetailsResponse
  if (data.status && data.status !== 'OK') {
    console.error('[places/details] google status:', data.status, data.error_message)
    return NextResponse.json({ error: 'Places lookup failed', google_status: data.status }, { status: 502 })
  }

  const components = data.result?.address_components ?? []
  const streetNumber = pick(components, 'street_number')?.long_name ?? ''
  const route = pick(components, 'route')?.long_name ?? ''
  const subpremise = pick(components, 'subpremise')?.long_name ?? ''
  // UK addresses use postal_town; most other countries use locality. Fall
  // through so this component works internationally the day we remove the
  // country=gb restriction upstream.
  const city =
    pick(components, 'postal_town')?.long_name
    ?? pick(components, 'locality')?.long_name
    ?? pick(components, 'sublocality')?.long_name
    ?? pick(components, 'administrative_area_level_2')?.long_name
    ?? ''
  const postcode = pick(components, 'postal_code')?.long_name?.toUpperCase() ?? ''
  const country = pick(components, 'country')?.long_name ?? ''

  const address_line1 = [streetNumber, route].filter(Boolean).join(' ').trim()

  const details: AddressDetails = {
    address_line1,
    address_line2: subpremise, // "Flat 3B" etc., blank when Google has none
    city,
    postcode,
    country,
  }

  return NextResponse.json({ details })
}
