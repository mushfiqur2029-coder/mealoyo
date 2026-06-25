'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminSellers() {
  const [profile, setProfile] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({})
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as any)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)

      const { data: sellerRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' })
      setSellers((sellerRows || []).sort((a: any, b: any) => a.full_name?.localeCompare(b.full_name)))

      const { data: listings } = await supabase.rpc('admin_get_all_listings')
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
  }, [])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_profile_status', { p_id: id, p_status: status })
    if (error) { alert('Could not update: ' + error.message); setBusyId(null); return }
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    setBusyId(null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'active' ? '#2DA84E' : s === 'pending' ? '#E8930A' : '#FF6B6B'
  const statusBg = (s: string) => s === 'active' ? 'rgba(45,168,78,0.15)' : s === 'pending' ? 'rgba(232,147,10,0.15)' : 'rgba(255,107,107,0.15)'

  const filtered = sellers.filter(s =>
    !search.trim() ||
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading sellers...</p></div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .approve:hover{background:#009836!important;} .reject:hover{background:#991010!important;} .nav-link:hover{color:#C8006A!important;}`}</style>

      <nav style={{background:'rgba(0,0,0,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.2)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/admin/dashboard" style={{display:'flex',alignItems:'center',gap:10,marginRight:28,flexShrink:0}}>
            <img src="/White_Logo.png" alt="meaLoyo" style={{height:26,width:'auto'}}/>
            <span style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#C8006A'}}>Admin</span>
          </Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/admin/dashboard'},{l:'Sellers',h:'/admin/sellers'},{l:'Drivers',h:'/admin/drivers'},{l:'Orders',h:'/admin/orders'},{l:'Settings',h:'/admin/settings'}].map(t=>(
              <Link key={t.h} href={t.h} className="nav-link" style={{height:62,padding:'0 12px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.h==='/admin/sellers'?700:400,color:t.h==='/admin/sellers'?'#C8006A':'rgba(255,255,255,0.5)',borderBottom:t.h==='/admin/sellers'?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Admin: {profile?.full_name||profile?.email}</span>
            <button onClick={signOut} style={{height:32,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.6)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Sellers</h1>
            <p style={{fontSize:14,color:'rgba(255,255,255,0.45)'}}>{sellers.length} {sellers.length===1?'seller':'sellers'} registered.</p>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email..." style={{height:40,padding:'0 16px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,fontSize:13,color:'#fff',background:'rgba(255,255,255,0.05)',width:280,outline:'none'}}/>
        </div>

        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:14}}>No sellers found</div>
          ) : filtered.map((s,i) => (
            <div key={s.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 22px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.05)':'none',flexWrap:'wrap'}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>
                {s.full_name?.[0]||'?'}
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:1}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>{s.full_name||'Unknown'}</span>
                  <span style={{background:statusBg(s.status),color:statusColor(s.status),padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'capitalize'}}>{s.status}</span>
                </div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{s.email} · joined {new Date(s.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{display:'flex',gap:18,flexShrink:0,marginRight:8}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{listingCounts[s.id]||0}</div>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em'}}>Listings</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{orderCounts[s.id]||0}</div>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em'}}>Orders</div>
                </div>
              </div>
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                {s.status !== 'active' && (
                  <button className="approve" disabled={busyId===s.id} onClick={()=>setStatus(s.id,'active')} style={{height:32,padding:'0 16px',background:'#2DA84E',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'background 0.12s',opacity:busyId===s.id?0.6:1}}>{s.status==='pending'?'Approve':'Reactivate'}</button>
                )}
                {s.status !== 'suspended' && (
                  <button className="reject" disabled={busyId===s.id} onClick={()=>setStatus(s.id,'suspended')} style={{height:32,padding:'0 14px',background:'rgba(192,57,43,0.8)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'background 0.12s',opacity:busyId===s.id?0.6:1}}>Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
