'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { compressImage, validateImageFile, ACCEPTED_IMAGE_TYPES } from '@/lib/images'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB hard limit on the original file

type Props = {
  userId: string
  initialUrl: string | null
  initials: string
  size?: number
  dark?: boolean
  onUploaded?: (url: string) => void
}

// Editable circular avatar used on the profile pages. Click to pick a file →
// validate → compress to 400×400 JPEG → upload to the "avatars" bucket at
// {userId}/avatar.jpg → save the public URL to profiles.avatar_url.
export default function AvatarUpload({ userId, initialUrl, initials, size = 96, dark = false, onUploaded }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError('')
    const validationError = validateImageFile(file, MAX_BYTES)
    if (validationError) { setError(validationError); return }

    setUploading(true)
    try {
      const blob = await compressImage(file, 400, 0.85)
      const path = `${userId}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      // The path is fixed, so bust the CDN/browser cache with a version param.
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`

      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      if (dbErr) throw dbErr

      setUrl(publicUrl)
      onUploaded?.(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <style>{`
        .avatar-upload { position: relative; cursor: pointer; border: none; padding: 0; background: transparent; border-radius: 50%; flex-shrink: 0; }
        .avatar-upload .cam-overlay { opacity: 0; transition: opacity 0.16s; }
        .avatar-upload:hover .cam-overlay { opacity: 1; }
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
          <div className="cam-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>

          {/* Uploading spinner */}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: size * 0.28, height: size * 0.28, border: '3px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'avspin 0.7s linear infinite' }} />
              <style>{`@keyframes avspin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </button>

      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleFile} style={{ display: 'none' }} />

      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 220 }}>{error}</p>
        : <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : '#1A1A1A', opacity: dark ? 1 : 0.55, fontWeight: 600 }}>{uploading ? 'Uploading…' : 'Tap to change photo'}</p>}
    </div>
  )
}
