'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

// Shape returned by admin_get_pending_changes(p_user_id).
type PendingChange = { label?: string; old: unknown; new: unknown }
type PendingChangesMap = Record<string, PendingChange>

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

// "2h ago", "3d ago" — mirrors the same helper used elsewhere in admin.
const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const renderValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
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

  // ── Side-channel: fetch pending_changes + changes_submitted_at for
  // pending users. Uses a lightweight admin_get_pending_changes RPC so we
  // don't have to also update admin_get_profiles_by_role. Nothing happens
  // for active / suspended users.
  const [pendingChanges, setPendingChanges] = useState<PendingChangesMap | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingError, setPendingError] = useState('')

  const userId = user?.id
  const userStatus = user?.status
  useEffect(() => {
    if (!isOpen || !userId || userStatus !== 'pending') {
      setPendingChanges(null); setSubmittedAt(null); setPendingError('')
      return
    }
    let alive = true
    setPendingLoading(true); setPendingError('')
    ;(async () => {
      // Fallback to whatever's already on the Profile row (if the caller
      // already fetched it) so we render instantly if we can.
      if (user?.pending_changes) setPendingChanges(user.pending_changes as PendingChangesMap)
      if (user?.changes_submitted_at) setSubmittedAt(user.changes_submitted_at)

      const { data, error } = await supabase.rpc('admin_get_pending_changes', { p_user_id: userId })
      if (!alive) return
      if (error) { setPendingError(error.message); setPendingLoading(false); return }
      const row = Array.isArray(data) ? data[0] : data
      setPendingChanges((row?.pending_changes as PendingChangesMap | null) ?? null)
      setSubmittedAt((row?.changes_submitted_at as string | null) ?? null)
      setPendingLoading(false)
    })()
    return () => { alive = false }
  }, [isOpen, userId, userStatus, user?.pending_changes, user?.changes_submitted_at])

  const changeEntries = useMemo(() => {
    if (!pendingChanges) return []
    return Object.entries(pendingChanges).map(([field, ch]) => ({
      field,
      label: ch.label ?? field.replace(/_/g, ' '),
      old: ch.old,
      new: ch.new,
    }))
  }, [pendingChanges])

  if (!isOpen || !user || typeof document === 'undefined') return null

  const initial = user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
  const address = [user.address_line1, user.address_line2, user.city, user.postcode].filter(Boolean).join(', ')

  const isSellerOrDriver = user.role === 'seller' || user.role === 'driver'
  const isPending = user.status === 'pending'
  const hasPendingDiff = isPending && changeEntries.length > 0

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
          {/* ── Pending re-approval banner ─────────────────────────────
              Renders three ways depending on what's known about the
              pending user: the resubmitted-changes diff (most common),
              a "new registration" call-out when the row is pending but
              carries no diff (first-time signup or pre-migration data),
              and a small error if the side-channel RPC failed. */}
          {isPending && (
            hasPendingDiff ? (
              <div style={{ background: 'rgba(251,191,36,0.13)', border: '1.5px solid rgba(251,191,36,0.5)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#B8730A' }}>Changes awaiting approval</div>
                </div>
                <div style={{ fontSize: 11.5, color: '#8C5500', fontWeight: 600, marginBottom: 12 }}>Submitted {timeAgo(submittedAt)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {changeEntries.map(ch => (
                    <div key={ch.field} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(251,191,36,0.35)' }}>
                      <div style={{ fontSize: 10.5, color: '#8C5500', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{ch.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5 }}>
                        <span style={{ color: '#DC2626', fontWeight: 600, textDecoration: 'line-through', wordBreak: 'break-word' }}>{renderValue(ch.old)}</span>
                        <span style={{ color: '#8C5500', fontWeight: 700 }}>→</span>
                        <span style={{ color: '#157A33', fontWeight: 800, wordBreak: 'break-word' }}>{renderValue(ch.new)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : pendingLoading ? (
              <div style={{ background: 'rgba(251,191,36,0.1)', border: '1.5px solid rgba(251,191,36,0.4)', borderRadius: 14, padding: '14px 18px', fontSize: 13, fontWeight: 600, color: '#8C5500' }}>Loading pending changes…</div>
            ) : (
              <div style={{ background: 'rgba(251,191,36,0.13)', border: '1.5px solid rgba(251,191,36,0.5)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>🆕</span>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700, color: '#B8730A' }}>New account registration</div>
                </div>
                <div style={{ fontSize: 13, color: '#8C5500', lineHeight: 1.55 }}>Please review the profile details below before approving.</div>
                {pendingError && <div style={{ marginTop: 8, fontSize: 11.5, color: '#B8730A', opacity: 0.85 }}>Note: could not load resubmission diff — {pendingError}</div>}
              </div>
            )
          )}

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
                >{isBusy ? (hasPendingDiff ? 'Approving changes…' : 'Approving…') : hasPendingDiff ? 'Approve changes' : 'Approve'}</button>
              )}
              {onSuspend && user.status !== 'suspended' && (
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
