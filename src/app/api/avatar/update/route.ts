import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Server-side avatar_url writer. Called by AvatarUpload AFTER the client has
// uploaded the compressed JPEG to Supabase Storage. We then persist the
// public URL to profiles.avatar_url using the SERVICE ROLE — bypasses RLS +
// column grants entirely, and the write is scoped to the caller's own row
// via the JWT.
//
// Auth model: Bearer token in the Authorization header (previous version
// used the cookie; on Vercel that path can silently drop the SB cookie for
// same-origin fetches from a client component in edge cases). The browser
// grabs the access_token from supabase.auth.getSession() and hands it over
// explicitly — no cookie plumbing to trust. supabaseAdmin.auth.getUser(token)
// validates the JWT server-side.

export const runtime = 'nodejs'

interface UpdateBody {
  avatarUrl?: string
}

export async function POST(request: Request) {
  // Presence-only cookie header log — we log LENGTH, not value, to help
  // diagnose cookie-vs-header drift without leaking any tokens.
  const cookieHeader = request.headers.get('cookie') || ''
  const authHeader = request.headers.get('authorization') || ''
  console.log('[api/avatar/update] incoming', {
    hasCookieHeader: cookieHeader.length > 0,
    cookieBytes: cookieHeader.length,
    hasAuthHeader: authHeader.length > 0,
    authScheme: authHeader.slice(0, 7) === 'Bearer ' ? 'Bearer' : 'other',
  })

  // 1. Extract the Bearer token.
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    console.warn('[api/avatar/update] missing Bearer token')
    return NextResponse.json({ error: 'Missing auth token — please sign in again' }, { status: 401 })
  }

  // 2. Verify the token server-side via the admin client. This calls
  //    Supabase's GoTrue /user endpoint with the JWT — no cookie needed.
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  const user = userData?.user
  console.log('[api/avatar/update] getUser result', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    error: userErr?.message,
  })
  if (userErr || !user) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  }

  // 3. Parse + validate the new URL.
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
  // Only accept Supabase Storage public URLs — belt-and-braces so a
  // compromised client can't set the avatar to an arbitrary tracking pixel.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\//i.test(avatarUrl)) {
    console.warn('[api/avatar/update] bad avatarUrl shape', { userId: user.id, avatarUrl })
    return NextResponse.json({ error: 'avatarUrl must point at the avatars storage bucket' }, { status: 400 })
  }

  // 4. Service-role UPDATE. Bypasses RLS + column grants; scoped to the
  //    caller's own row via .eq('id', user.id).
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)
    .select('id, avatar_url')
    .maybeSingle()

  console.log('[api/avatar/update] update result', {
    userId: user.id,
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
    // Row didn't exist — extremely rare (profile is created at signup) but
    // worth flagging so we don't lie about success.
    console.warn('[api/avatar/update] no profile row for user', user.id)
    return NextResponse.json({ error: 'Profile row not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, avatarUrl: data.avatar_url })
}
