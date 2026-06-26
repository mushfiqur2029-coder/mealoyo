
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order } from '@/lib/types'

export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name, price, cuisine)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const statusColor = (s:string) => s==='delivered'?'#2DA84E':s==='cooking'?'#E8930A':s==='pending'?'#1A6ECC':'#C8006A'
  const statusBg = (s:string) => s==='delivered'?'#E4F6EA':s==='cooking'?'#FFF4E0':s==='pending'?'#EBF2FD':'#FFE8F4'
  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading orders...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        .orow:hover{background:#FFF5FA !important;}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/buyer/dashboard" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:500}}>My orders</span>
          <div style={{display:'flex',gap:16,marginLeft:'auto'}}>
            <Link href="/buyer/saved" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Saved</Link>
            <Link href="/buyer/profile" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Profile</Link>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 20px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,26px)',fontWeight:700,color:'#1A1A1A',marginBottom:20}}>My orders</h1>

        {orders.length === 0 ? (
          <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:48,marginBottom:16}}>🛒</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No orders yet</h2>
            <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24,lineHeight:1.65}}>Browse home cooks near you and place your first order.</p>
            <Link href="/" style={{display:'inline-flex',alignItems:'center',height:46,padding:'0 28px',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
              Browse food →
            </Link>
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',overflow:'hidden'}}>
            {orders.map((o,i)=>(
              <Link key={o.id} href={`/buyer/orders/${o.id}`} className="orow" style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none',transition:'background 0.12s',cursor:'pointer'}}>
                <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>
                  {cuisineEmoji[o.listings?.cuisine||'Other']||'🍽️'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listings?.name||'Order'}</div>
                  <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400}}>Order #{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:4}}>£{parseFloat(o.total_amount).toFixed(2)}</div>
                  <span style={{background:statusBg(o.status),color:statusColor(o.status),padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{o.status}</span>
                </div>
                <span style={{fontSize:18,color:'#C8006A',flexShrink:0}}>→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
