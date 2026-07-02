'use client'
import { useEffect } from 'react'
import { useThemeStore, resolveTheme } from '@/lib/themeStore'

// Applies the persisted theme to <html> and keeps it in sync. The initial paint
// is handled by the inline script in layout.tsx (no flash); this component takes
// over once React hydrates, so toggling and live OS changes work immediately.
function apply(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    apply(resolveTheme(theme))

    // Only 'auto' cares about live OS preference changes.
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply(resolveTheme('auto'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return <>{children}</>
}
