'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import AdminDeleteUser from '@/components/AdminDeleteUser'
import type { Profile } from '@/lib/types'

// admin_get_all_orders returns flattened rows (names joined in the RPC).
type DriverOrder = {
  id: string
  listing_name: string | null
  buyer_name: string | null
  total_amount: string
  status: string
  created_at: string
  driver_id: string | null
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
  { k:'pending', l:'Pending' },
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
  @media (max-width: 640px) { .ustats { grid-template-columns: 1fr 1fr 1fr !important; } .ucounts { display: none !important; } .search { width: 100% !important; } }
`

export default function AdminDrivers() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [drivers, setDrivers] = useState<Profile[]>([])
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>({})
  const [allOrders, setAllOrders] = useState<DriverOrder[]>([])
  const [viewDriver, setViewDriver] = useState<Profile | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState<'name' | 'newest' | 'orders'>('name')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)

      const { data: driverRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'driver' })
      setDrivers((driverRows || []).sort((a: Profile, b: Profile) => (a.full_name || '').localeCompare(b.full_name || '')))

      const { data: orders } = await supabase.rpc('admin_get_all_orders')
      setAllOrders((orders || []) as DriverOrder[])
      const counts: Record<string, number> = {}
      for (const o of orders || []) { if (o.driver_id) counts[o.driver_id] = (counts[o.driver_id] || 0) + 1 }
      setDeliveryCounts(counts)

      setLoading(false)
    }
    getData()
  }, [router])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: status })
    if (error) { alert('Could not update: ' + error.message); setBusyId(null); return }
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, status } : d))
    setBusyId(null)
  }

  // Approve every pending driver in one action.
  const approveAllPending = async () => {
    const ids = drivers.filter(d => d.status === 'pending').map(d => d.id)
    if (ids.length === 0) return
    if (!confirm(`Approve all ${ids.length} pending driver${ids.length === 1 ? '' : 's'}?`)) return
    setBulkBusy(true)
    const results = await Promise.all(ids.map(id => supabase.rpc('admin_update_profile_status', { p_id: id, p_status: 'active' })))
    const failed = results.filter(r => r.error).length
    setDrivers(prev => prev.map(d => ids.includes(d.id) ? { ...d, status: 'active' } : d))
    setBulkBusy(false)
    if (failed) alert(`${failed} could not be approved. Refresh and try again.`)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'active' ? '#34D399' : s === 'pending' ? '#FBBF24' : '#FF8A8A'
  const statusBg = (s: string) => s === 'active' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : 'rgba(255,138,138,0.14)'

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/drivers'
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
        <div className="ustats" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>{Array.from({length:3}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:340, borderRadius:18}}/>
      </div>
    </div>
  )

  const activeCount = drivers.filter(d => d.status === 'active').length
  const pendingCount = drivers.filter(d => d.status === 'pending').length
  const suspendedCount = drivers.filter(d => d.status === 'suspended').length

  const stats = [
    { value:String(drivers.length), label:'Total drivers', color:'var(--text-primary)' },
    { value:String(activeCount), label:'Active', color:'#34D399' },
    { value:String(pendingCount), label:'Pending', color:'#FBBF24' },
  ]

  const tabCount = (k: string) => k === 'all' ? drivers.length : k === 'active' ? activeCount : k === 'pending' ? pendingCount : suspendedCount

  const filtered = drivers
    .filter(d => tab === 'all' || d.status === tab)
    .filter(d => !search.trim() || d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'orders') return (deliveryCounts[b.id] || 0) - (deliveryCounts[a.id] || 0)
      return (a.full_name || '').localeCompare(b.full_name || '')
    })

  const SORTS: { k: typeof sort; l: string }[] = [
    { k: 'name', l: 'Name' },
    { k: 'newest', l: 'Newest' },
    { k: 'orders', l: 'Most drops' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Drivers</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>{drivers.length} {drivers.length === 1 ? 'driver' : 'drivers'} registered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name or email…" style={{height:42, padding:'0 16px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        <div className="ustats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs + bulk approve */}
        <div className="fade-up" style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14}}>
          <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, flex:1, minWidth:0}}>
            {TABS.map(t => {
              const on = tab === t.k
              return <button key={t.k} onClick={() => setTab(t.k)} className="tab" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid var(--border-subtle)', background:on ? 'rgba(200,0,106,0.15)' : 'var(--bg-card)', color:on ? '#C8006A' : 'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{t.l} <span style={{opacity:0.6, marginLeft:2}}>{tabCount(t.k)}</span></button>
            })}
          </div>
          {pendingCount > 0 && (
            <button className="approve" onClick={approveAllPending} disabled={bulkBusy} style={{flexShrink:0, height:36, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:100, fontSize:12.5, fontWeight:700, cursor:bulkBusy ? 'wait' : 'pointer', opacity:bulkBusy ? 0.7 : 1, transition:'background 0.12s'}}>{bulkBusy ? 'Approving…' : `✓ Approve all pending (${pendingCount})`}</button>
          )}
        </div>

        {/* Sort */}
        <div className="fade-up" style={{display:'flex', gap:8, alignItems:'center', marginBottom:18, flexWrap:'wrap'}}>
          <span style={{fontSize:12, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>Sort</span>
          {SORTS.map(s => {
            const on = sort === s.k
            return <button key={s.k} onClick={() => setSort(s.k)} className="tab" style={{height:32, padding:'0 13px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid var(--border-subtle)', background:on ? 'rgba(200,0,106,0.15)' : 'transparent', color:on ? '#C8006A' : 'var(--text-secondary)', fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{s.l}</button>
          })}
        </div>

        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'52px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>No drivers found</div>
          ) : filtered.map((d, i) => (
            <div key={d.id} className="urow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', transition:'background 0.12s'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>{d.full_name?.[0]?.toUpperCase() || '?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                  <span style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.full_name || 'Unknown'}</span>
                  <span style={{background:statusBg(d.status), color:statusColor(d.status), padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{d.status}</span>
                </div>
                <div style={{fontSize:12, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.email} · joined {new Date(d.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ucounts" style={{display:'flex', gap:20, flexShrink:0, marginRight:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>{deliveryCounts[d.id] || 0}</div>
                  <div style={{fontSize:9, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Deliveries</div>
                </div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                <button className="view-btn" onClick={() => setViewDriver(d)} style={{height:34, padding:'0 14px', background:'var(--bg-secondary)', color:'var(--text-primary)', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>View history</button>
                {d.status !== 'active' && (
                  <button className="approve" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'active')} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === d.id ? 0.6 : 1}}>{d.status === 'pending' ? 'Approve' : 'Reactivate'}</button>
                )}
                {d.status !== 'suspended' && (
                  <button className="reject" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'suspended')} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === d.id ? 0.6 : 1}}>Suspend</button>
                )}
                <AdminDeleteUser user={d} onDeleted={id => setDrivers(prev => prev.filter(x => x.id !== id))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewDriver && (() => {
        const dh = allOrders
          .filter(o => o.driver_id === viewDriver.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const oColor = (s: string) => s === 'delivered' ? '#34D399' : s === 'cancelled' ? '#FF8A8A' : '#FBBF24'
        const oBg = (s: string) => s === 'delivered' ? 'rgba(52,211,153,0.14)' : s === 'cancelled' ? 'rgba(255,138,138,0.14)' : 'rgba(251,191,36,0.14)'
        return (
          <div onClick={() => setViewDriver(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, width:'100%', maxWidth:620, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
              <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                <div style={{minWidth:0}}>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{viewDriver.full_name || 'Driver'}&rsquo;s delivery history</h2>
                  <p style={{fontSize:12.5, color:'var(--text-secondary)', marginTop:2}}>{dh.length} {dh.length === 1 ? 'delivery' : 'deliveries'}</p>
                </div>
                <button onClick={() => setViewDriver(null)} style={{width:34, height:34, flexShrink:0, borderRadius:8, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:'auto', padding:'8px 0'}}>
                {dh.length === 0 ? (
                  <div style={{padding:'44px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>This driver has no deliveries yet.</div>
                ) : dh.map(o => (
                  <div key={o.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 24px'}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listing_name || 'Order'}</div>
                      <div style={{fontSize:12, color:'var(--text-secondary)'}}>#{o.id.slice(0, 8).toUpperCase()} · {o.buyer_name || 'Unknown'} · {new Date(o.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
                    </div>
                    <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                    <span style={{background:oBg(o.status), color:oColor(o.status), padding:'3px 11px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize', flexShrink:0, whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
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
