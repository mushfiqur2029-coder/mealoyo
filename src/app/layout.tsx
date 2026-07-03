import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import MobileTabBar from '@/components/MobileTabBar'
import ThemeProvider from '@/components/ThemeProvider'

// Anti-FOUC: runs synchronously in <head> before first paint, setting the `dark`
// class + color-scheme on <html> so ThemeProvider has nothing to correct on
// hydrate (no flash). See Next's "Preventing Flash" guide.
//
// The theme is a *signed-in-only* feature: dark is applied only when a Supabase
// auth cookie (sb-<ref>-auth-token, possibly chunked as .0/.1) is present. Public
// / logged-out visitors always paint light, regardless of any persisted
// preference — so we also explicitly *remove* any stale `dark` class. When
// authed, we read the zustand-persisted theme ({"state":{"theme":...}}) from
// localStorage; 'auto'/unset falls back to the OS preference.
const themeScript = `(function(){try{var authed=false;var ck=document.cookie?document.cookie.split('; '):[];for(var i=0;i<ck.length;i++){if(/^sb-.+-auth-token(\\.\\d+)?=/.test(ck[i])){authed=true;break;}}var m='light';if(authed){var raw=localStorage.getItem('mealoyo-theme');if(raw){var t=JSON.parse(raw);if(t&&t.state&&t.state.theme)m=t.state.theme;}}var d=authed&&(m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches));var e=document.documentElement;if(d)e.classList.add('dark');else e.classList.remove('dark');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

const title = 'meaLoyo — Home cooked food, delivered'
const description =
  'Order authentic home cooked food from verified home cooks across the UK. Bangladeshi, Pakistani, Indian, Caribbean and more.'

export const metadata: Metadata = {
  // Resolves relative image/icon URLs (e.g. the OG image) to absolute URLs, which
  // social platforms require. Falls back to the production domain when the env
  // var isn't set (e.g. on Vercel where we don't define NEXT_PUBLIC_APP_URL).
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mealoyo.com'),
  title,
  description,
  applicationName: 'meaLoyo',
  // One square PNG declared at multiple sizes — the favicon.ico equivalent in the
  // metadata system (browsers pick the size they need from /public/favicon.png).
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: ['/favicon.png'],
    apple: [{ url: '/favicon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title,
    description,
    url: 'https://mealoyo.com',
    siteName: 'meaLoyo',
    locale: 'en_GB',
    type: 'website',
    images: [{ url: '/favicon.png', width: 1754, height: 1782, alt: 'meaLoyo' }],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: ['/favicon.png'],
  },
}

// Mobile viewport: device-width scaling and a brand theme colour for the
// browser chrome. `maximumScale`/`userScalable` are left at their accessible
// defaults so pinch-zoom still works.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C8006A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <MobileTabBar />
        </ThemeProvider>
      </body>
    </html>
  )
}
