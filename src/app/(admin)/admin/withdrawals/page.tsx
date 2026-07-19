'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import AdminNotificationBell from '@/components/AdminNotificationBell'
import type { Profile, WithdrawalRequest } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Buyers', h:'/admin/buyers' },
  { l:'Listings', h:'/admin/listings' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Withdrawals', h:'/admin/withdrawals' },
  { l:'Settings', h:'/admin/settings' },
]

const wBadge: Record<string, { bg: string; c: string; l: string }> = {
  pending: { bg:'rgba(184,115,10,0.18)', c:'#FBBF24', l:'Pending' },
  approved: { bg:'rgba(59,130,246,0.18)', c:'#93C5FD', l:'Approved' },
  paid: { bg:'rgba(45,168,78,0.18)', c:'#34D399', l:'Paid' },
  rejected: { bg:'rgba(192,57,43,0.2)', c:'#FF8A8A', l:'Rejected' },
}

const dark = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmerD { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .skelD { background: linear-gradient(90deg, var(--bg-card) 0%, var(--border-subtle) 50%, var(--bg-card) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: var(--text-primary) !important; }
  .paid-btn:hover { background: #1A6030 !important; }
  .reject-btn:hover { background: rgba(192,57,43,0.16) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 720px) { .wr-row { flex-direction: column !important; align-items: stretch !important; } .wr-actions { justify-content: flex-start !important; } }
`

export default function AdminWithdrawals() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [paidModal, setPaidModal] = useState<WithdrawalRequest | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const load = async () => {
    const { data } = await supabase.rpc('admin_get_withdrawals')
    setRows((data as WithdrawalRequest[]) || [])
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: prof } = await supabase.rpc('get_my_profile')
      if ((prof as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(prof)
      await load()
      setLoading(false)
    }
    getData()
  }, [router])

  const approve = async (id: string) => {
    setError(''); setBusyId(id)
    const { error } = await supabase.rpc('admin_update_withdrawal', { p_id: id, p_status: 'approved', p_note: null })
    if (error) { setError(error.message); setBusyId(null); return }
    await load()
    setBusyId(null)
  }

  const openPaidModal = (w: WithdrawalRequest) => { setError(''); setReceiptFile(null); setPaidModal(w) }
  const closePaidModal = () => { setPaidModal(null); setReceiptFile(null); setDragActive(false); setUploading(false) }

  const confirmPaid = async () => {
    if (!paidModal) return
    setError(''); setUploading(true)
    let receiptUrl: string | null = null
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop() || 'jpg'
      const path = `${paidModal.user_id}/${paidModal.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { upsert: true, contentType: receiptFile.type })
      if (upErr) { setError(`Receipt upload failed: ${upErr.message}`); setUploading(false); return }
      receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.rpc('admin_update_withdrawal', { p_id: paidModal.id, p_status: 'paid', p_note: null, p_receipt_url: receiptUrl })
    if (error) { setError(error.message); setUploading(false); return }
    closePaidModal()
    await load()
  }

  const confirmReject = async (id: string) => {
    if (!rejectReason.trim()) { setError('Please give a reason for rejecting this request.'); return }
    setError(''); setBusyId(id)
    const { error } = await supabase.rpc('admin_update_withdrawal', { p_id: id, p_status: 'rejected', p_note: rejectReason.trim() })
    if (error) { setError(error.message); setBusyId(null); return }
    setRejectingId(null); setRejectReason('')
    await load()
    setBusyId(null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/withdrawals'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:12, color:'var(--text-secondary)'}}>{profile?.full_name || profile?.email}</span>
          <AdminNotificationBell/>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
      </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1000, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:180, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:260, borderRadius:6, marginBottom:28}}/>
        {Array.from({length:3}).map((_, i) => <div key={i} className="skelD" style={{height:96, borderRadius:16, marginBottom:14}}/>)}
      </div>
    </div>
  )

  // Priority queue: status 'pending' outranks 'approved' (awaiting transfer),
  // and within each, largest amounts surface first.
  const pending = rows
    .filter(r => r.status === 'pending' || r.status === 'approved')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      return parseFloat(b.amount || '0') - parseFloat(a.amount || '0')
    })
  const processed = rows.filter(r => r.status === 'paid' || r.status === 'rejected')
  const pendingTotal = pending.reduce((s, r) => s + parseFloat(r.amount || '0'), 0)

  const roleLabel = (r?: string | null) => r === 'driver' ? 'Driver' : r === 'seller' ? 'Seller' : (r || '—')

  const renderRow = (w: WithdrawalRequest) => {
    const badge = wBadge[w.status] || wBadge.pending
    return (
      <div key={w.id} style={{background:'var(--bg-card)', borderRadius:16, border:'1px solid var(--border-subtle)', padding:'18px 20px', marginBottom:14}}>
        <div className="wr-row" style={{display:'flex', alignItems:'center', gap:16}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <span style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)'}}>£{parseFloat(w.amount || '0').toFixed(2)}</span>
              <span style={{background:badge.bg, color:badge.c, fontSize:10.5, fontWeight:800, padding:'3px 9px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.03em'}}>{badge.l}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
              <span style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>{w.profiles?.full_name || w.profiles?.email || 'Unknown user'}</span>
              <span style={{background:'var(--border-subtle)', color:'var(--text-secondary)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.04em'}}>{roleLabel(w.profiles?.role)}</span>
            </div>
            <div style={{fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.6}}>
              {w.bank_account_name || '—'} · Sort {w.bank_sort_code || '—'} · Acct {w.bank_account_number || '—'}
            </div>
            <div style={{fontSize:11.5, color:'var(--text-secondary)', marginTop:4}}>
              Requested {new Date(w.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
              {w.approved_at && ` · Approved ${new Date(w.approved_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`}
              {w.paid_at && ` · Paid ${new Date(w.paid_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
            </div>
            {w.status === 'rejected' && (w.rejection_reason || w.admin_note) && <div style={{fontSize:12, color:'#FF8A8A', marginTop:4}}>Reason: {w.rejection_reason || w.admin_note}</div>}
            {w.status === 'paid' && w.receipt_url && <a href={w.receipt_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12, color:'#34D399', fontWeight:600, textDecoration:'underline', display:'inline-block', marginTop:5}}>View transfer receipt →</a>}
          </div>
          <div className="wr-actions" style={{display:'flex', gap:8, flexShrink:0}}>
            {w.status === 'pending' && (
              <>
                <button onClick={() => approve(w.id)} disabled={busyId === w.id} className="paid-btn" style={{height:40, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:busyId === w.id ? 'not-allowed' : 'pointer', opacity:busyId === w.id ? 0.7 : 1, transition:'background 0.14s'}}>Approve</button>
                <button onClick={() => { setRejectingId(rejectingId === w.id ? null : w.id); setRejectReason(''); setError('') }} className="reject-btn" style={{height:40, padding:'0 16px', background:'transparent', color:'#FF8A8A', border:'1px solid rgba(192,57,43,0.5)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Reject</button>
              </>
            )}
            {w.status === 'approved' && (
              <button onClick={() => openPaidModal(w)} className="paid-btn" style={{height:40, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Mark as Paid</button>
            )}
            {w.status === 'paid' && (
              <span style={{height:40, padding:'0 16px', display:'flex', alignItems:'center', background:'rgba(45,168,78,0.15)', color:'#34D399', borderRadius:10, fontSize:13, fontWeight:700}}>✓ Paid</span>
            )}
          </div>
        </div>
        {rejectingId === w.id && (
          <div style={{marginTop:14, paddingTop:14, borderTop:'1px solid var(--bg-secondary)', display:'flex', gap:8, flexWrap:'wrap'}}>
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (shown to the user)" style={{flex:1, minWidth:220, height:42, border:'1px solid var(--border-subtle)', borderRadius:10, padding:'0 14px', fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', outline:'none'}}/>
            <button onClick={() => confirmReject(w.id)} disabled={busyId === w.id} style={{height:42, padding:'0 18px', background:'#C0392B', color:'var(--text-primary)', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:busyId === w.id ? 'not-allowed' : 'pointer', opacity:busyId === w.id ? 0.7 : 1}}>Confirm reject</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1000, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:26}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Withdrawals</h1>
          <p style={{fontSize:14, color:'var(--text-secondary)'}}>Review payout requests and mark them paid once the bank transfer is sent.</p>
        </div>

        {error && <div className="fade-up" style={{background:'rgba(255,138,138,0.14)', border:'1px solid rgba(255,138,138,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#FF8A8A', fontWeight:600}}>{error}</div>}

        <div className="fade-up">
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>Priority queue {pending.length > 0 && <span style={{color:'#FBBF24'}}>({pending.length})</span>}</h2>
            {pending.length > 0 && <span style={{fontSize:12.5, color:'var(--text-secondary)', fontWeight:600}}>Outstanding: <strong style={{color:'#FBBF24', fontFamily:'Georgia,serif'}}>£{pendingTotal.toFixed(2)}</strong></span>}
          </div>
          {pending.length === 0 ? (
            <div style={{background:'var(--bg-card)', borderRadius:16, border:'1px solid var(--border-subtle)', padding:'40px 20px', textAlign:'center', marginBottom:32}}>
              <div style={{fontSize:38, marginBottom:10}}>✅</div>
              <p style={{fontSize:14, color:'var(--text-secondary)'}}>No pending withdrawal requests right now.</p>
            </div>
          ) : <div style={{marginBottom:32}}>{pending.map(renderRow)}</div>}

          {processed.length > 0 && (
            <>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:14}}>History</h2>
              {processed.map(renderRow)}
            </>
          )}
        </div>
      </div>

      {paidModal && (
        <div onClick={closePaidModal} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto', border:'1px solid var(--border-subtle)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', padding:'26px 28px 28px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:21, fontWeight:700, color:'var(--text-primary)'}}>Mark as paid</h2>
              <button onClick={closePaidModal} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid var(--border-subtle)', background:'transparent', fontSize:15, color:'var(--text-secondary)', cursor:'pointer'}}>✕</button>
            </div>

            <div style={{background:'var(--bg-card)', borderRadius:14, padding:'16px 18px', marginBottom:18, border:'1px solid var(--bg-secondary)'}}>
              <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.6}}>
                Confirm payment of <strong style={{color:'#34D399'}}>£{parseFloat(paidModal.amount || '0').toFixed(2)}</strong> to <strong style={{color:'var(--text-primary)'}}>{paidModal.bank_account_name || '—'}</strong> ({paidModal.bank_sort_code || '—'} {paidModal.bank_account_number || '—'}).
              </p>
            </div>

            <label style={{display:'block', fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>Upload bank transfer receipt <span style={{color:'var(--text-secondary)', fontWeight:500}}>(optional)</span></label>
            <label
              onDragOver={e => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={e => { e.preventDefault(); setDragActive(false) }}
              onDrop={e => {
                e.preventDefault(); setDragActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) setReceiptFile(f)
              }}
              style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, textAlign:'center', cursor:'pointer', padding:'22px 16px', borderRadius:14, border:`1.5px dashed ${dragActive ? '#C8006A' : receiptFile ? 'rgba(52,211,153,0.5)' : 'var(--border-subtle)'}`, background:dragActive ? 'rgba(200,0,106,0.08)' : 'var(--bg-card)', transition:'all 0.15s', marginBottom:6}}
            >
              <div style={{fontSize:24}}>{receiptFile ? '📎' : '⬆️'}</div>
              {receiptFile ? (
                <div style={{fontSize:12.5, color:'#34D399', fontWeight:700, wordBreak:'break-all'}}>{receiptFile.name}</div>
              ) : (
                <>
                  <div style={{fontSize:13, color:'var(--text-secondary)', fontWeight:600}}>Drag & drop receipt here</div>
                  <div style={{fontSize:11.5, color:'var(--text-secondary)'}}>or click to browse · JPG, PNG, WebP or PDF</div>
                </>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} style={{display:'none'}}/>
            </label>
            {receiptFile && <button onClick={() => setReceiptFile(null)} style={{fontSize:11.5, color:'#FF8A8A', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:6}}>Remove</button>}
            <p style={{fontSize:11.5, color:'var(--text-secondary)', lineHeight:1.55, marginTop:8, marginBottom:18}}>The requester will see this receipt and a &ldquo;Payment confirmed&rdquo; message on their earnings page.</p>

            {error && <div style={{background:'rgba(255,138,138,0.14)', border:'1px solid rgba(255,138,138,0.3)', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:12.5, color:'#FF8A8A', fontWeight:600}}>{error}</div>}

            <div style={{display:'flex', gap:10}}>
              <button onClick={closePaidModal} disabled={uploading} style={{flex:'0 0 auto', height:46, padding:'0 20px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', borderRadius:12, fontSize:14, fontWeight:600, cursor:uploading ? 'not-allowed' : 'pointer'}}>Cancel</button>
              <button onClick={confirmPaid} disabled={uploading} className="paid-btn" style={{flex:1, height:46, background:'#2DA84E', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:uploading ? 'not-allowed' : 'pointer', opacity:uploading ? 0.7 : 1, transition:'background 0.14s'}}>{uploading ? 'Processing…' : 'Confirm payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
