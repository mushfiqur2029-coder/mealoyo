'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile, Listing, Order, Review } from '@/lib/types'

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'accepted', label: 'Accept' },
  accepted: { next: 'cooking', label: 'Cook' },
  cooking: { next: 'ready', label: 'Ready' },
  ready: { next: 'picked_up', label: 'Picked up' },
  picked_up: { next: 'delivered', label: 'Delivered' },
  delivered: null,
  cancelled: null,
}

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
  { l:'Profile', h:'/seller/profile' },
]

export default function SellerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [monthCount, setMonthCount] = useState(0)
  const [deliveredOrders, setDeliveredOrders] = useState<Pick<Order, 'seller_payout'>[]>([])
  const [pendingOrders, setPendingOrders] = useState<Pick<Order, 'seller_payout'>[]>([])
  const [reviews, setReviews] = useState<Pick<Review, 'rating'>[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data: listings } = await supabase.from('listings').select('*').eq('seller_id', user.id)
      setListings(listings || [])
      const { data: orders } = await supabase.from('orders').select('*, listings(name,cuisine), profiles:buyer_id(full_name)').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id)
      setOrderCount(total ?? 0)
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
      const { count: month } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).gte('created_at', startOfMonth.toISOString())
      setMonthCount(month ?? 0)
      const { data: delivered } = await supabase.from('orders').select('seller_payout').eq('seller_id', user.id).eq('status', 'delivered')
      setDeliveredOrders(delivered || [])
      const { data: pending } = await supabase.from('orders').select('seller_payout').eq('seller_id', user.id).in('status', ['pending', 'accepted', 'cooking', 'ready', 'picked_up'])
      setPendingOrders(pending || [])
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('seller_id', user.id)
      setReviews(reviews || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const advanceStatus = async (order: Order) => {
    const step = STATUS_FLOW[order.status]
    if (!step) return
    setUpdatingId(order.id)
    const { error } = await supabase.from('orders').update({ status: step.next }).eq('id', order.id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: step.next } : o))
    }
    setUpdatingId(null)
  }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#B8730A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'

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
      .orow:hover { background: #FFF5FA !important; }
      .lrow:hover { background: #FFF5FA !important; }
      .advance-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .advance-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .qa-row:hover { background: #FFF5FA !important; transform: translateX(2px); }
      .ghost-btn:hover { background: rgba(255,255,255,0.28) !important; }
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      @media (max-width: 900px) {
        .nav-links { display: none !important; }
        .two-col { grid-template-columns: minmax(0,1fr) !important; }
        .col-right { position: static !important; order: -1; }
      }
      @media (max-width: 600px) {
        .dash-grid { grid-template-columns: 1fr 1fr !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/dashboard'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center'}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>{profile?.full_name?.[0]?.toUpperCase() || 'S'}</div>
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
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:280, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:200, borderRadius:6, marginBottom:28}}/>
        <div className="dash-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:108, borderRadius:18}}/>)}
        </div>
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20}}>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:300, borderRadius:20}}/>
            <div className="skel" style={{height:220, borderRadius:20}}/>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:200, borderRadius:20}}/>
            <div className="skel" style={{height:240, borderRadius:20}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL ──
  if (profile?.status === 'pending') {
    const steps = [
      { t:'Application submitted', d:'We received your seller details.', done:true },
      { t:'Identity & hygiene review', d:'Our team is verifying your information.', done:false, active:true },
      { t:'Approval & go live', d:'Start listing dishes and taking orders.', done:false },
    ]
    return (
      <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
        {pageStyles}
        {nav}
        <div style={{maxWidth:560, margin:'0 auto', padding:'48px 20px'}}>
          <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'40px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)', marginBottom:20}}>
            <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>You&apos;re almost ready, {profile?.full_name?.split(' ')[0] || 'Chef'}</h1>
            <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, maxWidth:400, margin:'0 auto'}}>Your seller account is being reviewed. Approval usually takes <strong style={{color:'#C8006A'}}>24–48 hours</strong>. We&apos;ll email you the moment you&apos;re live.</p>
          </div>
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', marginBottom:20}}>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:18}}>What happens next</h3>
            {steps.map((s, i) => (
              <div key={i} style={{display:'flex', gap:14, paddingBottom:i < steps.length - 1 ? 18 : 0, position:'relative'}}>
                {i < steps.length - 1 && <div style={{position:'absolute', left:15, top:32, bottom:6, width:2, background:'#F0E4EC'}}/>}
                <div style={{width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, zIndex:1, background:s.done ? '#2DA84E' : s.active ? '#C8006A' : '#F0E4EC', color:s.done || s.active ? '#fff' : '#1A1A1A'}}>{s.done ? '✓' : i + 1}</div>
                <div style={{flex:1, paddingTop:4}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', display:'flex', alignItems:'center', gap:8}}>{s.t}{s.active && <span style={{background:'#FFE8F4', color:'#C8006A', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.04em'}}>In progress</span>}</div>
                  <div style={{fontSize:13, color:'#1A1A1A', opacity:0.8, marginTop:2, lineHeight:1.5}}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center'}}>
            <button onClick={signOut} className="signout" style={{height:44, padding:'0 24px', background:'#fff', color:'#1A1A1A', border:'1.5px solid #E0E0E0', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  // ── DERIVED ──
  const liveListings = listings.filter(l => l.status === 'live')
  const totalEarnings = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null
  const firstName = profile?.full_name?.split(' ')[0] || 'Chef'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const stars = (r: number) => (
    <span style={{display:'inline-flex', gap:1, letterSpacing:1}}>
      {[1,2,3,4,5].map(i => <span key={i} style={{color:i <= Math.round(r) ? '#E8930A' : '#EBD7BE', fontSize:14}}>★</span>)}
    </span>
  )

  const quickActions = [
    { l:'Add new listing', s:'List another dish', i:'➕', h:'/seller/listings/new' },
    { l:'View all orders', s:'Manage every order', i:'📦', h:'/seller/orders' },
    { l:'View earnings', s:'Payouts & history', i:'💷', h:'/seller/earnings' },
    { l:'Edit profile', s:'Update your details', i:'⚙️', h:'/seller/profile' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Welcome header */}
        <div className="fade-up" style={{marginBottom:26}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,34px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4}}>{greeting}, {firstName} 👋</h1>
          <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85}}>{today}</p>
        </div>

        {/* Top stats */}
        <div className="dash-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {/* Total earned — magenta gradient */}
          <div className="stat-card" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:18, padding:'20px', boxShadow:'0 8px 24px rgba(200,0,106,0.25)'}}>
            <div style={{fontSize:20, marginBottom:10}}>💰</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{totalEarnings.toFixed(2)}</div>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Total earned</div>
          </div>
          {[
            { icon:'📦', value:String(monthCount), label:'Orders this month' },
            { icon:'🍽️', value:String(liveListings.length), label:'Live listings' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:'#fff', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{fontSize:20, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
          {/* Average rating with stars */}
          <div className="stat-card" style={{background:'#fff', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:20, marginBottom:10}}>⭐</div>
            <div style={{display:'flex', alignItems:'baseline', gap:6}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', lineHeight:1}}>{avgRating ? avgRating.toFixed(1) : '—'}</div>
              {avgRating != null && stars(avgRating)}
            </div>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{reviews.length ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</div>
          </div>
        </div>

        {/* Two-column */}
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20, alignItems:'start'}}>

          {/* LEFT */}
          <div style={{display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Recent orders */}
            <div className="fade-up" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid #F5F0F3', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A'}}>Recent orders <span style={{fontSize:13, color:'#C8006A', fontFamily:'Inter'}}>· {orderCount} total</span></h3>
                <Link href="/seller/orders" className="nav-link" style={{fontSize:13, fontWeight:700, color:'#C8006A'}}>View all →</Link>
              </div>
              {orders.length === 0 ? (
                <div style={{padding:'40px 32px', textAlign:'center'}}>
                  <div style={{fontSize:36, marginBottom:10}}>📦</div>
                  <p style={{fontSize:14, color:'#1A1A1A', marginBottom:16, lineHeight:1.6}}>No orders yet — they&apos;ll appear here as buyers order your dishes.</p>
                  <Link href="/seller/listings/new" style={{display:'inline-flex', alignItems:'center', height:42, padding:'0 20px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(200,0,106,0.28)'}}>Add your first dish →</Link>
                </div>
              ) : orders.map((o, i) => {
                const step = STATUS_FLOW[o.status]
                const buyerFirst = (o.profiles?.full_name || 'Buyer').trim().split(/\s+/)[0]
                return (
                  <div key={o.id} className="orow" style={{display:'flex', alignItems:'center', gap:12, padding:'14px 22px', borderBottom:i < orders.length - 1 ? '1px solid #F5F0F3' : 'none', transition:'background 0.12s'}}>
                    <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0}}>{cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                      <div style={{fontSize:12, color:'#1A1A1A', opacity:0.8, marginTop:1}}>👤 {buyerFirst}</div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:4}}>£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                      <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
                    </div>
                    {step ? (
                      <button onClick={() => advanceStatus(o)} disabled={updatingId === o.id} className="advance-btn" style={{flexShrink:0, height:40, padding:'0 14px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:updatingId === o.id ? 'not-allowed' : 'pointer', opacity:updatingId === o.id ? 0.7 : 1, whiteSpace:'nowrap'}}>{updatingId === o.id ? '…' : step.label}</button>
                    ) : (
                      <span style={{flexShrink:0, width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10, background:o.status === 'cancelled' ? '#FDECEA' : '#E4F6EA', color:o.status === 'cancelled' ? '#C0392B' : '#2DA84E', fontSize:16, fontWeight:700}}>{o.status === 'cancelled' ? '✕' : '✓'}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* My listings */}
            <div className="fade-up" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid #F5F0F3', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A'}}>My listings <span style={{fontSize:13, color:'#C8006A', fontFamily:'Inter'}}>· {liveListings.length} live</span></h3>
                <Link href="/seller/listings/new" className="advance-btn" style={{display:'inline-flex', alignItems:'center', height:36, padding:'0 14px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:12, fontWeight:700, boxShadow:'0 4px 12px rgba(200,0,106,0.25)'}}>＋ Add new dish</Link>
              </div>
              {liveListings.length === 0 ? (
                <div style={{padding:'40px 32px', textAlign:'center'}}>
                  <div style={{fontSize:36, marginBottom:10}}>🍽️</div>
                  <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.6}}>No live dishes yet. Add your first dish to start receiving orders.</p>
                </div>
              ) : liveListings.slice(0, 5).map((l, i) => (
                <Link key={l.id} href={`/dish/${l.id}`} className="lrow" style={{display:'flex', alignItems:'center', gap:12, padding:'14px 22px', borderBottom:i < Math.min(liveListings.length, 5) - 1 ? '1px solid #F5F0F3' : 'none', transition:'background 0.12s'}}>
                  <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0}}>{cuisineEmoji[l.cuisine] || '🍽️'}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                    <div style={{fontSize:12, color:'#1A1A1A', opacity:0.8, marginTop:1}}>{l.cuisine}</div>
                  </div>
                  <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#1A1A1A', flexShrink:0}}>£{parseFloat(l.price || '0').toFixed(2)}</div>
                  <span style={{flexShrink:0, background:'#E4F6EA', color:'#2DA84E', padding:'3px 9px', borderRadius:100, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.03em'}}>Live</span>
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT (sticky) */}
          <div className="col-right" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Wallet */}
            <div className="fade-up" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:20, padding:'24px', boxShadow:'0 10px 30px rgba(200,0,106,0.3)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Available balance</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'#fff', letterSpacing:'-0.03em', lineHeight:1, marginBottom:14}}>£{totalEarnings.toFixed(2)}</div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 14px', marginBottom:18}}>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:500}}>Pending</span>
                <span style={{fontSize:15, color:'#fff', fontWeight:700, fontFamily:'Georgia,serif'}}>£{pendingAmount.toFixed(2)}</span>
              </div>
              <button onClick={() => alert('Payouts are coming soon. Once Stripe Connect onboarding is live, your earnings will pay out automatically to your bank on a weekly schedule.')} className="ghost-btn" style={{width:'100%', height:46, background:'#fff', color:'#C8006A', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:10, transition:'all 0.16s'}}>Withdraw funds</button>
              <Link href="/seller/earnings" style={{display:'block', textAlign:'center', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)'}}>Transaction history →</Link>
            </div>

            {/* Quick actions */}
            <div className="fade-up" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{padding:'18px 22px 12px'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A'}}>Quick actions</h3>
              </div>
              {quickActions.map((a, i) => (
                <Link key={i} href={a.h} className="qa-row" style={{display:'flex', alignItems:'center', gap:13, padding:'13px 22px', borderTop:'1px solid #F5F0F3', transition:'all 0.14s'}}>
                  <div style={{width:38, height:38, borderRadius:10, background:'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0}}>{a.i}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>{a.l}</div>
                    <div style={{fontSize:12, color:'#1A1A1A', opacity:0.75, marginTop:1}}>{a.s}</div>
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
