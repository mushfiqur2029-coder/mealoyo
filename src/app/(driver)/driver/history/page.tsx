'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DriverHistory() {
  const [orders, setOrders] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
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
        .select('*, listings(name,cuisine)')
        .eq('driver_id', user.id)
        .in('status', ['delivered','cancelled'])
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }
  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0D0D',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading history...</p></div>
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

  return (
    <div style={{minHeight:'100vh',background:'#0D0D0D',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .hrow:hover{background:rgba(255,255,255,0.03)!important;}`}</style>

      <nav style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.15)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28}}><img src="/White_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/driver/dashboard',a:false},{l:'My earnings',h:'/driver/earnings',a:false},{l:'History',h:'/driver/history',a:true}].map((t,i)=>(
              <Link key={i} href={t.h} style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'rgba(255,255,255,0.55)',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff'}}>{profile?.full_name?.[0]||'D'}</div>
            <button onClick={signOut} style={{height:34,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.7)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Delivery history</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.55)'}}>{orders.length} {orders.length===1?'drop':'drops'} completed or cancelled.</p>
        </div>

        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:18,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
          {orders.length === 0 ? (
            <div style={{padding:'64px 20px',textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:16}}>🚴</div>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#fff',marginBottom:8}}>No deliveries yet</h2>
              <p style={{fontSize:14,color:'rgba(255,255,255,0.5)'}}>Completed and cancelled drops will show up here.</p>
            </div>
          ) : orders.map((o,i) => (
            <div key={o.id} className="hrow" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:i<orders.length-1?'1px solid rgba(255,255,255,0.05)':'none',transition:'background 0.12s'}}>
              <div style={{width:42,height:42,borderRadius:11,background:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                {cuisineEmoji[o.listings?.cuisine]||'🍽️'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.listings?.name||'Delivery'}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>#{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:o.status==='delivered'?'#86EFAC':'rgba(255,255,255,0.4)'}}>£{parseFloat(o.delivery_fee||0).toFixed(2)}</div>
                <span style={{fontSize:11,fontWeight:700,color:o.status==='delivered'?'#86EFAC':'#FF8A8A',textTransform:'capitalize'}}>{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
