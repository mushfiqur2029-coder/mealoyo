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
  .skelD { background: linear-gradient(90deg, var(--bg-card) 0%, var(--border-subtle) 50%, var(--bg-card) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: var(--text-primary) !important; }
  .hrow:hover { background: var(--bg-card) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  .prim:hover { background: #A00055 !important; }
  .chip { transition: all 0.14s; }
  .chip:hover { border-color: rgba(200,0,106,0.5) !important; color: var(--text-primary) !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 560px) { .hstats { grid-template-columns: 1fr 1fr !important; } .route-cell { display: none !important; } }
`

type Range = 'all' | '7d' | '30d'
const RANGES: { v: Range; l: string }[] = [
  { v: 'all', l: 'All time' },
  { v: '30d', l: 'Last 30 days' },
  { v: '7d', l: 'Last 7 days' },
]

export default function DriverHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [range, setRange] = useState<Range>('all')
  const [loading, setLoading] = useState(true)
  // Captured once per mount so the date-range cutoff stays stable across renders
  // (calling Date.now() during render is impure).
  const [now] = useState(() => Date.now())
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
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={30} themed/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/driver/history'
            return <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--text-primary)'}}>{profile?.full_name?.[0]?.toUpperCase() || 'D'}</div>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-secondary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
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
    <div style={{minHeight:'100vh', background:'var(--bg-page)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <style>{dark}</style>
      <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', border:'1px solid rgba(200,0,106,0.25)'}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,rgba(200,0,106,0.25),rgba(200,0,106,0.08))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.7, marginBottom:24}}>Your driver account is under review. We&apos;ll notify you within <strong style={{color:'#C8006A'}}>24–48 hours</strong>.</p>
        <button onClick={signOut} className="prim" style={{height:46, padding:'0 26px', background:'#C8006A', color:'var(--text-primary)', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Sign out</button>
      </div>
    </div>
  )

  // Date-range filter.
  const cutoffDays = range === '7d' ? 7 : range === '30d' ? 30 : null
  const filtered = cutoffDays == null ? orders : orders.filter(o => (now - new Date(o.created_at).getTime()) / 864e5 <= cutoffDays)

  // Driver's share is stored in driver_payout post-commission-split; legacy
  // pre-split rows still have driver_payout=0 so we fall back to delivery_fee.
  const driverFee = (o: Order) => {
    const payout = parseFloat(o.driver_payout || '0')
    return payout > 0 ? payout : parseFloat(o.delivery_fee || '0')
  }
  const delivered = filtered.filter(o => o.status === 'delivered')
  const totalEarned = delivered.reduce((s, o) => s + driverFee(o), 0)
  const cancelledCount = filtered.filter(o => o.status === 'cancelled').length

  const stats = [
    { value:String(delivered.length), label:'Completed', color:'var(--text-primary)' },
    { value:`£${totalEarned.toFixed(2)}`, label:'Total earned', color:'#34D399' },
    { value:String(cancelledCount), label:'Cancelled', color:'#FF8A8A' },
  ]

  // Group into a timeline by calendar day (already sorted newest-first).
  const groups: { key: string; label: string; items: Order[] }[] = []
  for (const o of filtered) {
    const d = new Date(o.created_at)
    const key = d.toDateString()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yest = new Date(today); yest.setDate(today.getDate() - 1)
    const label = key === today.toDateString() ? 'Today' : key === yest.toDateString() ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(o)
    else groups.push({ key, label, items: [o] })
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Delivery history</h1>
          <p style={{fontSize:14, color:'var(--text-secondary)'}}>{filtered.length} {filtered.length === 1 ? 'drop' : 'drops'} {range === 'all' ? 'completed or cancelled' : `in the ${range === '7d' ? 'last 7 days' : 'last 30 days'}`}.</p>
        </div>

        {/* Date-range filter */}
        <div className="fade-up" style={{display:'flex', gap:8, marginBottom:20, flexWrap:'wrap'}}>
          {RANGES.map(r => {
            const on = range === r.v
            return (
              <button key={r.v} className="chip" onClick={() => setRange(r.v)} style={{height:36, padding:'0 16px', borderRadius:100, fontSize:13, fontWeight:700, cursor:'pointer', border:`1px solid ${on ? '#C8006A' : 'var(--border-subtle)'}`, background:on ? '#C8006A' : 'transparent', color:on ? '#fff' : 'var(--text-secondary)'}}>{r.l}</button>
            )
          })}
        </div>

        <div className="hstats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', padding:'64px 20px', textAlign:'center'}}>
            <div style={{fontSize:48, marginBottom:16}}>🚴</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>{range === 'all' ? 'No deliveries yet' : 'Nothing in this range'}</h2>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>{range === 'all' ? 'Completed and cancelled drops will show up here.' : 'Try widening the date range above.'}</p>
          </div>
        ) : groups.map(group => {
          const dayTotal = group.items.filter(o => o.status === 'delivered').reduce((s, o) => s + driverFee(o), 0)
          return (
            <div key={group.key} className="fade-up" style={{marginBottom:22}}>
              {/* Timeline day header */}
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)'}}>{group.label}</h2>
                <div style={{flex:1, height:1, background:'var(--border-subtle)'}}/>
                <span style={{fontFamily:'Georgia,serif', fontSize:13, fontWeight:700, color:'#34D399'}}>£{dayTotal.toFixed(2)}</span>
              </div>
              {/* Timeline rail */}
              <div style={{position:'relative', paddingLeft:26}}>
                <div style={{position:'absolute', left:7, top:6, bottom:6, width:2, background:'var(--border-subtle)'}}/>
                {group.items.map(o => {
                  const isDelivered = o.status === 'delivered'
                  const dropTo = o.delivery_type === 'collect' ? 'Collection' : (o.delivery_address?.split(',')[0] || 'Customer')
                  return (
                    <div key={o.id} style={{position:'relative', marginBottom:10}}>
                      <span style={{position:'absolute', left:-23, top:22, width:12, height:12, borderRadius:'50%', background:'var(--bg-page)', border:`2.5px solid ${isDelivered ? '#34D399' : '#FF8A8A'}`, zIndex:1}}/>
                      <div className="hrow" style={{display:'flex', alignItems:'center', gap:14, padding:'13px 16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:14, transition:'background 0.12s'}}>
                        <div style={{width:44, height:44, borderRadius:12, background:isDelivered ? 'rgba(52,211,153,0.12)' : 'rgba(255,138,138,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>
                          {cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}
                        </div>
                        <div style={{minWidth:0, width:200, flexShrink:0}}>
                          <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Delivery'}</div>
                          <div style={{fontSize:12, color:'var(--text-secondary)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</div>
                        </div>
                        <div className="route-cell" style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, color:'var(--text-secondary)', fontSize:13, fontWeight:500}}>
                          <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>🍳 Kitchen</span>
                          <span style={{color:'#C8006A', flexShrink:0}}>→</span>
                          <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>📍 {dropTo}</span>
                        </div>
                        <div style={{textAlign:'right', flexShrink:0}}>
                          <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:isDelivered ? '#34D399' : 'var(--text-secondary)'}}>£{driverFee(o).toFixed(2)}</div>
                          <span style={{fontSize:10.5, fontWeight:700, color:isDelivered ? '#34D399' : '#FF8A8A', textTransform:'uppercase', letterSpacing:'0.04em'}}>{o.status}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
