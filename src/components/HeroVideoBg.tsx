'use client'
import { useEffect, useState } from 'react'

/**
 * Full-bleed muted/looping video background for a hero <section>.
 *
 * Drop this as the FIRST child of a `position: relative` section whose own
 * background is the brand gradient (the fallback). The video + dark gradient
 * overlay sit at z-index 0; keep your hero content at z-index 1 so it stays
 * above both.
 *
 * - Deferred mount (after first paint) so the video never blocks initial paint.
 * - playsInline + muted + autoPlay + loop → autoplays on mobile too.
 * - onError → unmounts the video so the section's gradient shows through.
 */
export default function HeroVideoBg({
  src,
  poster,
  overlay = 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(140,0,70,0.7) 100%)',
}: {
  src: string
  poster?: string
  overlay?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)

  // Defer the video to after first paint (rAF callback, not a synchronous
  // setState in the effect body) so it never blocks the initial render.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      {mounted && !failed && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          aria-hidden="true"
          onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
      {/* dark gradient overlay so white text stays readable over any frame */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 0, pointerEvents: 'none' }} />
    </>
  )
}
