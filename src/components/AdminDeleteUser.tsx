'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Destructive "Delete account" action for the admin user tables (sellers /
// drivers / buyers). Renders a red button plus a confirmation modal, and on
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
      <style>{`.del-acct:hover{background:rgba(192,57,43,0.14) !important;border-color:#C0392B !important;} .del-confirm:hover{background:#991010 !important;} .del-cancel:hover{background:var(--border-subtle) !important;color:var(--text-primary) !important;}`}</style>
      <button
        className="del-acct"
        onClick={() => { setError(''); setConfirming(true) }}
        style={{ height: 34, padding: '0 14px', background: 'transparent', color: '#FF8A8A', border: '1px solid rgba(192,57,43,0.6)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}
      >
        Delete account
      </button>

      {confirming && (
        <div
          onClick={() => { if (!deleting) setConfirming(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: '100%', maxWidth: 440, padding: 26, textAlign: 'left' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(192,57,43,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Permanently delete {name}&rsquo;s account?</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20 }}>
              This will delete all their data including orders, listings, reviews and cannot be undone.
            </p>
            {error && (
              <div style={{ background: 'rgba(192,57,43,0.14)', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: '#FF8A8A', fontWeight: 600 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="del-cancel"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                style={{ height: 42, padding: '0 18px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.12s' }}
              >
                Cancel
              </button>
              <button
                className="del-confirm"
                onClick={doDelete}
                disabled={deleting}
                style={{ height: 42, padding: '0 18px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.7 : 1, transition: 'background 0.12s' }}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
