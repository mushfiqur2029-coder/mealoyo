'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { findAddressesByPostcode, type AddressResult } from '@/lib/getAddress'
import { isValidUKPostcode, reverseGeocodePostcode } from '@/lib/pricing'

// Single-input UK address lookup — Deliveroo-style. The buyer types their
// postcode, we hit getAddress.io as soon as it's valid, and show the matching
// addresses as a picker. Selecting a row fills the parent form via `onChange`.
// A "type it manually" link + GPS button cover the fallback paths.
//
// This is the ONLY address entry component used across the app — profiles,
// checkout, and the OAuth completion flow all share it so the UX is identical
// everywhere.
export interface AddressValue {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
}

export default function AddressLookup({
  value,
  onChange,
  autoFocus = false,
  compact = false,
}: {
  value: AddressValue
  onChange: (v: AddressValue) => void
  autoFocus?: boolean
  compact?: boolean
}) {
  const [postcode, setPostcode] = useState(value.postcode || '')
  const [results, setResults] = useState<AddressResult[] | null>(null) // null = never searched yet
  const [status, setStatus] = useState<'idle' | 'loading' | 'gps' | 'error' | 'empty' | 'ready' | 'selected'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [manual, setManual] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Reset the "selected" chip whenever the parent gives us a fresh empty value
  // (e.g. after clearing the form).
  useEffect(() => {
    if (!value.address_line1 && !value.postcode && selectedLabel) {
      setSelectedLabel(null)
      setStatus('idle')
      setResults(null)
    }
  }, [value.address_line1, value.postcode, selectedLabel])

  // Show manual fields automatically when the parent hands us a saved address
  // that we didn't just pick from the dropdown — so pre-filled profiles are
  // editable on load.
  useEffect(() => {
    if (!manual && (value.address_line1 || value.city) && !selectedLabel && status !== 'selected') {
      setManual(true)
    }
    // Do not depend on `manual` to avoid re-entering the effect after we set it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address_line1, value.city, selectedLabel, status])

  // Live UK postcode validation on the input (used to gate the auto-lookup).
  const looksValid = useMemo(() => isValidUKPostcode(postcode), [postcode])

  // Auto-lookup when a valid postcode is typed. Debounced so we don't fire on
  // every keystroke. Aborts in-flight fetches when the postcode changes again.
  useEffect(() => {
    if (!looksValid) {
      // Only clear the "ready" state if the user actually shortened it below
      // valid length — don't nuke a selected address just because they focused
      // the input.
      if (status === 'ready' || status === 'empty' || status === 'error') {
        setStatus('idle'); setResults(null); setErrorMsg('')
      }
      return
    }
    // Postcode already resolved to the selected value — don't re-fetch.
    if (selectedLabel && postcode.toUpperCase() === value.postcode.toUpperCase()) return

    const controller = new AbortController()
    const t = setTimeout(async () => {
      setStatus('loading'); setErrorMsg('')
      try {
        const list = await findAddressesByPostcode(postcode)
        if (controller.signal.aborted) return
        setResults(list)
        setStatus(list.length === 0 ? 'empty' : 'ready')
      } catch (e) {
        if (controller.signal.aborted) return
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : 'Address lookup failed')
      }
    }, 350)
    return () => { controller.abort(); clearTimeout(t) }
  }, [postcode, looksValid, selectedLabel, value.postcode, status])

  // Close the dropdown when the user clicks outside — normal picker behaviour.
  useEffect(() => {
    if (status !== 'ready' && status !== 'empty' && status !== 'error') return
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        // Collapse the picker but keep the postcode we typed — no state loss.
        setStatus('idle')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [status])

  const pick = (a: AddressResult) => {
    onChange({
      address_line1: a.address_line1,
      address_line2: a.address_line2,
      city: a.city,
      postcode: a.postcode,
    })
    setPostcode(a.postcode)
    setSelectedLabel(a.label)
    setStatus('selected')
    setManual(false)
  }

  const clearSelection = () => {
    setSelectedLabel(null)
    setStatus('idle')
    setResults(null)
    onChange({ address_line1: '', address_line2: '', city: '', postcode: '' })
    setPostcode('')
    // Focus the input so the user can start again immediately.
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error'); setErrorMsg('Location is not available on this device')
      return
    }
    setStatus('gps'); setErrorMsg('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await reverseGeocodePostcode(pos.coords.latitude, pos.coords.longitude)
        if (!r) { setStatus('error'); setErrorMsg('Could not find your postcode from your location'); return }
        setPostcode(r.postcode.toUpperCase())
        // The auto-lookup effect will kick in on the next tick — no need to
        // fetch again here.
      },
      (err) => {
        setStatus('error')
        setErrorMsg(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── STYLES — Silicon Valley clean: white cards, brand pink, generous
  //    touch targets (48px+ on desktop, 52px on mobile via CSS below).
  const h = compact ? 44 : 48
  const container: React.CSSProperties = { position: 'relative', width: '100%' }
  const inputWrap: React.CSSProperties = { position: 'relative', width: '100%' }
  const inputStyle: React.CSSProperties = {
    height: h, width: '100%', border: '1.5px solid #E0E0E0', borderRadius: 12,
    padding: '0 44px 0 44px', fontSize: 15, color: '#1A1A1A',
    background: '#FAFAFA', textTransform: 'uppercase',
    fontFamily: 'Inter,system-ui,sans-serif', outline: 'none',
    transition: 'border-color 0.14s, background 0.14s',
  }
  const iconLeft: React.CSSProperties = {
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', color: '#C8006A',
  }
  const gpsBtn: React.CSSProperties = {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    width: h - 12, height: h - 12, borderRadius: 8, border: '1px solid rgba(200,0,106,0.25)',
    background: '#FFE8F4', color: '#C8006A', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, transition: 'all 0.14s',
  }
  const dropdown: React.CSSProperties = {
    position: 'absolute', top: `calc(${h}px + 6px)`, left: 0, right: 0, zIndex: 40,
    background: '#fff', border: '1.5px solid rgba(200,0,106,0.16)',
    borderRadius: 14, boxShadow: '0 12px 40px rgba(200,0,106,0.14)',
    maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain',
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 14px', minHeight: 48, cursor: 'pointer',
    fontSize: 14, color: '#1A1A1A',
    transition: 'background 0.12s',
  }
  const manualBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
    background: '#FFF5FA', color: '#C8006A', border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    borderTop: '1px solid rgba(200,0,106,0.12)',
  }

  const showDropdown = (status === 'ready' && Array.isArray(results) && results.length > 0)
    || status === 'empty'
    || (status === 'error' && !!errorMsg)

  return (
    <div ref={containerRef} style={container}>
      <style>{`
        .addrl-row:hover { background: #FFE8F4; }
        .addrl-input:focus { border-color: #C8006A !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(200,0,106,0.08); }
        .addrl-gps:hover { background: #FFD1E6 !important; }
        .addrl-manual:hover { background: #FFE8F4 !important; }
        @keyframes addrlSpin { to { transform: rotate(360deg); } }
        .addrl-spin { animation: addrlSpin 0.7s linear infinite; }
        @media (max-width: 640px) {
          .addrl-row { min-height: 52px; font-size: 15px; }
        }
      `}</style>

      {/* ── SELECTED CONFIRMATION CHIP ── */}
      {selectedLabel && status === 'selected' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#EAF7EE', border: '1.5px solid #A8DDB8', borderRadius: 12 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: '#2DA84E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>✓</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 700, color: '#157A33', lineHeight: 1.2 }}>Address confirmed</div>
            <div style={{ fontSize: 13.5, color: '#1A1A1A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            style={{ background: 'none', border: 'none', color: '#C8006A', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
          >Change</button>
        </div>
      ) : (
        <>
          {/* ── POSTCODE SEARCH INPUT ── */}
          <div style={inputWrap}>
            <span style={iconLeft} aria-hidden="true">
              {status === 'loading' ? (
                <span className="addrl-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(200,0,106,0.25)', borderTopColor: '#C8006A', borderRadius: '50%' }}/>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              )}
            </span>
            <input
              ref={inputRef}
              autoFocus={autoFocus}
              className="addrl-input"
              type="text"
              inputMode="text"
              autoComplete="postal-code"
              aria-label="Enter postcode"
              placeholder="Enter postcode (e.g. E3 4SS)"
              value={postcode}
              onChange={(e) => { setPostcode(e.target.value); if (status === 'selected') setStatus('idle') }}
              onFocus={() => { if (results && results.length > 0 && status === 'idle' && !selectedLabel) setStatus('ready') }}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={useMyLocation}
              aria-label="Use my current location"
              className="addrl-gps"
              style={gpsBtn}
              disabled={status === 'gps'}
              title="Use my current location"
            >
              {status === 'gps' ? (
                <span className="addrl-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(200,0,106,0.35)', borderTopColor: '#C8006A', borderRadius: '50%' }}/>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
              )}
            </button>
          </div>

          {/* ── DROPDOWN — results / empty / error ── */}
          {showDropdown && (
            <div role="listbox" style={dropdown}>
              {status === 'ready' && results && results.map((a, i) => (
                <div
                  key={`${a.postcode}-${i}`}
                  className="addrl-row"
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => pick(a)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(a) } }}
                  style={{ ...rowStyle, borderBottom: i < results.length - 1 ? '1px solid #F5F0F3' : 'none' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8006A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                </div>
              ))}
              {status === 'empty' && (
                <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#1A1A1A' }}>
                  No addresses found for this postcode.
                </div>
              )}
              {status === 'error' && (
                <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#C0392B', fontWeight: 600 }}>
                  {errorMsg || 'Could not look up that postcode.'}
                </div>
              )}
              <button
                type="button"
                className="addrl-manual"
                style={manualBtn}
                onClick={() => { setManual(true); setStatus('idle') }}
              >
                Enter address manually →
              </button>
            </div>
          )}

          {/* ── SUB-HINT below the input ── */}
          {!showDropdown && (
            <p style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
              {status === 'loading' ? 'Looking up addresses…' :
                looksValid ? 'Waiting for you to finish typing…' :
                'We\'ll show your address list as soon as you enter a valid UK postcode.'}
            </p>
          )}
        </>
      )}

      {/* ── MANUAL FIELDS — shown as a fallback + always after "Change" ── */}
      {manual && !selectedLabel && (
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <ManualField
              label='Flat/House number'
              value={extractHouse(value.address_line1)}
              placeholder='e.g. 42'
              required
              onChange={(house) => onChange({ ...value, address_line1: joinLine1(house, extractStreet(value.address_line1)) })}
            />
            <ManualField
              label='Street name'
              value={extractStreet(value.address_line1)}
              placeholder='e.g. Baker Street'
              required
              onChange={(street) => onChange({ ...value, address_line1: joinLine1(extractHouse(value.address_line1), street) })}
            />
          </div>
          <ManualField
            label='Building or apartment (optional)'
            value={value.address_line2}
            placeholder='Flat 3B, Riverside Court'
            onChange={(v) => onChange({ ...value, address_line2: v })}
          />
          <ManualField
            label='City / Town'
            value={value.city}
            placeholder='London'
            required
            onChange={(v) => onChange({ ...value, city: v })}
          />
          <ManualField
            label='Postcode'
            value={value.postcode}
            placeholder='E3 4SS'
            uppercase
            required
            onChange={(v) => onChange({ ...value, postcode: v.toUpperCase() })}
          />
        </div>
      )}
    </div>
  )
}

// ── HELPERS ─────────────────────────────────────────────────────────────────

function extractHouse(line1: string): string {
  const s = (line1 || '').trim()
  const m = s.match(/^(\S+)\s+(.+)$/)
  return m ? m[1] : (s ? '' : '')
}
function extractStreet(line1: string): string {
  const s = (line1 || '').trim()
  const m = s.match(/^(\S+)\s+(.+)$/)
  return m ? m[2] : s
}
function joinLine1(house: string, street: string): string {
  return [house.trim(), street.trim()].filter(Boolean).join(' ')
}

function ManualField({
  label, value, onChange, placeholder, uppercase, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  uppercase?: boolean
  required?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#C0392B', marginLeft: 4 }}>*</span>}
      </label>
      <input
        className="addrl-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', height: 46, border: '1.5px solid #E0E0E0', borderRadius: 12,
          padding: '0 14px', fontSize: 14, color: '#1A1A1A', background: '#FAFAFA',
          textTransform: uppercase ? 'uppercase' : 'none',
          fontFamily: 'Inter,system-ui,sans-serif', outline: 'none',
        }}
      />
    </div>
  )
}
