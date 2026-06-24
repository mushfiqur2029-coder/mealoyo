import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'meaLoyo — Home cooked food, delivered',
  description: 'Order authentic home cooked food from verified home cooks across the UK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
