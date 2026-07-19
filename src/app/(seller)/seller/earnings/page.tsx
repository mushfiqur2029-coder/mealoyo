'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import WithdrawalRequestModal from '@/components/WithdrawalRequestModal'
import type { Order, Profile, WithdrawalRequest } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
]

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: #C8006A !important; }
  .erow:hover { background: var(--bg-secondary) !important; }
  .signout:hover { background: #FFE8F4 !important; border-color: rgba(200,0,106,0.3) !important; }
  @media (max-width: 768px) { .nav-links { display: none !important; } .earn-grid { grid-template-columns: 1fr 1fr !important; } .body-grid { grid-template-columns: 1fr !important; } .nav-name { display: none !important; } }
`

const wBadge: Record<string, { bg: string; c: string; l: string }> = {
  pending:  { bg:'#FFF4E0', c:'#B8730A', l:'Awaiting review' },
  approved: { bg:'#E5F0FF', c:'#1E5FBF', l:'Approved · processing' },
  paid:     { bg:'#E4F6EA', c:'#1A6030', l:'Paid ✓' },
  rejected: { bg:'#FDE8E8', c:'#C0392B', l:'Rejected' },
}

export default function SellerEarnings() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [bank, setBank] = useState<{ name: string | null; sort: string | null; acct: string | null }>({ name: null, sort: null, acct: null })
  const [bankSaved, setBankSaved] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [wError, setWError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Direct-table read now that RLS is in place — bypasses the old
  // get_my_withdrawals RPC that wasn't returning the receipt_url/paid_at
  // columns needed for the "Paid" UI. eq(user_id, uid) is enforced twice:
  // once here for clarity, and once by the "users view own withdrawals"
  // policy on the table.
  const loadWithdrawals = async (uid: string) => {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', uid)
      .order('requested_at', { ascending: false })
    if (error) {
      console.error('[SellerEarnings] loadWithdrawals error:', { code: error.code, message: error.message, details: error.details, hint: error.hint, raw: JSON.stringify(error) })
      return
    }
    setWithdrawals((data as WithdrawalRequest[]) || [])
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      // Bank details aren't part of get_my_profile and aren't granted for direct
      // reads post-lockdown — read the caller's own full row via the definer RPC
      // to know whether a withdrawal can be requested.
      const { data: bank } = await supabase.rpc('get_my_profile_full')
      setBank({ name: bank?.bank_account_name ?? null, sort: bank?.bank_sort_code ?? null, acct: bank?.bank_account_number ?? null })
      setBankSaved(!!(bank?.bank_account_name && bank?.bank_sort_code && bank?.bank_account_number))
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name)')
        .eq('seller_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      await loadWithdrawals(user.id)
      setLoading(false)
    }
    getData()
  }, [router])

  const submitWithdrawal = async (amount: number): Promise<{ ok: boolean; error?: string }> => {
    setWError(''); setRequesting(true)
    const { error } = await supabase.rpc('request_withdrawal', { p_amount: amount })
    setRequesting(false)
    if (error) {
      console.error('[SellerEarnings] request_withdrawal error:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
      return { ok: false, error: error.message.replace(/^.*?:\s*/, '') }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadWithdrawals(user.id)
    return { ok: true }
  }

  const openModal = () => { setWError(''); setSubmitted(false); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setWError('') }
  // Auto-dismiss the "submitted" toast a few seconds after the modal closes.
  useEffect(() => {
    if (submitted && !modalOpen) {
      const t = setTimeout(() => setSubmitted(false), 3000)
      return () => clearTimeout(t)
    }
  }, [submitted, modalOpen])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const nav = (
    <nav style={{background:'var(--bg-card)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:62}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const a = t.h === '/seller/earnings'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:62, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:a ? 700 : 500, color:a ? '#C8006A' : 'var(--text-primary)', borderBottom:a ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:12, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{display:'flex', alignItems:'center', gap:9}}>
            <div style={{width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#8B0047)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>{profile?.full_name?.[0]?.toUpperCase() || 'S'}</div>
            <span className="nav-name" style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>{profile?.full_name || 'Seller'}</span>
          </div>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid rgba(200,0,106,0.15)', borderRadius:8, fontSize:12, fontWeight:600, color:'#C8006A', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{css}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:28, width:150, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:240, borderRadius:6, marginBottom:24}}/>
        <div className="earn-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:28}}>{Array.from({length:3}).map((_, i) => <div key={i} className="skel" style={{height:96, borderRadius:18}}/>)}</div>
        <div className="skel" style={{height:320, borderRadius:20}}/>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <div style={{background:'var(--bg-card)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const totalEarned = orders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  const totalCommission = orders.reduce((sum, o) => sum + parseFloat(o.platform_commission || '0'), 0)
  // Money already tied up in a pending/approved/paid withdrawal isn't available again.
  const activeWithdrawn = withdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  // Split the "tied up" amount into buckets so the summary can distinguish
  // "already left our platform" (paid) from "still queued" (pending / approved).
  const totalPaid    = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const totalPending = withdrawals.filter(w => w.status === 'pending' || w.status === 'approved').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const available = Math.max(0, totalEarned - activeWithdrawn)
  // Consumer-app-standard £5 floor on manual withdrawals so admin isn't
  // reviewing sub-pound requests.
  const MIN_WITHDRAWAL = 5
  const canWithdraw = available >= MIN_WITHDRAWAL && bankSaved && !requesting

  const now = new Date()
  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthEarned = thisMonthOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{css}</style>{nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,28px)', fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>Earnings</h1>
          <p style={{fontSize:14, color:'rgba(26,26,26,0.6)'}}>Your full payout history from delivered orders.</p>
        </div>

        <div className="earn-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>
          <div style={{background:'linear-gradient(135deg,#C8006A,#8B0047)', borderRadius:18, padding:'22px', boxShadow:'0 4px 20px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Total earned</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#fff', letterSpacing:'-0.02em'}}>£{totalEarned.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:6}}>{orders.length} delivered {orders.length === 1 ? 'order' : 'orders'}</div>
          </div>
          <div style={{background:'var(--bg-card)', borderRadius:18, padding:'22px', border:'1.5px solid rgba(200,0,106,0.07)', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>This month</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em'}}>£{thisMonthEarned.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(26,26,26,0.5)', marginTop:6}}>{thisMonthOrders.length} {thisMonthOrders.length === 1 ? 'order' : 'orders'} this month</div>
          </div>
          <div style={{background:'var(--bg-card)', borderRadius:18, padding:'22px', border:'1.5px solid rgba(200,0,106,0.07)', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Platform fees paid</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em'}}>£{totalCommission.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(26,26,26,0.5)', marginTop:6}}>12% commission</div>
          </div>
        </div>

        <div className="body-grid" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start'}}>
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:'1px solid var(--bg-secondary)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>Payout history</h2>
            </div>
            {orders.length === 0 ? (
              <div style={{padding:'48px 20px', textAlign:'center'}}>
                <div style={{fontSize:40, marginBottom:12}}>💳</div>
                <p style={{fontSize:14, color:'rgba(26,26,26,0.6)'}}>No payouts yet. Earnings appear here once an order is delivered.</p>
              </div>
            ) : orders.map((o, i) => (
              <div key={o.id} className="erow" style={{display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:i < orders.length - 1 ? '1px solid var(--bg-secondary)' : 'none', transition:'background 0.12s'}}>
                <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>🍽️</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                  <div style={{fontSize:12, color:'rgba(26,26,26,0.5)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#2DA84E'}}>+£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                  <div style={{fontSize:11, color:'rgba(26,26,26,0.5)'}}>after £{parseFloat(o.platform_commission || '0').toFixed(2)} fee</div>
                </div>
              </div>
            ))}
          </div>

          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', padding:'22px'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Available to withdraw</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:32, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:14}}>£{available.toFixed(2)}</div>

            {/* Cash-flow summary — pins the four numbers together so it's
                obvious that Available = Earned − (Paid + Pending). Kept in
                a compact 2-row grid so it fits the sidebar. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(26,26,26,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total earned</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>£{totalEarned.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(26,26,26,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total withdrawn</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#1A6030', marginTop: 2 }}>£{totalPaid.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(26,26,26,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#C8006A', marginTop: 2 }}>£{available.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(26,26,26,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#B8730A', marginTop: 2 }}>£{totalPending.toFixed(2)}</div>
              </div>
            </div>

            {wError && <div style={{background:'#FFE8F4', border:'1px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'10px 12px', marginBottom:12, fontSize:12.5, color:'#C8006A', fontWeight:600}}>{wError}</div>}
            {available > 0 && (
              <button onClick={openModal} disabled={!canWithdraw} style={{width:'100%', height:46, background:canWithdraw ? '#C8006A' : '#E7D6E0', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:canWithdraw ? 'pointer' : 'not-allowed', marginBottom:10}}>Request withdrawal</button>
            )}
            {!bankSaved && <p style={{fontSize:12, color:'rgba(26,26,26,0.6)', lineHeight:1.5, marginBottom:14}}>Add your bank details in <Link href="/seller/profile" style={{color:'#C8006A', fontWeight:600}}>your profile</Link> to request a withdrawal.</p>}
            {bankSaved && available > 0 && available < MIN_WITHDRAWAL && <p style={{fontSize:12, color:'#B8730A', fontWeight:600, marginBottom:14, lineHeight:1.5}}>Minimum withdrawal is £{MIN_WITHDRAWAL.toFixed(2)} (you have £{available.toFixed(2)} available).</p>}
            {bankSaved && available < 0.01 && <p style={{fontSize:12, color:'rgba(26,26,26,0.5)', marginBottom:14}}>No funds available to withdraw right now.</p>}

            <div style={{borderTop:'1px solid var(--bg-secondary)', paddingTop:16}}>
              <div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Withdrawal requests</div>
              {withdrawals.length === 0 ? (
                <p style={{fontSize:12.5, color:'rgba(26,26,26,0.5)', lineHeight:1.5}}>No withdrawals yet. Payouts are sent to your bank manually within 1–3 working days of approval.</p>
              ) : withdrawals.map(w => {
                const badge = wBadge[w.status] || wBadge.pending
                return (
                  <div key={w.id} style={{padding:'10px 0', borderBottom:'1px solid var(--bg-secondary)'}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10}}>
                      <div>
                        <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>£{parseFloat(w.amount || '0').toFixed(2)}</div>
                        <div style={{fontSize:11, color:'rgba(26,26,26,0.5)'}}>{new Date(w.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                      </div>
                      <span style={{background:badge.bg, color:badge.c, fontSize:10.5, fontWeight:800, padding:'3px 9px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.03em', flexShrink:0}}>{badge.l}</span>
                    </div>
                    {w.status === 'rejected' && (w.rejection_reason || w.admin_note) && <div style={{fontSize:11, color:'#C0392B', marginTop:4, lineHeight:1.5}}><strong>Reason:</strong> {w.rejection_reason || w.admin_note}</div>}
                    {w.status === 'paid' && (
                      <div style={{marginTop:6, background:'#E4F6EA', border:'1px solid rgba(26,96,48,0.25)', borderRadius:8, padding:'10px 12px'}}>
                        <div style={{fontSize:11.5, color:'#1A6030', fontWeight:700}}>✅ Paid on {w.paid_at ? new Date(w.paid_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : new Date(w.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                        {w.receipt_url && (
                          <a href={w.receipt_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:5, marginTop:6, height:32, padding:'0 12px', background:'#1A6030', color:'#fff', borderRadius:8, fontSize:11.5, fontWeight:700, textDecoration:'none'}}>
                            ↓ Download receipt
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <WithdrawalRequestModal
        isOpen={modalOpen}
        available={available}
        bank={bank}
        bankSaved={bankSaved}
        profileHref="/seller/profile"
        onSubmit={submitWithdrawal}
        onClose={closeModal}
        onSuccess={() => setSubmitted(true)}
      />

      {submitted && !modalOpen && (
        <div role="status" style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:9998, background:'#E4F6EA', border:'1.5px solid #1A6030', color:'#1A6030', borderRadius:100, padding:'12px 22px', fontSize:13.5, fontWeight:700, boxShadow:'0 10px 30px rgba(26,96,48,0.3)'}}>
          ✅ Withdrawal request submitted
        </div>
      )}
    </div>
  )
}
