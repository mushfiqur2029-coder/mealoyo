'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

// Keep this list in sync with middleware.ts. These are the route prefixes where a
// signed-out user has no business being — if the session expires while they're
// sitting on one of these, we bounce them to the right login screen.
const PROTECTED_PREFIXES = [
  '/buyer',
  '/seller/dashboard',
  '/seller/listings',
  '/seller/orders',
  '/seller/earnings',
  '/seller/profile',
  '/driver',
  '/admin',
]

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some(p => path.startsWith(p))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true })
  const router = useRouter()
  const pathname = usePathname()
  // pathname is read inside the auth listener; a ref keeps the listener stable
  // (subscribe once) while always seeing the current path.
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  useEffect(() => {
    let active = true

    // Hydrate from the persisted cookie session on first mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setState({ session, user: session?.user ?? null, loading: false })
    })

    // One listener for the lifetime of the app. Fires on SIGNED_IN, SIGNED_OUT,
    // TOKEN_REFRESHED (autoRefreshToken handles the refresh itself — we just keep
    // React state in sync) and USER_UPDATED.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setState({ session, user: session?.user ?? null, loading: false })

      if (event === 'SIGNED_OUT') {
        const path = pathRef.current
        if (isProtected(path)) {
          // replace (not push) so we don't fight an explicit router.push('/') from
          // a sign-out button and so the dead protected page leaves history.
          router.replace(path.startsWith('/admin') ? '/admin/login' : '/login')
        }
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
