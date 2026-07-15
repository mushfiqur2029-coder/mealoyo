import { NextResponse } from 'next/server'

// Server-side proxy for the Google Places Autocomplete API.
//
// Reasoning: GOOGLE_MAPS_API_KEY is a server-only secret so it never lands
// in the client bundle where any visitor could lift it. The browser POSTs
// here, we tack on the key and forward. This is also where we set the
// country restriction — see the comment on the components param below.
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/autocomplete

export const runtime = 'nodejs'

interface AutocompleteBody {
  input?: string
  sessionToken?: string
}

interface RawGoogleAutocompleteResponse {
  status?: string
  error_message?: string
  predictions?: Array<{
    place_id?: string
    description?: string
    structured_formatting?: { main_text?: string; secondary_text?: string }
  }>
}

export async function POST(request: Request) {
  let body: AutocompleteBody
  try {
    body = (await request.json()) as AutocompleteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = (body.input || '').trim()
  const sessionToken = (body.sessionToken || '').trim()

  // Google will accept 1 char but we require 3 so we don't burn quota on
  // inputs too short to produce useful predictions.
  if (input.length < 3) return NextResponse.json({ predictions: [] })

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ error: 'Places API is not configured' }, { status: 503 })

  const params = new URLSearchParams({
    input,
    types: 'address',
    // Country restriction — pinned to GB for now. To go international, drop
    // the next line (or thread a country param through from the client).
    components: 'country:gb',
    language: 'en',
    key,
  })
  if (sessionToken) params.set('sessiontoken', sessionToken)

  const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`

  let res: Response
  try {
    res = await fetch(googleUrl)
  } catch (e) {
    console.error('[places/autocomplete] network error:', e)
    return NextResponse.json({ error: 'Places lookup is temporarily unavailable' }, { status: 502 })
  }
  if (!res.ok) return NextResponse.json({ error: `Places lookup failed (${res.status})` }, { status: 502 })

  const data = (await res.json()) as RawGoogleAutocompleteResponse
  // Google's own status codes: OK, ZERO_RESULTS, INVALID_REQUEST,
  // OVER_QUERY_LIMIT, REQUEST_DENIED, UNKNOWN_ERROR.
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[places/autocomplete] google status:', data.status, data.error_message)
    return NextResponse.json({ error: 'Places lookup failed', google_status: data.status }, { status: 502 })
  }

  // Forward Google's shape verbatim (place_id, description,
  // structured_formatting) so the client can render either the full
  // description or the two-line structured_formatting version.
  const predictions = (data.predictions ?? [])
    .filter((p) => p && p.place_id && p.description)
    .map((p) => ({
      place_id: p.place_id as string,
      description: p.description as string,
      structured_formatting: {
        main_text: p.structured_formatting?.main_text ?? p.description ?? '',
        secondary_text: p.structured_formatting?.secondary_text ?? '',
      },
    }))

  return NextResponse.json({ predictions })
}
