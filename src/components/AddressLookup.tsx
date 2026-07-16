'use client'
import { useEffect, useRef, useState } from 'react'
import {
  autocompleteAddresses,
  getAddressDetails,
  reverseGeocodeViaPlaces,
  AddressLookupError,
  type AddressPrediction,
  type LookupErrorKind,
} from '@/lib/getAddress'

// Single-input address lookup — Google Places Autocomplete via server proxy.
// The buyer types any part of their address ("42 Bak…", a postcode, a
// building name) and we surface Google suggestions as they type. Selecting a
// row calls /api/places/details, extracts street_number + route + city +
// postal_code, and hands the finished address to the parent. A postcodes.io
// fallback covers Google zero-results on valid UK postcodes, and a manual
// entry escape hatch covers everything else.
//
// This is the ONLY address entry component used across the app — profiles,
// checkout, and the OAuth completion flow all share it.

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
  // Build a "confirmed" label from the parent's value so a saved profile
  // lands straight in the green chip without any API calls.
  const labelFromValue = (v: AddressValue): string =>
    [v.address_line1, v.city, v.postcode].filter((s) => s && s.trim()).join(', ')

  const valueIsComplete = !!(value.address_line1 && value.postcode)

  // Two separate strings: `inputValue` is what the input SHOWS (parent-derived
  // on mount, updated when we set it after a pick); `searchQuery` is what
  // actually feeds the autocomplete effect. Splitting them is the fix for
  // the post-selection loop — setting `inputValue = formatted address` no
  // longer re-triggers a search.
  const [inputValue, setInputValue] = useState(labelFromValue(value))
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<AddressPrediction[] | null>(null)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'gps' | 'error' | 'empty' | 'ready' | 'selected' | 'resolving'
  >(valueIsComplete ? 'selected' : 'idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [errorKind, setErrorKind] = useState<LookupErrorKind | null>(null)
  const [manual, setManual] = useState(false)
  // Tracks what came back missing from a successful Google Details call, so we
  // can nudge the buyer to fill it in. Google's data is inconsistent for
  // buildings that aren't in Royal Mail's PAF (approximated tourist entries,
  // brand-new construction, some POI-style addresses), and we can't accept
  // an order with no postcode — so we hide the green confirmed chip when
  // that happens and open the manual form pre-filled with what we do have.
  const [missingField, setMissingField] = useState<'postcode' | 'street' | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(valueIsComplete ? labelFromValue(value) : null)
  // Flipped to true only when the user actually types or clicks GPS/Change.
  // A saved profile that lands in the "selected" state must never flip this,
  // and the pick handler must never leave it true — otherwise the autocomplete
  // effect fires again on the next render.
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const lastQueriedRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Sync when the parent CLEARS the value externally (logout / reset). Never
  // sync a filled parent value back over user-in-progress state.
  useEffect(() => {
    if (!value.address_line1 && !value.postcode) {
      if (selectedLabel) setSelectedLabel(null)
      if (status !== 'idle') setStatus('idle')
      if (predictions !== null) setPredictions(null)
      if (inputValue) setInputValue('')
      if (searchQuery) setSearchQuery('')
      lastQueriedRef.current = null
      if (missingField) setMissingField(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address_line1, value.postcode])

  // Autocomplete — only when the user has actively typed. Debounced so we
  // don't burn Google quota on every keystroke; deduped via lastQueriedRef.
  //
  // Two hard guards up front stop the post-selection loop:
  //   1. status === 'selected' → the buyer already picked; never re-fetch.
  //   2. !userHasInteracted → this is either the initial mount OR a
  //      just-completed pick, where we reset the flag to false so a parent
  //      re-render triggered by onChange can't sneak past.
  useEffect(() => {
    if (status === 'selected') return
    if (!userHasInteracted) return
    const q = searchQuery.trim()
    if (q.length < 3) {
      if (status === 'ready' || status === 'empty' || status === 'error') {
        setStatus('idle'); setPredictions(null); setErrorMsg(''); setErrorKind(null)
      }
      return
    }
    if (lastQueriedRef.current === q) return

    const controller = new AbortController()
    const t = setTimeout(async () => {
      setStatus('loading'); setErrorMsg(''); setErrorKind(null)
      lastQueriedRef.current = q
      try {
        const list = await autocompleteAddresses(q, { signal: controller.signal })
        if (controller.signal.aborted) return
        setPredictions(list)
        setStatus(list.length === 0 ? 'empty' : 'ready')
      } catch (e) {
        if (controller.signal.aborted) return
        const kind: LookupErrorKind = e instanceof AddressLookupError ? e.kind : 'unavailable'
        setErrorKind(kind); setStatus('error')
        setErrorMsg(
          kind === 'misconfigured' ? 'Address lookup is not set up — please enter your address manually.'
          : 'Address lookup unavailable — please enter your address manually.'
        )
        // Auto-open manual fields for every service-down kind so the buyer
        // is never stuck.
        setManual(true)
      }
    }, 300)
    return () => { controller.abort(); clearTimeout(t) }
    // Deps deliberately narrow — `searchQuery` and `userHasInteracted` are
    // the only things that should cause a fetch to be considered. `status`
    // is read inside the effect but not in deps; the two guards at the top
    // make it safe to re-run only on the interactions we care about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, userHasInteracted])

  // Close the dropdown when the user clicks outside — normal picker behaviour.
  useEffect(() => {
    if (status !== 'ready' && status !== 'empty' && status !== 'error') return
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setStatus('idle')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [status])

  const pick = async (p: AddressPrediction) => {
    setStatus('resolving')
    try {
      const detail = await getAddressDetails(p.place_id)
      onChange({
        address_line1: detail.address_line1,
        address_line2: detail.address_line2,
        city: detail.city,
        postcode: detail.postcode,
      })
      const label = detail.formatted_address || p.description
      // Show the formatted address in the input, but never in searchQuery —
      // otherwise the autocomplete effect would treat it as new input and
      // refetch. Clear searchQuery to be safe.
      setInputValue(label)
      setSearchQuery('')
      // Extra belt-and-braces: reset the interaction flag so any accidental
      // re-render of the effect body returns immediately on the guard.
      setUserHasInteracted(false)
      lastQueriedRef.current = null
      // Strict guards: we need both a street address AND a postcode before we
      // can call the address "confirmed" — an order can't dispatch without a
      // postcode for delivery distance, and can't route without a street.
      // Google sometimes returns one without the other for POI-style
      // entries; drop into the manual form and tell the buyer what's missing.
      if (!detail.address_line1) {
        setSelectedLabel(null); setStatus('idle'); setManual(true); setMissingField('street'); return
      }
      if (!detail.postcode) {
        setSelectedLabel(null); setStatus('idle'); setManual(true); setMissingField('postcode'); return
      }
      setSelectedLabel(label)
      setStatus('selected')
      setManual(false)
      setMissingField(null)
    } catch (e) {
      const kind: LookupErrorKind = e instanceof AddressLookupError ? e.kind : 'unavailable'
      setErrorKind(kind); setStatus('error')
      setErrorMsg('Could not fetch that address. Please enter it manually.')
      setManual(true)
    }
  }

  const clearSelection = () => {
    setSelectedLabel(null); setStatus('idle'); setPredictions(null); setErrorMsg(''); setErrorKind(null)
    onChange({ address_line1: '', address_line2: '', city: '', postcode: '' })
    setInputValue(''); setSearchQuery(''); lastQueriedRef.current = null
    setMissingField(null)
    // Reset interaction so the effect stays quiet until the buyer actually
    // types the first character of their new search.
    setUserHasInteracted(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  // GPS button → reverse-geocode via Google to a postcode, seed the input,
  // and let the autocomplete effect pull addresses at that postcode.
  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error'); setErrorMsg('Location is not available on this device'); return
    }
    setUserHasInteracted(true)
    setStatus('gps'); setErrorMsg('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await reverseGeocodeViaPlaces(pos.coords.latitude, pos.coords.longitude)
          if (!r?.postcode) { setStatus('error'); setErrorMsg('Could not find a postcode at your location'); return }
          // Seed both — inputValue shows in the input, searchQuery drives
          // the effect. userHasInteracted was set true above, so the effect
          // will fetch as soon as the debounce completes.
          setInputValue(r.postcode)
          setSearchQuery(r.postcode)
        } catch (e) {
          const kind: LookupErrorKind = e instanceof AddressLookupError ? e.kind : 'unavailable'
          setErrorKind(kind); setStatus('error')
          setErrorMsg('Could not fetch your location. Please enter your address manually.')
          setManual(true)
        }
      },
      (err) => {
        setStatus('error')
        setErrorMsg(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const showDropdown = (status === 'ready' && Array.isArray(predictions) && predictions.length > 0)
    || status === 'empty'
    || status === 'loading'
    || status === 'resolving'
    || (status === 'error' && !!errorMsg)

  // ── STYLES — Silicon Valley clean: white cards, brand pink, generous
  //    touch targets (48px+ on desktop, 52px on mobile via CSS below).
  const h = compact ? 44 : 48
  const inputStyle: React.CSSProperties = {
    height: h, width: '100%', border: '1.5px solid #E0E0E0', borderRadius: 12,
    padding: '0 44px 0 44px', fontSize: 15, color: '#1A1A1A',
    background: '#FAFAFA', fontFamily: 'Inter,system-ui,sans-serif', outline: 'none',
    transition: 'border-color 0.14s, background 0.14s',
  }
  const iconLeft: React.CSSProperties = {
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#C8006A',
  }
  const gpsBtn: React.CSSProperties = {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    width: h - 12, height: h - 12, borderRadius: 8, border: '1px solid rgba(200,0,106,0.25)',
    background: '#FFE8F4', color: '#C8006A', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, transition: 'all 0.14s',
  }
  const dropdown: React.CSSProperties = {
    position: 'absolute', top: `calc(${h}px + 6px)`, left: 0, right: 0, zIndex: 40,
    background: '#fff', border: '1.5px solid rgba(200,0,106,0.16)',
    borderRadius: 14, boxShadow: '0 12px 40px rgba(200,0,106,0.14)',
    maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'contain',
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '0 14px', minHeight: 56, cursor: 'pointer',
    fontSize: 14, color: '#1A1A1A', transition: 'background 0.12s',
  }
  const manualBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
    background: '#FFF5FA', color: '#C8006A', border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', borderTop: '1px solid rgba(200,0,106,0.12)',
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <style>{`
        .addrl-row:hover { background: #FFE8F4; }
        .addrl-input:focus { border-color: #C8006A !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(200,0,106,0.08); }
        .addrl-gps:hover { background: #FFD1E6 !important; }
        .addrl-manual:hover { background: #FFE8F4 !important; }
        @keyframes addrlSpin { to { transform: rotate(360deg); } }
        .addrl-spin { animation: addrlSpin 0.7s linear infinite; }
        @media (max-width: 640px) {
          .addrl-row { min-height: 60px; font-size: 15px; }
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
          <button type="button" onClick={clearSelection}
            style={{ background: 'none', border: 'none', color: '#C8006A', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>Change</button>
        </div>
      ) : (
        <>
          {/* ── SEARCH INPUT — any part of the address ── */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={iconLeft} aria-hidden="true">
              {(status === 'loading' || status === 'resolving') ? (
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
              autoComplete="street-address"
              aria-label="Search your address"
              placeholder="Start typing your address or postcode…"
              value={inputValue}
              onChange={(e) => {
                // Typing is the ONLY thing that mirrors input → search. A
                // programmatic setInputValue (after pick / mount) never
                // touches searchQuery, so it can't trigger a refetch.
                setUserHasInteracted(true)
                setInputValue(e.target.value)
                setSearchQuery(e.target.value)
                if (status === 'selected') setStatus('idle')
              }}
              onFocus={() => {
                if (predictions && predictions.length > 0 && status === 'idle' && !selectedLabel) setStatus('ready')
              }}
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

          {/* ── DROPDOWN — predictions / states / footer ── */}
          {showDropdown && (
            <div role="listbox" style={dropdown}>
              {status === 'loading' && (
                <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#1A1A1A' }}>Searching addresses…</div>
              )}
              {status === 'resolving' && (
                <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#1A1A1A' }}>Loading full address…</div>
              )}
              {status === 'ready' && predictions && predictions.map((p, i) => {
                const main = p.structured_formatting?.main_text || p.description
                const secondary = p.structured_formatting?.secondary_text || ''
                return (
                  <div
                    key={`${p.place_id}-${i}`}
                    className="addrl-row"
                    role="option"
                    aria-selected={false}
                    tabIndex={0}
                    onClick={() => pick(p)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p) } }}
                    style={{ ...rowStyle, borderBottom: i < predictions.length - 1 ? '1px solid #F5F0F3' : 'none' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8006A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{main}</div>
                      {secondary && (
                        <div style={{ fontSize: 12.5, color: '#6B6B6B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</div>
                      )}
                    </div>
                    <span aria-hidden="true" style={{ color: '#C8006A', fontSize: 18, flexShrink: 0 }}>›</span>
                  </div>
                )
              })}
              {status === 'empty' && (
                <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#1A1A1A' }}>
                  No addresses found. Try a different search, or enter your address manually below.
                </div>
              )}
              {status === 'error' && (
                <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF4E0', borderTop: '1px solid rgba(184,115,10,0.18)' }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>ℹ️</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8C5500', marginBottom: 2 }}>Address lookup unavailable</div>
                    <div style={{ fontSize: 12.5, color: '#8C5500', opacity: 0.9, lineHeight: 1.5 }}>{errorMsg || 'Please enter your address manually below.'}</div>
                  </div>
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
              {/* Google TOS: Places-powered dropdowns must display attribution. */}
              <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid #F5F0F3', background: '#FAFAFA', color: '#6B6B6B', fontSize: 11 }}>
                Powered by Google
              </div>
            </div>
          )}

          {/* ── SUB-HINT below the input ── */}
          {!showDropdown && (
            <p style={{ fontSize: 12, color: '#1A1A1A', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
              {searchQuery.trim().length >= 3
                ? 'Waiting for you to finish typing…'
                : 'Start typing your address — we\'ll show suggestions.'}
            </p>
          )}
        </>
      )}

      {/* ── MANUAL FIELDS — fallback + always after "Change" ── */}
      {manual && !selectedLabel && (
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {/* Notice when Google returned a picked address without a
              required field. Tells the buyer exactly what to add. */}
          {missingField && (
            <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#FFF4E0', border: '1.5px solid #F5C97A', borderRadius: 12 }}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8C5500', marginBottom: 2 }}>
                  {missingField === 'postcode' ? 'Postcode missing from that address' : 'Street missing from that address'}
                </div>
                <div style={{ fontSize: 12.5, color: '#8C5500', opacity: 0.9, lineHeight: 1.5 }}>
                  {missingField === 'postcode'
                    ? "Google didn't return a postcode for this address — please add it below."
                    : "Google didn't return a full street address — please fill it in below."}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <ManualField
              label='Flat/House number'
              value={extractHouse(value.address_line1)}
              placeholder='e.g. 42'
              required
              onChange={(house) => {
                if (missingField === 'street') setMissingField(null)
                onChange({ ...value, address_line1: joinLine1(house, extractStreet(value.address_line1)) })
              }}
            />
            <ManualField
              label='Street name'
              value={extractStreet(value.address_line1)}
              placeholder='e.g. Baker Street'
              required
              onChange={(street) => {
                if (missingField === 'street') setMissingField(null)
                onChange({ ...value, address_line1: joinLine1(extractHouse(value.address_line1), street) })
              }}
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
            onChange={(v) => {
              if (missingField === 'postcode') setMissingField(null)
              onChange({ ...value, postcode: v.toUpperCase() })
            }}
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
