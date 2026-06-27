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
]

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

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
  .hrow:hover { background: rgba(255,255,255,0.04) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  .prim:hover { background: #A00055 !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 560px) { .hstats { grid-template-columns: 1fr 1fr !important; } .route-cell { display: none !important; } }
`

export default function DriverHistory() {
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
        .select('*, listings(name,cuisine)')
        .eq('driver_id', user.id)
        .in('status', ['delivered', 'cancelled'])
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
            const active = t.h === '/driver/history'
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
        <div className="skelD" style={{height:28, width:220, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:250, borderRadius:6, marginBottom:26}}/>
        <div className="hstats" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>{Array.from({length:3}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:320, borderRadius:18}}/>
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

  const delivered = orders.filter(o => o.status === 'delivered')
  const totalEarned = delivered.reduce((s, o) => s + parseFloat(o.delivery_fee || '0'), 0)
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  const stats = [
    { value:String(delivered.length), label:'Completed', color:'#fff' },
    { value:`£${totalEarned.toFixed(2)}`, label:'Total earned', color:'#34D399' },
    { value:String(cancelledCount), label:'Cancelled', color:'#FF8A8A' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>Delivery history</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.55)'}}>{orders.length} {orders.length === 1 ? 'drop' : 'drops'} completed or cancelled.</p>
        </div>

        <div className="hstats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
          <div style={{padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>All drops</h2>
          </div>
          {orders.length === 0 ? (
            <div style={{padding:'64px 20px', textAlign:'center'}}>
              <div style={{fontSize:48, marginBottom:16}}>🚴</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#fff', marginBottom:8}}>No deliveries yet</h2>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>Completed and cancelled drops will show up here.</p>
            </div>
          ) : orders.map((o, i) => {
            const isDelivered = o.status === 'delivered'
            const dropTo = o.delivery_type === 'collect' ? 'Collection' : (o.delivery_address?.split(',')[0] || 'Customer')
            return (
              <div key={o.id} className="hrow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 20px', borderBottom:i < orders.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition:'background 0.12s'}}>
                <div style={{width:44, height:44, borderRadius:12, background:isDelivered ? 'rgba(52,211,153,0.12)' : 'rgba(255,138,138,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>
                  {cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}
                </div>
                <div style={{minWidth:0, width:200, flexShrink:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Delivery'}</div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                </div>
                <div className="route-cell" style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, color:'rgba(255,255,255,0.55)', fontSize:13, fontWeight:500}}>
                  <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>🍳 Kitchen</span>
                  <span style={{color:'#C8006A', flexShrink:0}}>→</span>
                  <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>📍 {dropTo}</span>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:isDelivered ? '#34D399' : 'rgba(255,255,255,0.4)'}}>£{parseFloat(o.delivery_fee || '0').toFixed(2)}</div>
                  <span style={{fontSize:10.5, fontWeight:700, color:isDelivered ? '#34D399' : '#FF8A8A', textTransform:'uppercase', letterSpacing:'0.04em'}}>{o.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
