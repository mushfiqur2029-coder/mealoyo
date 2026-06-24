const fs = require('fs')

// ── BUYER DASHBOARD ──────────────────────────────────
fs.mkdirSync('src/app/(buyer)/buyer/dashboard', { recursive: true })
fs.writeFileSync('src/app/(buyer)/buyer/dashboard/page.tsx', `
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BuyerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48, height:48, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'}}/>
        <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
        <p style={{color:'#C8006A', fontWeight:600}}>Loading your dashboard...</p>
      </div>
    </div>
  )

  const orders = [
    {id:'#ML001', dish:'Lamb biryani & raita', cook:"Fatima's Kitchen", price:'£12.50', status:'Delivered', date:'Today 12:30', rating:null, emoji:'🍛'},
    {id:'#ML002', dish:'Karahi chicken', cook:'Mama Razia', price:'£9.00', status:'Cooking', date:'Today 13:15', rating:null, emoji:'🫕'},
    {id:'#ML003', dish:'Jerk chicken & rice', cook:"Auntie Dawn", price:'£10.00', status:'Delivered', date:'Yesterday', rating:5, emoji:'🍱'},
  ]

  const statusColor = (s:string) => s==='Delivered'?'#2DA84E':s==='Cooking'?'#E8930A':s==='Pending'?'#1A6ECC':'#C8006A'
  const statusBg = (s:string) => s==='Delivered'?'#E4F6EA':s==='Cooking'?'#FFF4E0':s==='Pending'?'#EBF2FD':'#FFE8F4'

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        * { scrollbar-width: none; }
        a { text-decoration: none; color: inherit; }
        .nav-link:hover { color: #C8006A !important; }
        .card-hover:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(200,0,106,0.1) !important; }
        .order-row:hover { background: #FFF5FA !important; }
        .sign-out:hover { background: #FFE8F4 !important; color: #C8006A !important; }
        @media(max-width:768px) {
          .dash-grid { grid-template-columns: 1fr 1fr !important; }
          .nav-links { display: none !important; }
        }
        @media(max-width:480px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      \`}</style>

      {/* NAV */}
      <nav style={{background:'#fff', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:62}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center', gap:0}}>
          <Link href="/" style={{marginRight:28, flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:34, width:'auto'}}/>
          </Link>
          <div className="nav-links" style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Dashboard',h:'/buyer/dashboard',a:true},{l:'Browse food',h:'/',a:false},{l:'My orders',h:'/buyer/orders',a:false},{l:'Saved',h:'/buyer/saved',a:false}].map((t,i)=>(
              <a key={i} href={t.h} className="nav-link" style={{height:62, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:t.a?700:500, color:t.a?'#C8006A':'#1A1A1A', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</a>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
            <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>
              {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'B'}
            </div>
            <button onClick={handleSignOut} className="sign-out" style={{height:34, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', transition:'all 0.12s'}}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>

        {/* Welcome */}
        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#1A1A1A', marginBottom:4}}>
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{fontSize:14, color:'#1A1A1A', fontWeight:400}}>Here is what is happening with your orders today.</p>
        </div>

        {/* Stats */}
        <div className="dash-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28}}>
          {[
            {n:'3', l:'Total orders', icon:'🛒', color:'#C8006A', bg:'#FFE8F4'},
            {n:'2', l:'Delivered', icon:'✅', color:'#2DA84E', bg:'#E4F6EA'},
            {n:'1', l:'In progress', icon:'⏳', color:'#E8930A', bg:'#FFF4E0'},
            {n:'4.8★', l:'Avg rating given', icon:'⭐', color:'#1A6ECC', bg:'#EBF2FD'},
          ].map((s,i)=>(
            <div key={i} className="card-hover" style={{background:'#fff', borderRadius:16, padding:'18px 16px', boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', transition:'all 0.18s'}}>
              <div style={{width:38, height:38, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:12, color:'#1A1A1A', marginTop:4, fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div style={{background:'#fff', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', marginBottom:24, overflow:'hidden'}}>
          <div style={{padding:'18px 22px', borderBottom:'1px solid #F5F0F3', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A'}}>Recent orders</h2>
            <Link href="/buyer/orders" style={{fontSize:13, fontWeight:600, color:'#C8006A'}}>View all →</Link>
          </div>
          {orders.map((o,i)=>(
            <div key={i} className="order-row" style={{display:'flex', alignItems:'center', gap:14, padding:'14px 22px', borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none', transition:'background 0.12s', cursor:'pointer'}}>
              <div style={{width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0}}>{o.emoji}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.dish}</div>
                <div style={{fontSize:12, color:'#1A1A1A', fontWeight:500}}>{o.cook} · {o.date}</div>
              </div>
              <div style={{textAlign:'right', flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:4}}>{o.price}</div>
                <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700}}>{o.status}</span>
              </div>
              {o.status === 'Delivered' && !o.rating && (
                <button style={{height:30, padding:'0 12px', background:'#C8006A', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0}}>
                  Rate
                </button>
              )}
              {o.rating && (
                <div style={{flexShrink:0, fontSize:13, fontWeight:700, color:'#C8006A'}}>★ {o.rating}</div>
              )}
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
          <Link href="/" style={{background:'linear-gradient(135deg,#C8006A,#8B0047)', borderRadius:16, padding:'22px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 4px 16px rgba(200,0,106,0.3)', transition:'transform 0.16s'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='translateY(0)'}>
            <span style={{fontSize:28}}>🍽️</span>
            <div>
              <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:2}}>Order food now</div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.75)'}}>Browse home cooks near you</div>
            </div>
          </Link>
          <Link href="/buyer/saved" style={{background:'#fff', borderRadius:16, padding:'22px', display:'flex', alignItems:'center', gap:14, border:'1.5px solid rgba(200,0,106,0.1)', boxShadow:'0 2px 10px rgba(200,0,106,0.06)', transition:'all 0.16s'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLElement).style.borderColor='#C8006A'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(0)';(e.currentTarget as HTMLElement).style.borderColor='rgba(200,0,106,0.1)'}}>
            <span style={{fontSize:28}}>❤️</span>
            <div>
              <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:2}}>Saved listings</div>
              <div style={{fontSize:12, color:'#1A1A1A', fontWeight:400}}>Your favourite home cooks</div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  )
}
`)
console.log('Buyer dashboard done')

