'use client'
import { useEffect, useState } from 'react'
import { useThemeStore, resolveTheme } from '@/lib/themeStore'
import { supabase } from '@/lib/supabase'

// Applies the theme to <html> and keeps it in sync. The initial paint is handled
// by the inline script in layout.tsx (no flash); this component takes over once
// React hydrates, so toggling, live OS changes and sign-in/out work immediately.
//
// The theme is a signed-in-only feature: only authenticated users get their
// stored preference. Public / logged-out visitors are always forced to light,
// and on sign-out we revert to light.
function apply(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)
  // null = auth state not yet resolved. While unknown we leave the inline
  // script's paint untouched to avoid a flash; once known we take over.
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setAuthed(!!session)
    })
    // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED all flow through here, keeping the
    // applied theme correct across login and logout without a reload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthed(!!session)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Wait until auth is resolved; the inline script already painted correctly.
    if (authed === null) return

    // Signed out (or never signed in): always light. Strips a stale `dark` class.
    if (!authed) {
      apply('light')
      return
    }

    // Signed in: honour the stored preference.
    apply(resolveTheme(theme))

    // Only 'auto' cares about live OS preference changes.
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply(resolveTheme('auto'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [authed, theme])

  return <>{children}</>
}
