'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { compressToTarget, validateImageFile, ACCEPTED_IMAGE_TYPES } from '@/lib/images'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB ceiling on the original (matches bucket limit)

type Props = {
  // Image to show: an existing image_url, or a locally-staged object URL.
  previewUrl: string | null
  // Called once the picked file has been compressed to a <80KB JPEG. The parent
  // is responsible for the actual upload (it knows the seller + listing ids).
  onPicked: (blob: Blob, previewUrl: string) => void
  onRemove?: () => void
}

// Dashed upload zone for a listing's dish photo. Compresses entirely in the
// browser to a <80KB JPEG (max 600×600) before handing the blob to the parent.
export default function ListingImageUpload({ previewUrl, onPicked, onRemove }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    const validationError = validateImageFile(file, MAX_BYTES)
    if (validationError) { setError(validationError); return }

    setBusy(true)
    try {
      const blob = await compressToTarget(file, 80 * 1024, 600)
      const url = URL.createObjectURL(blob)
      onPicked(blob, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <style>{`.li-zone:hover { border-color: #C8006A !important; background: #FFF5FA !important; }`}</style>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleFile} style={{ display: 'none' }} />

      {previewUrl ? (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1.5px solid #E0BCD2' }}>
          <div style={{ position: 'relative', width: '100%', height: 200, background: '#FAFAFA' }}>
            <Image src={previewUrl} alt="Dish photo" fill sizes="(max-width: 900px) 100vw, 700px" style={{ objectFit: 'cover' }} unoptimized />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 10, background: '#fff' }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              style={{ flex: 1, height: 40, border: '1.5px solid #E0E0E0', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, color: '#1A1A1A', cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Processing…' : 'Replace photo'}
            </button>
            {onRemove && (
              <button type="button" onClick={onRemove} disabled={busy}
                style={{ height: 40, padding: '0 16px', border: '1.5px solid #E0E0E0', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, color: '#C0392B', cursor: 'pointer' }}>
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="li-zone" onClick={() => !busy && inputRef.current?.click()}
          style={{ border: '2px dashed #E0BCD2', borderRadius: 14, background: '#FAFAFA', padding: '36px 20px', textAlign: 'center', cursor: busy ? 'wait' : 'pointer', transition: 'all 0.16s' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FFE8F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>📷</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{busy ? 'Processing image…' : 'Add a photo of your dish'}</p>
          <p style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.7 }}>Click to upload · JPG, PNG or WebP · auto-compressed</p>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: '#C8006A', fontWeight: 600, marginTop: 10 }}>{error}</p>}
    </div>
  )
}
