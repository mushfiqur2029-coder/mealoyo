'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import type { Profile, Order } from '@/lib/types'

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
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulseG { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); } 70% { box-shadow: 0 0 0 7px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .skelD { background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: #fff !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .job:hover { border-color: rgba(200,0,106,0.5) !important; background: rgba(200,0,106,0.07) !important; transform: translateY(-2px); }
  .accept:hover { background: #2DA84E !important; transform: translateY(-1px); }
  .prim:hover { background: #A00055 !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } .two-col { grid-template-columns: 1fr !important; } .col-right { position: static !important; } }
  @media (max-width: 560px) { .dstats { grid-template-columns: 1fr 1fr !important; } }
`

export default function DriverDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data: avatarRow } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
      setAvatarUrl(avatarRow?.avatar_url || null)
      const { data } = await supabase.from('orders').select('*, listings(name,cuisine)').eq('driver_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  // Live dispatch isn't built yet, so there are no real jobs to fetch. The
  // refresh re-checks for newly available work (currently always none) without
  // ever showing fake jobs.
  const refreshJobs = async () => {
    setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('orders').select('*, listings(name,cuisine)').eq('driver_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false })
      setOrders(data || [])
    }
    setRefreshing(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const toggle = (
    <button onClick={() => setOnline(o => !o)} aria-label="Toggle availability" style={{display:'flex', alignItems:'center', gap:9, height:36, padding:'0 6px 0 12px', borderRadius:100, border:`1px solid ${online ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.14)'}`, background:online ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)', cursor:'pointer', transition:'all 0.2s'}}>
      <span style={{fontSize:12, fontWeight:700, color:online ? '#34D399' : 'rgba(255,255,255,0.5)'}}>{online ? 'Online' : 'Offline'}</span>
      <span style={{position:'relative', width:38, height:22, borderRadius:100, background:online ? '#2DA84E' : 'rgba(255,255,255,0.18)', transition:'background 0.2s', flexShrink:0}}>
        <span style={{position:'absolute', top:2, left:2, width:18, height:18, borderRadius:'50%', background:'#fff', transform:online ? 'translateX(16px)' : 'translateX(0)', transition:'transform 0.2s cubic-bezier(0.34,1.4,0.64,1)', animation:online ? 'pulseG 2s ease-out infinite' : 'none'}}/>
      </span>
    </button>
  )

  const nav = (
    <nav style={{background:'rgba(13,13,13,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={30} white/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/driver/dashboard'
            return <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#fff' : 'rgba(255,255,255,0.5)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          {toggle}
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || 'D'}/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.7)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:30, width:280, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:220, borderRadius:6, marginBottom:26}}/>
        <div className="dstats" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:104, borderRadius:16}}/>)}</div>
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20}}>
          <div className="skelD" style={{height:340, borderRadius:18}}/><div className="skelD" style={{height:280, borderRadius:18}}/>
        </div>
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

  // ── DERIVED ──
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const todayOrders = orders.filter(o => new Date(o.created_at) >= startOfToday)
  const monthOrders = orders.filter(o => new Date(o.created_at) >= startOfMonth)
  const fee = (o: Order) => parseFloat(o.delivery_fee || '0')
  const todayPay = todayOrders.reduce((s, o) => s + fee(o), 0)
  const monthPay = monthOrders.reduce((s, o) => s + fee(o), 0)
  const totalPay = orders.reduce((s, o) => s + fee(o), 0)
  const firstName = profile?.full_name?.split(' ')[0] || 'Driver'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { icon:'📦', value:String(todayOrders.length), label:'Drops today', color:'#fff' },
    { icon:'⏱️', value:online ? 'On shift' : '—', label:'Active time', color:'#fff' },
    { icon:'💷', value:`£${todayPay.toFixed(2)}`, label:"Today's pay", color:'#34D399' },
    { icon:'⭐', value:'—', label:'Your rating', color:'#FBBF24' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>{greeting}, {firstName} 🚴</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.55)'}}>{online ? "You're online — we'll surface jobs here as they come in near you." : "You're offline. Go online to start receiving jobs."}</p>
        </div>

        {/* Stats */}
        <div className="dstats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontSize:19, marginBottom:9}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,25px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20, alignItems:'start'}}>

          {/* Available jobs */}
          <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
            <div style={{padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#fff'}}>Available jobs near you</h2>
              {online && (
                <button onClick={refreshJobs} disabled={refreshing} className="accept" style={{height:32, padding:'0 14px', background:'rgba(200,0,106,0.16)', color:'#fff', border:'1px solid rgba(200,0,106,0.35)', borderRadius:8, fontSize:12, fontWeight:700, cursor:refreshing ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:6, transition:'all 0.14s'}}>
                  <span style={{display:'inline-block', animation:refreshing ? 'spin 0.8s linear infinite' : 'none'}}>↻</span>{refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              )}
            </div>
            {!online ? (
              <div style={{padding:'48px 24px', textAlign:'center'}}>
                <div style={{fontSize:40, marginBottom:12}}>🌙</div>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.6}}>You&apos;re offline. Flip the switch to go online and see jobs.</p>
              </div>
            ) : (
              <div style={{padding:'48px 24px', textAlign:'center'}}>
                <div style={{fontSize:40, marginBottom:12}}>🛵</div>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#fff', marginBottom:8}}>No jobs available right now</h3>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.6, maxWidth:340, margin:'0 auto 18px'}}>You&apos;re online and ready. New delivery jobs near you will appear here as soon as buyers place orders.</p>
                <button onClick={refreshJobs} disabled={refreshing} className="accept" style={{height:40, padding:'0 20px', background:'rgba(52,211,153,0.18)', color:'#34D399', border:'1px solid rgba(52,211,153,0.35)', borderRadius:10, fontSize:14, fontWeight:700, cursor:refreshing ? 'wait' : 'pointer', display:'inline-flex', alignItems:'center', gap:8, transition:'all 0.14s'}}>
                  <span style={{display:'inline-block', animation:refreshing ? 'spin 0.8s linear infinite' : 'none'}}>↻</span>{refreshing ? 'Checking…' : 'Check for jobs'}
                </button>
              </div>
            )}
          </div>

          {/* Earnings summary (sticky) */}
          <div className="col-right fade-up" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:16, minWidth:0}}>
            <div style={{background:'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)', borderRadius:20, padding:'24px', boxShadow:'0 12px 34px rgba(200,0,106,0.32)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Available balance</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'#fff', letterSpacing:'-0.03em', lineHeight:1, marginBottom:16}}>£{totalPay.toFixed(2)}</div>
              <div style={{display:'flex', gap:10, marginBottom:18}}>
                <div style={{flex:1, background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 12px'}}>
                  <div style={{fontSize:10.5, color:'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:3}}>This month</div>
                  <div style={{fontSize:15, color:'#fff', fontWeight:700, fontFamily:'Georgia,serif'}}>£{monthPay.toFixed(2)}</div>
                </div>
                <div style={{flex:1, background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 12px'}}>
                  <div style={{fontSize:10.5, color:'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:3}}>Total drops</div>
                  <div style={{fontSize:15, color:'#fff', fontWeight:700, fontFamily:'Georgia,serif'}}>{orders.length}</div>
                </div>
              </div>
              <button onClick={() => alert('Payouts are coming soon. Once Stripe Connect onboarding is live, your delivery earnings will pay out automatically to your bank.')} style={{width:'100%', height:46, background:'#fff', color:'#C8006A', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:10}}>Withdraw funds</button>
              <Link href="/driver/earnings" style={{display:'block', textAlign:'center', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)'}}>View earnings history →</Link>
            </div>

            <div style={{background:'rgba(255,255,255,0.04)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
              {[
                { l:'My earnings', s:'Payouts & balance', i:'💷', h:'/driver/earnings' },
                { l:'Delivery history', s:'Past drops', i:'🗂️', h:'/driver/history' },
              ].map((a, i) => (
                <Link key={i} href={a.h} className="job" style={{display:'flex', alignItems:'center', gap:13, padding:'14px 18px', borderBottom:i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', transition:'all 0.14s'}}>
                  <div style={{width:38, height:38, borderRadius:10, background:'rgba(200,0,106,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0}}>{a.i}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>{a.l}</div>
                    <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:1}}>{a.s}</div>
                  </div>
                  <span style={{fontSize:16, color:'#C8006A', flexShrink:0}}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
