'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = { l: string; i: string; h: string }

// One bottom tab bar for each authenticated area. Mounted once in the root
// layout; it reads the pathname, picks the matching area, and renders nothing
// elsewhere (marketing pages, admin, auth, dish, checkout…). Mobile-only —
// hidden on ≥769px via the scoped <style> below.
const AREAS: { match: string; tabs: Tab[] }[] = [
  { match: '/buyer', tabs: [
    { l: 'Home', i: '🏠', h: '/buyer/dashboard' },
    { l: 'Browse', i: '🔍', h: '/browse' },
    { l: 'Orders', i: '📦', h: '/buyer/orders' },
    { l: 'Saved', i: '❤️', h: '/buyer/saved' },
    { l: 'Profile', i: '👤', h: '/buyer/profile' },
  ] },
  { match: '/seller', tabs: [
    { l: 'Home', i: '🏠', h: '/seller/dashboard' },
    { l: 'Dishes', i: '🍽️', h: '/seller/listings' },
    { l: 'Orders', i: '📦', h: '/seller/orders' },
    { l: 'Earnings', i: '💷', h: '/seller/earnings' },
    { l: 'Profile', i: '👤', h: '/seller/profile' },
  ] },
  { match: '/driver', tabs: [
    { l: 'Home', i: '🏠', h: '/driver/dashboard' },
    { l: 'Earnings', i: '💷', h: '/driver/earnings' },
    { l: 'History', i: '🕑', h: '/driver/history' },
    { l: 'Profile', i: '👤', h: '/driver/profile' },
  ] },
]

export default function MobileTabBar() {
  const pathname = usePathname() || ''
  const area = AREAS.find(a => pathname === a.match || pathname.startsWith(a.match + '/'))
  if (!area) return null

  const isActive = (h: string) => pathname === h || pathname.startsWith(h + '/')

  return (
    <>
      <style>{`
        .mtb { display: none; }
        @media (max-width: 768px) {
          .mtb {
            display: flex;
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 600;
            background: rgba(255,255,255,0.98);
            -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
            border-top: 1px solid rgba(200,0,106,0.12);
            box-shadow: 0 -4px 20px rgba(200,0,106,0.08);
            padding-bottom: env(safe-area-inset-bottom);
          }
          /* Keep page content clear of the fixed bar. */
          body { padding-bottom: calc(58px + env(safe-area-inset-bottom)) !important; }
        }
        .mtb-tab:active { background: #FFE8F4; }
      `}</style>
      <nav className="mtb" aria-label="Primary">
        {area.tabs.map(t => {
          const on = isActive(t.h)
          return (
            <Link key={t.h} href={t.h} className="mtb-tab" aria-current={on ? 'page' : undefined}
              style={{ flex: 1, height: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', transition: 'background 0.12s' }}>
              <span style={{ fontSize: 19, lineHeight: 1, filter: on ? 'none' : 'grayscale(0.4) opacity(0.55)' }}>{t.i}</span>
              <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? '#C8006A' : '#8A8A8A', letterSpacing: '0.01em' }}>{t.l}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
