'use client'
import { useEffect, useState } from 'react'
import { useThemeStore, type Theme } from '@/lib/themeStore'
import { useAuth } from '@/components/AuthProvider'

// Three-way pill: Light · Auto · Dark. The active segment fills with the brand
// colour. 36px tall, unobtrusive — lives in profile/settings pages.
const OPTS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'auto',
    label: 'Auto',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
]

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { session, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Persisted value is only trustworthy after hydration — until then render the
  // default so server and client markup match.
  const active = mounted ? theme : 'light'

  // Theme is a signed-in-only feature: hide the control entirely for logged-out
  // visitors (and until auth resolves) so it never appears on public pages.
  if (loading || !session) return null

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
        padding: 3,
        borderRadius: 100,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      {OPTS.map((o) => {
        const on = active === o.value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              border: 'none',
              borderRadius: 100,
              background: on ? '#C8006A' : 'transparent',
              color: on ? '#fff' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.16s, color 0.16s',
            }}
          >
            {o.icon}
            <span style={{ lineHeight: 1 }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
