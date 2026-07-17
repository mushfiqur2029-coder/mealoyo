'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { compressToTarget } from '@/lib/images'

// Profile-photo uploader.
//
// Two ways in:
//   • 📷 Selfie  — capture="user" hint opens the front camera on mobile.
//   • 🖼️ Upload — plain file picker for the gallery / filesystem.
//
// Both accept any image/* mime (jpg/png/webp/heic/gif) so users don't have to
// think about formats — we convert everything to a compact JPEG on the client
// via the canvas API. Target: max 200KB at 400×400, quality steps down from
// 0.9 to hit the byte cap (compressToTarget). The result uploads to Supabase
// Storage at avatars/{userId}/avatar.jpg (matches the folder-scoped RLS
// policies from 20260717_avatar_storage_rls.sql), then the public URL is
// written back to profiles.avatar_url.

const MAX_INPUT_BYTES = 15 * 1024 * 1024   // 15MB pre-compression ceiling
const OUTPUT_MAX_BYTES = 200 * 1024        // 200KB post-compression target
const OUTPUT_MAX_DIM = 400                 // 400×400 output

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
  const [progress, setProgress] = useState(0)  // 0–100, driven by the compress + upload phases
  const [error, setError] = useState('')
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Same handler for both inputs — the input element only differs in whether
  // it has the capture="user" hint.
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError('')

    // Broad "any image" check. Some Android cameras report a generic
    // application/octet-stream, so we also fall back to the file extension.
    const mime = (file.type || '').toLowerCase()
    const looksLikeImage = mime.startsWith('image/')
      || /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name)
    if (!looksLikeImage) {
      setError('Please choose an image file'); return
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError(`Photo is too large — please keep it under ${Math.round(MAX_INPUT_BYTES / (1024 * 1024))}MB.`)
      return
    }

    setUploading(true)
    setProgress(5)
    try {
      // Phase 1: client-side compression. compressToTarget steps quality down
      // (then dimensions if needed) until the JPEG fits under OUTPUT_MAX_BYTES.
      const blob = await compressToTarget(file, OUTPUT_MAX_BYTES, OUTPUT_MAX_DIM)
      setProgress(40)

      // Phase 2: storage upload. supabase-js doesn't emit browser upload
      // progress, so we fake a linear tick between 40 and 92 — feels
      // responsive without lying about state.
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
      setTimeout(() => { setUploading(false); setProgress(0) }, 350)
    }
  }

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <style>{`
        .avatar-upload { position: relative; cursor: pointer; border: none; padding: 0; background: transparent; border-radius: 50%; flex-shrink: 0; }
        .avatar-upload .cam-overlay { opacity: 0; transition: opacity 0.16s; }
        .avatar-upload:hover .cam-overlay, .avatar-upload:focus-visible .cam-overlay { opacity: 1; }
        .avatar-upload:focus-visible { outline: 3px solid rgba(200,0,106,0.5); outline-offset: 3px; }
        .av-btn-selfie:hover { background: #FFE8F4 !important; }
        .av-btn-upload:hover { background: #A00055 !important; }
        @keyframes avspin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .av-btns { flex-direction: column !important; width: 100%; max-width: 260px; }
          .av-btns > button { width: 100% !important; }
        }
      `}</style>

      {/* ── AVATAR CIRCLE — clicking still opens the gallery picker ── */}
      <button
        type="button"
        className="avatar-upload"
        onClick={() => galleryInputRef.current?.click()}
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

          {/* Uploading overlay + circular progress */}
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

      {/* ── HIDDEN INPUTS ────────────────────────────────────────────────
          Two inputs so a mobile browser can honour capture="user" (front
          camera) on one path while the other stays a plain gallery picker.
          accept="image/*" catches HEIC/HEIF/AVIF that iOS 17+ can hand back
          from the camera roll. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {/* ── VISIBLE BUTTONS ── */}
      <div className="av-btns" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          className="av-btn-selfie"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          style={{
            height: 44, padding: '0 18px',
            background: 'transparent',
            color: '#C8006A',
            border: '1.5px solid #C8006A',
            borderRadius: 100,
            fontSize: 14, fontWeight: 700,
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all 0.14s',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <span aria-hidden="true">📷</span> Selfie
        </button>
        <button
          type="button"
          className="av-btn-upload"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          style={{
            height: 44, padding: '0 18px',
            background: '#C8006A',
            color: '#fff',
            border: 'none',
            borderRadius: 100,
            fontSize: 14, fontWeight: 700,
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 12px rgba(200,0,106,0.28)',
            transition: 'all 0.14s',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <span aria-hidden="true">🖼️</span> Upload
        </button>
      </div>

      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 260 }}>{error}</p>
        : uploading
          ? <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.65)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600 }}>Uploading… {progress}%</p>
          : null}
    </div>
  )
}
