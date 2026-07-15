'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import type { Profile } from '@/lib/types'

// Pending sellers, drivers and listings are all rendered through the same row
// template, so a single shape covering both profile and listing fields fits.
type PendingItem = {
  id: string
  full_name?: string | null
  name?: string | null
  email?: string | null
  cuisine?: string | null
  created_at: string
}
type AdminOrderRow = { id?: string; status: string; platform_commission?: string | null; driver_commission?: string | null; total?: string | null; created_at?: string | null }
type Stats = { users: number; sellers: number; drivers: number; orders: number; listings: number; revenue: number }

// Compact relative time, e.g. "3m ago", "2h ago", "5d ago".
function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Buyers', h:'/admin/buyers' },
  { l:'Listings', h:'/admin/listings' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Withdrawals', h:'/admin/withdrawals' },
  { l:'Settings', h:'/admin/settings' },
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
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .quick:hover { border-color: rgba(200,0,106,0.5) !important; background: rgba(200,0,106,0.07) !important; transform: translateY(-2px); }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .admin-grid { grid-template-columns: 1fr 1fr !important; } .quick-grid { grid-template-columns: 1fr 1fr !important; } }
  @media (max-width: 480px) { .admin-grid { grid-template-columns: 1fr 1fr !important; } }
`

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [sellers, setSellers] = useState<PendingItem[]>([])
  const [drivers, setDrivers] = useState<PendingItem[]>([])
  const [listings, setListings] = useState<PendingItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)
      const { data: avatarRow } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
      setAvatarUrl(avatarRow?.avatar_url || null)

      const [
        { data: pendingSellers }, { data: pendingDrivers }, { data: pendingListings },
        { data: allSellers }, { data: allBuyers }, { data: allDrivers },
        { data: allOrders }, { data: allListings },
      ] = await Promise.all([
        supabase.rpc('admin_get_profiles_by_status', { p_role: 'seller', p_status: 'pending' }),
        supabase.rpc('admin_get_profiles_by_status', { p_role: 'driver', p_status: 'pending' }),
        supabase.rpc('admin_get_listings_by_status', { p_status: 'pending' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'buyer' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'driver' }),
        supabase.rpc('admin_get_all_orders'),
        supabase.rpc('admin_get_all_listings'),
      ])

      setSellers(pendingSellers || [])
      setDrivers(pendingDrivers || [])
      setListings(pendingListings || [])

      const orderRows = (allOrders as AdminOrderRow[] | null) || []
      // Platform revenue = food commission (12% of seller subtotal) + driver
      // commission (20% of delivery fee) on every delivered order.
      const revenue = orderRows
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + parseFloat(o.platform_commission || '0') + parseFloat(o.driver_commission || '0'), 0)

      setRecentOrders(
        orderRows
          .slice()
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 6)
      )

      setStats({
        sellers: allSellers?.length || 0,
        drivers: allDrivers?.length || 0,
        users: (allSellers?.length || 0) + (allBuyers?.length || 0) + (allDrivers?.length || 0),
        orders: allOrders?.length || 0,
        listings: allListings?.length || 0,
        revenue,
      })
      setLoading(false)
    }
    getData()
  }, [router])

  const approve = async (id: string, type: 'profile' | 'listing') => {
    if (type === 'profile') {
      const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: 'active' })
      if (error) { alert('Could not approve: ' + error.message); return }
      setSellers(prev => prev.filter(s => s.id !== id))
      setDrivers(prev => prev.filter(d => d.id !== id))
    } else {
      const { error } = await supabase.rpc('admin_update_listing_status', { p_id: id, p_status: 'live' })
      if (error) { alert('Could not approve: ' + error.message); return }
      setListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const reject = async (id: string, type: 'profile' | 'listing') => {
    if (type === 'profile') {
      const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: 'suspended' })
      if (error) { alert('Could not reject: ' + error.message); return }
      setSellers(prev => prev.filter(s => s.id !== id))
      setDrivers(prev => prev.filter(d => d.id !== id))
    } else {
      const { error } = await supabase.rpc('admin_update_listing_status', { p_id: id, p_status: 'suspended' })
      if (error) { alert('Could not reject: ' + error.message); return }
      setListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/dashboard'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'A'}/>
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
        <div className="skelD" style={{height:28, width:240, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:200, borderRadius:6, marginBottom:26}}/>
        <div className="admin-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:108, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:300, borderRadius:18}}/>
      </div>
    </div>
  )

  const totalPending = sellers.length + drivers.length + listings.length

  const overview = [
    { value:String(stats?.users ?? 0), label:'Total users', icon:'👥', color:'var(--text-primary)' },
    { value:String(stats?.orders ?? 0), label:'Total orders', icon:'📦', color:'var(--text-primary)' },
    { value:`£${(stats?.revenue ?? 0).toFixed(2)}`, label:'Platform revenue', icon:'💷', color:'#34D399' },
    { value:String(stats?.listings ?? 0), label:'Total listings', icon:'🍽️', color:'var(--text-primary)' },
  ]

  const quickLinks = [
    { l:'Sellers', s:`${stats?.sellers ?? 0} total`, i:'👩‍🍳', h:'/admin/sellers' },
    { l:'Drivers', s:`${stats?.drivers ?? 0} total`, i:'🚴', h:'/admin/drivers' },
    { l:'Orders', s:`${stats?.orders ?? 0} total`, i:'📦', h:'/admin/orders' },
    { l:'Settings', s:'Platform config', i:'⚙️', h:'/admin/settings' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12, marginBottom:24}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Platform overview</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>meaLoyo admin — full control panel</p>
          </div>
          {totalPending > 0 && (
            <span style={{display:'inline-flex', alignItems:'center', gap:7, height:34, padding:'0 14px', background:'rgba(232,147,10,0.14)', border:'1px solid rgba(232,147,10,0.35)', borderRadius:100, fontSize:13, fontWeight:700, color:'#FBBF24'}}>⏳ {totalPending} pending approval{totalPending === 1 ? '' : 's'}</span>
          )}
        </div>

        {/* Platform stats */}
        <div className="admin-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {overview.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:20, marginBottom:9}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="quick-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28}}>
          {quickLinks.map((a, i) => (
            <Link key={i} href={a.h} className="quick" style={{display:'flex', alignItems:'center', gap:13, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'16px', transition:'all 0.16s'}}>
              <div style={{width:40, height:40, borderRadius:11, background:'rgba(200,0,106,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{a.i}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{a.l}</div>
                <div style={{fontSize:12, color:'var(--text-secondary)', marginTop:1}}>{a.s}</div>
              </div>
              <span style={{fontSize:15, color:'#C8006A', flexShrink:0}}>→</span>
            </Link>
          ))}
        </div>

        <h2 className="fade-up" style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:14}}>Approval queue</h2>

        {/* Pending approvals */}
        {[
          { title:'Pending seller approvals', items:sellers, badge:'#E8930A', type:'profile' as const, empty:'No sellers awaiting approval' },
          { title:'Pending driver approvals', items:drivers, badge:'#2DA84E', type:'profile' as const, empty:'No drivers awaiting approval' },
          { title:'Pending listing approvals', items:listings, badge:'#1A6ECC', type:'listing' as const, empty:'No listings awaiting approval' },
        ].map(section => (
          <div key={section.title} className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden', marginBottom:16}}>
            <div style={{padding:'16px 22px', borderBottom:'1px solid var(--bg-secondary)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center'}}>
                {section.title}
                {section.items.length > 0 && <span style={{marginLeft:8, background:section.badge, color:'var(--text-primary)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20}}>{section.items.length}</span>}
              </h3>
            </div>
            {section.items.length === 0 ? (
              <div style={{padding:'30px 22px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>{section.empty}</div>
            ) : section.items.map((item, i) => (
              <div key={item.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 22px', borderBottom:i < section.items.length - 1 ? '1px solid var(--border-subtle)' : 'none'}}>
                <div style={{width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A,#7A0042)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0}}>
                  {(item.full_name || item.name || '?')[0]?.toUpperCase()}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.full_name || item.name || 'Unknown'}</div>
                  <div style={{fontSize:12, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.email || item.cuisine || ''} · applied {timeAgo(item.created_at)}</div>
                </div>
                <div style={{display:'flex', gap:8, flexShrink:0}}>
                  <button className="approve" onClick={() => approve(item.id, section.type)} style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Approve</button>
                  <button className="reject" onClick={() => reject(item.id, section.type)} style={{height:34, padding:'0 14px', background:'rgba(192,57,43,0.85)', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Recent activity */}
        <h2 className="fade-up" style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:'12px 0 14px'}}>Recent activity</h2>
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
          {recentOrders.length === 0 ? (
            <div style={{padding:'30px 22px', textAlign:'center', color:'var(--text-secondary)', fontSize:14}}>No orders yet</div>
          ) : recentOrders.map((o, i) => {
            const delivered = o.status === 'delivered'
            const dot = delivered ? '#34D399' : o.status === 'cancelled' ? '#C0392B' : '#E8930A'
            return (
              <div key={o.id || i} style={{display:'flex', alignItems:'center', gap:14, padding:'13px 22px', borderBottom:i < recentOrders.length - 1 ? '1px solid var(--border-subtle)' : 'none'}}>
                <span style={{width:9, height:9, borderRadius:'50%', background:dot, flexShrink:0, boxShadow:`0 0 0 3px ${dot}22`}}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    Order {o.id ? `#${o.id.slice(0, 8)}` : ''} <span style={{color:'var(--text-secondary)', fontWeight:500, textTransform:'capitalize'}}>· {o.status}</span>
                  </div>
                  <div style={{fontSize:12, color:'var(--text-secondary)'}}>{timeAgo(o.created_at)}</div>
                </div>
                {o.total != null && <span style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:delivered ? '#34D399' : 'var(--text-primary)', flexShrink:0}}>£{parseFloat(o.total || '0').toFixed(2)}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
