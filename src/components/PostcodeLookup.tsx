'use client'
import { useState } from 'react'
import { isValidUKPostcode, lookupPostcodeAddress, reverseGeocodePostcode } from '@/lib/pricing'

// Twin buttons rendered next to a postcode input. "Find address" hits
// postcodes.io with the current value and calls back with any city + normalised
// postcode it finds. "Use my location" reverse-geocodes the browser's coords.
// postcodes.io has no street-level data, so address_line1/2 are not touched.
export interface LookupResult {
  postcode: string
  city: string | null
}

export default function PostcodeLookup({
  postcode,
  onResolved,
  compact = false,
  dark = false,
}: {
  postcode: string
  onResolved: (r: LookupResult) => void
  compact?: boolean
  dark?: boolean
}) {
  const [busy, setBusy] = useState<'find' | 'gps' | null>(null)
  const [message, setMessage] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null)

  const flash = (kind: 'err' | 'ok', text: string) => {
    setMessage({ kind, text })
    setTimeout(() => setMessage(null), 3500)
  }

  const findAddress = async () => {
    const pc = postcode.trim()
    if (!pc) { flash('err', 'Enter a postcode first'); return }
    if (!isValidUKPostcode(pc)) { flash('err', 'Enter a valid UK postcode'); return }
    setBusy('find')
    const res = await lookupPostcodeAddress(pc)
    setBusy(null)
    if (!res) { flash('err', 'Postcode not found, please check and try again'); return }
    onResolved({ postcode: res.postcode, city: res.city })
    flash('ok', res.city
      ? `Postcode confirmed — city set to ${res.city}. Now enter your door number and street name below.`
      : 'Postcode confirmed. Now enter your door number and street name below.')
  }

  const useLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      flash('err', 'Location not available on this device'); return
    }
    setBusy('gps')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await reverseGeocodePostcode(pos.coords.latitude, pos.coords.longitude)
        setBusy(null)
        if (!r) { flash('err', 'Could not find a nearby postcode'); return }
        onResolved({ postcode: r.postcode, city: r.city })
        flash('ok', `Detected ${r.postcode}${r.city ? ' · ' + r.city : ''}. Please enter your door number and street name below.`)
      },
      (err) => {
        setBusy(null)
        flash('err', err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const btnStyle: React.CSSProperties = {
    height: compact ? 34 : 38,
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: dark ? 'rgba(200,0,106,0.14)' : '#FFE8F4',
    color: '#C8006A',
    border: dark ? '1px solid rgba(200,0,106,0.35)' : '1.5px solid rgba(200,0,106,0.22)',
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={findAddress} disabled={busy !== null} style={{ ...btnStyle, opacity: busy === 'find' ? 0.7 : 1 }}>
          {busy === 'find' ? '⏳ Looking up…' : '🔍 Find address'}
        </button>
        <button type="button" onClick={useLocation} disabled={busy !== null} style={{ ...btnStyle, opacity: busy === 'gps' ? 0.7 : 1 }}>
          {busy === 'gps' ? '⏳ Detecting…' : '📍 Use my location'}
        </button>
      </div>
      {message && (
        <div
          role={message.kind === 'err' ? 'alert' : 'status'}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: message.kind === 'err' ? '#C0392B' : '#1A6030',
          }}
        >
          {message.kind === 'err' ? '⚠ ' : '✓ '}{message.text}
        </div>
      )}
    </div>
  )
}
