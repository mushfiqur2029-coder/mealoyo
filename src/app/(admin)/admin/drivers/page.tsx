'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile } from '@/lib/types'

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
  input::placeholder { color: rgba(255,255,255,0.35); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 640px) { .ustats { grid-template-columns: 1fr 1fr 1fr !important; } .ucounts { display: none !important; } .search { width: 100% !important; } }
`

export default function AdminDrivers() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [drivers, setDrivers] = useState<Profile[]>([])
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
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

      const { data: driverRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'driver' })
      setDrivers((driverRows || []).sort((a: Profile, b: Profile) => (a.full_name || '').localeCompare(b.full_name || '')))

      const { data: orders } = await supabase.rpc('admin_get_all_orders')
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
            const active = t.h === '/admin/drivers'
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

  const activeCount = drivers.filter(d => d.status === 'active').length
  const pendingCount = drivers.filter(d => d.status === 'pending').length
  const suspendedCount = drivers.filter(d => d.status === 'suspended').length

  const stats = [
    { value:String(drivers.length), label:'Total drivers', color:'#fff' },
    { value:String(activeCount), label:'Active', color:'#34D399' },
    { value:String(pendingCount), label:'Pending', color:'#FBBF24' },
  ]

  const tabCount = (k: string) => k === 'all' ? drivers.length : k === 'active' ? activeCount : k === 'pending' ? pendingCount : suspendedCount

  const filtered = drivers
    .filter(d => tab === 'all' || d.status === tab)
    .filter(d => !search.trim() || d.full_name?.toLowerCase().includes(search.toLowerCase()) || d.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>Drivers</h1>
            <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>{drivers.length} {drivers.length === 1 ? 'driver' : 'drivers'} registered.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name or email…" style={{height:42, padding:'0 16px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, fontSize:13, color:'#fff', background:'rgba(255,255,255,0.05)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        <div className="ustats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="fade-up" style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:18}}>
          {TABS.map(t => {
            const on = tab === t.k
            return <button key={t.k} onClick={() => setTab(t.k)} className="tab" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid rgba(255,255,255,0.14)', background:on ? 'rgba(200,0,106,0.15)' : 'rgba(255,255,255,0.04)', color:on ? '#fff' : 'rgba(255,255,255,0.55)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{t.l} <span style={{opacity:0.6, marginLeft:2}}>{tabCount(t.k)}</span></button>
          })}
        </div>

        <div className="fade-up" style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'52px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>No drivers found</div>
          ) : filtered.map((d, i) => (
            <div key={d.id} className="urow" style={{display:'flex', alignItems:'center', gap:14, padding:'15px 22px', borderBottom:i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition:'background 0.12s'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', flexShrink:0}}>{d.full_name?.[0]?.toUpperCase() || '?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                  <span style={{fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.full_name || 'Unknown'}</span>
                  <span style={{background:statusBg(d.status), color:statusColor(d.status), padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, textTransform:'capitalize', flexShrink:0}}>{d.status}</span>
                </div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.email} · joined {new Date(d.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
              </div>
              <div className="ucounts" style={{display:'flex', gap:20, flexShrink:0, marginRight:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>{deliveryCounts[d.id] || 0}</div>
                  <div style={{fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Deliveries</div>
                </div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                {d.status !== 'active' && (
                  <button className="approve" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'active')} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === d.id ? 0.6 : 1}}>{d.status === 'pending' ? 'Approve' : 'Reactivate'}</button>
                )}
                {d.status !== 'suspended' && (
                  <button className="reject" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'suspended')} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === d.id ? 0.6 : 1}}>Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
