'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { compressToTarget } from '@/lib/images'

// Profile-photo uploader — click-to-edit UX (no visible buttons).
//
// Interaction:
//   • Avatar circle is the ONLY tappable element.
//   • Desktop hover → dark overlay + camera icon.
//   • Touch pointers → persistent camera badge at bottom-right.
//   • Click → sheet: Take a selfie · Upload from gallery · Remove photo.
//
// "Take a selfie" opens a full camera modal built on getUserMedia (live
// preview, shutter, front/back flip) so desktops with a webcam actually get
// a camera. If getUserMedia isn't available (older browsers, HTTP contexts)
// it falls back to a <input capture="user">.
//
// Storage layout unchanged: avatars/{authUid}/avatar.jpg + update_my_avatar.

const MAX_INPUT_BYTES = 15 * 1024 * 1024
const OUTPUT_MAX_BYTES = 80 * 1024
const OUTPUT_MAX_DIM = 400

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

  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraFallbackInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  // ── Post-file-picked pipeline. Shared by gallery input, camera fallback
  // input, AND the getUserMedia capture path.
  const uploadFile = useCallback(async (file: File) => {
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
  }, [onUploaded, preview])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void uploadFile(file)
  }

  // ── CAMERA MODAL PLUMBING ────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopCamera()
    setCameraError(''); setCameraReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // The metadata "loadedmetadata" event fires once the video knows its
        // dimensions — we wait for it before enabling the shutter.
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch (e) {
      const err = e as { name?: string; message?: string }
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
      setCameraError(denied
        ? 'Camera access denied. Please allow camera access in your browser settings.'
        : 'Could not access camera. Try uploading from gallery instead.')
    }
  }, [stopCamera])

  // Start/restart the stream whenever the modal opens or the facing changes.
  useEffect(() => {
    if (cameraOpen) void startCamera(cameraFacing)
    else stopCamera()
    return stopCamera
  }, [cameraOpen, cameraFacing, startCamera, stopCamera])

  // Escape closes the camera modal too.
  useEffect(() => {
    if (!cameraOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCameraOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cameraOpen])

  const openSheet = () => {
    if (uploading || removing) return
    setError(''); setShowSuccess(false)
    setSheetOpen(true)
  }

  const pickGallery = () => {
    setSheetOpen(false)
    galleryInputRef.current?.click()
  }

  const pickCamera = () => {
    setSheetOpen(false)
    const hasMediaDevices = typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
    if (!hasMediaDevices) {
      // Older browser or insecure context — fall back to file input with
      // capture hint so mobile can still open the camera.
      cameraFallbackInputRef.current?.click()
      return
    }
    setCameraFacing('user')
    setCameraOpen(true)
  }

  const flipCamera = () => setCameraFacing(f => f === 'user' ? 'environment' : 'user')

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the captured frame when using the front camera so the saved
    // photo matches the mirrored preview the user just saw (Instagram / iOS
    // Camera-app convention).
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
      setCameraOpen(false)
      void uploadFile(file)
    }, 'image/jpeg', 0.92)
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

  const ring = dark ? 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)'
  const displayImage = (uploading && preview) ? preview : url

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
  const flipIcon = (px: number, stroke: string) => (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/>
      <path d="M9 21H3v-6"/>
      <path d="M21 3l-9 9"/>
      <path d="M3 21l9-9"/>
    </svg>
  )
  const closeIcon = (px: number, stroke: string) => (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
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
        .av-badge { display: none; }
        @media (hover: none) and (pointer: coarse) { .av-badge { display: flex; } }

        @keyframes avFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes avSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes avPopIn { from { opacity: 0; transform: scale(0.94) } to { opacity: 1; transform: scale(1) } }
        @keyframes avspin { to { transform: rotate(360deg); } }
        @keyframes avSuccessPop { 0% { opacity: 0; transform: scale(0.4); } 55% { transform: scale(1.16); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes avSuccessRing { 0% { box-shadow: 0 0 0 0 rgba(45,168,78,0.55); } 70% { box-shadow: 0 0 0 18px rgba(45,168,78,0); } 100% { box-shadow: 0 0 0 0 rgba(45,168,78,0); } }

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

        /* ── Camera modal ─────────────────────────────────────── */
        .av-cam-back {
          position: fixed; inset: 0; z-index: 10000;
          background: #000;
          display: flex; align-items: center; justify-content: center;
          animation: avFadeIn 0.2s ease both;
        }
        .av-cam-stage {
          position: relative;
          width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        @media (min-width: 641px) {
          .av-cam-stage {
            width: min(520px, calc(100vw - 40px));
            height: min(720px, calc(100vh - 40px));
            border-radius: 22px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          }
        }
        .av-cam-video {
          width: 100%; height: 100%;
          object-fit: cover;
          background: #000;
        }
        .av-cam-video.mirrored { transform: scaleX(-1); }

        .av-cam-topbtn {
          position: absolute; top: calc(16px + env(safe-area-inset-top, 0px));
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(0,0,0,0.55); color: #fff; border: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          transition: background 0.14s;
        }
        .av-cam-topbtn:hover { background: rgba(0,0,0,0.75); }
        .av-cam-close { left: 16px; }
        .av-cam-flip { right: 16px; }

        .av-cam-shutter {
          position: absolute;
          bottom: calc(36px + env(safe-area-inset-bottom, 0px));
          left: 50%; transform: translateX(-50%);
          width: 72px; height: 72px; border-radius: 50%;
          background: #fff; border: 4px solid rgba(255,255,255,0.55);
          box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
          cursor: pointer;
          transition: transform 0.12s ease;
        }
        .av-cam-shutter:hover { transform: translateX(-50%) scale(1.03); }
        .av-cam-shutter:active { transform: translateX(-50%) scale(0.94); }
        .av-cam-shutter:disabled { opacity: 0.5; cursor: not-allowed; }

        .av-cam-error {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          color: #fff; text-align: center; font-size: 15px; font-weight: 600;
          line-height: 1.5;
          background: rgba(0,0,0,0.75);
        }
        .av-cam-loading {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.85);
          font-size: 13px; font-weight: 600;
          pointer-events: none;
        }
      `}</style>

      {/* ── AVATAR ── */}
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

          <div className="av-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cameraIcon(size * 0.32, '#fff')}
          </div>

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

          {showSuccess && !uploading && !removing && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(45,168,78,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'avSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, avSuccessRing 1.4s ease-out 0.3s 1' }}>
              <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          )}
        </div>

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

      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }}/>
      <input ref={cameraFallbackInputRef} type="file" accept="image/*" capture="user" onChange={handleFileInput} style={{ display: 'none' }}/>

      {error
        ? <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, textAlign: 'center', maxWidth: 260, marginTop: 4 }}>{error}</p>
        : uploading
          ? <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.75)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600, textAlign: 'center', marginTop: 4 }}>Uploading… {progress}%{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
          : removing
            ? <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.75)' : '#1A1A1A', opacity: dark ? 1 : 0.7, fontWeight: 600, textAlign: 'center', marginTop: 4 }}>Removing…</p>
            : showSuccess
              ? <p style={{ fontSize: 12, color: '#157A33', fontWeight: 700, marginTop: 4 }}>✓ Photo updated{sizeLabel ? ` · ${sizeLabel}` : ''}</p>
              : null}

      {/* ── ACTION SHEET ── */}
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

      {/* ── CAMERA MODAL ── */}
      {cameraOpen && (
        <div className="av-cam-back" role="dialog" aria-modal="true" aria-label="Take a selfie">
          <div className="av-cam-stage">
            <video
              ref={videoRef}
              className={`av-cam-video${cameraFacing === 'user' ? ' mirrored' : ''}`}
              autoPlay
              playsInline
              muted
            />

            {!cameraReady && !cameraError && (
              <div className="av-cam-loading">Starting camera…</div>
            )}

            {cameraError && (
              <div className="av-cam-error">{cameraError}</div>
            )}

            <button
              type="button"
              className="av-cam-topbtn av-cam-close"
              onClick={() => setCameraOpen(false)}
              aria-label="Close camera"
            >
              {closeIcon(22, '#fff')}
            </button>

            <button
              type="button"
              className="av-cam-topbtn av-cam-flip"
              onClick={flipCamera}
              aria-label="Flip camera"
              disabled={!cameraReady}
              style={{ opacity: cameraReady ? 1 : 0.4 }}
            >
              {flipIcon(22, '#fff')}
            </button>

            <button
              type="button"
              className="av-cam-shutter"
              onClick={capturePhoto}
              disabled={!cameraReady || !!cameraError}
              aria-label="Capture photo"
            />
          </div>
        </div>
      )}
    </div>
  )
}