// ── SELLER DASHBOARD ─────────────────────────────────
fs.mkdirSync('src/app/(seller)/seller/dashboard', { recursive: true })
fs.writeFileSync('src/app/(seller)/seller/dashboard/page.tsx', `
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SellerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48, height:48, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'}}/>
        <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
        <p style={{color:'#C8006A', fontWeight:600}}>Loading...</p>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <div style={{background:'#fff', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You will receive an email within 24–48 hours once approved.</p>
        <button onClick={handleSignOut} style={{height:44, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const orders = [
    {id:'#ML001', dish:'Lamb biryani', buyer:'Rahul S.', price:'£12.50', status:'Cooking', time:'13:15', emoji:'🍛'},
    {id:'#ML002', dish:'Mutton pilau', buyer:'Sarah M.', price:'£11.00', status:'Ready', time:'13:45', emoji:'🫙'},
    {id:'#ML003', dish:'Karahi chicken', buyer:'James T.', price:'£9.00', status:'Delivered', time:'12:00', emoji:'🫕'},
  ]
  const statusColor = (s:string) => s==='Delivered'?'#2DA84E':s==='Cooking'?'#E8930A':s==='Ready'?'#C8006A':'#1A6ECC'
  const statusBg = (s:string) => s==='Delivered'?'#E4F6EA':s==='Cooking'?'#FFF4E0':s==='Ready'?'#FFE8F4':'#EBF2FD'

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 0; }
        * { scrollbar-width: none; }
        a { text-decoration: none; color: inherit; }
        .nav-link:hover { color: #C8006A !important; }
        .card-hover:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(200,0,106,0.1) !important; }
        .order-row:hover { background: #FFF5FA !important; }
        @media(max-width:768px){.dash-grid{grid-template-columns:1fr 1fr !important;}.nav-links{display:none !important;}}
        @media(max-width:480px){.dash-grid{grid-template-columns:1fr !important;}}
      \`}</style>

      <nav style={{background:'#fff', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:62}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{marginRight:28, flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:34, width:'auto'}}/>
          </Link>
          <div className="nav-links" style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:true},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false}].map((t,i)=>(
              <a key={i} href={t.h} className="nav-link" style={{height:62, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:t.a?700:500, color:t.a?'#C8006A':'#1A1A1A', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</a>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center'}}>
            <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>
              {profile?.full_name?.[0] || 'S'}
            </div>
            <button onClick={handleSignOut} style={{height:34, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>

        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#1A1A1A', marginBottom:4}}>
            Seller dashboard 👩‍🍳
          </h1>
          <p style={{fontSize:14, color:'#1A1A1A', fontWeight:400}}>Welcome back, {profile?.full_name?.split(' ')[0] || 'Chef'}. Here is your activity today.</p>
        </div>

        {/* Stats */}
        <div className="dash-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {[
            {n:'£342.50', l:'Wallet balance', icon:'💳', color:'#C8006A', bg:'#FFE8F4'},
            {n:'14', l:'Orders this month', icon:'📦', color:'#2DA84E', bg:'#E4F6EA'},
            {n:'4.9★', l:'Your rating', icon:'⭐', color:'#E8930A', bg:'#FFF4E0'},
            {n:'3', l:'Active listings', icon:'🍽️', color:'#1A6ECC', bg:'#EBF2FD'},
          ].map((s,i)=>(
            <div key={i} className="card-hover" style={{background:'#fff', borderRadius:16, padding:'18px 16px', boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', transition:'all 0.18s'}}>
              <div style={{width:38, height:38, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:12, color:'#1A1A1A', marginTop:4, fontWeight:500}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          {/* Wallet */}
          <div style={{background:'linear-gradient(135deg,#C8006A,#8B0047)', borderRadius:20, padding:'24px', boxShadow:'0 4px 20px rgba(200,0,106,0.3)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Available to withdraw</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'#fff', letterSpacing:'-0.03em', marginBottom:4}}>£342.50</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginBottom:20}}>Updated just now</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:20}}>
              {[['Biryani orders (×14)','+£175.00','#86EFAC'],['Office lunch — TechCo','+£124.00','#86EFAC'],['Platform commission (12%)','−£47.88','#FCA5A5'],['Pending (×3)','+£67.00 pending','#FCD34D']].map(([l,v,c],i)=>(
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.65)', paddingBottom:8, borderBottom:i<3?'1px solid rgba(255,255,255,0.08)':'none'}}>
                  <span>{l}</span><span style={{color:c, fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <button style={{height:38, background:'rgba(255,255,255,0.18)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer'}}>Withdraw</button>
              <button style={{height:38, background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.75)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer'}}>History</button>
            </div>
          </div>

          {/* Live orders */}
          <div style={{background:'#fff', borderRadius:20, boxShadow:'0 2px 10px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:'1px solid #F5F0F3', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A'}}>Live orders</h3>
              <Link href="/seller/orders" style={{fontSize:12, fontWeight:600, color:'#C8006A'}}>View all →</Link>
            </div>
            {orders.map((o,i)=>(
              <div key={i} className="order-row" style={{display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:i<orders.length-1?'1px solid #F5F0F3':'none', transition:'background 0.12s', cursor:'pointer'}}>
                <div style={{width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{o.emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.dish}</div>
                  <div style={{fontSize:11, color:'#1A1A1A', fontWeight:500}}>{o.buyer} · {o.time}</div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:3}}>{o.price}</div>
                  <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700}}>{o.status}</span>
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
console.log('Seller dashboard done')

// ── DRIVER DASHBOARD ─────────────────────────────────
fs.mkdirSync('src/app/(driver)/driver/dashboard', { recursive: true })
fs.writeFileSync('src/app/(driver)/driver/dashboard/page.tsx', `
'use client'
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
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48, height:48, border:'4px solid rgba(200,0,106,0.2)', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'}}/>
        <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
        <p style={{color:'#C8006A', fontWeight:600}}>Loading...</p>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <div style={{background:'#1A1A1A', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', border:'1px solid rgba(200,0,106,0.2)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#fff', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:24}}>Your driver account is under review. You will be notified within 24–48 hours.</p>
        <button onClick={handleSignOut} style={{height:44, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  const jobs = [
    {id:1, from:'East London', to:'Ilford', dish:'Biryani for 2', pay:'£4.50', dist:'1.8 km', time:'Ready now', color:'#2DA84E'},
    {id:2, from:'West London', to:'Hammersmith', dish:'Curry box', pay:'£5.50', dist:'2.4 km', time:'10 min wait', color:'#E8930A'},
    {id:3, from:'South London', to:'Brixton', dish:'Catering order', pay:'£8.00', dist:'3.1 km', time:'30 min', color:'#C8006A'},
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 0; }
        * { scrollbar-width: none; }
        a { text-decoration: none; }
        .job-card:hover { border-color: #C8006A !important; background: rgba(200,0,106,0.06) !important; }
        .accept-btn:hover { background: #009836 !important; }
        @media(max-width:768px){.driver-grid{grid-template-columns:1fr 1fr !important;}}
        @media(max-width:480px){.driver-grid{grid-template-columns:1fr !important;}}
      \`}</style>

      <nav style={{background:'rgba(0,0,0,0.8)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(200,0,106,0.15)', position:'sticky', top:0, zIndex:100, height:62}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{marginRight:28}}>
            <img src="/White_Logo.png" alt="meaLoyo" style={{height:32, width:'auto'}}/>
          </Link>
          <div style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Dashboard',a:true},{l:'My earnings',a:false},{l:'History',a:false}].map((t,i)=>(
              <a key={i} href="#" style={{height:62, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:t.a?700:500, color:t.a?'#C8006A':'rgba(255,255,255,0.55)', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t.l}</a>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center'}}>
            <div style={{width:8, height:8, borderRadius:'50%', background:'#2DA84E', flexShrink:0}}/>
            <span style={{fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:500}}>Online</span>
            <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', marginLeft:8}}>
              {profile?.full_name?.[0] || 'D'}
            </div>
            <button onClick={handleSignOut} style={{height:34, padding:'0 14px', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.7)', background:'transparent', cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>

        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,28px)', fontWeight:700, color:'#fff', marginBottom:4}}>
            Driver dashboard 🚴
          </h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.55)'}}>Welcome back, {profile?.full_name?.split(' ')[0] || 'Driver'}. You have {jobs.length} jobs available near you.</p>
        </div>

        {/* Stats */}
        <div className="driver-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {[
            {n:'7', l:'Drops today', color:'#fff'},
            {n:'3.5h', l:'Active time', color:'#fff'},
            {n:'£35', l:"Today's pay", color:'#86EFAC'},
            {n:'4.9★', l:'Your rating', color:'#C8006A'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'16px', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:s.color, letterSpacing:'-0.02em', marginBottom:4}}>{s.n}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Available jobs */}
        <div style={{marginBottom:8}}>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#fff', marginBottom:16}}>Available jobs near you</h2>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {jobs.map(j=>(
              <div key={j.id} className="job-card" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'16px 18px', display:'flex', alignItems:'center', gap:14, transition:'all 0.14s', cursor:'pointer'}}>
                <div style={{width:42, height:42, borderRadius:10, background:j.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>🚴</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:2}}>{j.from} → {j.to}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{j.dist} · {j.dish} · {j.time}</div>
                </div>
                <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#86EFAC', flexShrink:0}}>{j.pay}</div>
                <button className="accept-btn" style={{height:34, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, transition:'background 0.12s'}}>Accept</button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
`)
console.log('Driver dashboard done')

// ── ADMIN DASHBOARD ──────────────────────────────────
fs.mkdirSync('src/app/(admin)/admin/dashboard', { recursive: true })
fs.writeFileSync('src/app/(admin)/admin/dashboard/page.tsx', `
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/'); return }

      setUser(user)
      setProfile(profile)

      const { data: pendingSellers } = await supabase.from('profiles').select('*').eq('role','seller').eq('status','pending')
      const { data: pendingDrivers } = await supabase.from('profiles').select('*').eq('role','driver').eq('status','pending')

      setSellers(pendingSellers || [])
      setDrivers(pendingDrivers || [])
      setLoading(false)
    }
    getData()
  }, [])

  const approve = async (id: string) => {
    await supabase.from('profiles').update({status:'active'}).eq('id', id)
    setSellers(prev => prev.filter(s => s.id !== id))
    setDrivers(prev => prev.filter(d => d.id !== id))
  }

  const reject = async (id: string) => {
    await supabase.from('profiles').update({status:'suspended'}).eq('id', id)
    setSellers(prev => prev.filter(s => s.id !== id))
    setDrivers(prev => prev.filter(d => d.id !== id))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0D0006', fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48, height:48, border:'4px solid rgba(200,0,106,0.2)', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'}}/>
        <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
        <p style={{color:'#C8006A', fontWeight:600}}>Loading admin panel...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#0D0006', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 0; }
        * { scrollbar-width: none; }
        a { text-decoration: none; }
        .approve-btn:hover { background: #009836 !important; }
        .reject-btn:hover { background: #991010 !important; }
        @media(max-width:768px){.admin-grid{grid-template-columns:1fr 1fr !important;}}
        @media(max-width:480px){.admin-grid{grid-template-columns:1fr !important;}}
      \`}</style>

      <nav style={{background:'rgba(0,0,0,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(200,0,106,0.2)', position:'sticky', top:0, zIndex:100, height:62}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:62, display:'flex', alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginRight:28}}>
            <div style={{width:30, height:30, background:'#C8006A', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16}}>🔐</div>
            <span style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#C8006A'}}>Admin Panel</span>
          </div>
          <div style={{display:'flex', gap:0, flex:1}}>
            {['Dashboard','Sellers','Drivers','Orders','Settings'].map((t,i)=>(
              <a key={i} href="#" style={{height:62, padding:'0 12px', display:'flex', alignItems:'center', fontSize:13, fontWeight:i===0?700:400, color:i===0?'#C8006A':'rgba(255,255,255,0.5)', borderBottom:i===0?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t}</a>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center'}}>
            <span style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>Admin: {profile?.full_name || profile?.email}</span>
            <button onClick={handleSignOut} style={{height:32, padding:'0 14px', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.6)', background:'transparent', cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>

        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,28px)', fontWeight:700, color:'#fff', marginBottom:4}}>Platform overview</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.45)'}}>meaLoyo admin — full control panel</p>
        </div>

        {/* Stats */}
        <div className="admin-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28}}>
          {[
            {n:sellers.length + drivers.length, l:'Pending approvals', icon:'⏳', color:'#E8930A', bg:'rgba(232,147,10,0.15)'},
            {n:'840+', l:'Total sellers', icon:'👩‍🍳', color:'#C8006A', bg:'rgba(200,0,106,0.15)'},
            {n:'120+', l:'Active drivers', icon:'🚴', color:'#2DA84E', bg:'rgba(45,168,78,0.15)'},
            {n:'12k+', l:'Monthly orders', icon:'📦', color:'#1A6ECC', bg:'rgba(26,110,204,0.15)'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.04)', borderRadius:14, padding:'18px 16px', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center'}}>
              <div style={{width:38, height:38, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, margin:'0 auto 10px'}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:s.color, letterSpacing:'-0.02em', marginBottom:4}}>{s.n}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Pending sellers */}
        <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.07)', overflow:'hidden', marginBottom:16}}>
          <div style={{padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>
              Pending seller approvals
              {sellers.length > 0 && <span style={{marginLeft:8, background:'#E8930A', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20}}>{sellers.length}</span>}
            </h2>
          </div>
          {sellers.length === 0 ? (
            <div style={{padding:'32px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:14}}>No pending seller applications</div>
          ) : sellers.map((seller,i)=>(
            <div key={seller.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 22px', borderBottom:i<sellers.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:38, height:38, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0}}>
                {seller.full_name?.[0] || 'S'}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:1}}>{seller.full_name || 'Unknown'}</div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>{seller.email} · Applied {new Date(seller.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                <button className="approve-btn" onClick={() => approve(seller.id)} style={{height:32, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Approve</button>
                <button className="reject-btn" onClick={() => reject(seller.id)} style={{height:32, padding:'0 14px', background:'rgba(192,57,43,0.8)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Reject</button>
              </div>
            </div>
          ))}
        </div>

        {/* Pending drivers */}
        <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.07)', overflow:'hidden'}}>
          <div style={{padding:'16px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>
              Pending driver approvals
              {drivers.length > 0 && <span style={{marginLeft:8, background:'#2DA84E', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20}}>{drivers.length}</span>}
            </h2>
          </div>
          {drivers.length === 0 ? (
            <div style={{padding:'32px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:14}}>No pending driver applications</div>
          ) : drivers.map((driver,i)=>(
            <div key={driver.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 22px', borderBottom:i<drivers.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:38, height:38, borderRadius:'50%', background:'#2DA84E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0}}>
                {driver.full_name?.[0] || 'D'}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:1}}>{driver.full_name || 'Unknown'}</div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>{driver.email} · Applied {new Date(driver.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{display:'flex', gap:8, flexShrink:0}}>
                <button className="approve-btn" onClick={() => approve(driver.id)} style={{height:32, padding:'0 16px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Approve</button>
                <button className="reject-btn" onClick={() => reject(driver.id)} style={{height:32, padding:'0 14px', background:'rgba(192,57,43,0.8)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', transition:'background 0.12s'}}>Reject</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
`)
console.log('Admin dashboard done')

console.log('')
console.log('════════════════════════════════')
console.log('ALL DASHBOARDS DONE')
console.log('════════════════════════════════')
console.log('/buyer/dashboard   — buyer home')
console.log('/seller/dashboard  — seller + wallet')
console.log('/driver/dashboard  — driver + jobs')
console.log('/admin/dashboard   — admin + approvals')