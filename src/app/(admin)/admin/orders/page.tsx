'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile } from '@/lib/types'

// admin_get_all_orders returns a flattened row (names joined in the RPC).
type AdminOrder = {
  id: string
  listing_name: string | null
  buyer_name: string | null
  seller_name: string | null
  total_amount: string
  status: string
  created_at: string
}

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Settings', h:'/admin/settings' },
]

const FILTERS = ['all', 'pending', 'accepted', 'cooking', 'ready', 'picked_up', 'delivered', 'cancelled']
const ACTIVE_STATUSES = ['pending', 'accepted', 'cooking', 'ready', 'picked_up']

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
  .cancel-btn:hover { background: #991010 !important; }
  .orow:hover { background: rgba(255,255,255,0.03) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .pill:hover { color: #fff !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  input::placeholder { color: rgba(255,255,255,0.35); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .ostats { grid-template-columns: 1fr 1fr !important; } .ocell { display: none !important; } .orow { grid-template-columns: 1fr 110px 84px !important; } .search { width: 100% !important; } }
`

export default function AdminOrders() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)
      const { data } = await supabase.rpc('admin_get_all_orders')
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const cancelOrder = async (id: string) => {
    if (!confirm('Cancel this order?')) return
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_order_status', { p_id: id, p_status: 'cancelled' })
    if (error) { alert('Could not cancel: ' + error.message); setBusyId(null); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
    setBusyId(null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'delivered' ? '#34D399' : s === 'cooking' ? '#FBBF24' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#FF8A8A' : '#5B9DF0'
  const statusBg = (s: string) => s === 'delivered' ? 'rgba(52,211,153,0.14)' : s === 'cooking' ? 'rgba(251,191,36,0.14)' : s === 'ready' ? 'rgba(200,0,106,0.15)' : s === 'cancelled' ? 'rgba(255,138,138,0.14)' : 'rgba(91,157,240,0.15)'

  const nav = (
    <nav style={{background:'rgba(13,13,13,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} white/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/orders'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#fff' : 'rgba(255,255,255,0.5)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.6)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:140, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:200, borderRadius:6, marginBottom:24}}/>
        <div className="ostats" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:340, borderRadius:18}}/>
      </div>
    </div>
  )

  const grossSales = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total_amount || '0'), 0)
  const deliveredCount = orders.filter(o => o.status === 'delivered').length
  const activeCount = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  const stats = [
    { value:String(orders.length), label:'Total orders', color:'#fff' },
    { value:`£${grossSales.toFixed(2)}`, label:'Gross sales', color:'#34D399' },
    { value:String(activeCount), label:'In progress', color:'#5B9DF0' },
    { value:String(cancelledCount), label:'Cancelled', color:'#FF8A8A' },
  ]

  const filtered = orders
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return o.id.toLowerCase().includes(q) || o.buyer_name?.toLowerCase().includes(q) || o.seller_name?.toLowerCase().includes(q) || o.listing_name?.toLowerCase().includes(q)
    })

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>Orders</h1>
            <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>{orders.length} {orders.length === 1 ? 'order' : 'orders'} platform-wide · {deliveredCount} delivered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search order ID, buyer or seller…" style={{height:42, padding:'0 16px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, fontSize:13, color:'#fff', background:'rgba(255,255,255,0.05)', width:320, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        {/* Revenue summary */}
        <div className="ostats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status pills */}
        <div className="fade-up" style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:18}}>
          {FILTERS.map(f => {
            const on = filter === f
            return <button key={f} onClick={() => setFilter(f)} className="pill" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid rgba(255,255,255,0.14)', background:on ? 'rgba(200,0,106,0.15)' : 'rgba(255,255,255,0.04)', color:on ? '#fff' : 'rgba(255,255,255,0.55)', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'capitalize', transition:'all 0.14s'}}>{f.replace('_', ' ')}</button>
          })}
        </div>

        <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'52px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>No orders {search.trim() ? 'match your search' : filter !== 'all' ? `in "${filter.replace('_', ' ')}"` : ''}</div>
          ) : filtered.map((o, i) => (
            <div key={o.id} className="orow" style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 120px 92px', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition:'background 0.12s'}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listing_name || 'Order'}</div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>#{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ocell" style={{minWidth:0}}>
                <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2}}>Buyer</div>
                <div style={{fontSize:13, color:'#fff', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.buyer_name || 'Unknown'}</div>
              </div>
              <div className="ocell" style={{minWidth:0}}>
                <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2}}>Seller</div>
                <div style={{fontSize:13, color:'#fff', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.seller_name || 'Unknown'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#fff', marginBottom:4}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
              </div>
              <div style={{textAlign:'right'}}>
                {o.status !== 'delivered' && o.status !== 'cancelled' && (
                  <button className="cancel-btn" disabled={busyId === o.id} onClick={() => cancelOrder(o.id)} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === o.id ? 0.6 : 1}}>Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
