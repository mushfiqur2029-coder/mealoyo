'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

interface Props {
  isOpen: boolean
  // Available balance in pounds — used both for the "full" pill and as the
  // cap on the custom input.
  available: number
  // Bank details for the "Payment goes to" preview. Passed in from the
  // parent's already-loaded profile so the modal doesn't hit the network.
  bank: { name: string | null; sort: string | null; acct: string | null }
  bankSaved: boolean
  // Where the "Please add your bank details" warning link should go —
  // '/seller/profile' or '/driver/profile'. Keeps this component role-neutral.
  profileHref: string
  // Parent-owned submit — the modal calls request_withdrawal there so the
  // caller can trigger a reload of its own list on success.
  onSubmit: (amount: number) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
  onSuccess?: () => void
}

const MIN_WITHDRAWAL = 5
type Choice = 'full' | 'custom'

// Consumer-app-style withdrawal request modal. Full-balance pill OR custom
// amount input, min £5, capped at available. Portals into document.body so
// its z-index isn't fighting the parent page's transform contexts.
export default function WithdrawalRequestModal({ isOpen, available, bank, bankSaved, profileHref, onSubmit, onClose, onSuccess }: Props) {
  const [choice, setChoice] = useState<Choice>('full')
  const [customText, setCustomText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Reset internal state each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setChoice('full')
      setCustomText('')
      setError('')
      setSubmitted(false)
      setBusy(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, busy, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  // Amount actually chosen right now — used for the button label and the RPC.
  const parsedCustom = parseFloat(customText.replace(/[^\d.]/g, '')) || 0
  const chosenAmount = choice === 'full' ? available : parsedCustom
  const rounded = Math.round(chosenAmount * 100) / 100

  const overCap = choice === 'custom' && rounded > available + 0.001
  const belowMin = rounded < MIN_WITHDRAWAL
  const validAmount = !overCap && !belowMin && rounded > 0

  const maskedAcct = bank.acct ? `•••• ${bank.acct.replace(/\D/g, '').slice(-4)}` : null

  const submit = async () => {
    if (!bankSaved || !validAmount || busy) return
    setBusy(true); setError('')
    const res = await onSubmit(rounded)
    setBusy(false)
    if (!res.ok) { setError(res.error || 'Could not submit withdrawal'); return }
    setSubmitted(true)
    onSuccess?.()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request withdrawal"
      onClick={() => { if (!busy) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'wrmFade 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', color: '#1A1A1A',
          borderRadius: 20,
          width: '100%', maxWidth: 420,
          maxHeight: 'calc(100vh - 32px)', overflow: 'auto',
          padding: 32,
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          animation: 'wrmPop 0.18s cubic-bezier(0.34,1.2,0.64,1)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <style>{`
          @keyframes wrmFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes wrmPop { from { transform: scale(0.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          .wrm-choice { transition: border-color 0.14s, background 0.14s, transform 0.1s; }
          .wrm-choice:active { transform: scale(0.98); }
          .wrm-submit:active { transform: scale(0.98); }
        `}</style>

        {submitted ? (
          // Success view — modal replaces its own content with the confirmation
          // block, mirrors the pattern the old modal used.
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E4F6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 18px' }}>✅</div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Withdrawal request submitted</h2>
            <p style={{ fontSize: 14, color: 'rgba(26,26,26,0.7)', lineHeight: 1.6, marginBottom: 22 }}>
              Admin will review and process within <strong>1–3 working days</strong>. You&apos;ll see the status change here once it&apos;s paid.
            </p>
            <button
              onClick={onClose}
              className="wrm-submit"
              style={{ height: 46, padding: '0 32px', background: '#C8006A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700 }}>Request withdrawal</h2>
              <button
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E7D6E0', background: '#fff', fontSize: 16, color: '#1A1A1A', cursor: busy ? 'not-allowed' : 'pointer' }}
              >✕</button>
            </div>

            {/* Available balance */}
            <div style={{ background: '#FBF3F8', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Available balance</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>£{available.toFixed(2)}</div>
            </div>

            {/* Bank preview */}
            {bankSaved ? (
              <div style={{ background: '#F8F0F4', borderRadius: 12, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🏦</span>
                <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700 }}>To: {maskedAcct ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(26,26,26,0.65)' }}>{bank.name || '—'}</div>
                </div>
              </div>
            ) : (
              <div style={{ background: '#FFF4E0', border: '1px solid rgba(184,115,10,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: '#8A5600', fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>Please add your bank details in Profile before withdrawing.</p>
                <Link href={profileHref} style={{ fontSize: 13, color: '#C8006A', fontWeight: 700, textDecoration: 'underline' }}>Go to Profile settings →</Link>
              </div>
            )}

            {/* Amount picker */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Amount to withdraw</div>

            {/* Full-balance pill */}
            <button
              type="button"
              className="wrm-choice"
              onClick={() => setChoice('full')}
              disabled={!bankSaved || available < MIN_WITHDRAWAL}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                background: choice === 'full' ? 'rgba(45,168,78,0.1)' : '#fff',
                border: choice === 'full' ? '2px solid #2DA84E' : '1.5px solid #E0E0E0',
                borderRadius: 14,
                marginBottom: 10,
                cursor: bankSaved && available >= MIN_WITHDRAWAL ? 'pointer' : 'not-allowed',
                opacity: bankSaved && available >= MIN_WITHDRAWAL ? 1 : 0.55,
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>£{available.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'rgba(26,26,26,0.6)', marginTop: 2, fontWeight: 600 }}>Full balance</div>
              </div>
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: choice === 'full' ? '6px solid #2DA84E' : '2px solid #C0C0C0',
                  background: '#fff',
                  transition: 'border 0.14s',
                }}
              />
            </button>

            {/* Custom amount */}
            <div
              className="wrm-choice"
              onClick={() => setChoice('custom')}
              style={{
                padding: '14px 16px',
                background: choice === 'custom' ? 'rgba(200,0,106,0.06)' : '#fff',
                border: choice === 'custom' ? '2px solid #C8006A' : '1.5px solid #E0E0E0',
                borderRadius: 14,
                marginBottom: 6,
                cursor: bankSaved ? 'pointer' : 'not-allowed',
                opacity: bankSaved ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: choice === 'custom' ? '6px solid #C8006A' : '2px solid #C0C0C0',
                    background: '#fff', flexShrink: 0,
                    transition: 'border 0.14s',
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Custom amount</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: 46, border: '1.5px solid #E0E0E0', borderRadius: 11, background: '#fff', paddingLeft: 12, opacity: bankSaved ? 1 : 0.55 }}>
                <span style={{ fontSize: 17, color: '#1A1A1A', fontWeight: 700 }}>£</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customText}
                  onFocus={() => setChoice('custom')}
                  onChange={e => setCustomText(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                  placeholder="0.00"
                  disabled={!bankSaved}
                  style={{ flex: 1, height: '100%', border: 'none', outline: 'none', paddingLeft: 6, fontSize: 17, fontWeight: 700, color: '#1A1A1A', background: 'transparent', minWidth: 0 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'rgba(26,26,26,0.55)' }}>
                <span>Min £{MIN_WITHDRAWAL.toFixed(2)}</span>
                <span>Max £{available.toFixed(2)}</span>
              </div>
            </div>

            {/* Inline validation */}
            {choice === 'custom' && customText && (overCap || belowMin) && (
              <div style={{ fontSize: 12, color: '#C0392B', fontWeight: 600, marginBottom: 6 }}>
                {overCap
                  ? `Enter £${available.toFixed(2)} or less — that's your available balance.`
                  : `Minimum withdrawal is £${MIN_WITHDRAWAL.toFixed(2)}.`}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: 'rgba(26,26,26,0.55)', lineHeight: 1.55, marginTop: 12, marginBottom: 18 }}>Payments are processed manually within <strong>1–3 working days</strong> of approval. For security, bank details can only be changed in your <Link href={profileHref} style={{ color: '#C8006A', fontWeight: 600 }}>Profile settings</Link>.</p>

            {error && <div style={{ background: '#FFE8F4', border: '1px solid rgba(200,0,106,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: '#C8006A', fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                disabled={busy}
                style={{ flex: '0 0 auto', height: 48, padding: '0 20px', background: 'transparent', color: '#1A1A1A', border: '1.5px solid #E0E0E0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
              >Cancel</button>
              <button
                onClick={submit}
                disabled={!bankSaved || !validAmount || busy}
                className="wrm-submit"
                style={{
                  flex: 1, height: 48,
                  background: (bankSaved && validAmount) ? '#C8006A' : '#E7D6E0',
                  color: '#fff',
                  border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 800,
                  cursor: (bankSaved && validAmount && !busy) ? 'pointer' : 'not-allowed',
                  opacity: busy ? 0.75 : 1,
                }}
              >
                {busy ? 'Submitting…' : validAmount ? `Request withdrawal of £${rounded.toFixed(2)}` : 'Request withdrawal'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
