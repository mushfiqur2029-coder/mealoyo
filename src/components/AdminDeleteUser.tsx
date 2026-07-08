'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Destructive "Delete" action for the admin user tables (sellers / drivers /
// buyers). Renders a compact red button plus a confirmation modal, and on
// confirm calls the admin_delete_user RPC which logs the deletion, removes the
// profile row (cascading to their listings/orders/reviews/etc.) and deletes the
// underlying auth.users row. On success it calls onDeleted so the parent can
// drop the row from its list immediately.
export default function AdminDeleteUser({
  user,
  onDeleted,
}: {
  user: { id: string; full_name?: string | null; email?: string | null }
  onDeleted: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const name = user.full_name || user.email || 'this user'

  const doDelete = async () => {
    setDeleting(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('admin_delete_user', { p_user_id: user.id })
    if (rpcError) {
      setError(rpcError.message)
      setDeleting(false)
      return
    }
    // Row is about to be removed from the list, unmounting this component.
    onDeleted(user.id)
  }

  return (
    <>
      <style>{`
        @keyframes delModalIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
        .del-row:hover { background: rgba(220,38,38,0.12) !important; border-color: #DC2626 !important; }
        .del-confirm:hover { background: #B91C1C !important; }
        .del-cancel:hover { background: var(--border-subtle) !important; color: var(--text-primary) !important; }
      `}</style>
      <button
        className="del-row action-btn"
        onClick={() => { setError(''); setConfirming(true) }}
        style={{ height: 34, padding: '0 14px', background: 'transparent', color: '#DC2626', border: '1px solid rgba(220,38,38,0.55)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}
      >
        Delete
      </button>

      {confirming && (
        <div
          onClick={() => { if (!deleting) setConfirming(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center', animation: 'delModalIn 0.2s ease', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(220,38,38,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 20px' }}>⚠️</div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Permanently delete {name}?</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 20 }}>
              This will delete all their data including orders, listings and reviews. This cannot be undone.
            </p>
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0 -32px 22px' }} />
            {error && (
              <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: '#DC2626', fontWeight: 600, textAlign: 'left' }}>{error}</div>
            )}
            <button
              className="del-confirm"
              onClick={doDelete}
              disabled={deleting}
              style={{ width: '100%', height: 48, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.75 : 1, transition: 'background 0.12s', marginBottom: 10 }}
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              className="del-cancel"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              style={{ width: '100%', height: 44, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.12s', marginBottom: 14 }}
            >
              Cancel
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>This action cannot be reversed</p>
          </div>
        </div>
      )}
    </>
  )
}
