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
 * - matchMedia picks the lighter encode on ≤768px (browser support for `media`
 *   on <source> is unreliable, so we resolve the URL in JS instead).
 * - onError → unmounts the video so the section's gradient shows through.
 */
export default function HeroVideoBg({
  src,
  mobileSrc,
  poster,
  overlay = 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(140,0,70,0.7) 100%)',
}: {
  src: string
  /** Optional lighter/smaller encode served to ≤768px viewports to cut mobile data + buffering. */
  mobileSrc?: string
  poster?: string
  overlay?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)
  // Resolved once the component mounts client-side. Until then it's the full
  // encode, but the video itself doesn't render until `mounted` is set, so the
  // mobile decision is always made before any source is requested.
  const [activeSrc, setActiveSrc] = useState(src)

  // Defer the video to after first paint (rAF callback, not a synchronous
  // setState in the effect body) so it never blocks the initial render. In the
  // same pass, pick the mobile encode when the viewport is ≤768px.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (mobileSrc && window.matchMedia('(max-width: 768px)').matches) setActiveSrc(mobileSrc)
      setMounted(true)
    })
    return () => cancelAnimationFrame(id)
  }, [src, mobileSrc])

  return (
    <>
      {/* Solid brand colour + poster paint instantly (esp. on mobile, where the
          video takes a beat to buffer) so the hero is never blank/delayed. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#C8006A', zIndex: 0, pointerEvents: 'none' }} />
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }} />
      )}
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
          <source src={activeSrc} type="video/mp4" />
        </video>
      )}
      {/* dark gradient overlay so white text stays readable over any frame */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlay, zIndex: 0, pointerEvents: 'none' }} />
    </>
  )
}
