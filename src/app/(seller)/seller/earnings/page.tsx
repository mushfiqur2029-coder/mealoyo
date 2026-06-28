'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Profile } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
  { l:'Profile', h:'/seller/profile' },
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
  .erow:hover { background: #FFF5FA !important; }
  .signout:hover { background: #FFE8F4 !important; border-color: rgba(200,0,106,0.3) !important; }
  @media (max-width: 768px) { .nav-links { display: none !important; } .earn-grid { grid-template-columns: 1fr 1fr !important; } .body-grid { grid-template-columns: 1fr !important; } .nav-name { display: none !important; } }
`

export default function SellerEarnings() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name)')
        .eq('seller_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const nav = (
    <nav style={{background:'#fff', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:62}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const a = t.h === '/seller/earnings'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:62, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:a ? 700 : 500, color:a ? '#C8006A' : '#1A1A1A', borderBottom:a ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:12, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{display:'flex', alignItems:'center', gap:9}}>
            <div style={{width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#8B0047)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>{profile?.full_name?.[0]?.toUpperCase() || 'S'}</div>
            <span className="nav-name" style={{fontSize:13, fontWeight:600, color:'#1A1A1A'}}>{profile?.full_name || 'Seller'}</span>
          </div>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid rgba(200,0,106,0.15)', borderRadius:8, fontSize:12, fontWeight:600, color:'#C8006A', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
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
    <div style={{minHeight:'100vh', background:'#F8F0F4', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <div style={{background:'#fff', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const totalEarned = orders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  const totalCommission = orders.reduce((sum, o) => sum + parseFloat(o.platform_commission || '0'), 0)

  const now = new Date()
  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthEarned = thisMonthOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{css}</style>{nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,28px)', fontWeight:700, color:'#1A1A1A', marginBottom:4}}>Earnings</h1>
          <p style={{fontSize:14, color:'rgba(26,26,26,0.6)'}}>Your full payout history from delivered orders.</p>
        </div>

        <div className="earn-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>
          <div style={{background:'linear-gradient(135deg,#C8006A,#8B0047)', borderRadius:18, padding:'22px', boxShadow:'0 4px 20px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Total earned</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#fff', letterSpacing:'-0.02em'}}>£{totalEarned.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:6}}>{orders.length} delivered {orders.length === 1 ? 'order' : 'orders'}</div>
          </div>
          <div style={{background:'#fff', borderRadius:18, padding:'22px', border:'1.5px solid rgba(200,0,106,0.07)', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>This month</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{thisMonthEarned.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(26,26,26,0.5)', marginTop:6}}>{thisMonthOrders.length} {thisMonthOrders.length === 1 ? 'order' : 'orders'} this month</div>
          </div>
          <div style={{background:'#fff', borderRadius:18, padding:'22px', border:'1.5px solid rgba(200,0,106,0.07)', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Platform fees paid</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{totalCommission.toFixed(2)}</div>
            <div style={{fontSize:12, color:'rgba(26,26,26,0.5)', marginTop:6}}>12% commission</div>
          </div>
        </div>

        <div className="body-grid" style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start'}}>
          <div className="fade-up" style={{background:'#fff', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:'1px solid #F5F0F3'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A'}}>Payout history</h2>
            </div>
            {orders.length === 0 ? (
              <div style={{padding:'48px 20px', textAlign:'center'}}>
                <div style={{fontSize:40, marginBottom:12}}>💳</div>
                <p style={{fontSize:14, color:'rgba(26,26,26,0.6)'}}>No payouts yet. Earnings appear here once an order is delivered.</p>
              </div>
            ) : orders.map((o, i) => (
              <div key={o.id} className="erow" style={{display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:i < orders.length - 1 ? '1px solid #F5F0F3' : 'none', transition:'background 0.12s'}}>
                <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>🍽️</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                  <div style={{fontSize:12, color:'rgba(26,26,26,0.5)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#2DA84E'}}>+£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                  <div style={{fontSize:11, color:'rgba(26,26,26,0.5)'}}>after £{parseFloat(o.platform_commission || '0').toFixed(2)} fee</div>
                </div>
              </div>
            ))}
          </div>

          <div className="fade-up" style={{background:'#fff', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', padding:'22px'}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Available to withdraw</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:32, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:14}}>£{totalEarned.toFixed(2)}</div>
            <button onClick={() => alert('Instant payouts are coming soon. For now your earnings settle to your account on the weekly payout schedule below — no action needed.')} style={{width:'100%', height:46, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:18}}>Withdraw to bank</button>
            <div style={{borderTop:'1px solid #F5F0F3', paddingTop:16}}>
              <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Payout schedule</div>
              {[
                { icon:'🗓️', t:'Weekly payouts', s:'Every Monday' },
                { icon:'⚡', t:'Instant available', s:'1% fee · 30 min' },
                { icon:'🔒', t:'Secured transfers', s:'Bank-grade encryption' },
              ].map((r, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:11, marginBottom:i < 2 ? 12 : 0}}>
                  <div style={{width:34, height:34, borderRadius:9, background:'#FFF0F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0}}>{r.icon}</div>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color:'#1A1A1A'}}>{r.t}</div>
                    <div style={{fontSize:11.5, color:'rgba(26,26,26,0.5)'}}>{r.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
