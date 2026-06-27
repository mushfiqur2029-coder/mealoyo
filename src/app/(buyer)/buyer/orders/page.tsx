'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile, Order } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/buyer/dashboard' },
  { l:'Browse food', h:'/' },
  { l:'My orders', h:'/buyer/orders' },
  { l:'Saved', h:'/buyer/saved' },
  { l:'Profile', h:'/buyer/profile' },
]

const FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key:'all', label:'All', statuses:null },
  { key:'pending', label:'Pending', statuses:['pending','accepted'] },
  { key:'cooking', label:'Cooking', statuses:['cooking'] },
  { key:'ready', label:'Ready', statuses:['ready'] },
  { key:'on_way', label:'On its way', statuses:['picked_up'] },
  { key:'delivered', label:'Delivered', statuses:['delivered'] },
  { key:'cancelled', label:'Cancelled', statuses:['cancelled'] },
]

export default function BuyerOrders() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
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
        .select('*, listings(name, cuisine), profiles:seller_id(full_name)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
      const { data: revs } = await supabase.from('reviews').select('order_id').eq('buyer_id', user.id)
      setReviewed(new Set((revs || []).map(r => r.order_id)))
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#B8730A' : s === 'ready' ? '#C8006A' : s === 'picked_up' ? '#7A3FB0' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'picked_up' ? '#F2EAFA' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'
  const statusLabel = (s: string) => s === 'picked_up' ? 'On its way' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')
  const deliveryLabel = (t: string | null) => {
    if (!t) return null
    const v = t.toLowerCase()
    if (v.includes('collect') || v.includes('pickup') || v.includes('pick')) return '🥡 Collection'
    if (v.includes('deliver')) return '🛵 Delivery'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .stat-card { transition: transform 0.18s; }
      .stat-card:hover { transform: translateY(-2px); }
      .ocard { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
      .ocard:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(200,0,106,0.13) !important; }
      .ocard:hover .ocard-arrow { transform: translateX(3px); }
      .ocard-arrow { transition: transform 0.18s; }
      .pill:hover { border-color: #C8006A !important; color: #C8006A !important; }
      .rate-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .browse-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      @media (max-width: 900px) { .nav-links { display: none !important; } }
      @media (max-width: 620px) {
        .ostats { grid-template-columns: 1fr !important; }
        .ocard-emoji { width: 64px !important; font-size: 30px !important; }
        .ocard-right { width: 100% !important; align-items: flex-start !important; text-align: left !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1000, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/buyer/orders'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>{profile?.full_name?.[0]?.toUpperCase() || 'B'}</div>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1000, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:220, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:160, borderRadius:6, marginBottom:24}}/>
        <div className="ostats" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22}}>
          {Array.from({length:3}).map((_, i) => <div key={i} className="skel" style={{height:104, borderRadius:18}}/>)}
        </div>
        <div style={{display:'flex', gap:10, marginBottom:22}}>
          {Array.from({length:5}).map((_, i) => <div key={i} className="skel" style={{height:38, width:90, borderRadius:100}}/>)}
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:108, borderRadius:18}}/>)}
        </div>
      </div>
    </div>
  )

  // ── DERIVED ──
  const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0)
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const inProgressCount = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length
  const countFor = (f: typeof FILTERS[number]) => f.statuses === null ? orders.length : orders.filter(o => f.statuses!.includes(o.status)).length
  const activeFilter = FILTERS.find(f => f.key === filter)!
  const visible = activeFilter.statuses === null ? orders : orders.filter(o => activeFilter.statuses!.includes(o.status))

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1000, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Header */}
        <div className="fade-up" style={{marginBottom:22}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4}}>My orders</h1>
          <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85}}>{orders.length} {orders.length === 1 ? 'order' : 'orders'} placed all time</p>
        </div>

        {/* Summary stats */}
        <div className="ostats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22}}>
          <div className="stat-card" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:18, padding:'20px', boxShadow:'0 8px 24px rgba(200,0,106,0.25)'}}>
            <div style={{fontSize:20, marginBottom:10}}>💷</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{totalSpent.toFixed(2)}</div>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Total spent</div>
          </div>
          {[
            { icon:'✅', value:String(deliveredCount), label:'Delivered' },
            { icon:'⏳', value:String(inProgressCount), label:'In progress' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:'#fff', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{fontSize:20, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="fade-up" style={{display:'flex', gap:10, marginBottom:22, overflowX:'auto', paddingBottom:4}}>
          {FILTERS.map(f => {
            const active = filter === f.key
            const count = countFor(f)
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} className="pill" style={{flexShrink:0, height:38, padding:'0 16px', borderRadius:100, border:active ? '1.5px solid #C8006A' : '1.5px solid #EAD9E4', background:active ? '#C8006A' : '#fff', color:active ? '#fff' : '#1A1A1A', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7, transition:'all 0.14s'}}>
                {f.label}
                <span style={{background:active ? 'rgba(255,255,255,0.25)' : '#FFE8F4', color:active ? '#fff' : '#C8006A', borderRadius:100, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center'}}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Orders */}
        {visible.length === 0 ? (
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:46, marginBottom:14}}>{filter === 'all' ? '🛒' : '🍽️'}</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:21, fontWeight:700, color:'#1A1A1A', marginBottom:8}}>{filter === 'all' ? 'No orders yet' : `No ${activeFilter.label.toLowerCase()} orders`}</h2>
            <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85, marginBottom:filter === 'all' ? 24 : 0, lineHeight:1.6, maxWidth:380, margin:filter === 'all' ? '0 auto 24px' : '0 auto'}}>{filter === 'all' ? 'Browse home cooks near you and place your first order.' : 'You have no orders with this status right now.'}</p>
            {filter === 'all' && (
              <Link href="/" className="browse-btn" style={{display:'inline-flex', alignItems:'center', height:46, padding:'0 26px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:14, fontWeight:700, boxShadow:'0 4px 14px rgba(200,0,106,0.3)', transition:'all 0.16s'}}>Browse food →</Link>
            )}
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {visible.map(o => {
              const cookFirst = (o.profiles?.full_name || 'Home cook').trim().split(/\s+/)[0]
              const canRate = o.status === 'delivered' && !reviewed.has(o.id)
              const delivery = deliveryLabel(o.delivery_type)
              return (
                <Link key={o.id} href={`/buyer/orders/${o.id}`} className="ocard fade-up" style={{display:'flex', alignItems:'stretch', gap:0, background:'#fff', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', flexWrap:'wrap'}}>
                  <div className="ocard-emoji" style={{width:84, alignSelf:'stretch', minHeight:96, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, flexShrink:0}}>{cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}</div>
                  <div style={{flex:1, minWidth:0, padding:'16px 18px', display:'flex', flexDirection:'column', justifyContent:'center', gap:7}}>
                    <div>
                      <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2}}>{o.listings?.name || 'Order'}</div>
                      <div style={{fontSize:12.5, color:'#1A1A1A', opacity:0.8}}>👨‍🍳 {cookFirst} · #{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                    </div>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      <span style={{background:'#F8F0F4', color:'#1A1A1A', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:100}}>× {o.quantity || 1}</span>
                      {delivery && <span style={{background:'#F8F0F4', color:'#1A1A1A', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:100}}>{delivery}</span>}
                    </div>
                  </div>
                  <div className="ocard-right" style={{padding:'16px 18px', display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'center', gap:8, flexShrink:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A', marginBottom:4}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                        <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, whiteSpace:'nowrap'}}>{statusLabel(o.status)}</span>
                      </div>
                      <span className="ocard-arrow" style={{fontSize:18, color:'#C8006A', flexShrink:0}}>→</span>
                    </div>
                    {canRate && (
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/buyer/orders/${o.id}`) }} className="rate-btn" style={{height:34, padding:'0 14px', background:'#C8006A', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(200,0,106,0.25)', transition:'all 0.16s', whiteSpace:'nowrap'}}>★ Rate order</button>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
