'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import AdminDeleteModal from '@/components/AdminDeleteModal'
import AdminSuspendModal from '@/components/AdminSuspendModal'
import type { Profile, Listing } from '@/lib/types'

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
  .reject:hover { background: #D97706 !important; }
  .del-row:hover { background: rgba(220,38,38,0.12) !important; border-color: #DC2626 !important; }
  .urow:hover { background: var(--bg-card) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .tab:hover { color: var(--text-primary) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  .view-btn:hover { background: rgba(37,99,235,0.1) !important; }
  input::placeholder { color: var(--text-secondary); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 640px) { .ustats { grid-template-columns: 1fr 1fr 1fr !important; } .ucounts { display: none !important; } .search { width: 100% !important; } .action-row { flex-direction: column !important; align-items: stretch !important; width: 100% !important; } .action-row > button { width: 100% !important; } }
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
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null)
  const [suspending, setSuspending] = useState(false)
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

  // Suspend via the portal confirmation modal (reactivate stays a direct click).
  const confirmSuspend = async () => {
    if (!suspendTarget) return
    setSuspending(true)
    const { error } = await supabase.rpc('admin_update_profile_status', { p_id: suspendTarget.id, p_status: 'suspended' })
    if (error) { alert('Could not update: ' + error.message); setSuspending(false); return }
    setSellers(prev => prev.map(s => s.id === suspendTarget.id ? { ...s, status: 'suspended' } : s))
    setSuspending(false)
    setSuspendTarget(null)
  }

  // Permanently delete via the admin_delete_user RPC, then drop the row.
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: deleteTarget.id })
    if (error) { alert('Could not delete: ' + error.message); setDeleting(false); return }
    setSellers(prev => prev.filter(s => s.id !== deleteTarget.id))
    setDeleting(false)
    setDeleteTarget(null)
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
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/sellers'
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

  const activeCount = sellers.filter(s => s.status === 'active').length
  const pendingCount = sellers.filter(s => s.status === 'pending').length
  const suspendedCount = sellers.filter(s => s.status === 'suspended').length

  const stats = [
    { value:String(sellers.length), label:'Total sellers', color:'var(--text-primary)' },
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
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Sellers</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>{sellers.length} {sellers.length === 1 ? 'seller' : 'sellers'} registered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name or email…" style={{height:42, padding:'0 16px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        {/* Stats */}
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
            <div style={{padding:'52px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>No sellers found</div>
          ) : filtered.map((s, i) => (
            <div key={s.id} className="urow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', transition:'background 0.12s'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>{s.full_name?.[0]?.toUpperCase() || '?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                  <span style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.full_name || 'Unknown'}</span>
                  <span style={{background:statusBg(s.status), color:statusColor(s.status), padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{s.status}</span>
                </div>
                <div style={{fontSize:12, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.email} · joined {new Date(s.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ucounts" style={{display:'flex', gap:20, flexShrink:0, marginRight:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>{listingCounts[s.id] || 0}</div>
                  <div style={{fontSize:9, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Listings</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>{orderCounts[s.id] || 0}</div>
                  <div style={{fontSize:9, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Orders</div>
                </div>
              </div>
              <div className="action-row" style={{display:'flex', gap:8, flexShrink:0, flexWrap:'wrap'}}>
                <button className="view-btn action-btn" onClick={() => setViewSeller(s)} style={{height:34, padding:'0 14px', background:'transparent', color:'#2563EB', border:'1px solid rgba(37,99,235,0.5)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>View listings</button>
                {s.status !== 'active' && (
                  <button className="approve" disabled={busyId === s.id} onClick={() => setStatus(s.id, 'active')} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === s.id ? 0.6 : 1}}>{s.status === 'pending' ? 'Approve' : 'Reactivate'}</button>
                )}
                {s.status !== 'suspended' && (
                  <button className="reject action-btn" disabled={busyId === s.id} onClick={() => setSuspendTarget(s)} style={{height:34, padding:'0 14px', background:'#F59E0B', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === s.id ? 0.6 : 1}}>Suspend</button>
                )}
                <button className="del-row action-btn" onClick={() => setDeleteTarget(s)} style={{height:34, padding:'0 14px', background:'transparent', color:'#DC2626', border:'1px solid rgba(220,38,38,0.55)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewSeller && (() => {
        const sl = allListings.filter(l => l.seller_id === viewSeller.id)
        const lColor = (s: string) => s === 'live' ? '#34D399' : s === 'pending' ? '#FBBF24' : s === 'suspended' ? '#FF8A8A' : 'var(--text-secondary)'
        const lBg = (s: string) => s === 'live' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : s === 'suspended' ? 'rgba(255,138,138,0.14)' : 'var(--border-subtle)'
        return (
          <div onClick={() => setViewSeller(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, width:'100%', maxWidth:620, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
              <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                <div style={{minWidth:0}}>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{viewSeller.full_name || 'Seller'}&rsquo;s listings</h2>
                  <p style={{fontSize:12.5, color:'var(--text-secondary)', marginTop:2}}>{sl.length} {sl.length === 1 ? 'listing' : 'listings'} · all statuses</p>
                </div>
                <button onClick={() => setViewSeller(null)} style={{width:34, height:34, flexShrink:0, borderRadius:8, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-secondary)', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:'auto', padding:'8px 0'}}>
                {sl.length === 0 ? (
                  <div style={{padding:'44px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>This seller has no listings yet.</div>
                ) : sl.map(l => (
                  <div key={l.id} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 24px'}}>
                    <div style={{width:52, height:52, borderRadius:12, background:'var(--bg-card)', flexShrink:0, overflow:'hidden'}}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image_url && <img src={l.image_url} alt={l.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                      <div style={{fontSize:12, color:'var(--text-secondary)'}}>{l.cuisine} · £{parseFloat(l.price || '0').toFixed(2)} · {l.order_count || 0} orders</div>
                    </div>
                    <span style={{background:lBg(l.status), color:lColor(l.status), padding:'3px 11px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{l.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      <AdminSuspendModal
        isOpen={!!suspendTarget}
        userName={suspendTarget?.full_name || suspendTarget?.email || 'this user'}
        onConfirm={confirmSuspend}
        onCancel={() => { if (!suspending) setSuspendTarget(null) }}
        isSuspending={suspending}
      />
      <AdminDeleteModal
        isOpen={!!deleteTarget}
        userName={deleteTarget?.full_name || deleteTarget?.email || 'this user'}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null) }}
        isDeleting={deleting}
      />
    </div>
  )
}
