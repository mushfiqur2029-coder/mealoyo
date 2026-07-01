import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role key. It bypasses RLS, so
// it must ONLY be imported from route handlers / server code — never from a
// 'use client' component. Used by the Stripe webhook to update orders and by
// any server flow that legitimately needs elevated access.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
