'use client'
import { createPortal } from 'react-dom'

interface Props {
  isOpen: boolean
  userName: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

// Rendered via a portal into document.body so it escapes the admin list's
// transformed (.fade-up) ancestors — a CSS transform on an ancestor makes
// position:fixed resolve against that ancestor instead of the viewport, which
// previously trapped the overlay inside the table row and broke the layout.
export default function AdminDeleteModal({ isOpen, userName, onConfirm, onCancel, isDeleting }: Props) {
  // isOpen is always false on first render (server + hydration), so the portal
  // only ever mounts client-side after a user click — the typeof guard just
  // keeps createPortal from touching document during SSR.
  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.15s ease'
    }} onClick={() => { if (!isDeleting) onCancel() }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.2s ease'
      }} onClick={e => e.stopPropagation()}>

        {/* Warning icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#FEE2E2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '28px', margin: '0 auto'
          }}>⚠️</div>
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700,
          color: 'var(--text-primary)', textAlign: 'center', marginBottom: '12px'
        }}>Permanently delete {userName}?</h2>

        {/* Body */}
        <p style={{
          fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center',
          lineHeight: 1.6, marginBottom: '24px'
        }}>
          This will delete all their data including orders, listings and reviews. This cannot be undone.
        </p>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border-subtle)', marginBottom: '20px' }}/>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={onConfirm} disabled={isDeleting} style={{
            height: '48px', background: '#DC2626', color: '#fff',
            border: 'none', borderRadius: '12px', fontSize: '15px',
            fontWeight: 700, cursor: isDeleting ? 'not-allowed' : 'pointer',
            opacity: isDeleting ? 0.7 : 1, width: '100%',
            fontFamily: 'Inter, sans-serif'
          }}>
            {isDeleting ? 'Deleting...' : 'Delete permanently'}
          </button>
          <button onClick={onCancel} disabled={isDeleting} style={{
            height: '44px', background: 'transparent', color: 'var(--text-primary)',
            border: '1.5px solid var(--border-subtle)', borderRadius: '12px',
            fontSize: '14px', fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer', width: '100%',
            fontFamily: 'Inter, sans-serif'
          }}>Cancel</button>
        </div>

        {/* Note */}
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
          This action is permanent and cannot be reversed.
        </p>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>,
    document.body
  )
}
