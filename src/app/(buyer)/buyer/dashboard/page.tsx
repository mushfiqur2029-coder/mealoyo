'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BuyerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [deliveredCount, setDeliveredCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [reviewsGiven, setReviewsGiven] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data: orders } = await supabase.from('orders').select('*, listings(name,cuisine)').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id)
      setOrderCount(total ?? 0)
      const { count: delivered } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('status', 'delivered')
      setDeliveredCount(delivered ?? 0)
      const { count: inProgress } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).not('status', 'in', '(delivered,cancelled)')
      setInProgressCount(inProgress ?? 0)
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('buyer_id', user.id)
      setReviewsGiven(reviews || [])
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const statusColor = (s:string) => s==='delivered'?'#2DA84E':s==='cooking'?'#E8930A':s==='pending'?'#1A6ECC':'#C8006A'
  const statusBg = (s:string) => s==='delivered'?'#E4F6EA':s==='cooking'?'#FFF4E0':s==='pending'?'#EBF2FD':'#FFE8F4'
  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  if (loading) return (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{textAlign:'center'}}>
      <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{color:'#C8006A',fontWeight:600,fontSize:14}}>Loading...</p>
    </div>
  </div>)

  const avgRatingGiven = reviewsGiven.length
    ? (reviewsGiven.reduce((sum,r)=>sum+r.rating,0)/reviewsGiven.length).toFixed(1)
    : null

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .card-hover:hover{transform:translateY(-2px)!important;box-shadow:0 8px 24px rgba(200,0,106,0.1)!important;} .orow:hover{background:#FFF5FA!important;} .signout:hover{background:#FFE8F4!important;color:#C8006A!important;} .nav-link:hover{color:#C8006A!important;} @media(max-width:768px){.dash-grid{grid-template-columns:1fr 1fr!important;}.nav-links{display:none!important;}} @media(max-width:480px){.dash-grid{grid-template-columns:1fr!important;}}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/buyer/dashboard',a:true},{l:'Browse food',h:'/',a:false},{l:'My orders',h:'/buyer/orders',a:false},{l:'Saved',h:'/buyer/saved',a:false},{l:'Profile',h:'/buyer/profile',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center',flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff'}}>{profile?.full_name?.[0]||user?.email?.[0]?.toUpperCase()||'B'}</div>
            <button onClick={signOut} className="signout" style={{height:34,padding:'0 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',background:'#fff',transition:'all 0.12s'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,30px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Welcome back, {profile?.full_name?.split(' ')[0]||'there'} 👋</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>Here is what is happening with your orders today.</p>
        </div>

        <div className="dash-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
          {[
            {n:String(orderCount),l:'Total orders',icon:'🛒',color:'#C8006A',bg:'#FFE8F4'},
            {n:String(deliveredCount),l:'Delivered',icon:'✅',color:'#2DA84E',bg:'#E4F6EA'},
            {n:String(inProgressCount),l:'In progress',icon:'⏳',color:'#E8930A',bg:'#FFF4E0'},
            {n:avgRatingGiven?`${avgRatingGiven}★`:'—',l:'Avg rating given',icon:'⭐',color:'#1A6ECC',bg:'#EBF2FD'},
          ].map((s,i)=>(
            <div key={i} className="card-hover" style={{background:'#fff',borderRadius:16,padding:'18px 16px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',transition:'all 0.18s'}}>
              <div style={{width:38,height:38,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:s.color,letterSpacing:'-0.02em',lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:12,color:'#1A1A1A',marginTop:4,fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',marginBottom:24,overflow:'hidden'}}>
          <div style={{padding:'18px 22px',borderBottom:'1px solid #F5F0F3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A'}}>Recent orders</h2>
            <Link href="/buyer/orders" style={{fontSize:13,fontWeight:600,color:'#C8006A'}}>View all →</Link>
          </div>
          {orders.length === 0 ? (
            <div style={{padding:'40px 22px',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>🛒</div>
              <p style={{fontSize:14,color:'#1A1A1A',marginBottom:16}}>No orders yet. Find home cooks near you.</p>
              <Link href="/" style={{display:'inline-flex',alignItems:'center',height:40,padding:'0 20px',background:'#C8006A',color:'#fff',borderRadius:8,fontSize:13,fontWeight:700,boxShadow:'0 4px 12px rgba(200,0,106,0.25)'}}>Browse food →</Link>
            </div>
          ) : orders.map((o,i)=>(
            <Link key={o.id} href={`/buyer/orders/${o.id}`} className="orow" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 22px',borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none',transition:'background 0.12s',cursor:'pointer'}}>
              <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                {cuisineEmoji[o.listings?.cuisine]||'🍽️'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listings?.name||'Order'}</div>
                <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400}}>#{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:4}}>£{parseFloat(o.total_amount).toFixed(2)}</div>
                <span style={{background:statusBg(o.status),color:statusColor(o.status),padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{o.status}</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Link href="/" style={{background:'linear-gradient(135deg,#C8006A,#8B0047)',borderRadius:16,padding:'22px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 4px 16px rgba(200,0,106,0.3)'}}>
            <span style={{fontSize:28}}>🍽️</span>
            <div><div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:2}}>Order food now</div><div style={{fontSize:12,color:'rgba(255,255,255,0.75)'}}>Browse home cooks near you</div></div>
          </Link>
          <Link href="/buyer/orders" style={{background:'#fff',borderRadius:16,padding:'22px',display:'flex',alignItems:'center',gap:14,border:'1.5px solid rgba(200,0,106,0.1)',boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
            <span style={{fontSize:28}}>📦</span>
            <div><div style={{fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:2}}>All my orders</div><div style={{fontSize:12,color:'#1A1A1A',fontWeight:400}}>View full order history</div></div>
          </Link>
        </div>
      </div>
    </div>
  )
}
