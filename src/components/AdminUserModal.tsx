'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Profile } from '@/lib/types'

// Comprehensive user-details modal for admin lists. Shown when an admin clicks
// "View profile" on a row in /admin/sellers, /admin/drivers, /admin/buyers,
// and on any pending row in /admin/dashboard's approval queue.
//
// Callers pass a Profile (already loaded via admin_get_profiles_by_role) plus
// any role-specific stats they already have in memory — the modal itself does
// NOT hit the network, so there's no loading state to worry about.

type Stat = { label: string; value: string | number }

interface Props {
  isOpen: boolean
  user: Profile | null
  stats?: Stat[]
  // Role-neutral action callbacks — the parent still owns the RPC calls so a
  // failure surfaces where the rest of that page's error handling lives.
  onApprove?: () => void
  onSuspend?: () => void
  onDelete?: () => void
  onClose: () => void
  isBusy?: boolean
}

// Mask an account number to the last four digits: "12345678" → "•••• 5678".
const maskAccount = (v: string | null | undefined): string => {
  if (!v) return '—'
  const digits = v.replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `•••• ${digits.slice(-4)}`
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusColor = (s: string) =>
  s === 'active' ? '#34D399'
  : s === 'pending' ? '#FBBF24'
  : s === 'suspended' ? '#FF8A8A'
  : 'var(--text-secondary)'
const statusBg = (s: string) =>
  s === 'active' ? 'rgba(52,211,153,0.14)'
  : s === 'pending' ? 'rgba(251,191,36,0.14)'
  : s === 'suspended' ? 'rgba(255,138,138,0.14)'
  : 'var(--border-subtle)'

const vehicleLabel: Record<string, string> = {
  bicycle: '🚴 Bicycle',
  moped: '🛵 Moped',
  car: '🚗 Car',
  van: '🚐 Van',
}

export default function AdminUserModal({ isOpen, user, stats, onApprove, onSuspend, onDelete, onClose, isBusy = false }: Props) {
  // Escape closes the modal (backdrop tap also handled below).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isBusy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isBusy, onClose])

  if (!isOpen || !user || typeof document === 'undefined') return null

  const initial = user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
  const address = [user.address_line1, user.address_line2, user.city, user.postcode].filter(Boolean).join(', ')

  const isSellerOrDriver = user.role === 'seller' || user.role === 'driver'

  return createPortal(
    <div
      onClick={() => { if (!isBusy) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'aumFadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 560,
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'auto',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          border: '1px solid var(--border-subtle)',
          animation: 'aumSlideUp 0.2s ease',
        }}
      >
        <style>{`
          @keyframes aumFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes aumSlideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          .aum-close:hover { background: var(--border-subtle) !important; }
          .aum-btn:active { transform: scale(0.97); transition: transform 0.1s; }
        `}</style>

        {/* Header — avatar + name + email + close */}
        <div style={{ position: 'relative', padding: '28px 24px 0' }}>
          <button
            className="aum-close"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 36, height: 36, borderRadius: '50%',
              background: 'transparent', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              fontSize: 20, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.14s',
            }}
          >×</button>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingRight: 40 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {user.avatar_url ? (
                // Plain img over next/image to avoid layout-shift + remote-domain configuration issues in a modal.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              ) : (
                <span style={{ fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 700, color: '#fff' }}>{initial}</span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name || 'Unknown'}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || '—'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ background: statusBg(user.status), color: statusColor(user.status), padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{user.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{user.role || 'user'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>· joined {formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stats grid (role-specific numbers passed in by caller) */}
          {stats && stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: 10 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-page)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Contact */}
          <Section title="Contact">
            <Field label="Phone" value={user.phone || '—'}/>
            <Field label="Email" value={user.email || '—'}/>
          </Section>

          {/* Address */}
          <Section title="Address">
            {address ? (
              <>
                <Field label="Line 1" value={user.address_line1 || '—'}/>
                {user.address_line2 && <Field label="Line 2" value={user.address_line2}/>}
                <Field label="City" value={user.city || '—'}/>
                <Field label="Postcode" value={user.postcode || '—'}/>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No address on file.</div>
            )}
          </Section>

          {/* Vehicle (driver only) */}
          {user.role === 'driver' && (
            <Section title="Vehicle">
              <Field label="Type" value={user.vehicle_type ? (vehicleLabel[user.vehicle_type] || user.vehicle_type) : '—'}/>
            </Section>
          )}

          {/* Bank (seller / driver) */}
          {isSellerOrDriver && (
            <Section title="Bank details (masked)">
              <Field label="Account name" value={user.bank_account_name || '—'}/>
              <Field label="Sort code" value={user.bank_sort_code || '—'}/>
              <Field label="Account number" value={maskAccount(user.bank_account_number)}/>
            </Section>
          )}

          {/* Documents placeholder — verification workflow not yet built. */}
          <Section title="Documents">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Document verification is coming soon. This section will list ID, address proof, and role-specific documents (food-hygiene certificate, driving licence) once the upload flow ships.
            </div>
          </Section>

          {/* Action bar — surfaces only what the caller wired up */}
          {(onApprove || onSuspend || onDelete) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {onApprove && user.status !== 'active' && (
                <button
                  className="aum-btn"
                  onClick={onApprove}
                  disabled={isBusy}
                  style={{ flex: '1 1 120px', minHeight: 44, padding: '0 16px', background: '#2DA84E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
                >Approve</button>
              )}
              {onSuspend && user.status === 'active' && (
                <button
                  className="aum-btn"
                  onClick={onSuspend}
                  disabled={isBusy}
                  style={{ flex: '1 1 120px', minHeight: 44, padding: '0 16px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
                >Suspend</button>
              )}
              {onDelete && (
                <button
                  className="aum-btn"
                  onClick={onDelete}
                  disabled={isBusy}
                  style={{ flex: '1 1 120px', minHeight: 44, padding: '0 16px', background: 'transparent', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.5)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
                >Delete</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-page)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 92, textTransform: 'capitalize' }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word', flex: 1 }}>{value}</div>
    </div>
  )
}
