'use client'
import { useEffect, useRef, useState } from 'react'
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
// via the canvas API. Target: max 80KB at 400×400, quality steps 0.82 → 0.5
// (see compressToTarget). Result uploads to Supabase Storage at
// avatars/{userId}/avatar.jpg (matches the folder-scoped RLS policies from
// 20260717_avatar_storage_rls.sql), then the public URL is written back to
// profiles.avatar_url.

const MAX_INPUT_BYTES = 15 * 1024 * 1024   // 15MB pre-compression ceiling
const OUTPUT_MAX_BYTES = 80 * 1024         // 80KB post-compression target
const OUTPUT_MAX_DIM = 400                 // 400×400 output

// "1.2 MB" / "68 KB" — friendly byte formatter for the compression readout.
function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

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
  // Optimistic preview from the picked file — shown INSIDE the avatar circle
  // the moment the buyer selects an image, before compression or upload
  // finish. Object URL cleaned up on unmount and on new picks.
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)  // 0–100
  // Human-readable "1.2 MB → 68 KB" during / after compression.
  const [sizeLabel, setSizeLabel] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Revoke any leftover object URL on unmount so we don't leak.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setError(''); setShowSuccess(false)

    // Broad "any image" check. Some Android cameras report a generic
    // application/octet-stream, so we also fall back to the file extension.
    const mime = (file.type || '').toLowerCase()
    const looksLikeImage = mime.startsWith('image/')
      || /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name)
    if (!looksLikeImage) { setError('Please choose an image file'); return }
    if (file.size > MAX_INPUT_BYTES) {
      setError(`Photo is too large — please keep it under ${Math.round(MAX_INPUT_BYTES / (1024 * 1024))}MB.`)
      return
    }

    // Optimistic preview immediately.
    if (preview) URL.revokeObjectURL(preview)
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setUploading(true)
    setProgress(5)
    setSizeLabel(`${humanSize(file.size)} → …`)
    try {
      // ── SESSION VERIFICATION ─────────────────────────────────────────
      // Re-derive user.id from the live session rather than trusting the
      // userId prop. If the parent handed a stale/wrong id we'd try to
      // update someone else's row and RLS would (correctly) reject with
      // "permission denied for table profiles". The session also proves
      // the JWT still has auth.uid() attached to the browser client.
      const { data: sessionData } = await supabase.auth.getSession()
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user ?? null
      if (!user || !sessionData?.session) {
        setError('Please sign in again — your session has expired.')
        setUploading(false); setProgress(0); return
      }
      // Use the live session's id for BOTH the storage path and the
      // profiles update. Never the prop.
      const authUid = user.id

      // Phase 1: client-side compression. compressToTarget iteratively steps
      // quality down (then dimensions if needed) until it fits under 80KB.
      const blob = await compressToTarget(file, OUTPUT_MAX_BYTES, OUTPUT_MAX_DIM)
      setProgress(40)
      setSizeLabel(`${humanSize(file.size)} → ${humanSize(blob.size)}`)

      // Phase 2: storage upload. supabase-js doesn't emit browser upload
      // progress so we tick 40 → 92 linearly — feels responsive without
      // lying about state.
      const tickId = window.setInterval(() => {
        setProgress((p) => (p < 92 ? Math.min(92, p + 3) : p))
      }, 120)
      const path = `${authUid}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      window.clearInterval(tickId)
      if (upErr) throw upErr

      // Phase 3: publish + write URL back via the service-role API route.
      //
      // Auth model: send the session's access_token as an Authorization
      // Bearer header rather than relying on the Supabase cookie flowing to
      // the route. On Vercel same-origin fetches from a 'use client'
      // component the cookie sometimes doesn't reach the handler cleanly;
      // the Bearer token makes the call self-contained and independent of
      // cookie plumbing. The API route verifies the JWT server-side with
      // supabaseAdmin.auth.getUser(token) and does the write with the
      // service role — bypasses RLS + column grants entirely.
      setProgress(96)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust for the browser's <img> but strip it before persisting so
      // the URL doesn't grow every save.
      const persistedUrl = pub.publicUrl
      const displayUrl = `${pub.publicUrl}?v=${Date.now()}`

      // Fresh session read — the JWT rotates in the background, so grab the
      // current access_token right before we send it.
      const { data: freshSession } = await supabase.auth.getSession()
      const accessToken = freshSession?.session?.access_token
      if (!accessToken) {
        throw new Error('Please sign in again — your session has expired.')
      }

      const res = await fetch('/api/avatar/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ avatarUrl: persistedUrl }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[AvatarUpload] api/avatar/update failed', { status: res.status, payload })
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Could not save avatar (${res.status})`)
      }

      setProgress(100)
      setUrl(displayUrl)
      onUploaded?.(displayUrl)
      // Success checkmark bloom — clears after ~1.6s so the next click still
      // shows a clean UI.
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0) }, 350)
    }
  }

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'
  // The circle shows: freshly-picked preview during upload, or the persisted URL, or initials.
  const displayImage = (uploading && preview) ? preview : url

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
        @keyframes avSuccessPop {
          0% { opacity: 0; transform: scale(0.4); }
          55% { transform: scale(1.16); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes avSuccessRing {
          0% { box-shadow: 0 0 0 0 rgba(45,168,78,0.55); }
          70% { box-shadow: 0 0 0 18px rgba(45,168,78,0); }
          100% { box-shadow: 0 0 0 0 rgba(45,168,78,0); }
        }
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
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: displayImage ? '#eee' : ring, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(200,0,106,0.28)' }}>
          {displayImage ? (
            <Image src={displayImage} alt="Profile picture" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} unoptimized />
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

          {/* Success burst — brief green check with pulse ring */}
          {showSuccess && !uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(45,168,78,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'avSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, avSuccessRing 1.4s ease-out 0.3s 1' }}>
              <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
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
      <div className="av-btns" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          className="av-btn-selfie"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          style={{
            height: 44, padding: '0 20px',
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
            height: 44, padding: '0 20px',
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

      {/* ── STATUS LINE — error / uploading / size / done ── */}
      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 260 }}>{error}</p>
        : uploading
          ? (
            <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.75)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600, textAlign: 'center' }}>
              Uploading… {progress}%{sizeLabel ? ` · ${sizeLabel}` : ''}
            </p>
          )
          : showSuccess
            ? <p style={{ fontSize: 12, color: '#157A33', fontWeight: 700 }}>✓ Photo updated{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
            : null}
    </div>
  )
}
