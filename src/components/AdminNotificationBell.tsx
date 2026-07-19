'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { playNotificationBeep } from '@/lib/beep'

// Bell + badge + dropdown for every admin nav bar. Fetches five pending
// counts via admin_get_notification_counts, subscribes to realtime changes on
// profiles / listings / withdrawal_requests so the badge updates the instant
// any pending item lands, and beeps + fires a browser notification when the
// total goes UP (never on refresh or on reduction).
//
// TODO(email): also fire an email to admin@mealoyo when a new pending item
// arrives, once SMTP is wired up. Currently browser push only.

type Counts = {
  pending_sellers: number
  pending_drivers: number
  pending_changes: number
  pending_withdrawals: number
  pending_listings: number
  total: number
}

const bellIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

export default function AdminNotificationBell() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [open, setOpen] = useState(false)
  // Previous total, so we can detect an INCREASE (and only beep on that).
  // Initialised on the first load to whatever count is already there — no
  // beep just for landing on the page.
  const prevTotalRef = useRef<number | null>(null)
  const initializedRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const loadCounts = async () => {
    const { data, error } = await supabase.rpc('admin_get_notification_counts')
    if (error || !data) return
    setCounts(data as Counts)
  }

  useEffect(() => {
    void loadCounts()
    // 30s polling fallback in case a realtime message drops.
    const t = setInterval(() => { void loadCounts() }, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!counts) return
    if (!initializedRef.current) {
      prevTotalRef.current = counts.total
      initializedRef.current = true
      return
    }
    if (counts.total > (prevTotalRef.current ?? 0)) {
      playNotificationBeep()
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          // Pick the most interesting NEW item for the body, in priority order.
          const prev = prevTotalRef.current ?? 0
          const delta = counts.total - prev
          const body = delta === 1 ? 'A new task needs your review.' : `${delta} new tasks need your review.`
          new Notification('New pending task on meaLoyo', { body, icon: '/favicon.png' })
        } catch { /* Safari / iOS Notification quirks — non-fatal */ }
      }
    }
    prevTotalRef.current = counts.total
  }, [counts])

  // Realtime subscriptions: whenever any of the three tables that feed the
  // pending counts changes, re-run the RPC. The RPC is cheap (five COUNT
  // scans over indexed columns) so this is fine.
  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void loadCounts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { void loadCounts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => { void loadCounts() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  // Ask for notification permission once per admin session so the prompt
  // never fires in an unexpected spot.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default' && !localStorage.getItem('mealoyo_admin_notif_asked')) {
      localStorage.setItem('mealoyo_admin_notif_asked', '1')
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Click-outside dismisses the dropdown.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const total = counts?.total ?? 0

  const items = counts ? [
    counts.pending_sellers > 0 ? { icon: '👨‍🍳', label: `${counts.pending_sellers} seller${counts.pending_sellers === 1 ? '' : 's'} waiting for approval`, href: '/admin/sellers' } : null,
    counts.pending_drivers > 0 ? { icon: '🚴', label: `${counts.pending_drivers} driver${counts.pending_drivers === 1 ? '' : 's'} waiting for approval`, href: '/admin/drivers' } : null,
    counts.pending_changes > 0 ? { icon: '📝', label: `${counts.pending_changes} profile change request${counts.pending_changes === 1 ? '' : 's'}`, href: '/admin/dashboard' } : null,
    counts.pending_withdrawals > 0 ? { icon: '💰', label: `${counts.pending_withdrawals} withdrawal request${counts.pending_withdrawals === 1 ? '' : 's'} pending`, href: '/admin/withdrawals' } : null,
    counts.pending_listings > 0 ? { icon: '🍽️', label: `${counts.pending_listings} listing${counts.pending_listings === 1 ? '' : 's'} pending review`, href: '/admin/listings' } : null,
  ].filter((x): x is { icon: string; label: string; href: string } => !!x) : []

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`${total} pending ${total === 1 ? 'task' : 'tasks'}`}
        aria-expanded={open}
        style={{
          position: 'relative',
          width: 38, height: 38, borderRadius: 10,
          background: 'transparent',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.14s, border-color 0.14s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,0,106,0.08)'; e.currentTarget.style.borderColor = 'rgba(200,0,106,0.35)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
      >
        {bellIcon}
        {total > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -6, right: -6,
              minWidth: 18, height: 18, borderRadius: 100,
              background: '#DC2626', color: '#fff',
              fontSize: 10, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
              boxShadow: '0 2px 6px rgba(220,38,38,0.5)',
              border: '2px solid var(--bg-card)',
            }}
          >{total > 99 ? '99+' : total}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 46, right: 0, zIndex: 200,
            width: 340, maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
            padding: 10,
            animation: 'admBellIn 0.14s ease',
          }}
        >
          <style>{`@keyframes admBellIn { from { opacity:0; transform: translateY(-8px) } to { opacity:1; transform: translateY(0) } }`}</style>
          <div style={{ padding: '4px 10px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, fontWeight: 700 }}>Notifications</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {total === 0 ? "You're all caught up." : `${total} pending ${total === 1 ? 'task' : 'tasks'}`}
            </div>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '18px 14px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              Nothing needs your attention right now. ✅
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((it, i) => (
                <Link
                  key={i}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 12px', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary)',
                    transition: 'background 0.14s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-page)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{it.icon}</span>
                  <span style={{ minWidth: 0 }}>{it.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
