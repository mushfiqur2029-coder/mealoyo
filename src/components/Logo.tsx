import Image from 'next/image'
import type { CSSProperties } from 'react'

// Both logo PNGs are 2775×805. We render at an exact pixel size derived from the
// requested height so next/image keeps the intrinsic aspect ratio without the
// "width/height modified" warning.
const RATIO = 2775 / 805

export default function Logo({
  height = 34,
  white = false,
  themed = false,
  priority = true,
  style,
}: {
  height?: number
  white?: boolean
  /** Renders both marks and lets CSS pick by theme (white in dark, colour in
   *  light). Use on surfaces that flip with the theme, e.g. the admin nav. */
  themed?: boolean
  priority?: boolean
  style?: CSSProperties
}) {
  const width = Math.round(height * RATIO)
  if (themed) {
    return (
      <>
        <Image src="/Color_Logo.png" alt="meaLoyo" width={width} height={height} priority={priority} className="logo-themed-light" style={{ display: 'block', ...style }} />
        <Image src="/White_Logo.png" alt="meaLoyo" width={width} height={height} priority={priority} className="logo-themed-dark" style={{ display: 'none', ...style }} />
      </>
    )
  }
  return (
    <Image
      src={white ? '/White_Logo.png' : '/Color_Logo.png'}
      alt="meaLoyo"
      width={width}
      height={height}
      priority={priority}
      style={{ display: 'block', ...style }}
    />
  )
}

// The favicon is the square brand mark (1754×1782). LogoMark renders it as a
// standalone icon for spots that need a compact glyph rather than the wide
// wordmark — e.g. the admin login header or a nav badge. We derive height from
// the intrinsic ratio so next/image doesn't warn about a modified aspect ratio.
const MARK_W = 1754
const MARK_H = 1782

export function LogoMark({
  size = 36,
  radius,
  priority = true,
  style,
}: {
  size?: number
  /** Corner radius in px. Omit for the raw mark; pass e.g. size*0.25 for a chip. */
  radius?: number
  priority?: boolean
  style?: CSSProperties
}) {
  return (
    <Image
      src="/favicon.png"
      alt="meaLoyo"
      width={size}
      height={Math.round(size * (MARK_H / MARK_W))}
      priority={priority}
      style={{
        display: 'block',
        ...(radius != null ? { borderRadius: radius } : {}),
        ...style,
      }}
    />
  )
}
