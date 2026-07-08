import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Keep this list in sync with src/components/AuthProvider.tsx (PROTECTED_PREFIXES).
const PROTECTED = [
  '/buyer',
  '/seller/dashboard',
  '/seller/listings',
  '/seller/orders',
  '/seller/earnings',
  '/seller/profile',
  '/driver',
  '/admin',
]

// Next.js 16 renamed the `middleware` convention to `proxy`. The file must be
// named proxy.ts and the function `proxy` (or default export), and it must sit at
// the same level as `app` — i.e. src/proxy.ts when the app lives in src/app. The
// previous root-level middleware.ts satisfied neither, so it never ran and
// protected routes were not gated at the edge at all.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and getUser: getUser() revalidates
  // the token and, on refresh, writes the rotated session cookie via setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAdminArea = path.startsWith('/admin') && !path.startsWith('/admin/login')
  // '/admin' is handled by isAdminArea above (and must not catch /admin/login),
  // so exclude it from the generic prefix check.
  const isProtected =
    isAdminArea || PROTECTED.filter(r => r !== '/admin').some(r => path.startsWith(r))

  if (!user && isProtected) {
    return NextResponse.redirect(new URL(isAdminArea ? '/admin/login' : '/login', request.url))
  }

  // A suspended user must not reach any protected area — bounce them to
  // /suspended. We only look up the profile on protected routes (to avoid the
  // extra query on public pages), and /suspended itself is public, so there's
  // no login↔suspended redirect loop. Admins are exempt so a mis-set status
  // can't lock them out of the admin panel.
  if (user && isProtected) {
    const { data: profile } = await supabase.rpc('get_my_profile')
    const p = profile as { status?: string; role?: string } | null
    if (p?.status === 'suspended' && p.role !== 'admin') {
      return NextResponse.redirect(new URL('/suspended', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
