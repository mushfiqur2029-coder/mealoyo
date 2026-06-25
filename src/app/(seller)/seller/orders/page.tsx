'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'cooking', label: 'Start cooking' },
  cooking: { next: 'ready', label: 'Mark ready' },
  ready: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'delivered', label: 'Mark delivered' },
  delivered: null,
  cancelled: null,
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name,cuisine), profiles:buyer_id(full_name)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const advanceStatus = async (order: any) => {
    const step = STATUS_FLOW[order.status]
    if (!step) return
    setUpdatingId(order.id)
    const { error } = await supabase.from('orders').update({ status: step.next }).eq('id', order.id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: step.next } : o))
    }
    setUpdatingId(null)
  }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#E8930A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'
  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  const filters = ['all','pending','accepted','cooking','ready','picked_up','delivered','cancelled']
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600,fontSize:14}}>Loading orders...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .nav-link:hover{color:#C8006A!important;} .filter-pill:hover{border-color:#C8006A!important;} .advance-btn:hover{background:#A00055!important;} @media(max-width:768px){.nav-links{display:none!important;}}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:false},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:true},{l:'Earnings',h:'/seller/earnings',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Orders</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>{orders.length} {orders.length===1?'order':'orders'} total</p>
        </div>

        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,marginBottom:20}}>
          {filters.map(f => (
            <button key={f} onClick={()=>setFilter(f)} className="filter-pill" style={{flexShrink:0,height:36,padding:'0 16px',borderRadius:100,border:filter===f?'2px solid #C8006A':'1.5px solid #E0E0E0',background:filter===f?'#FFE8F4':'#fff',color:filter===f?'#C8006A':'#1A1A1A',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.14s'}}>{f.replace('_',' ')}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:48,marginBottom:16}}>📦</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No orders {filter !== 'all' ? `in "${filter.replace('_',' ')}"` : 'yet'}</h2>
            <p style={{fontSize:14,color:'#1A1A1A'}}>{filter === 'all' ? 'Orders will appear here once buyers start ordering your dishes.' : 'Try a different filter.'}</p>
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',overflow:'hidden'}}>
            {filtered.map((o,i) => {
              const step = STATUS_FLOW[o.status]
              return (
                <div key={o.id} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',borderBottom:i<filtered.length-1?'1px solid #F5F0F3':'none',flexWrap:'wrap'}}>
                  <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>
                    {cuisineEmoji[o.listings?.cuisine]||'🍽️'}
                  </div>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2}}>{o.listings?.name||'Order'}</div>
                    <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400}}>#{o.id.slice(0,8).toUpperCase()} · {o.profiles?.full_name||'Buyer'} · Qty {o.quantity} · {new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:4}}>£{parseFloat(o.seller_payout||0).toFixed(2)}</div>
                    <span style={{background:statusBg(o.status),color:statusColor(o.status),padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{o.status.replace('_',' ')}</span>
                  </div>
                  {step && (
                    <button onClick={()=>advanceStatus(o)} disabled={updatingId===o.id} className="advance-btn" style={{flexShrink:0,height:36,padding:'0 16px',background:'#C8006A',color:'#fff',border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:updatingId===o.id?'not-allowed':'pointer',opacity:updatingId===o.id?0.7:1,transition:'background 0.12s'}}>
                      {updatingId===o.id ? 'Updating...' : step.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
