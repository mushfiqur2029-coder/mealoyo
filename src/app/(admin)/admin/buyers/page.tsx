'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile } from '@/lib/types'

// admin_get_all_orders returns flattened rows (FK ids + joined names). We use it
// for per-buyer counts, total spent and the "View orders" modal — the same
// reliable source the Orders and Drivers pages use, so dish names always resolve.
type BuyerOrder = {
  id: string
  buyer_id: string | null
  listing_name: string | null
  total_amount: string
  status: string
  created_at: string
}

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Buyers', h:'/admin/buyers' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Withdrawals', h:'/admin/withdrawals' },
  { l:'Settings', h:'/admin/settings' },
]

const TABS = [
  { k:'all', l:'All' },
  { k:'active', l:'Active' },
  { k:'suspended', l:'Suspended' },
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
  .approve:hover { background: #009836 !important; }
  .reject:hover { background: #991010 !important; }
  .urow:hover { background: var(--bg-card) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .tab:hover { color: var(--text-primary) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  .view-btn:hover { background: var(--border-subtle) !important; color: var(--text-primary) !important; }
  input::placeholder { color: var(--text-secondary); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .ustats { grid-template-columns: 1fr 1fr !important; } }
  @media (max-width: 640px) { .ucounts { display: none !important; } .search { width: 100% !important; } }
`

export default function AdminBuyers() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [buyers, setBuyers] = useState<Profile[]>([])
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [viewBuyer, setViewBuyer] = useState<Profile | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Captured once per mount so the "new this week" cutoff stays stable across
  // renders (calling Date.now() during render is impure).
  const [now] = useState(() => Date.now())
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)

      // Buyers self-register with no approval step, so their status column is
      // often null — normalise to 'active' so the badge, filters and counts all
      // resolve to a real value.
      const { data: buyerRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'buyer' })
      setBuyers((buyerRows || [])
        .map((b: Profile) => ({ ...b, status: b.status || 'active' }))
        .sort((a: Profile, b: Profile) => (a.full_name || '').localeCompare(b.full_name || '')))

      const { data: orderRows } = await supabase.rpc('admin_get_all_orders')
      setOrders((orderRows || []) as BuyerOrder[])

      setLoading(false)
    }
    getData()
  }, [router])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: status })
    if (error) { alert('Could not update: ' + error.message); setBusyId(null); return }
    setBuyers(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    setBusyId(null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'active' ? '#34D399' : s === 'suspended' ? '#FF8A8A' : '#FBBF24'
  const statusBg = (s: string) => s === 'active' ? 'rgba(52,211,153,0.14)' : s === 'suspended' ? 'rgba(255,138,138,0.14)' : 'rgba(251,191,36,0.14)'

  // Order-status styling for the "View orders" modal (mirrors the Orders page).
  const oColor = (s: string) => s === 'delivered' ? '#34D399' : s === 'pending_payment' ? '#F59E0B' : s === 'cooking' ? '#FBBF24' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#FF8A8A' : '#5B9DF0'
  const oBg = (s: string) => s === 'delivered' ? 'rgba(52,211,153,0.14)' : s === 'pending_payment' ? 'rgba(245,158,11,0.16)' : s === 'cooking' ? 'rgba(251,191,36,0.14)' : s === 'ready' ? 'rgba(200,0,106,0.15)' : s === 'cancelled' ? 'rgba(255,138,138,0.14)' : 'rgba(91,157,240,0.15)'
  const oLabel = (s: string) => s === 'pending_payment' ? 'Awaiting payment' : s.replace('_', ' ')

  // Per-buyer aggregates derived from the flattened order rows.
  const orderCounts: Record<string, number> = {}
  const spentTotals: Record<string, number> = {}
  for (const o of orders) {
    if (!o.buyer_id) continue
    orderCounts[o.buyer_id] = (orderCounts[o.buyer_id] || 0) + 1
    if (o.status === 'delivered') spentTotals[o.buyer_id] = (spentTotals[o.buyer_id] || 0) + parseFloat(o.total_amount || '0')
  }

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/buyers'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:12, color:'var(--text-secondary)'}}>{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:12, fontWeight:600, color:'var(--text-secondary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:160, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:200, borderRadius:6, marginBottom:24}}/>
        <div className="ustats" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:340, borderRadius:18}}/>
      </div>
    </div>
  )

  const activeCount = buyers.filter(b => b.status === 'active').length
  const suspendedCount = buyers.filter(b => b.status === 'suspended').length
  const weekAgo = now - 7 * 864e5
  const newThisWeek = buyers.filter(b => new Date(b.created_at).getTime() >= weekAgo).length

  const stats = [
    { value:String(buyers.length), label:'Total buyers', color:'var(--text-primary)' },
    { value:String(activeCount), label:'Active buyers', color:'#34D399' },
    { value:String(newThisWeek), label:'New this week', color:'#5B9DF0' },
    { value:String(orders.length), label:'Total orders placed', color:'#C8006A' },
  ]

  const tabCount = (k: string) => k === 'all' ? buyers.length : k === 'active' ? activeCount : suspendedCount

  const filtered = buyers
    .filter(b => tab === 'all' || b.status === tab)
    .filter(b => !search.trim() || b.full_name?.toLowerCase().includes(search.toLowerCase()) || b.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Buyers</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>{buyers.length} {buyers.length === 1 ? 'buyer' : 'buyers'} registered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name or email…" style={{height:42, padding:'0 16px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        {/* Stats */}
        <div className="ustats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="fade-up" style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:18}}>
          {TABS.map(t => {
            const on = tab === t.k
            return <button key={t.k} onClick={() => setTab(t.k)} className="tab" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid var(--border-subtle)', background:on ? 'rgba(200,0,106,0.15)' : 'var(--bg-card)', color:on ? '#C8006A' : 'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{t.l} <span style={{opacity:0.6, marginLeft:2}}>{tabCount(t.k)}</span></button>
          })}
        </div>

        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'52px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>{search.trim() ? 'No buyers match your search' : 'No buyers found'}</div>
          ) : filtered.map((b, i) => (
            <div key={b.id} className="urow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', transition:'background 0.12s'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>{b.full_name?.[0]?.toUpperCase() || '?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                  <span style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{b.full_name || 'Unknown'}</span>
                  <span style={{background:statusBg(b.status), color:statusColor(b.status), padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{b.status}</span>
                </div>
                <div style={{fontSize:12, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{b.email} · joined {new Date(b.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ucounts" style={{display:'flex', gap:20, flexShrink:0, marginRight:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>{orderCounts[b.id] || 0}</div>
                  <div style={{fontSize:9, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Orders</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>£{(spentTotals[b.id] || 0).toFixed(2)}</div>
                  <div style={{fontSize:9, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Spent</div>
                </div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                <button className="view-btn" onClick={() => setViewBuyer(b)} style={{height:34, padding:'0 14px', background:'var(--bg-secondary)', color:'var(--text-primary)', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>View orders</button>
                {b.status !== 'active' && (
                  <button className="approve" disabled={busyId === b.id} onClick={() => setStatus(b.id, 'active')} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === b.id ? 0.6 : 1}}>Reactivate</button>
                )}
                {b.status !== 'suspended' && (
                  <button className="reject" disabled={busyId === b.id} onClick={() => setStatus(b.id, 'suspended')} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === b.id ? 0.6 : 1}}>Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewBuyer && (() => {
        const bo = orders
          .filter(o => o.buyer_id === viewBuyer.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
        return (
          <div onClick={() => setViewBuyer(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, width:'100%', maxWidth:620, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
              <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                <div style={{minWidth:0}}>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{viewBuyer.full_name || 'Buyer'}&rsquo;s orders</h2>
                  <p style={{fontSize:12.5, color:'var(--text-secondary)', marginTop:2}}>{(orderCounts[viewBuyer.id] || 0) === 0 ? 'No orders' : `Last ${bo.length} of ${orderCounts[viewBuyer.id]} order${orderCounts[viewBuyer.id] === 1 ? '' : 's'}`}</p>
                </div>
                <button onClick={() => setViewBuyer(null)} style={{width:34, height:34, flexShrink:0, borderRadius:8, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:'auto', padding:'8px 0'}}>
                {bo.length === 0 ? (
                  <div style={{padding:'44px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>This buyer has not placed any orders yet.</div>
                ) : bo.map(o => (
                  <div key={o.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 24px'}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listing_name || 'Order'}</div>
                      <div style={{fontSize:12, color:'var(--text-secondary)'}}>{new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                    </div>
                    <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                    <span style={{background:oBg(o.status), color:oColor(o.status), padding:'3px 11px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize', flexShrink:0, whiteSpace:'nowrap'}}>{oLabel(o.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
