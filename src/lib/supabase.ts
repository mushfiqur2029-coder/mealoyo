import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// IMPORTANT: use the @supabase/ssr browser client, NOT the plain
// @supabase/supabase-js createClient. The plain client stores the session in
// localStorage, which the Next.js middleware (createServerClient, cookie-based)
// can never see — so every navigation to a protected route read the session as
// missing and bounced the user to /login. createBrowserClient persists the
// session in cookies that are shared with the middleware/server, and returns a
// browser-wide singleton so we don't spin up a fresh client per render.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
