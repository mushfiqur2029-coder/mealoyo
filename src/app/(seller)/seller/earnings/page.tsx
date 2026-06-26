'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Profile } from '@/lib/types'

export default function SellerEarnings() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name)')
        .eq('seller_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600,fontSize:14}}>Loading earnings...</p>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,system-ui,sans-serif',padding:24}}>
      <div style={{background:'#fff',borderRadius:24,padding:'48px 36px',maxWidth:480,width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56,marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1A1A',marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.7,marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44,padding:'0 24px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const totalEarned = orders.reduce((sum,o)=>sum+parseFloat(o.seller_payout||'0'),0)
  const totalCommission = orders.reduce((sum,o)=>sum+parseFloat(o.platform_commission||'0'),0)

  const now = new Date()
  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthEarned = thisMonthOrders.reduce((sum,o)=>sum+parseFloat(o.seller_payout||'0'),0)

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .nav-link:hover{color:#C8006A!important;} .erow:hover{background:#FFF5FA!important;} @media(max-width:768px){.nav-links{display:none!important;}.earn-grid{grid-template-columns:1fr 1fr!important;}}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><Logo height={34}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:false},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:true},{l:'Profile',h:'/seller/profile',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Earnings</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>Your full payout history from delivered orders.</p>
        </div>

        <div className="earn-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:28}}>
          <div style={{background:'linear-gradient(135deg,#C8006A,#8B0047)',borderRadius:18,padding:'22px',boxShadow:'0 4px 20px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Total earned</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:30,fontWeight:700,color:'#fff',letterSpacing:'-0.02em'}}>£{totalEarned.toFixed(2)}</div>
          </div>
          <div style={{background:'#fff',borderRadius:18,padding:'22px',border:'1.5px solid rgba(200,0,106,0.07)',boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>This month</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:30,fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.02em'}}>£{thisMonthEarned.toFixed(2)}</div>
          </div>
          <div style={{background:'#fff',borderRadius:18,padding:'22px',border:'1.5px solid rgba(200,0,106,0.07)',boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Platform fees paid</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:30,fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.02em'}}>£{totalCommission.toFixed(2)}</div>
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F5F0F3'}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A'}}>Payout history</h2>
          </div>
          {orders.length === 0 ? (
            <div style={{padding:'48px 20px',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>💳</div>
              <p style={{fontSize:14,color:'#1A1A1A'}}>No payouts yet. Earnings appear here once an order is delivered.</p>
            </div>
          ) : orders.map((o,i) => (
            <div key={o.id} className="erow" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none',transition:'background 0.12s'}}>
              <div style={{width:42,height:42,borderRadius:11,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🍽️</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listings?.name||'Order'}</div>
                <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400}}>#{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#2DA84E'}}>+£{parseFloat(o.seller_payout||'0').toFixed(2)}</div>
                <div style={{fontSize:11,color:'#1A1A1A'}}>after £{parseFloat(o.platform_commission||'0').toFixed(2)} fee</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
