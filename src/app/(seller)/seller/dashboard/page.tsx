'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile, Listing, Order, Review } from '@/lib/types'

export default function SellerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [deliveredOrders, setDeliveredOrders] = useState<Pick<Order, 'seller_payout'>[]>([])
  const [reviews, setReviews] = useState<Pick<Review, 'rating'>[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data: listings } = await supabase.from('listings').select('*').eq('seller_id', user.id)
      setListings(listings || [])
      const { data: orders } = await supabase.from('orders').select('*, listings(name)').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id)
      setOrderCount(total ?? 0)
      const { data: delivered } = await supabase.from('orders').select('seller_payout').eq('seller_id', user.id).eq('status', 'delivered')
      setDeliveredOrders(delivered || [])
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('seller_id', user.id)
      setReviews(reviews || [])
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
      <p style={{color:'#C8006A',fontWeight:600,fontSize:14}}>Loading...</p>
    </div>
  </div>)

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

  const statusColor = (s:string) => s==='delivered'?'#2DA84E':s==='cooking'?'#E8930A':s==='ready'?'#C8006A':'#1A6ECC'
  const statusBg = (s:string) => s==='delivered'?'#E4F6EA':s==='cooking'?'#FFF4E0':s==='ready'?'#FFE8F4':'#EBF2FD'
  const liveListings = listings.filter(l=>l.status==='live').length
  const totalEarnings = deliveredOrders.reduce((sum,o)=>sum+parseFloat(o.seller_payout||'0'),0)
  const avgRating = reviews.length ? (reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1) : null

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .card-hover:hover{transform:translateY(-2px)!important;} .orow:hover{background:#FFF5FA!important;} .signout:hover{background:#FFE8F4!important;color:#C8006A!important;} @media(max-width:768px){.dash-grid{grid-template-columns:1fr 1fr!important;}.nav-links{display:none!important;}.two-col{grid-template-columns:1fr!important;}} @media(max-width:480px){.dash-grid{grid-template-columns:1fr!important;}}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><Logo height={34}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:true},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false},{l:'Profile',h:'/seller/profile',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff'}}>{profile?.full_name?.[0]||'S'}</div>
            <button onClick={signOut} className="signout" style={{height:34,padding:'0 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',background:'#fff',transition:'all 0.12s'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,30px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Seller dashboard 👩‍🍳</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>Welcome back, {profile?.full_name?.split(' ')[0]||'Chef'}.</p>
        </div>

        <div className="dash-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          {[
            {n:`£${totalEarnings.toFixed(2)}`,l:'Total earned',icon:'💳',color:'#C8006A',bg:'#FFE8F4'},
            {n:String(orderCount),l:'Total orders',icon:'📦',color:'#2DA84E',bg:'#E4F6EA'},
            {n:String(liveListings),l:'Live listings',icon:'🍽️',color:'#1A6ECC',bg:'#EBF2FD'},
            {n:avgRating?`${avgRating}★`:'—',l:'Your rating',icon:'⭐',color:'#E8930A',bg:'#FFF4E0'},
          ].map((s,i)=>(
            <div key={i} className="card-hover" style={{background:'#fff',borderRadius:16,padding:'18px 16px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',transition:'all 0.18s'}}>
              <div style={{width:38,height:38,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:s.color,letterSpacing:'-0.02em',lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:12,color:'#1A1A1A',marginTop:4,fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div style={{background:'linear-gradient(135deg,#C8006A,#8B0047)',borderRadius:20,padding:'24px',boxShadow:'0 4px 20px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Wallet balance</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:38,fontWeight:700,color:'#fff',letterSpacing:'-0.03em',marginBottom:4}}>£{totalEarnings.toFixed(2)}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginBottom:20}}>From {deliveredOrders.length} delivered orders</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button style={{height:38,background:'rgba(255,255,255,0.18)',color:'#fff',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Withdraw</button>
              <Link href="/seller/earnings" style={{height:38,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.75)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,fontSize:13,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>History</Link>
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:20,overflow:'hidden',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #F5F0F3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A'}}>Recent orders</h3>
              <Link href="/seller/orders" style={{fontSize:12,fontWeight:600,color:'#C8006A'}}>View all →</Link>
            </div>
            {orders.length === 0 ? (
              <div style={{padding:'32px',textAlign:'center'}}>
                <p style={{fontSize:13,color:'#1A1A1A',marginBottom:12}}>No orders yet.</p>
                <Link href="/seller/listings/new" style={{display:'inline-flex',alignItems:'center',height:36,padding:'0 16px',background:'#C8006A',color:'#fff',borderRadius:8,fontSize:12,fontWeight:700}}>Add first listing →</Link>
              </div>
            ) : orders.map((o,i)=>(
              <div key={o.id} className="orow" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none',transition:'background 0.12s'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1A1A1A',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listings?.name||'Order'}</div>
                  <div style={{fontSize:11,color:'#1A1A1A',fontWeight:400}}>#{o.id.slice(0,8).toUpperCase()}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:13,fontWeight:700,color:'#1A1A1A',marginBottom:3}}>£{parseFloat(o.seller_payout||'0').toFixed(2)}</div>
                  <span style={{background:statusBg(o.status),color:statusColor(o.status),padding:'2px 7px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'capitalize'}}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
