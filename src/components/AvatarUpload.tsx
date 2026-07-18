'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { compressToTarget } from '@/lib/images'

// Profile-photo uploader — click-to-edit UX (no visible buttons).
//
// Interaction:
//   • Avatar circle is the ONLY tappable element.
//   • Desktop hover → dark overlay + camera icon.
//   • Mobile → persistent camera badge at bottom-right (Instagram / WhatsApp).
//   • Click → sheet with three actions:
//        Take a selfie · Upload from gallery · Remove photo (only if set).
//   • On mobile the sheet slides up from the bottom; on desktop it appears as
//     a centred modal. Backdrop + Escape both close it.
//
// Storage layout is unchanged: files land at avatars/{authUid}/avatar.jpg and
// the public URL is persisted via update_my_avatar (security-definer RPC).

const MAX_INPUT_BYTES = 15 * 1024 * 1024   // 15MB pre-compression ceiling
const OUTPUT_MAX_BYTES = 80 * 1024         // 80KB post-compression target
const OUTPUT_MAX_DIM = 400                 // 400×400 output

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
  onUploaded?: (url: string | null) => void
}

export default function AvatarUpload({ userId: _userId, initialUrl, initials, size = 96, dark = false, onUploaded }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sizeLabel, setSizeLabel] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // Close the sheet on Escape (desktop keyboard users).
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const openSheet = () => {
    if (uploading || removing) return
    setError('')
    setShowSuccess(false)
    setSheetOpen(true)
  }

  const pickGallery = () => {
    setSheetOpen(false)
    galleryInputRef.current?.click()
  }

  const pickCamera = async () => {
    setSheetOpen(false)
    // On mobile the capture attribute handles permissions natively. On
    // desktop the capture hint is mostly ignored, so we probe getUserMedia
    // first to distinguish "no camera / denied" from "silent file picker".
    const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (!isTouch && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
      } catch {
        setError('Camera access denied. Please allow camera access in your browser settings.')
        return
      }
    }
    cameraInputRef.current?.click()
  }

  const removePhoto = async () => {
    setSheetOpen(false)
    if (!url) return
    if (typeof window !== 'undefined' && !window.confirm('Remove your profile photo?')) return
    setRemoving(true); setError('')
    try {
      const { data: userData } = await supabase.auth.getUser()
      const authUid = userData?.user?.id
      if (!authUid) { setError('Please sign in again — your session has expired.'); setRemoving(false); return }
      await supabase.storage.from('avatars').remove([`${authUid}/avatar.jpg`])
      const { error: rpcErr } = await supabase.rpc('update_my_avatar', { p_avatar_url: null })
      if (rpcErr) throw new Error(rpcErr.message || 'Could not remove avatar')
      setUrl(null)
      onUploaded?.(null)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo')
    } finally {
      setRemoving(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(''); setShowSuccess(false)

    const mime = (file.type || '').toLowerCase()
    const looksLikeImage = mime.startsWith('image/')
      || /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name)
    if (!looksLikeImage) { setError('Please choose an image file'); return }
    if (file.size > MAX_INPUT_BYTES) {
      setError(`Photo is too large — please keep it under ${Math.round(MAX_INPUT_BYTES / (1024 * 1024))}MB.`)
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setUploading(true)
    setProgress(5)
    setSizeLabel(`${humanSize(file.size)} → …`)
    let step: 'getUser' | 'compress' | 'storage' | 'publicUrl' | 'rpc' = 'getUser'
    try {
      const { data: userData, error: getUserErr } = await supabase.auth.getUser()
      if (getUserErr) throw new Error(`[getUser] ${getUserErr.message}`)
      const user = userData?.user ?? null
      if (!user) {
        setError('Please sign in again — your session has expired.')
        setUploading(false); setProgress(0); return
      }
      const authUid = user.id

      step = 'compress'
      const blob = await compressToTarget(file, OUTPUT_MAX_BYTES, OUTPUT_MAX_DIM)
      setProgress(40)
      setSizeLabel(`${humanSize(file.size)} → ${humanSize(blob.size)}`)

      step = 'storage'
      const tickId = window.setInterval(() => {
        setProgress((p) => (p < 92 ? Math.min(92, p + 3) : p))
      }, 120)
      const path = `${authUid}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      window.clearInterval(tickId)
      if (upErr) throw new Error(`[storage] ${upErr.message}`)

      step = 'publicUrl'
      setProgress(96)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const persistedUrl = pub.publicUrl
      const displayUrl = `${pub.publicUrl}?v=${Date.now()}`

      step = 'rpc'
      const { error: rpcErr } = await supabase.rpc('update_my_avatar', { p_avatar_url: persistedUrl })
      if (rpcErr) throw new Error(`[rpc] ${rpcErr.message || 'Could not save avatar'}`)

      setProgress(100)
      setUrl(displayUrl)
      onUploaded?.(displayUrl)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1600)
    } catch (err) {
      console.error(`[AvatarUpload] CAUGHT at step "${step}":`, err)
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(message)
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0) }, 350)
    }
  }

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'
  const displayImage = (uploading && preview) ? preview : url

  // Camera icon used in three places: hover overlay, mobile badge, sheet.
  const cameraIcon = (px: number, stroke: string) => (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )

  const galleryIcon = (px: number, stroke: string) => (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  )

  const trashIcon = (px: number, stroke: string) => (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )

  const badgeSize = Math.max(24, Math.round(size * 0.28))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
      <style>{`
        .av-btn { position: relative; cursor: pointer; border: none; padding: 0; background: transparent; border-radius: 50%; flex-shrink: 0; }
        .av-btn:focus-visible { outline: 3px solid rgba(200,0,106,0.55); outline-offset: 3px; }
        .av-overlay { opacity: 0; transition: opacity 0.2s ease; }
        @media (hover: hover) {
          .av-btn:hover .av-overlay, .av-btn:focus-visible .av-overlay { opacity: 1; }
        }
        /* Persistent camera badge — only on touch pointers. */
        .av-badge { display: none; }
        @media (hover: none) and (pointer: coarse) {
          .av-badge { display: flex; }
        }

        /* ── Sheet ────────────────────────────────────────────── */
        @keyframes avFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes avSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes avPopIn { from { opacity: 0; transform: scale(0.94) } to { opacity: 1; transform: scale(1) } }

        .av-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
          z-index: 9998; animation: avFadeIn 0.18s ease both;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .av-sheet {
          background: #fff; color: #1A1A1A;
          border-radius: 24px 24px 0 0;
          width: 100%; max-width: 520px;
          padding: 10px 8px calc(20px + env(safe-area-inset-bottom, 0px));
          animation: avSlideUp 0.24s cubic-bezier(0.34,1.2,0.64,1) both;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.25);
        }
        @media (min-width: 641px) {
          .av-backdrop { align-items: center; }
          .av-sheet {
            border-radius: 16px;
            width: min(360px, calc(100vw - 40px));
            padding: 12px;
            animation: avPopIn 0.16s cubic-bezier(0.34,1.2,0.64,1) both;
            box-shadow: 0 24px 60px rgba(0,0,0,0.25);
          }
          .av-handle { display: none; }
        }
        .av-handle { width: 44px; height: 5px; background: #E0E0E0; border-radius: 100px; margin: 6px auto 12px; }
        .av-row {
          display: flex; align-items: center; gap: 14px;
          width: 100%; height: 56px; padding: 0 16px;
          background: transparent; border: none; border-radius: 14px;
          font-size: 15.5px; font-weight: 600; color: #1A1A1A;
          cursor: pointer; text-align: left;
        }
        .av-row:hover { background: rgba(200,0,106,0.06); }
        .av-row:active { background: rgba(200,0,106,0.12); }
        .av-row-danger { color: #DC2626; }
        .av-row-danger:hover { background: rgba(220,38,38,0.08); }
        .av-cancel {
          margin-top: 6px; height: 48px;
          background: #F3F4F6; color: #444; font-weight: 700;
          border: none; border-radius: 14px; width: 100%;
          cursor: pointer; font-size: 14.5px;
        }
        .av-cancel:hover { background: #E5E7EB; }
        .av-icon-tile {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* ── Status ring animations (unchanged) ────────────────── */
        @keyframes avSuccessPop { 0% { opacity: 0; transform: scale(0.4); } 55% { transform: scale(1.16); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes avSuccessRing { 0% { box-shadow: 0 0 0 0 rgba(45,168,78,0.55); } 70% { box-shadow: 0 0 0 18px rgba(45,168,78,0); } 100% { box-shadow: 0 0 0 0 rgba(45,168,78,0); } }
      `}</style>

      {/* ── AVATAR (only tappable element) ── */}
      <button
        type="button"
        className="av-btn"
        onClick={openSheet}
        disabled={uploading || removing}
        aria-label="Change profile picture"
        style={{ width: size, height: size }}
      >
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: displayImage ? '#eee' : ring, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(200,0,106,0.28)' }}>
          {displayImage ? (
            <Image src={displayImage} alt="Profile picture" fill sizes={`${size}px`} style={{ objectFit: 'cover' }} unoptimized />
          ) : (
            <span style={{ fontFamily: 'Georgia,serif', fontSize: size * 0.38, fontWeight: 700, color: '#fff' }}>{initials}</span>
          )}

          {/* Desktop hover overlay */}
          <div className="av-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cameraIcon(size * 0.32, '#fff')}
          </div>

          {/* Uploading progress overlay */}
          {(uploading || removing) && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? (
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
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'avspin 0.7s linear infinite' }}/>
              )}
            </div>
          )}

          {/* Success burst */}
          {showSuccess && !uploading && !removing && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(45,168,78,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'avSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, avSuccessRing 1.4s ease-out 0.3s 1' }}>
              <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          )}
        </div>

        {/* Mobile persistent camera badge */}
        <div
          className="av-badge"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0, bottom: 0,
            width: badgeSize, height: badgeSize, borderRadius: '50%',
            background: '#C8006A',
            border: '2.5px solid #fff',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(200,0,106,0.35)',
          }}
        >
          {cameraIcon(badgeSize * 0.5, '#fff')}
        </div>
      </button>

      {/* Hidden inputs */}
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }}/>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }}/>

      {/* Status line under the avatar */}
      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 260, marginTop: 4 }}>{error}</p>
        : uploading
          ? <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.75)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600, textAlign: 'center', marginTop: 4 }}>Uploading… {progress}%{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
          : removing
            ? <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.75)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600, textAlign: 'center', marginTop: 4 }}>Removing…</p>
            : showSuccess
              ? <p style={{ fontSize: 12, color: '#157A33', fontWeight: 700, marginTop: 4 }}>✓ Photo updated{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
              : null}

      {/* ── SHEET / POPOVER ── */}
      {sheetOpen && (
        <div
          className="av-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Change profile picture"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false) }}
        >
          <div className="av-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="av-handle"/>

            <button type="button" className="av-row" onClick={pickCamera}>
              <span className="av-icon-tile" style={{ background: '#FFE8F4' }}>{cameraIcon(20, '#C8006A')}</span>
              <span>Take a selfie</span>
            </button>

            <button type="button" className="av-row" onClick={pickGallery}>
              <span className="av-icon-tile" style={{ background: '#E4EEFC' }}>{galleryIcon(20, '#1A6ECC')}</span>
              <span>Upload from gallery</span>
            </button>

            {url && (
              <button type="button" className="av-row av-row-danger" onClick={removePhoto}>
                <span className="av-icon-tile" style={{ background: '#FDECEC' }}>{trashIcon(20, '#DC2626')}</span>
                <span>Remove photo</span>
              </button>
            )}

            <button type="button" className="av-cancel" onClick={() => setSheetOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <style>{`@keyframes avspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
