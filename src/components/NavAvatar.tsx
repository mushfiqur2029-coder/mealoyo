import Image from 'next/image'
import Link from 'next/link'

type Props = {
  url: string | null | undefined
  initial: string
  size?: number
  bg?: string
  // When provided the avatar becomes a link to the profile page — the standard
  // "tap your face → your account" pattern every consumer app uses. Callers
  // omit it (or pass null) for read-only contexts.
  href?: string | null
  // Overrides the default "Edit profile" tooltip when the avatar is a link.
  title?: string
}

// Circular avatar chip for nav bars. Shows the uploaded image if one exists,
// otherwise the user's initial on a solid background. If href is set it
// renders as a Link with a hover ring + tooltip.
export default function NavAvatar({ url, initial, size = 34, bg = '#C8006A', href, title }: Props) {
  const inner = url ? (
    <Image src={url} alt="" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} unoptimized />
  ) : (
    <span style={{ fontSize: size * 0.4, fontWeight: 700, color: '#fff' }}>{initial}</span>
  )

  const dot = (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {inner}
    </div>
  )

  if (!href) return dot

  return (
    <>
      <style>{`
        .nav-avatar-link { position: relative; display: inline-flex; border-radius: 50%; transition: box-shadow 0.14s ease; }
        .nav-avatar-link:hover, .nav-avatar-link:focus-visible { box-shadow: 0 0 0 2px #C8006A; outline: none; }
      `}</style>
      <Link href={href} className="nav-avatar-link" aria-label={title ?? 'Edit profile'} title={title ?? 'Edit profile'}>
        {dot}
      </Link>
    </>
  )
}
