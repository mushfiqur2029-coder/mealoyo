import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Server-side avatar_url writer. Called by the AvatarUpload component AFTER
// the client has already uploaded the compressed JPEG to Supabase Storage
// (avatars/{userId}/avatar.jpg). We then persist the public URL to
// profiles.avatar_url.
//
// Why server-side: direct .update() on public.profiles from the browser is
// gated by RLS + column-level grants that keep drifting across environments
// (the "permission denied for table profiles" bug). Doing the write through a
// service-role client sidesteps all of that. Same pattern as
// /api/orders/create — the SDK still verifies the caller's session cookie via
// createClient(), we ONLY use the admin client for the actual UPDATE.

export const runtime = 'nodejs'

interface UpdateBody {
  avatarUrl?: string
}

export async function POST(request: Request) {
  // 1. Session verification via the buyer's cookie. Never trust an
  //    incoming userId — always derive it from the JWT.
  const supabase = await createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const user = userData?.user
  if (userErr || !user) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  }

  // 2. Parse + validate the new URL.
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
  // Only accept Supabase Storage public URLs — belt-and-braces so a compromised
  // client can't set the avatar to an arbitrary tracking pixel.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\//i.test(avatarUrl)) {
    return NextResponse.json({ error: 'avatarUrl must point at the avatars storage bucket' }, { status: 400 })
  }

  // 3. Service-role UPDATE. Bypasses RLS + column grants entirely, but we
  //    scope the write to the caller's own row via .eq('id', user.id) — no
  //    way for a signed-in user to overwrite someone else's avatar even
  //    though the underlying client CAN.
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)
    .select('id, avatar_url')
    .maybeSingle()

  if (error) {
    console.error('[api/avatar/update] profiles error', {
      userId: user.id,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return NextResponse.json({ error: 'Could not save avatar. Please try again.' }, { status: 500 })
  }
  if (!data) {
    // Row didn't exist — extremely rare (profile is created at signup) but
    // worth flagging so we don't lie about success.
    console.warn('[api/avatar/update] no profile row for', user.id)
    return NextResponse.json({ error: 'Profile row not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, avatarUrl: data.avatar_url })
}
