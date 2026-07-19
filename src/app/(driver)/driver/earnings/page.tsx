'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import WeeklyBarChart from '@/components/WeeklyBarChart'
import type { Order, Profile, WithdrawalRequest } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/driver/dashboard' },
  { l:'My earnings', h:'/driver/earnings' },
  { l:'History', h:'/driver/history' },
]

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
  .erow:hover { background: var(--bg-card) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  .prim:hover { background: #A00055 !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .earn-grid { grid-template-columns: 1fr 1fr !important; } .bottom-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .earn-grid { grid-template-columns: 1fr !important; } }
`

const wBadge: Record<string, { bg: string; c: string; l: string }> = {
  pending:  { bg:'rgba(184,115,10,0.18)', c:'#FBBF24', l:'Awaiting review' },
  approved: { bg:'rgba(59,130,246,0.18)', c:'#93C5FD', l:'Approved · processing' },
  paid:     { bg:'rgba(45,168,78,0.18)', c:'#34D399', l:'Paid ✓' },
  rejected: { bg:'rgba(192,57,43,0.2)',  c:'#FF8A8A', l:'Rejected' },
}

export default function DriverEarnings() {
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

  const loadWithdrawals = async () => {
    const { data } = await supabase.rpc('get_my_withdrawals')
    setWithdrawals((data as WithdrawalRequest[]) || [])
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      // Bank columns aren't granted for direct reads post-lockdown — read the
      // caller's own full row via the definer RPC.
      const { data: bank } = await supabase.rpc('get_my_profile_full')
      setBank({ name: bank?.bank_account_name ?? null, sort: bank?.bank_sort_code ?? null, acct: bank?.bank_account_number ?? null })
      setBankSaved(!!(bank?.bank_account_name && bank?.bank_sort_code && bank?.bank_account_number))
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name)')
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      await loadWithdrawals()
      setLoading(false)
    }
    getData()
  }, [router])

  const handleRequestWithdrawal = async (amount: number) => {
    setWError(''); setRequesting(true)
    const { error } = await supabase.rpc('request_withdrawal', { p_amount: amount })
    if (error) { setWError(error.message.replace(/^.*?:\s*/, '')); setRequesting(false); return }
    await loadWithdrawals()
    setRequesting(false)
    setSubmitted(true)
  }

  const openModal = () => { setWError(''); setSubmitted(false); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setSubmitted(false); setWError('') }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={30} themed/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/driver/earnings'
            return <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <NavAvatar url={profile?.avatar_url} initial={profile?.full_name?.[0]?.toUpperCase() || 'D'} href="/driver/profile"/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:200, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:260, borderRadius:6, marginBottom:26}}/>
        <div className="earn-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:100, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:300, borderRadius:18}}/>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <style>{dark}</style>
      <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', border:'1px solid rgba(200,0,106,0.25)'}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,rgba(200,0,106,0.25),rgba(200,0,106,0.08))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.7, marginBottom:24}}>Your driver account is under review. We&apos;ll notify you within <strong style={{color:'#C8006A'}}>24–48 hours</strong>.</p>
        <button onClick={signOut} className="prim" style={{height:46, padding:'0 26px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Sign out</button>
      </div>
    </div>
  )

  // Driver's share is stored in driver_payout post-commission-split; legacy
  // pre-split rows still have driver_payout=0 so we fall back to delivery_fee.
  const fee = (o: Order) => {
    const payout = parseFloat(o.driver_payout || '0')
    return payout > 0 ? payout : parseFloat(o.delivery_fee || '0')
  }
  const totalEarned = orders.reduce((s, o) => s + fee(o), 0)
  const activeWithdrawn = withdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const totalPaid    = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const totalPending = withdrawals.filter(w => w.status === 'pending' || w.status === 'approved').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const available = Math.max(0, totalEarned - activeWithdrawn)
  const MIN_WITHDRAWAL = 5
  const canWithdraw = available >= MIN_WITHDRAWAL && bankSaved && !requesting
  const now = new Date()
  const thisMonthOrders = orders.filter(o => { const d = new Date(o.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const thisMonthEarned = thisMonthOrders.reduce((s, o) => s + fee(o), 0)
  const avgPerDrop = orders.length ? totalEarned / orders.length : 0

  const cards = [
    { label:'This month', value:`£${thisMonthEarned.toFixed(2)}`, color:'var(--text-primary)' },
    { label:'Total drops', value:String(orders.length), color:'var(--text-primary)' },
    { label:'Avg per drop', value:`£${avgPerDrop.toFixed(2)}`, color:'var(--text-primary)' },
  ]

  // Last 7 days, oldest → newest, for the weekly chart + daily breakdown.
  const days = Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d })
  const weekRows = days.map(d => {
    const next = new Date(d); next.setDate(d.getDate() + 1)
    const dayOrders = orders.filter(o => { const od = new Date(o.created_at); return od >= d && od < next })
    return { date: d, label: d.toLocaleDateString('en-GB', { weekday: 'short' }), full: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), drops: dayOrders.length, value: dayOrders.reduce((s, o) => s + fee(o), 0) }
  })
  const weekTotal = weekRows.reduce((s, r) => s + r.value, 0)

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>My earnings</h1>
          <p style={{fontSize:14, color:'var(--text-secondary)'}}>Your full payout history from completed drops.</p>
        </div>

        <div className="earn-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          <div style={{background:'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)', borderRadius:16, padding:'20px', boxShadow:'0 10px 30px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.85)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7}}>Total earned</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{totalEarned.toFixed(2)}</div>
          </div>
          {cards.map((c, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'20px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7}}>{c.label}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:c.color, letterSpacing:'-0.02em', lineHeight:1}}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Weekly earnings chart + daily breakdown */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', padding:'22px 22px 20px', marginBottom:20}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:18, flexWrap:'wrap'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Last 7 days</h2>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10.5, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em'}}>Week total</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#34D399', lineHeight:1}}>£{weekTotal.toFixed(2)}</div>
            </div>
          </div>
          <WeeklyBarChart bars={weekRows.map(r => ({ label: r.label, value: r.value }))} />

          {/* Daily breakdown table */}
          <div style={{marginTop:22, borderTop:'1px solid var(--bg-secondary)', paddingTop:6}}>
            {weekRows.slice().reverse().map((r, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'11px 0', borderBottom:i < 6 ? '1px solid var(--bg-card)' : 'none'}}>
                <div style={{fontSize:13.5, fontWeight:600, color:'var(--text-primary)'}}>{r.full}</div>
                <div style={{display:'flex', alignItems:'center', gap:16}}>
                  <span style={{fontSize:12.5, color:'var(--text-secondary)'}}>{r.drops} {r.drops === 1 ? 'drop' : 'drops'}</span>
                  <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:r.value > 0 ? '#34D399' : 'var(--text-secondary)', minWidth:64, textAlign:'right'}}>£{r.value.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bottom-grid" style={{display:'grid', gridTemplateColumns:'minmax(0,1.7fr) minmax(0,320px)', gap:20, alignItems:'start'}}>
          {/* Payout history */}
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:'1px solid var(--bg-secondary)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>Payout history</h2>
              <span style={{fontSize:12, color:'var(--text-secondary)', fontWeight:600}}>{orders.length} {orders.length === 1 ? 'payout' : 'payouts'}</span>
            </div>
            {orders.length === 0 ? (
              <div style={{padding:'52px 20px', textAlign:'center'}}>
                <div style={{fontSize:42, marginBottom:12}}>💳</div>
                <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6}}>No payouts yet. Earnings appear here once you complete a drop.</p>
              </div>
            ) : orders.map((o, i) => (
              <div key={o.id} className="erow" style={{display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:i < orders.length - 1 ? '1px solid var(--bg-card)' : 'none', transition:'background 0.12s'}}>
                <div style={{width:42, height:42, borderRadius:11, background:'rgba(52,211,153,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>🚴</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Delivery'}</div>
                  <div style={{fontSize:12, color:'var(--text-secondary)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                </div>
                <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#34D399', flexShrink:0}}>+£{fee(o).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Withdrawal */}
          <div className="fade-up" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:16}}>
            <div style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', padding:'22px'}}>
              <div style={{fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Available to withdraw</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:34, fontWeight:700, color:'#34D399', letterSpacing:'-0.02em', lineHeight:1, marginBottom:14}}>£{available.toFixed(2)}</div>

              {/* Cash-flow summary — same 2×2 grid as seller, dark-theme
                  palette. Available = Earned − (Paid + Pending). */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total earned</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>£{totalEarned.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Withdrawn</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#34D399', marginTop: 2 }}>£{totalPaid.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#34D399', marginTop: 2 }}>£{available.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: 14.5, fontWeight: 700, color: '#FBBF24', marginTop: 2 }}>£{totalPending.toFixed(2)}</div>
                </div>
              </div>

              {wError && <div style={{background:'rgba(200,0,106,0.12)', border:'1px solid rgba(200,0,106,0.35)', borderRadius:10, padding:'10px 12px', marginBottom:12, fontSize:12.5, color:'#FF8AC4', fontWeight:600}}>{wError}</div>}
              {available > 0 && (
                <button onClick={openModal} disabled={!canWithdraw} className="prim" style={{width:'100%', height:46, background:canWithdraw ? '#C8006A' : 'var(--border-subtle)', color:canWithdraw ? '#fff' : 'var(--text-secondary)', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:canWithdraw ? 'pointer' : 'not-allowed', marginBottom:12, transition:'background 0.14s'}}>Request withdrawal</button>
              )}
              {!bankSaved && <p style={{fontSize:12, color:'var(--text-secondary)', lineHeight:1.55, marginBottom:0}}>Add your bank details in <Link href="/driver/profile" style={{color:'#FF8AC4', fontWeight:600}}>your profile</Link> to request a withdrawal.</p>}
              {bankSaved && available > 0 && available < MIN_WITHDRAWAL && <p style={{fontSize:12, color:'#FBBF24', fontWeight:600, lineHeight:1.55, marginBottom:0}}>Minimum withdrawal is £{MIN_WITHDRAWAL.toFixed(2)} (you have £{available.toFixed(2)} available).</p>}
              {bankSaved && available < 0.01 && <p style={{fontSize:12, color:'var(--text-secondary)', marginBottom:0}}>No funds available to withdraw right now.</p>}
              {bankSaved && available >= 0.01 && (
                <div style={{display:'flex', alignItems:'flex-start', gap:8, padding:'12px 14px', background:'var(--bg-card)', borderRadius:12, border:'1px solid var(--bg-secondary)'}}>
                  <span style={{fontSize:14, flexShrink:0}}>🔒</span>
                  <p style={{fontSize:12, color:'var(--text-secondary)', lineHeight:1.55}}>Payouts are sent to your bank manually within 1–3 working days of approval.</p>
                </div>
              )}
            </div>
            <div style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--bg-secondary)', padding:'18px 20px'}}>
              <div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Withdrawal requests</div>
              {withdrawals.length === 0 ? (
                <p style={{fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.5}}>No withdrawals yet.</p>
              ) : withdrawals.map(w => {
                const badge = wBadge[w.status] || wBadge.pending
                return (
                  <div key={w.id} style={{padding:'10px 0', borderTop:'1px solid var(--bg-card)'}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10}}>
                      <div>
                        <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>£{parseFloat(w.amount || '0').toFixed(2)}</div>
                        <div style={{fontSize:11, color:'var(--text-secondary)'}}>{new Date(w.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                      </div>
                      <span style={{background:badge.bg, color:badge.c, fontSize:10.5, fontWeight:800, padding:'3px 9px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.03em', flexShrink:0}}>{badge.l}</span>
                    </div>
                    {w.status === 'rejected' && (w.rejection_reason || w.admin_note) && <div style={{fontSize:11, color:'#FF8A8A', marginTop:4, lineHeight:1.5}}><strong>Reason:</strong> {w.rejection_reason || w.admin_note}</div>}
                    {w.status === 'paid' && (
                      <div style={{marginTop:6, background:'rgba(45,168,78,0.14)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:8, padding:'10px 12px'}}>
                        <div style={{fontSize:11.5, color:'#34D399', fontWeight:700}}>✅ Paid on {w.paid_at ? new Date(w.paid_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : new Date(w.requested_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                        {w.receipt_url && (
                          <a href={w.receipt_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:5, marginTop:6, height:32, padding:'0 12px', background:'#2DA84E', color:'#fff', borderRadius:8, fontSize:11.5, fontWeight:700, textDecoration:'none'}}>
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

      {modalOpen && (
        <div onClick={closeModal} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'#161616', borderRadius:20, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto', border:'1px solid var(--border-subtle)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
            {submitted ? (
              <div style={{padding:'40px 32px', textAlign:'center'}}>
                <div style={{width:64, height:64, borderRadius:'50%', background:'rgba(45,168,78,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 18px'}}>✅</div>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Withdrawal request submitted</h2>
                <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:24}}>Admin will review and process within 2–3 business days. You&apos;ll see the status update here once it&apos;s paid.</p>
                <button onClick={closeModal} className="prim" style={{height:46, padding:'0 32px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>Done</button>
              </div>
            ) : (
              <div style={{padding:'26px 28px 28px'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:21, fontWeight:700, color:'var(--text-primary)'}}>Withdraw funds</h2>
                  <button onClick={closeModal} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', fontSize:15, color:'var(--text-secondary)', cursor:'pointer'}}>✕</button>
                </div>

                <div style={{background:'var(--bg-card)', borderRadius:14, padding:'16px 18px', marginBottom:18, border:'1px solid var(--bg-secondary)'}}>
                  <div style={{fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>Amount to withdraw</div>
                  <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#34D399', letterSpacing:'-0.02em'}}>£{available.toFixed(2)}</div>
                </div>

                {!bankSaved ? (
                  <div style={{background:'rgba(184,115,10,0.14)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:12, padding:'14px 16px', marginBottom:18}}>
                    <p style={{fontSize:13, color:'#FBBF24', fontWeight:600, lineHeight:1.5, marginBottom:8}}>Please add your bank details in Profile first.</p>
                    <Link href="/driver/profile" style={{fontSize:13, color:'#FF8AC4', fontWeight:700, textDecoration:'underline'}}>Go to Profile settings →</Link>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Payment goes to</div>
                    {[
                      { l:'Account holder name', v:bank.name },
                      { l:'Sort code', v:bank.sort },
                      { l:'Account number', v:bank.acct },
                    ].map(f => (
                      <div key={f.l} style={{marginBottom:12}}>
                        <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:5}}>{f.l}</label>
                        <input value={f.v || ''} readOnly style={{width:'100%', height:42, border:'1px solid var(--border-subtle)', borderRadius:10, padding:'0 14px', fontSize:14, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'not-allowed'}}/>
                      </div>
                    ))}
                    <p style={{fontSize:11.5, color:'var(--text-secondary)', lineHeight:1.55, marginTop:6, marginBottom:18}}>Payments are only made to the account registered under your name. For security, bank details can only be changed in your <Link href="/driver/profile" style={{color:'#FF8AC4', fontWeight:600}}>Profile settings</Link>.</p>
                  </>
                )}

                {wError && <div style={{background:'rgba(200,0,106,0.12)', border:'1px solid rgba(200,0,106,0.35)', borderRadius:10, padding:'10px 12px', marginBottom:14, fontSize:12.5, color:'#FF8AC4', fontWeight:600}}>{wError}</div>}

                <button onClick={() => handleRequestWithdrawal(available)} disabled={!bankSaved || requesting || available < 0.01} className="prim" style={{width:'100%', height:48, background:(!bankSaved || requesting || available < 0.01) ? 'var(--border-subtle)' : '#C8006A', color:(!bankSaved || requesting || available < 0.01) ? 'var(--text-secondary)' : '#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:(!bankSaved || requesting || available < 0.01) ? 'not-allowed' : 'pointer'}}>{requesting ? 'Submitting…' : 'Request withdrawal'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
