'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { CompletionResult, Role } from '@/lib/profileCompletion'

// Two ways this card gets rendered:
//   • variant='full'    → profile page. Big circular ring + full checklist +
//                          amber/green banner (seller/driver only).
//   • variant='compact' → dashboard. Small ring + one-line CTA + dismiss.
//                          Only shown when percentage < 80.
type Variant = 'full' | 'compact'

interface Props {
  result: CompletionResult
  role: Role
  variant: Variant
  // Where the "Complete now" / "Add now" links point. Anchor hashes drive
  // scroll-to-field on the profile page.
  profileHref?: string
  // Dashboard variant lets the buyer dismiss for the session.
  onDismiss?: () => void
  // Storage key for "remember dismissed" — passed in so the caller controls
  // scope (per-tab in sessionStorage vs persistent in localStorage).
  storageKey?: string
}

// Text for the seller/driver banner. Buyers just see the ring — the profile
// isn't gating anything for them so we don't scold.
const bannerCopy: Record<Role, { pending: string; done: string }> = {
  buyer: {
    pending: "Fill in a few more details so cooks can deliver to you quickly.",
    done:    "Profile complete! Cooks will love how easy you are to deliver to.",
  },
  seller: {
    pending: "Complete your profile to start selling. Buyers trust complete cooks.",
    done:    "Profile complete! You're ready to sell.",
  },
  driver: {
    pending: "Complete your profile to start delivering. Cooks trust complete drivers.",
    done:    "Profile complete! You're ready to deliver.",
  },
}

