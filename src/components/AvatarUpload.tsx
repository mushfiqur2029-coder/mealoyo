'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/images'

// Profile-photo uploader. Click to pick → validate → compress to 400×400 JPEG
// at q=0.9 → upload to the "avatars" bucket at {userId}/avatar.jpg → save the
// public URL back to profiles.avatar_url. Mobile-selfie feel: JPEG only, no
// PNG/WebP that could arrive as a screenshot.

const MAX_BYTES = 5 * 1024 * 1024        // 5MB hard limit on the original file
const COMPRESSED_MAX_DIM = 400           // 400×400 output
const COMPRESSED_QUALITY = 0.9           // higher quality for faces

type Props = {
  userId: string
  initialUrl: string | null
  initials: string
  size?: number
  dark?: boolean
  onUploaded?: (url: string) => void
}

export default function AvatarUpload({ userId, initialUrl, initials, size = 96, dark = false, onUploaded }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)   // 0–100, driven by the compress + upload phases
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError('')

    // JPEG only — matches the "mobile selfie" feel the design brief asked for.
    // MIME comparison is case-insensitive to handle image/JPEG from some
    // Android cameras.
    const mime = (file.type || '').toLowerCase()
    if (mime !== 'image/jpeg' && mime !== 'image/jpg') {
      setError('Photo must be a JPEG image')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Photo is too large — please keep it under ${Math.round(MAX_BYTES / (1024 * 1024))}MB.`)
      return
    }

    setUploading(true)
    setProgress(5)
    try {
      // Phase 1: client-side compress. The canvas API is synchronous under
      // the hood so we don't get streaming progress — bump to 40% when done.
      const blob = await compressImage(file, COMPRESSED_MAX_DIM, COMPRESSED_QUALITY)
      setProgress(40)

      // Phase 2: upload to Supabase Storage. supabase-js doesn't expose upload
      // progress on the browser SDK, so we fake a linear tick between 40 and
      // 92 while the network call runs — it feels responsive without lying.
      const tickId = window.setInterval(() => {
        setProgress((p) => (p < 92 ? Math.min(92, p + 3) : p))
      }, 120)
      const path = `${userId}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      window.clearInterval(tickId)
      if (upErr) throw upErr

      // Phase 3: publish + write URL back to the profile row.
      setProgress(96)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}` // cache-bust
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      if (dbErr) throw dbErr

      setProgress(100)
      setUrl(publicUrl)
      onUploaded?.(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      // Short beat at 100% so the buyer sees it complete.
      setTimeout(() => { setUploading(false); setProgress(0) }, 350)
    }
  }

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <style>{`
        .avatar-upload { position: relative; cursor: pointer; border: none; padding: 0; background: transparent; border-radius: 50%; flex-shrink: 0; }
        .avatar-upload .cam-overlay { opacity: 0; transition: opacity 0.16s; }
        .avatar-upload:hover .cam-overlay, .avatar-upload:focus-visible .cam-overlay { opacity: 1; }
        .avatar-upload:focus-visible { outline: 3px solid rgba(200,0,106,0.5); outline-offset: 3px; }
      `}</style>

      <button
        type="button"
        className="avatar-upload"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile picture"
        style={{ width: size, height: size }}
      >
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: url ? '#eee' : ring, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(200,0,106,0.28)' }}>
          {url ? (
            <Image src={url} alt="Profile picture" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} unoptimized />
          ) : (
            <span style={{ fontFamily: 'Georgia,serif', fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>{initials}</span>
          )}

          {/* Hover overlay with camera icon */}
          <div className="cam-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span style={{ fontSize: size * 0.11, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change</span>
          </div>

          {/* Uploading overlay + circular progress + linear bar */}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: size * 0.44, height: size * 0.44 }}>
                <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 18}
                    strokeDashoffset={2 * Math.PI * 18 * (1 - progress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.2s linear' }}/>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontSize: size * 0.14, fontWeight: 700, color: '#fff' }}>
                  {progress}%
                </div>
              </div>
            </div>
          )}
        </div>
      </button>

      <input ref={inputRef} type="file" accept="image/jpeg,.jpg,.jpeg" onChange={handleFile} style={{ display: 'none' }} />

      {uploading && (
        <div style={{ width: 160, height: 4, background: 'rgba(200,0,106,0.14)', borderRadius: 100, overflow: 'hidden' }} aria-label="Upload progress">
          <div style={{ width: `${progress}%`, height: '100%', background: '#C8006A', transition: 'width 0.2s linear' }}/>
        </div>
      )}

      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 220 }}>{error}</p>
        : <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : '#1A1A1A', opacity: dark ? 1 : 0.55, fontWeight: 600 }}>
            {uploading ? 'Uploading…' : 'Tap to change photo · JPEG only'}
          </p>}
    </div>
  )
}
