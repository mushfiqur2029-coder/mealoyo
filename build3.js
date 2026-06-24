const fs = require('fs')
const path = require('path')
const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('✓', filePath)
}

const loadingSpinner = `
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{textAlign:'center'}}>
      <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
      <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
      <p style={{color:'#C8006A',fontWeight:600,fontSize:14}}>Loading...</p>
    </div>
  </div>`

// ── BUYER DASHBOARD ───────────────────────────────────
write('src/app/(buyer)/buyer/dashboard/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BuyerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      const { data: orders } = await supabase.from('orders').select('*, listings(name,cuisine)').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const statusColor = (s:string) => s==='delivered'?'#2DA84E':s==='cooking'?'#E8930A':s==='pending'?'#1A6ECC':'#C8006A'
  const statusBg = (s:string) => s==='delivered'?'#E4F6EA':s==='cooking'?'#FFF4E0':s==='pending'?'#EBF2FD':'#FFE8F4'
  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  if (loading) return (${loadingSpinner})

  const delivered = orders.filter(o=>o.status==='delivered').length
  const inProgress = orders.filter(o=>o.status!=='delivered'&&o.status!=='cancelled').length

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .card-hover:hover{transform:translateY(-2px)!important;box-shadow:0 8px 24px rgba(200,0,106,0.1)!important;} .orow:hover{background:#FFF5FA!important;} .signout:hover{background:#FFE8F4!important;color:#C8006A!important;} .nav-link:hover{color:#C8006A!important;} @media(max-width:768px){.dash-grid{grid-template-columns:1fr 1fr!important;}.nav-links{display:none!important;}} @media(max-width:480px){.dash-grid{grid-template-columns:1fr!important;}}\`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/buyer/dashboard',a:true},{l:'Browse food',h:'/',a:false},{l:'My orders',h:'/buyer/orders',a:false}].map((t,i)=>(
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
            {n:String(orders.length),l:'Total orders',icon:'🛒',color:'#C8006A',bg:'#FFE8F4'},
            {n:String(delivered),l:'Delivered',icon:'✅',color:'#2DA84E',bg:'#E4F6EA'},
            {n:String(inProgress),l:'In progress',icon:'⏳',color:'#E8930A',bg:'#FFF4E0'},
            {n:'4.8★',l:'Avg rating given',icon:'⭐',color:'#1A6ECC',bg:'#EBF2FD'},
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
            <Link key={o.id} href={\`/buyer/orders/\${o.id}\`} className="orow" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 22px',borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none',transition:'background 0.12s',cursor:'pointer'}}>
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
`)

// ── SELLER DASHBOARD ──────────────────────────────────
write('src/app/(seller)/seller/dashboard/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SellerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      const { data: listings } = await supabase.from('listings').select('*').eq('seller_id', user.id)
      setListings(listings || [])
      const { data: orders } = await supabase.from('orders').select('*, listings(name)').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (${loadingSpinner})

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
  const totalEarnings = orders.filter(o=>o.status==='delivered').reduce((sum,o)=>sum+parseFloat(o.seller_payout||0),0)

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;color:inherit;} .card-hover:hover{transform:translateY(-2px)!important;} .orow:hover{background:#FFF5FA!important;} .signout:hover{background:#FFE8F4!important;color:#C8006A!important;} @media(max-width:768px){.dash-grid{grid-template-columns:1fr 1fr!important;}.nav-links{display:none!important;}.two-col{grid-template-columns:1fr!important;}} @media(max-width:480px){.dash-grid{grid-template-columns:1fr!important;}}\`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:true},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false}].map((t,i)=>(
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
            {n:\`£\${totalEarnings.toFixed(2)}\`,l:'Total earned',icon:'💳',color:'#C8006A',bg:'#FFE8F4'},
            {n:String(orders.length),l:'Total orders',icon:'📦',color:'#2DA84E',bg:'#E4F6EA'},
            {n:String(liveListings),l:'Live listings',icon:'🍽️',color:'#1A6ECC',bg:'#EBF2FD'},
            {n:'4.9★',l:'Your rating',icon:'⭐',color:'#E8930A',bg:'#FFF4E0'},
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
            <div style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginBottom:20}}>From {orders.filter(o=>o.status==='delivered').length} delivered orders</div>
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
                  <div style={{fontFamily:'Georgia,serif',fontSize:13,fontWeight:700,color:'#1A1A1A',marginBottom:3}}>£{parseFloat(o.seller_payout||0).toFixed(2)}</div>
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
`)

// ── DRIVER DASHBOARD ──────────────────────────────────
write('src/app/(driver)/driver/dashboard/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DriverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0D0D',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading...</p></div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh',background:'#0D0D0D',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,system-ui,sans-serif',padding:24}}>
      <div style={{background:'#1A1A1A',borderRadius:24,padding:'48px 36px',maxWidth:480,width:'100%',textAlign:'center',border:'1px solid rgba(200,0,106,0.2)'}}>
        <div style={{fontSize:56,marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#fff',marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14,color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:24}}>Your driver account is under review. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44,padding:'0 24px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const jobs = [
    {id:1,from:'East London',to:'Ilford',dish:'Biryani for 2',pay:'£4.50',dist:'1.8 km',time:'Ready now',color:'#2DA84E'},
    {id:2,from:'West London',to:'Hammersmith',dish:'Curry box',pay:'£5.50',dist:'2.4 km',time:'10 min wait',color:'#E8930A'},
    {id:3,from:'South London',to:'Brixton',dish:'Catering order',pay:'£8.00',dist:'3.1 km',time:'30 min',color:'#C8006A'},
  ]

  return (
    <div style={{minHeight:'100vh',background:'#0D0D0D',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .job:hover{border-color:#C8006A!important;background:rgba(200,0,106,0.06)!important;} .accept:hover{background:#009836!important;} @media(max-width:768px){.driver-grid{grid-template-columns:1fr 1fr!important;}}\`}</style>

      <nav style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.15)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28}}><img src="/White_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',a:true},{l:'My earnings',a:false},{l:'History',a:false}].map((t,i)=>(
              <a key={i} href="#" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'rgba(255,255,255,0.55)',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t.l}</a>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#2DA84E',flexShrink:0}}/>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.6)',fontWeight:500}}>Online</span>
            <div style={{width:34,height:34,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',marginLeft:8}}>{profile?.full_name?.[0]||'D'}</div>
            <button onClick={signOut} style={{height:34,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.7)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Driver dashboard 🚴</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.55)'}}>Welcome back, {profile?.full_name?.split(' ')[0]||'Driver'}. You have {jobs.length} jobs available near you.</p>
        </div>

        <div className="driver-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          {[{n:'7',l:'Drops today',color:'#fff'},{n:'3.5h',l:'Active time',color:'#fff'},{n:'£35',l:"Today's pay",color:'#86EFAC'},{n:'4.9★',l:'Your rating',color:'#C8006A'}].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'16px',border:'1px solid rgba(255,255,255,0.08)',textAlign:'center'}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:s.color,letterSpacing:'-0.02em',marginBottom:4}}>{s.n}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#fff',marginBottom:16}}>Available jobs near you</h2>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {jobs.map(j=>(
            <div key={j.id} className="job" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,transition:'all 0.14s',cursor:'pointer'}}>
              <div style={{width:42,height:42,borderRadius:10,background:j.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🚴</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:2}}>{j.from} → {j.to}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.dist} · {j.dish} · {j.time}</div>
              </div>
              <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#86EFAC',flexShrink:0}}>{j.pay}</div>
              <button className="accept" style={{height:34,padding:'0 16px',background:'#2DA84E',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0,transition:'background 0.12s'}}>Accept</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
`)

// ── ADMIN DASHBOARD ───────────────────────────────────
write('src/app/(admin)/admin/dashboard/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)
      const { data: pendingSellers } = await supabase.from('profiles').select('*').eq('role','seller').eq('status','pending')
      const { data: pendingDrivers } = await supabase.from('profiles').select('*').eq('role','driver').eq('status','pending')
      const { data: pendingListings } = await supabase.from('listings').select('*, profiles:seller_id(full_name)').eq('status','pending')
      setSellers(pendingSellers || [])
      setDrivers(pendingDrivers || [])
      setListings(pendingListings || [])
      setLoading(false)
    }
    getData()
  }, [])

  const approve = async (id: string, type: 'profile'|'listing') => {
    if (type === 'profile') {
      await supabase.from('profiles').update({status:'active'}).eq('id', id)
      setSellers(prev => prev.filter(s => s.id !== id))
      setDrivers(prev => prev.filter(d => d.id !== id))
    } else {
      await supabase.from('listings').update({status:'live'}).eq('id', id)
      setListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const reject = async (id: string, type: 'profile'|'listing') => {
    if (type === 'profile') {
      await supabase.from('profiles').update({status:'suspended'}).eq('id', id)
      setSellers(prev => prev.filter(s => s.id !== id))
      setDrivers(prev => prev.filter(d => d.id !== id))
    } else {
      await supabase.from('listings').update({status:'suspended'}).eq('id', id)
      setListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading admin panel...</p></div>
    </div>
  )

  const totalPending = sellers.length + drivers.length + listings.length

  return (
    <div style={{minHeight:'100vh',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .approve:hover{background:#009836!important;} .reject:hover{background:#991010!important;} @media(max-width:768px){.admin-grid{grid-template-columns:1fr 1fr!important;}}\`}</style>

      <nav style={{background:'rgba(0,0,0,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.2)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:28}}>
            <div style={{width:30,height:30,background:'#C8006A',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🔐</div>
            <span style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#C8006A'}}>Admin Panel</span>
          </div>
          <div style={{display:'flex',gap:0,flex:1}}>
            {['Dashboard','Sellers','Drivers','Orders','Settings'].map((t,i)=>(
              <a key={i} href="#" style={{height:62,padding:'0 12px',display:'flex',alignItems:'center',fontSize:13,fontWeight:i===0?700:400,color:i===0?'#C8006A':'rgba(255,255,255,0.5)',borderBottom:i===0?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t}</a>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Admin: {profile?.full_name||profile?.email}</span>
            <button onClick={signOut} style={{height:32,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.6)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Platform overview</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.45)'}}>meaLoyo admin — full control panel</p>
        </div>

        <div className="admin-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
          {[
            {n:String(totalPending),l:'Pending approvals',icon:'⏳',color:'#E8930A'},
            {n:'Sellers',l:'Pending: '+sellers.length,icon:'👩‍🍳',color:'#C8006A'},
            {n:'Drivers',l:'Pending: '+drivers.length,icon:'🚴',color:'#2DA84E'},
            {n:'Listings',l:'Pending: '+listings.length,icon:'🍽️',color:'#1A6ECC'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:'18px 16px',border:'1px solid rgba(255,255,255,0.07)',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:s.color,letterSpacing:'-0.02em',marginBottom:4}}>{s.n}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Pending Sellers */}
        {[
          {title:'Pending seller approvals',items:sellers,badge:'#E8930A',type:'profile' as const},
          {title:'Pending driver approvals',items:drivers,badge:'#2DA84E',type:'profile' as const},
          {title:'Pending listing approvals',items:listings,badge:'#1A6ECC',type:'listing' as const},
        ].map(section=>(
          <div key={section.title} style={{background:'rgba(255,255,255,0.03)',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden',marginBottom:16}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#fff'}}>
                {section.title}
                {section.items.length>0&&<span style={{marginLeft:8,background:section.badge,color:'#fff',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{section.items.length}</span>}
              </h2>
            </div>
            {section.items.length===0?(
              <div style={{padding:'32px',textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:14}}>No pending {section.title.toLowerCase()}</div>
            ):section.items.map((item,i)=>(
              <div key={item.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 22px',borderBottom:i<section.items.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>
                  {(item.full_name||item.name||'?')[0]}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:1}}>{item.full_name||item.name||'Unknown'}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{item.email||item.cuisine||''} · {new Date(item.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  <button className="approve" onClick={()=>approve(item.id,section.type)} style={{height:32,padding:'0 16px',background:'#2DA84E',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'background 0.12s'}}>Approve</button>
                  <button className="reject" onClick={()=>reject(item.id,section.type)} style={{height:32,padding:'0 14px',background:'rgba(192,57,43,0.8)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',transition:'background 0.12s'}}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
`)

console.log('\n✅ Part 3 done — all dashboards created')
