import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
