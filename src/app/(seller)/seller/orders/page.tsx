'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Profile } from '@/lib/types'

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'cooking', label: 'Start cooking' },
  cooking: { next: 'ready', label: 'Mark ready' },
  ready: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'delivered', label: 'Mark delivered' },
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

const FILTERS = ['all', 'pending', 'accepted', 'cooking', 'ready', 'delivered', 'cancelled']

export default function SellerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setSellerId(user.id)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name,cuisine), profiles:buyer_id(full_name)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  // ── REALTIME: new orders appear instantly + live status sync ──
  useEffect(() => {
    if (!sellerId) return
    const ORDER_SELECT = '*, listings(name,cuisine), profiles:buyer_id(full_name)'
    const channel = supabase
      .channel(`seller-orders-${sellerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        async (payload) => {
          // The realtime payload has only the base row — re-fetch with the
          // listing/buyer joins so the new card renders fully.
          const newId = (payload.new as Order).id
          const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', newId).single()
          if (data) {
            setOrders(prev => prev.some(o => o.id === data.id) ? prev : [data, ...prev])
            setToast('New order received')
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        (payload) => {
          const updated = payload.new as Order
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sellerId])

  // Auto-dismiss the "new order" toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

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

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const counts: Record<string, number> = { all: orders.length }
  for (const f of FILTERS) if (f !== 'all') counts[f] = orders.filter(o => o.status === f).length

  const revenue = orders.reduce((s, o) => s + parseFloat(o.total_amount || '0'), 0)
  const earnings = orders.reduce((s, o) => s + parseFloat(o.seller_payout || '0'), 0)
  const activeCount = orders.filter(o => STATUS_FLOW[o.status]).length

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes toastIn { from { opacity: 0; transform: translateX(20px) translateY(-4px); } to { opacity: 1; transform: translateX(0) translateY(0); } }
      @keyframes toastDot { 0% { box-shadow: 0 0 0 0 rgba(200,0,106,0.5); } 70% { box-shadow: 0 0 0 8px rgba(200,0,106,0); } 100% { box-shadow: 0 0 0 0 rgba(200,0,106,0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .filter-pill { transition: all 0.16s cubic-bezier(0.34,1.2,0.64,1); }
      .filter-pill:hover { border-color: #C8006A !important; }
      .advance-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .advance-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .order-card { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
      .order-card:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(200,0,106,0.12) !important; }
      .stat-card { transition: transform 0.18s; }
      .stat-card:hover { transform: translateY(-2px); }
      @media (max-width: 768px) {
        .nav-links { display: none !important; }
        .orders-grid { grid-template-columns: 1fr !important; }
        .summary-grid { grid-template-columns: 1fr 1fr !important; }
        .card-footer { flex-direction: column; align-items: stretch !important; }
        .card-footer .advance-btn, .card-footer .done-pill { width: 100%; justify-content: center; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', gap:0, flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/orders'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <button onClick={signOut} className="nav-link" style={{marginLeft:'auto', height:36, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, background:'#fff', fontSize:13, fontWeight:600, color:'#1A1A1A', cursor:'pointer', flexShrink:0}}>Sign out</button>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:160, borderRadius:8, marginBottom:20}}/>
        <div className="summary-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:92, borderRadius:18}}/>)}
        </div>
        <div style={{display:'flex', gap:8, marginBottom:24}}>
          {Array.from({length:5}).map((_, i) => <div key={i} className="skel" style={{height:38, width:90, borderRadius:100}}/>)}
        </div>
        <div className="orders-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:16}}>
          {Array.from({length:4}).map((_, i) => (
            <div key={i} style={{background:'#fff', borderRadius:20, padding:20, border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{display:'flex', gap:14, marginBottom:16}}>
                <div className="skel" style={{width:52, height:52, borderRadius:14, flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div className="skel" style={{height:15, width:'60%', borderRadius:6, marginBottom:8}}/>
                  <div className="skel" style={{height:12, width:'40%', borderRadius:6}}/>
                </div>
              </div>
              <div className="skel" style={{height:44, borderRadius:12, marginBottom:16}}/>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <div className="skel" style={{height:30, width:90, borderRadius:6}}/>
                <div className="skel" style={{height:46, width:130, borderRadius:12}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL GATE ──
  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      {pageStyles}
      <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} className="advance-btn" style={{height:46, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      {/* ── REALTIME TOAST: new order received ── */}
      {toast && (
        <div role="status" aria-live="polite" style={{position:'fixed', top:78, right:20, zIndex:300, display:'flex', alignItems:'center', gap:12, background:'#fff', borderLeft:'4px solid #C8006A', borderRadius:14, padding:'14px 18px 14px 16px', boxShadow:'0 12px 36px rgba(200,0,106,0.22)', animation:'toastIn 0.32s cubic-bezier(0.34,1.3,0.64,1) both', maxWidth:'calc(100vw - 40px)'}}>
          <span style={{width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, animation:'toastDot 1.8s ease-out infinite'}}>🔔</span>
          <div>
            <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', lineHeight:1.2}}>{toast}</div>
            <div style={{fontSize:12, color:'#C8006A', fontWeight:600, marginTop:2}}>It&apos;s ready for you to accept</div>
          </div>
          <button onClick={() => setToast(null)} aria-label="Dismiss" style={{marginLeft:6, width:26, height:26, border:'none', background:'#F8F0F4', borderRadius:'50%', color:'#1A1A1A', fontSize:14, cursor:'pointer', flexShrink:0, lineHeight:1}}>✕</button>
        </div>
      )}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Header */}
        <div className="fade-up" style={{marginBottom:22}}>
          <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Seller workspace</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4}}>Orders</h1>
          <p style={{fontSize:14, color:'#1A1A1A'}}>{orders.length} {orders.length === 1 ? 'order' : 'orders'} total · sorted newest first</p>
        </div>

        {/* Revenue summary cards */}
        <div className="summary-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:26}}>
          {[
            { label:'Total orders', value:String(orders.length), icon:'🧾', accent:false },
            { label:'Needs action', value:String(activeCount), icon:'⚡', accent:false },
            { label:'Gross revenue', value:`£${revenue.toFixed(2)}`, icon:'💷', accent:false },
            { label:'Your earnings', value:`£${earnings.toFixed(2)}`, icon:'💰', accent:true },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:s.accent ? 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)' : '#fff', borderRadius:18, padding:'18px 20px', boxShadow:s.accent ? '0 8px 24px rgba(200,0,106,0.25)' : '0 2px 14px rgba(200,0,106,0.06)', border:s.accent ? 'none' : '1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{fontSize:18, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:s.accent ? '#fff' : '#1A1A1A', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:s.accent ? 'rgba(255,255,255,0.8)' : '#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter pills with counts */}
        <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:22}}>
          {FILTERS.map(f => {
            const on = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} className="filter-pill" style={{flexShrink:0, display:'flex', alignItems:'center', gap:7, height:40, padding:'0 16px', borderRadius:100, border:on ? '2px solid #C8006A' : '1.5px solid #E0E0E0', background:on ? '#FFE8F4' : '#fff', color:on ? '#C8006A' : '#1A1A1A', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'capitalize'}}>
                {f.replace('_', ' ')}
                <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:20, height:20, padding:'0 6px', borderRadius:100, background:on ? '#C8006A' : '#F0E4EC', color:on ? '#fff' : '#1A1A1A', fontSize:11, fontWeight:700}}>{counts[f] ?? 0}</span>
              </button>
            )
          })}
        </div>

        {/* Orders */}
        {filtered.length === 0 ? (
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px'}}>📦</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', marginBottom:8}}>No orders {filter !== 'all' ? `in "${filter.replace('_', ' ')}"` : 'yet'}</h2>
            <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.65, maxWidth:380, margin:'0 auto'}}>{filter === 'all' ? 'Orders will appear here the moment buyers start ordering your dishes.' : 'Try a different filter to see more orders.'}</p>
          </div>
        ) : (
          <div className="orders-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:16}}>
            {filtered.map(o => {
              const step = STATUS_FLOW[o.status]
              const buyerFirst = (o.profiles?.full_name || 'Buyer').trim().split(/\s+/)[0]
              const dt = new Date(o.created_at)
              const isDelivery = o.delivery_type === 'delivery'
              return (
                <div key={o.id} className="order-card fade-up" style={{background:'#fff', borderRadius:20, padding:'20px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', flexDirection:'column'}}>

                  {/* Top: dish + status */}
                  <div style={{display:'flex', gap:14, marginBottom:16}}>
                    <div style={{width:54, height:54, borderRadius:14, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>
                      {cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                        <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                        <span style={{flexShrink:0, background:statusBg(o.status), color:statusColor(o.status), padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
                      </div>
                      <div style={{fontSize:12, color:'#1A1A1A', fontWeight:500, marginTop:3}}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                  </div>

                  {/* Meta pills */}
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:14}}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#F8F0F4', color:'#1A1A1A', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>👤 {buyerFirst}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#F8F0F4', color:'#1A1A1A', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>× {o.quantity}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#FFE8F4', color:'#C8006A', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>{isDelivery ? '🚴 Delivery' : '📍 Collection'}</span>
                  </div>

                  {/* Date / time */}
                  <div style={{fontSize:12, color:'#1A1A1A', fontWeight:500, marginBottom:14, opacity:0.85}}>
                    🕐 {dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} · {dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                  </div>

                  {/* Notes */}
                  {o.notes && (
                    <div style={{background:'#F8F0F4', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#1A1A1A', lineHeight:1.5, marginBottom:14}}>
                      <span style={{fontWeight:700, color:'#C8006A'}}>📝 Note</span> · {o.notes}
                    </div>
                  )}

                  {/* Footer: amounts + action */}
                  <div className="card-footer" style={{marginTop:'auto', paddingTop:14, borderTop:'1px solid #F5F0F3', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12}}>
                    <div>
                      <div style={{display:'flex', gap:16}}>
                        <div>
                          <div style={{fontSize:10, color:'#1A1A1A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', opacity:0.7, marginBottom:2}}>Order total</div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.01em'}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2}}>Your payout</div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#C8006A', letterSpacing:'-0.01em'}}>£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    {step ? (
                      <button onClick={() => advanceStatus(o)} disabled={updatingId === o.id} className="advance-btn" style={{flexShrink:0, height:46, padding:'0 18px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:updatingId === o.id ? 'not-allowed' : 'pointer', opacity:updatingId === o.id ? 0.7 : 1, boxShadow:'0 4px 14px rgba(200,0,106,0.28)', whiteSpace:'nowrap'}}>
                        {updatingId === o.id ? 'Updating...' : step.label}
                      </button>
                    ) : (
                      <span className="done-pill" style={{flexShrink:0, height:46, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6, background:o.status === 'cancelled' ? '#FDECEA' : '#E4F6EA', color:o.status === 'cancelled' ? '#C0392B' : '#2DA84E', borderRadius:12, fontSize:13, fontWeight:700, whiteSpace:'nowrap'}}>
                        {o.status === 'cancelled' ? '✕ Cancelled' : '✓ Completed'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
