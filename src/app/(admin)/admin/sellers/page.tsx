'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile, Listing } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
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
  .skelD { background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: #fff !important; }
  .approve:hover { background: #009836 !important; }
  .reject:hover { background: #991010 !important; }
  .urow:hover { background: rgba(255,255,255,0.03) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .tab:hover { color: #fff !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  .view-btn:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; }
  input::placeholder { color: rgba(255,255,255,0.35); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 640px) { .ustats { grid-template-columns: 1fr 1fr 1fr !important; } .ucounts { display: none !important; } .search { width: 100% !important; } }
`

export default function AdminSellers() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sellers, setSellers] = useState<Profile[]>([])
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({})
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({})
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [viewSeller, setViewSeller] = useState<Profile | null>(null)
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

      const { data: sellerRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' })
      setSellers((sellerRows || []).sort((a: Profile, b: Profile) => (a.full_name || '').localeCompare(b.full_name || '')))

      const { data: listings } = await supabase.rpc('admin_get_all_listings')
      setAllListings((listings || []) as Listing[])
      const lCounts: Record<string, number> = {}
      for (const l of listings || []) lCounts[l.seller_id] = (lCounts[l.seller_id] || 0) + 1
      setListingCounts(lCounts)

      const { data: orders } = await supabase.rpc('admin_get_all_orders')
      const oCounts: Record<string, number> = {}
      for (const o of orders || []) oCounts[o.seller_id] = (oCounts[o.seller_id] || 0) + 1
      setOrderCounts(oCounts)

      setLoading(false)
    }
    getData()
  }, [router])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: status })
    if (error) { alert('Could not update: ' + error.message); setBusyId(null); return }
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    setBusyId(null)
  }

  // Approve every pending seller in one action.
  const approveAllPending = async () => {
    const ids = sellers.filter(s => s.status === 'pending').map(s => s.id)
    if (ids.length === 0) return
    if (!confirm(`Approve all ${ids.length} pending seller${ids.length === 1 ? '' : 's'}?`)) return
    setBulkBusy(true)
    const results = await Promise.all(ids.map(id => supabase.rpc('admin_update_profile_status', { p_id: id, p_status: 'active' })))
    const failed = results.filter(r => r.error).length
    setSellers(prev => prev.map(s => ids.includes(s.id) ? { ...s, status: 'active' } : s))
    setBulkBusy(false)
    if (failed) alert(`${failed} could not be approved. Refresh and try again.`)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'active' ? '#34D399' : s === 'pending' ? '#FBBF24' : '#FF8A8A'
  const statusBg = (s: string) => s === 'active' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : 'rgba(255,138,138,0.14)'

  const nav = (
    <nav style={{background:'rgba(13,13,13,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} white/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/sellers'
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
        <div className="skelD" style={{height:28, width:160, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:200, borderRadius:6, marginBottom:24}}/>
        <div className="ustats" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24}}>{Array.from({length:3}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:340, borderRadius:18}}/>
      </div>
    </div>
  )

  const activeCount = sellers.filter(s => s.status === 'active').length
  const pendingCount = sellers.filter(s => s.status === 'pending').length
  const suspendedCount = sellers.filter(s => s.status === 'suspended').length

  const stats = [
    { value:String(sellers.length), label:'Total sellers', color:'#fff' },
    { value:String(activeCount), label:'Active', color:'#34D399' },
    { value:String(pendingCount), label:'Pending', color:'#FBBF24' },
  ]

  const tabCount = (k: string) => k === 'all' ? sellers.length : k === 'active' ? activeCount : k === 'pending' ? pendingCount : suspendedCount

  const filtered = sellers
    .filter(s => tab === 'all' || s.status === tab)
    .filter(s => !search.trim() || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'orders') return (orderCounts[b.id] || 0) - (orderCounts[a.id] || 0)
      return (a.full_name || '').localeCompare(b.full_name || '')
    })

  const SORTS: { k: typeof sort; l: string }[] = [
    { k: 'name', l: 'Name' },
    { k: 'newest', l: 'Newest' },
    { k: 'orders', l: 'Most orders' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>Sellers</h1>
            <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>{sellers.length} {sellers.length === 1 ? 'seller' : 'sellers'} registered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name or email…" style={{height:42, padding:'0 16px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, fontSize:13, color:'#fff', background:'rgba(255,255,255,0.05)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        {/* Stats */}
        <div className="ustats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs + bulk approve */}
        <div className="fade-up" style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14}}>
          <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, flex:1, minWidth:0}}>
            {TABS.map(t => {
              const on = tab === t.k
              return <button key={t.k} onClick={() => setTab(t.k)} className="tab" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid rgba(255,255,255,0.14)', background:on ? 'rgba(200,0,106,0.15)' : 'rgba(255,255,255,0.04)', color:on ? '#fff' : 'rgba(255,255,255,0.55)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{t.l} <span style={{opacity:0.6, marginLeft:2}}>{tabCount(t.k)}</span></button>
            })}
          </div>
          {pendingCount > 0 && (
            <button className="approve" onClick={approveAllPending} disabled={bulkBusy} style={{flexShrink:0, height:36, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:100, fontSize:12.5, fontWeight:700, cursor:bulkBusy ? 'wait' : 'pointer', opacity:bulkBusy ? 0.7 : 1, transition:'background 0.12s'}}>{bulkBusy ? 'Approving…' : `✓ Approve all pending (${pendingCount})`}</button>
          )}
        </div>

        {/* Sort */}
        <div className="fade-up" style={{display:'flex', gap:8, alignItems:'center', marginBottom:18, flexWrap:'wrap'}}>
          <span style={{fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>Sort</span>
          {SORTS.map(s => {
            const on = sort === s.k
            return <button key={s.k} onClick={() => setSort(s.k)} className="tab" style={{height:32, padding:'0 13px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid rgba(255,255,255,0.12)', background:on ? 'rgba(200,0,106,0.15)' : 'transparent', color:on ? '#fff' : 'rgba(255,255,255,0.5)', fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{s.l}</button>
          })}
        </div>

        <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'52px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>No sellers found</div>
          ) : filtered.map((s, i) => (
            <div key={s.id} className="urow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition:'background 0.12s'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', flexShrink:0}}>{s.full_name?.[0]?.toUpperCase() || '?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                  <span style={{fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.full_name || 'Unknown'}</span>
                  <span style={{background:statusBg(s.status), color:statusColor(s.status), padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{s.status}</span>
                </div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.email} · joined {new Date(s.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ucounts" style={{display:'flex', gap:20, flexShrink:0, marginRight:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>{listingCounts[s.id] || 0}</div>
                  <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Listings</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>{orderCounts[s.id] || 0}</div>
                  <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Orders</div>
                </div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                <button className="view-btn" onClick={() => setViewSeller(s)} style={{height:34, padding:'0 14px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>View listings</button>
                {s.status !== 'active' && (
                  <button className="approve" disabled={busyId === s.id} onClick={() => setStatus(s.id, 'active')} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === s.id ? 0.6 : 1}}>{s.status === 'pending' ? 'Approve' : 'Reactivate'}</button>
                )}
                {s.status !== 'suspended' && (
                  <button className="reject" disabled={busyId === s.id} onClick={() => setStatus(s.id, 'suspended')} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === s.id ? 0.6 : 1}}>Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewSeller && (() => {
        const sl = allListings.filter(l => l.seller_id === viewSeller.id)
        const lColor = (s: string) => s === 'live' ? '#34D399' : s === 'pending' ? '#FBBF24' : s === 'suspended' ? '#FF8A8A' : 'rgba(255,255,255,0.5)'
        const lBg = (s: string) => s === 'live' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : s === 'suspended' ? 'rgba(255,138,138,0.14)' : 'rgba(255,255,255,0.08)'
        return (
          <div onClick={() => setViewSeller(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{background:'#161616', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, width:'100%', maxWidth:620, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
              <div style={{padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                <div style={{minWidth:0}}>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{viewSeller.full_name || 'Seller'}&rsquo;s listings</h2>
                  <p style={{fontSize:12.5, color:'rgba(255,255,255,0.45)', marginTop:2}}>{sl.length} {sl.length === 1 ? 'listing' : 'listings'} · all statuses</p>
                </div>
                <button onClick={() => setViewSeller(null)} style={{width:34, height:34, flexShrink:0, borderRadius:8, border:'1px solid rgba(255,255,255,0.14)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:'auto', padding:'8px 0'}}>
                {sl.length === 0 ? (
                  <div style={{padding:'44px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>This seller has no listings yet.</div>
                ) : sl.map(l => (
                  <div key={l.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 24px'}}>
                    <div style={{width:52, height:52, borderRadius:12, background:'rgba(255,255,255,0.05)', flexShrink:0, overflow:'hidden'}}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image_url && <img src={l.image_url} alt={l.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                      <div style={{fontSize:12, color:'rgba(255,255,255,0.45)'}}>{l.cuisine} · £{parseFloat(l.price || '0').toFixed(2)} · {l.order_count || 0} orders</div>
                    </div>
                    <span style={{background:lBg(l.status), color:lColor(l.status), padding:'3px 11px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{l.status}</span>
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
