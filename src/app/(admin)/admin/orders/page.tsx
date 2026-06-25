'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminOrders() {
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
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
      const { data } = await supabase.rpc('admin_get_all_orders')
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const cancelOrder = async (id: string) => {
    if (!confirm('Cancel this order?')) return
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_order_status', { p_id: id, p_status: 'cancelled' })
    if (error) { alert('Could not cancel: ' + error.message); setBusyId(null); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
    setBusyId(null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#E8930A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#FF6B6B' : '#5B9DF0'
  const statusBg = (s: string) => s === 'delivered' ? 'rgba(45,168,78,0.15)' : s === 'cooking' ? 'rgba(232,147,10,0.15)' : s === 'ready' ? 'rgba(200,0,106,0.15)' : s === 'cancelled' ? 'rgba(255,107,107,0.15)' : 'rgba(91,157,240,0.15)'

  const filters = ['all','pending','accepted','cooking','ready','picked_up','delivered','cancelled']
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading orders...</p></div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .nav-link:hover{color:#C8006A!important;} .filter-pill:hover{border-color:#C8006A!important;} .cancel-btn:hover{background:#991010!important;}`}</style>

      <nav style={{background:'rgba(0,0,0,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.2)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/admin/dashboard" style={{display:'flex',alignItems:'center',gap:10,marginRight:28,flexShrink:0}}>
            <img src="/White_Logo.png" alt="meaLoyo" style={{height:26,width:'auto'}}/>
            <span style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#C8006A'}}>Admin</span>
          </Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/admin/dashboard'},{l:'Sellers',h:'/admin/sellers'},{l:'Drivers',h:'/admin/drivers'},{l:'Orders',h:'/admin/orders'},{l:'Settings',h:'/admin/settings'}].map(t=>(
              <Link key={t.h} href={t.h} className="nav-link" style={{height:62,padding:'0 12px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.h==='/admin/orders'?700:400,color:t.h==='/admin/orders'?'#C8006A':'rgba(255,255,255,0.5)',borderBottom:t.h==='/admin/orders'?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Admin: {profile?.full_name||profile?.email}</span>
            <button onClick={signOut} style={{height:32,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.6)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Orders</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.45)'}}>{orders.length} {orders.length===1?'order':'orders'} platform-wide.</p>
        </div>

        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,marginBottom:20}}>
          {filters.map(f => (
            <button key={f} onClick={()=>setFilter(f)} className="filter-pill" style={{flexShrink:0,height:36,padding:'0 16px',borderRadius:100,border:filter===f?'2px solid #C8006A':'1px solid rgba(255,255,255,0.15)',background:filter===f?'rgba(200,0,106,0.15)':'rgba(255,255,255,0.05)',color:filter===f?'#C8006A':'rgba(255,255,255,0.6)',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.14s'}}>{f.replace('_',' ')}</button>
          ))}
        </div>

        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:14}}>No orders {filter!=='all'?`in "${filter.replace('_',' ')}"`:''}</div>
          ) : filtered.map((o,i) => (
            <div key={o.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 110px 90px',alignItems:'center',gap:14,padding:'14px 22px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listing_name||'Order'}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>#{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>Buyer</div>
                <div style={{fontSize:13,color:'#fff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.buyer_name||'Unknown'}</div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>Seller</div>
                <div style={{fontSize:13,color:'#fff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.seller_name||'Unknown'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#fff',marginBottom:4}}>£{parseFloat(o.total_amount||0).toFixed(2)}</div>
                <span style={{background:statusBg(o.status),color:statusColor(o.status),padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize',whiteSpace:'nowrap'}}>{o.status.replace('_',' ')}</span>
              </div>
              <div style={{textAlign:'right'}}>
                {o.status !== 'delivered' && o.status !== 'cancelled' && (
                  <button className="cancel-btn" disabled={busyId===o.id} onClick={()=>cancelOrder(o.id)} style={{height:32,padding:'0 14px',background:'rgba(192,57,43,0.8)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'background 0.12s',opacity:busyId===o.id?0.6:1}}>Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
