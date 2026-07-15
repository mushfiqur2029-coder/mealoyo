import { NextResponse } from 'next/server'

// Server-side proxy for the Google Places Autocomplete API.
//
// Reasoning for the proxy: the API key is a private, server-only secret
// (GOOGLE_MAPS_API_KEY, no NEXT_PUBLIC_) so it never lands in the client
// bundle where any visitor could lift it. The browser calls this route
// instead, we tack on the key and forward. This also lets us normalise the
// response shape so the client stays Google-agnostic (easy to swap
// providers later without touching AddressLookup.tsx).
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/autocomplete
//
// Query params from the client:
//   input        — required, the text the user has typed
//   country      — optional ISO 3166-1 alpha-2 code, default 'gb'; pass '' to
//                  remove the country restriction and go international
//   sessiontoken — optional; Google prices autocomplete cheaper when you
//                  bundle it with the follow-up Details call under one token

export const runtime = 'nodejs'

export interface Prediction {
  place_id: string
  label: string          // full "3 Sheringham Drive, Barking, IG11 9AL"
  main_text: string      // "3 Sheringham Drive"
  secondary_text: string // "Barking, IG11 9AL, UK"
}

// Loose Google response shape — we only touch the fields we need.
interface RawGoogleAutocompleteResponse {
  status?: string
  error_message?: string
  predictions?: Array<{
    place_id?: string
    description?: string
    structured_formatting?: {
      main_text?: string
      secondary_text?: string
    }
  }>
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const input = (url.searchParams.get('input') || '').trim()
  const country = url.searchParams.get('country')
  const sessiontoken = url.searchParams.get('sessiontoken') || ''

  // Google requires at least one character; we require three so we don't burn
  // quota on 1-2 char inputs that rarely produce useful predictions anyway.
  if (input.length < 3) return NextResponse.json({ predictions: [] })

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    // Distinct 503 so the client can distinguish "server missing config" from
    // "Google says no results" (which is a 200 with empty predictions).
    return NextResponse.json({ error: 'Places API is not configured' }, { status: 503 })
  }

  const params = new URLSearchParams({
    input,
    types: 'address',
    key,
  })
  // Default to UK-only; caller can pass ?country= (empty) to go international.
  const cc = country === null ? 'gb' : country.trim().toLowerCase()
  if (cc) params.set('components', `country:${cc}`)
  if (sessiontoken) params.set('sessiontoken', sessiontoken)

  const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`

  let res: Response
  try {
    res = await fetch(googleUrl)
  } catch (e) {
    console.error('[places/autocomplete] network error:', e)
    return NextResponse.json({ error: 'Places lookup is temporarily unavailable' }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Places lookup failed (${res.status})` }, { status: 502 })
  }

  const data = (await res.json()) as RawGoogleAutocompleteResponse
  // Google's own status codes: OK, ZERO_RESULTS, INVALID_REQUEST,
  // OVER_QUERY_LIMIT, REQUEST_DENIED, UNKNOWN_ERROR.
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[places/autocomplete] google status:', data.status, data.error_message)
    return NextResponse.json({ error: 'Places lookup failed', google_status: data.status }, { status: 502 })
  }

  const predictions: Prediction[] = (data.predictions ?? [])
    .filter((p) => p && p.place_id && p.description)
    .map((p) => ({
      place_id: p.place_id as string,
      label: p.description as string,
      main_text: p.structured_formatting?.main_text ?? p.description ?? '',
      secondary_text: p.structured_formatting?.secondary_text ?? '',
    }))

  return NextResponse.json({ predictions })
}
