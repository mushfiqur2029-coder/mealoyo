import Image from 'next/image'
import type { CSSProperties } from 'react'

// Both logo PNGs are 2775×805. We render at an exact pixel size derived from the
// requested height so next/image keeps the intrinsic aspect ratio without the
// "width/height modified" warning.
const RATIO = 2775 / 805

export default function Logo({
  height = 34,
  white = false,
  priority = true,
  style,
}: {
  height?: number
  white?: boolean
  priority?: boolean
  style?: CSSProperties
}) {
  return (
    <Image
      src={white ? '/White_Logo.png' : '/Color_Logo.png'}
      alt="meaLoyo"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      style={{ display: 'block', ...style }}
    />
  )
}
