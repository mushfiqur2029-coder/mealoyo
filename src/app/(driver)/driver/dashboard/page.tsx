'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DriverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [completedDrops, setCompletedDrops] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('driver_id', user.id).eq('status', 'delivered')
      setCompletedDrops(count ?? 0)
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0D0D',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading...</p></div>
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
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .job:hover{border-color:#C8006A!important;background:rgba(200,0,106,0.06)!important;} .accept:hover{background:#009836!important;} @media(max-width:768px){.driver-grid{grid-template-columns:1fr 1fr!important;}}`}</style>

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
          {[{n:String(completedDrops),l:'Completed drops',color:'#fff'},{n:String(jobs.length),l:'Jobs available',color:'#fff'},{n:'—',l:"Today's pay",color:'#86EFAC'},{n:'—',l:'Your rating',color:'#C8006A'}].map((s,i)=>(
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
