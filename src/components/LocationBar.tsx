'use client'
import { useState } from 'react'

// Location entry / display strip. Two modes:
//   • no postcode set → prompt input + optional GPS button
//   • postcode set    → "📍 <postcode>" chip with an ✕ to clear
//
// Purely presentational — the caller passes state + callbacks from
// useLocationFilter so the same bar can front the homepage hero and the
// browse-page filter row without duplicating hydration logic.

interface Props {
  postcode: string | null
  onSubmit: (pc: string) => void
  onClear: () => void
  onGPS?: () => void
  loading?: boolean
  error?: string | null
  // Visual variant. `hero` = big + bold (homepage top of fold);
  // `compact` = one-line pill (browse filter row).
  variant?: 'hero' | 'compact'
  placeholder?: string
}

export default function LocationBar({
  postcode,
  onSubmit,
  onClear,
  onGPS,
  loading = false,
  error = null,
  variant = 'compact',
  placeholder = 'Find home-cooked food near you',
}: Props) {
  const [value, setValue] = useState('')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  // Chip mode — postcode is set.
  if (postcode) {
    return (
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 6px 8px 14px',
          background: variant === 'hero' ? '#fff' : 'var(--bg-card)',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: 100,
          fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)',
        }}
      >
        <span style={{ color: '#C8006A' }}>📍</span>
        <span>{postcode.toUpperCase()}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear location"
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--bg-page)',
            color: 'var(--text-primary)',
            border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1,
          }}
        >×</button>
      </div>
    )
  }

  // Input mode — postcode not set.
  const inputHeight = variant === 'hero' ? 56 : 48
  const radius = variant === 'hero' ? 100 : 12
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: radius,
          padding: variant === 'hero' ? '6px 6px 6px 20px' : '4px 4px 4px 14px',
          boxShadow: variant === 'hero' ? '0 10px 30px rgba(200,0,106,0.14)' : '0 2px 8px rgba(200,0,106,0.06)',
        }}
      >
        <span style={{ fontSize: variant === 'hero' ? 20 : 16, color: '#C8006A', flexShrink: 0 }}>📍</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder={placeholder}
          disabled={loading}
          style={{
            flex: 1, minWidth: 0,
            height: inputHeight - 12,
            border: 'none', outline: 'none',
            fontSize: variant === 'hero' ? 16 : 14.5,
            fontWeight: 500,
            color: '#1A1A1A',
            background: 'transparent',
          }}
        />
        {onGPS && (
          <button
            type="button"
            onClick={onGPS}
            disabled={loading}
            aria-label="Use my current location"
            title="Use my current location"
            style={{
              flexShrink: 0,
              width: inputHeight - 12, height: inputHeight - 12,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 18,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >📡</button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          style={{
            flexShrink: 0,
            height: inputHeight - 12,
            padding: variant === 'hero' ? '0 24px' : '0 16px',
            background: value.trim() ? '#C8006A' : 'var(--bg-page)',
            color: value.trim() ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 100,
            fontSize: variant === 'hero' ? 14 : 13,
            fontWeight: 800,
            cursor: value.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'background 0.14s',
          }}
        >{loading ? '…' : 'Find food'}</button>
      </div>
      {error && (
        <div style={{ fontSize: 12.5, color: '#C0392B', fontWeight: 600, paddingLeft: 4 }}>{error}</div>
      )}
    </div>
  )
}
