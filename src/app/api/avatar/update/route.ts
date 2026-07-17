import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Server-side avatar_url writer.
//
// Auth model (defense in depth):
//   1. Client sends the freshly-uploaded storage URL in the body AND its
//      session's access_token as an Authorization: Bearer header.
//   2. We extract the UUID from the URL's path
//      (avatars/{uuid}/avatar.jpg) — that's what the profile row will be
//      updated against, so a client-supplied userId is never trusted.
//   3. We verify the Bearer token → user.id and require it MATCHES the UUID
//      in the URL. So even if an attacker constructs a URL string with
//      someone else's UUID, they can't update that row unless they also
//      possess that user's JWT.
//
// The service role key does the actual UPDATE, bypassing RLS + column
// grants so the fragile public.profiles grants can't block the write.

export const runtime = 'nodejs'

interface UpdateBody {
  avatarUrl?: string
}

// UUID v4 or any hex-with-dashes shape Supabase might issue. Pulled from
// the middle segment of a public storage URL.
const AVATAR_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\/([0-9a-f-]{36})\/avatar\.jpg(?:\?[^ ]*)?$/i

export async function POST(request: Request) {
  // ── Boot-time env sanity — a missing service key is a silent killer,
  // so we log its presence on every call. Value is never logged.
  console.log('[api/avatar/update] service key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  // ── Incoming headers snapshot — helps diagnose Vercel cookie/proxy drift
  // between the browser and this handler.
  const cookieHeader = request.headers.get('cookie') || ''
  const authHeader = request.headers.get('authorization') || ''
  console.log('[api/avatar/update] incoming', {
    hasCookieHeader: cookieHeader.length > 0,
    cookieBytes: cookieHeader.length,
    hasAuthHeader: authHeader.length > 0,
    authScheme: authHeader.slice(0, 7) === 'Bearer ' ? 'Bearer' : (authHeader ? 'other' : 'none'),
  })

  // ── 1. Parse + shape-validate the body.
  let body: UpdateBody
  try {
    body = (await request.json()) as UpdateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
  if (!avatarUrl) {
    return NextResponse.json({ error: 'avatarUrl is required' }, { status: 400 })
  }

  // ── 2. Extract the userId from the URL. This IS the id we'll write
  // against — no client-supplied userId is ever trusted for the WHERE
  // clause. If the regex doesn't match, the URL wasn't a Supabase Storage
  // avatars-bucket path and we bail before touching the DB.
  const match = avatarUrl.match(AVATAR_URL_RE)
  const urlUserId = match?.[1]?.toLowerCase()
  if (!urlUserId) {
    console.warn('[api/avatar/update] URL did not match avatars-bucket pattern', { avatarUrl })
    return NextResponse.json({
      error: 'avatarUrl must be a Supabase Storage avatars-bucket URL of the form .../avatars/{uuid}/avatar.jpg'
    }, { status: 400 })
  }

  // ── 3. Verify the Bearer token and require its user matches the URL's
  // UUID. Storage RLS already proved that only that user could have
  // uploaded to that folder — but this check stops a signed-in attacker
  // from POSTing a hand-crafted URL with someone else's UUID.
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    console.warn('[api/avatar/update] missing Bearer token')
    return NextResponse.json({ error: 'Missing auth token — please sign in again' }, { status: 401 })
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  const user = userData?.user
  console.log('[api/avatar/update] getUser result', {
    hasUser: !!user,
    userId: user?.id,
    error: userErr?.message,
  })
  if (userErr || !user) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  }
  if (user.id.toLowerCase() !== urlUserId) {
    console.warn('[api/avatar/update] session/URL user mismatch', {
      sessionUserId: user.id,
      urlUserId,
    })
    return NextResponse.json({ error: 'You can only update your own avatar' }, { status: 403 })
  }

  // ── 4. Service-role UPDATE. userId comes from the URL (which the caller
  // is proven to own). Bypasses RLS + column grants entirely.
  console.log('[api/avatar/update] update attempt for userId:', urlUserId)
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', urlUserId)
    .select('id, avatar_url')
    .maybeSingle()

  console.log('[api/avatar/update] update result', {
    userId: urlUserId,
    updatedRowId: data?.id,
    updatedAvatarUrl: data?.avatar_url,
    hasData: !!data,
    errorMessage: error?.message,
    errorCode: error?.code,
    errorDetails: error?.details,
    errorHint: error?.hint,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not save avatar. Please try again.' }, { status: 500 })
  }
  if (!data) {
    console.warn('[api/avatar/update] no profile row for user', urlUserId)
    return NextResponse.json({ error: 'Profile row not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, avatarUrl: data.avatar_url })
}
