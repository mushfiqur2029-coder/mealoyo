import Image from 'next/image'

type Props = {
  url: string | null | undefined
  initial: string
  size?: number
  bg?: string
}

// Read-only circular avatar chip for nav bars. Shows the uploaded image if one
// exists, otherwise the user's initial on a solid background.
export default function NavAvatar({ url, initial, size = 34, bg = '#C8006A' }: Props) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {url ? (
        <Image src={url} alt="" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} unoptimized />
      ) : (
        <span style={{ fontSize: size * 0.4, fontWeight: 700, color: '#fff' }}>{initial}</span>
      )}
    </div>
  )
}