export default function ProfileCompletionCard({
  result,
  role,
  variant,
  profileHref = role === 'seller' ? '/seller/profile' : role === 'driver' ? '/driver/profile' : '/buyer/profile',
  onDismiss,
  storageKey,
}: Props) {
  // Ring animates from 0 → percentage on mount (1s ease).
  const [animatedPct, setAnimatedPct] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedPct(result.percentage))
    return () => cancelAnimationFrame(raf)
  }, [result.percentage])

  // Dashboard variant: check dismissed flag once on mount.
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (variant !== 'compact' || !storageKey) return
    try {
      if (sessionStorage.getItem(storageKey) === '1') setDismissed(true)
    } catch { /* private mode etc. */ }
  }, [variant, storageKey])

  const dismiss = () => {
    setDismissed(true)
    if (storageKey) { try { sessionStorage.setItem(storageKey, '1') } catch {} }
    onDismiss?.()
  }

  // Colour + label swap once we hit 100.
  const ringColor = result.isComplete ? '#2DA84E' : '#C8006A'
  const trackColor = '#FFE8F4'

  // Circle geometry — 120px svg (compact = 72px).
  const SIZE = variant === 'compact' ? 72 : 120
  const STROKE = variant === 'compact' ? 6 : 8
  const R = (SIZE - STROKE) / 2
  const CIRCUMF = 2 * Math.PI * R
  const dashOffset = useMemo(() => CIRCUMF - (animatedPct / 100) * CIRCUMF, [animatedPct, CIRCUMF])

  const percentTxtSize = variant === 'compact' ? 20 : 28

  const ring = (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={trackColor} strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMF}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.2,0.64,1), stroke 0.3s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: percentTxtSize, fontWeight: 700, color: ringColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {result.percentage}%
        </div>
        {variant === 'full' && (
          <div style={{ fontSize: 10.5, color: '#1A1A1A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
            {result.isComplete ? 'Complete' : 'Profile'}
          </div>
        )}
      </div>
    </div>
  )

  // ── COMPACT (dashboard) ────────────────────────────────────────────────
  if (variant === 'compact') {
    // Only show the dashboard nag under 80%. If they crossed the line since
    // the last render we hide immediately.
    if (result.percentage >= 80 || dismissed) return null
    const copy = bannerCopy[role]
    return (
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '1.5px solid rgba(200,0,106,0.16)', borderRadius: 18, padding: '16px 18px', marginBottom: 20, boxShadow: '0 6px 22px rgba(200,0,106,0.08)' }}>
        {ring}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: 3 }}>
            Your profile is {result.percentage}% complete
          </div>
          <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>
            {copy.pending} {role !== 'buyer' && result.percentage < 100 && ' Orders may be limited until it\'s done.'}
          </div>
        </div>
        <Link href={profileHref} className="order-btn" style={{ flexShrink: 0, height: 44, padding: '0 18px', background: '#C8006A', color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', boxShadow: '0 6px 18px rgba(200,0,106,0.3)' }}>
          Complete now →
        </Link>
        <button onClick={dismiss} aria-label="Dismiss" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: '#1A1A1A', fontSize: 14, cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  // ── FULL (profile page) ────────────────────────────────────────────────
  const copy = bannerCopy[role]
  const banner = role !== 'buyer' ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 15px',
      background: result.isComplete ? '#EAF7EE' : '#FFF4E0',
      border: `1.5px solid ${result.isComplete ? '#A8DDB8' : '#F5C97A'}`,
      borderRadius: 12, marginTop: 18, fontSize: 13,
      color: result.isComplete ? '#157A33' : '#8C5500', fontWeight: 600, lineHeight: 1.5,
    }}>
      <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>{result.isComplete ? '✅' : '⚠️'}</span>
      <span style={{ flex: 1 }}>{result.isComplete ? copy.done : copy.pending}</span>
    </div>
  ) : null

  // Progress bar under the banner — echoes the ring for a-glance scanning.
  const progressBar = (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        <span>Progress</span>
        <span style={{ color: ringColor }}>{result.percentage}%</span>
      </div>
      <div style={{ height: 8, background: '#FFE8F4', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${animatedPct}%`, background: ringColor, borderRadius: 100, transition: 'width 1s cubic-bezier(0.34,1.2,0.64,1), background 0.3s' }} />
      </div>
    </div>
  )

  return (
    <div className="fade-up" style={{ background: 'var(--bg-card)', borderRadius: 22, padding: 24, boxShadow: '0 4px 22px rgba(200,0,106,0.08)', border: '1.5px solid rgba(200,0,106,0.1)', marginBottom: 18 }}>
      <style>{`
        .pcc-item { transition: background 0.14s; }
        .pcc-item:hover { background: rgba(200,0,106,0.04); }
        @media (max-width: 640px) {
          .pcc-flex { flex-direction: column; align-items: flex-start !important; }
          .pcc-ring-wrap { align-self: center; }
        }
      `}</style>
      <div className="pcc-flex" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="pcc-ring-wrap">{ring}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Profile completion
          </div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {result.isComplete ? 'Your profile is complete' : `You're ${result.percentage}% there`}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-primary)', opacity: 0.85, lineHeight: 1.55, marginTop: 4 }}>
            {result.missing.length === 0
              ? 'Everything looks great — thanks for filling in the details.'
              : `${result.missing.length} item${result.missing.length === 1 ? '' : 's'} left. Fill them in to unlock the best experience.`}
          </p>
        </div>
      </div>

      {banner}
      {progressBar}

      {/* Checklist */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 18, display: 'grid', gap: 6 }}>
        {result.completed.map((item) => (
          <li key={item.field} className="pcc-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10 }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: '#2DA84E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </span>
            <span style={{ flex: 1, fontSize: 13.5, color: '#157A33', textDecoration: 'line-through', fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 11, color: '#2DA84E', fontWeight: 700 }}>+{item.points}</span>
          </li>
        ))}
        {result.missing.map((item) => (
          <li key={item.field} className="pcc-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#FFF7EA' }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: '#F5A623', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>!</span>
            <span style={{ flex: 1, fontSize: 13.5, color: '#8C5500', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.label}
              {item.required
                ? <span aria-label="Required" style={{ color: '#C0392B', fontWeight: 800 }}>*</span>
                : <span aria-label="Optional" style={{ width: 5, height: 5, borderRadius: '50%', background: '#B0B0B0', display: 'inline-block' }}/>}
            </span>
            <a
              href={`#pcc-${item.anchor}`}
              onClick={(e) => {
                // Smooth scroll to the anchor if it exists on this page (profile).
                const el = document.getElementById(`pcc-${item.anchor}`)
                if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
              }}
              style={{ fontSize: 12.5, color: '#C8006A', fontWeight: 700, textDecoration: 'underline', flexShrink: 0 }}
            >
              Add now →
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
