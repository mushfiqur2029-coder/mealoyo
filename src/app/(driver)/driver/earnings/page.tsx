'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Profile } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/driver/dashboard' },
  { l:'My earnings', h:'/driver/earnings' },
  { l:'History', h:'/driver/history' },
  { l:'Profile', h:'/driver/profile' },
]

const dark = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmerD { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .skelD { background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: #fff !important; }
  .erow:hover { background: rgba(255,255,255,0.04) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  .prim:hover { background: #A00055 !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .earn-grid { grid-template-columns: 1fr 1fr !important; } .bottom-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .earn-grid { grid-template-columns: 1fr !important; } }
`

export default function DriverEarnings() {
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
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const nav = (
    <nav style={{background:'rgba(13,13,13,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={30} white/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/driver/earnings'
            return <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#fff' : 'rgba(255,255,255,0.5)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>{profile?.full_name?.[0]?.toUpperCase() || 'D'}</div>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.7)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
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
    <div style={{minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <style>{dark}</style>
      <div className="fade-up" style={{background:'rgba(255,255,255,0.05)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', border:'1px solid rgba(200,0,106,0.25)'}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,rgba(200,0,106,0.25),rgba(200,0,106,0.08))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#fff', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:24}}>Your driver account is under review. We&apos;ll notify you within <strong style={{color:'#C8006A'}}>24–48 hours</strong>.</p>
        <button onClick={signOut} className="prim" style={{height:46, padding:'0 26px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Sign out</button>
      </div>
    </div>
  )

  const fee = (o: Order) => parseFloat(o.delivery_fee || '0')
  const totalEarned = orders.reduce((s, o) => s + fee(o), 0)
  const now = new Date()
  const thisMonthOrders = orders.filter(o => { const d = new Date(o.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const thisMonthEarned = thisMonthOrders.reduce((s, o) => s + fee(o), 0)
  const avgPerDrop = orders.length ? totalEarned / orders.length : 0

  const cards = [
    { label:'This month', value:`£${thisMonthEarned.toFixed(2)}`, color:'#fff' },
    { label:'Total drops', value:String(orders.length), color:'#fff' },
    { label:'Avg per drop', value:`£${avgPerDrop.toFixed(2)}`, color:'#fff' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>My earnings</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.55)'}}>Your full payout history from completed drops.</p>
        </div>

        <div className="earn-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          <div style={{background:'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)', borderRadius:16, padding:'20px', boxShadow:'0 10px 30px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7}}>Total earned</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{totalEarned.toFixed(2)}</div>
          </div>
          {cards.map((c, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'20px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7}}>{c.label}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:c.color, letterSpacing:'-0.02em', lineHeight:1}}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="bottom-grid" style={{display:'grid', gridTemplateColumns:'minmax(0,1.7fr) minmax(0,320px)', gap:20, alignItems:'start'}}>
          {/* Payout history */}
          <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>Payout history</h2>
              <span style={{fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600}}>{orders.length} {orders.length === 1 ? 'payout' : 'payouts'}</span>
            </div>
            {orders.length === 0 ? (
              <div style={{padding:'52px 20px', textAlign:'center'}}>
                <div style={{fontSize:42, marginBottom:12}}>💳</div>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.6}}>No payouts yet. Earnings appear here once you complete a drop.</p>
              </div>
            ) : orders.map((o, i) => (
              <div key={o.id} className="erow" style={{display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:i < orders.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition:'background 0.12s'}}>
                <div style={{width:42, height:42, borderRadius:11, background:'rgba(52,211,153,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>🚴</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Delivery'}</div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                </div>
                <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#34D399', flexShrink:0}}>+£{fee(o).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Withdrawal */}
          <div className="fade-up" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:16}}>
            <div style={{background:'rgba(255,255,255,0.05)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', padding:'22px'}}>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Available to withdraw</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:34, fontWeight:700, color:'#34D399', letterSpacing:'-0.02em', lineHeight:1, marginBottom:18}}>£{totalEarned.toFixed(2)}</div>
              <button onClick={() => alert('Instant payouts are coming soon. For now your earnings settle to your account weekly — no action needed.')} className="prim" style={{width:'100%', height:46, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:12, transition:'background 0.14s'}}>Withdraw to bank</button>
              <div style={{display:'flex', alignItems:'flex-start', gap:8, padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)'}}>
                <span style={{fontSize:14, flexShrink:0}}>🔒</span>
                <p style={{fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.55}}>Instant payouts are coming soon. For now earnings settle to your account weekly.</p>
              </div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.07)', padding:'18px 20px'}}>
              <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:10}}>Payout schedule</div>
              {[['Frequency','Weekly'], ['Next payout','Monday'], ['Method','Bank transfer']].map(([k, v], i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'7px 0', borderTop:i ? '1px solid rgba(255,255,255,0.05)' : 'none'}}>
                  <span style={{fontSize:13, color:'rgba(255,255,255,0.5)'}}>{k}</span>
                  <span style={{fontSize:13, color:'#fff', fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
