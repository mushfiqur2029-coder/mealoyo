'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile } from '@/lib/types'

const COMMISSION_RATE = 0.12

type RevenueOrder = { status: string; platform_commission: string }

export default function AdminSettings() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({ sellers: 0, buyers: 0, drivers: 0, orders: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteMsg, setPromoteMsg] = useState('')
  const [promoteError, setPromoteError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)

      const [{ data: sellers }, { data: buyers }, { data: drivers }, { data: orders }] = await Promise.all([
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'buyer' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'driver' }),
        supabase.rpc('admin_get_all_orders'),
      ])
      const revenue = (orders || [])
        .filter((o: RevenueOrder) => o.status === 'delivered')
        .reduce((sum: number, o: RevenueOrder) => sum + parseFloat(o.platform_commission || '0'), 0)

      setStats({
        sellers: sellers?.length || 0,
        buyers: buyers?.length || 0,
        drivers: drivers?.length || 0,
        orders: orders?.length || 0,
        revenue,
      })
      setLoading(false)
    }
    getData()
  }, [router])

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteEmail.trim()) return
    setPromoting(true)
    setPromoteMsg('')
    setPromoteError('')
    const { error } = await supabase.rpc('admin_promote_to_admin', { p_email: promoteEmail.trim() })
    if (error) { setPromoteError(error.message); setPromoting(false); return }
    setPromoteMsg(`${promoteEmail.trim()} is now an admin.`)
    setPromoteEmail('')
    setPromoting(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading settings...</p></div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .nav-link:hover{color:#C8006A!important;} input:focus{border-color:#C8006A !important;outline:none;} .promote-btn:hover{background:#A00055!important;} @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr!important;}}`}</style>

      <nav style={{background:'rgba(0,0,0,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.2)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/admin/dashboard" style={{display:'flex',alignItems:'center',gap:10,marginRight:28,flexShrink:0}}>
            <Logo height={26} white/>
            <span style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#C8006A'}}>Admin</span>
          </Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/admin/dashboard'},{l:'Sellers',h:'/admin/sellers'},{l:'Drivers',h:'/admin/drivers'},{l:'Orders',h:'/admin/orders'},{l:'Settings',h:'/admin/settings'}].map(t=>(
              <Link key={t.h} href={t.h} className="nav-link" style={{height:62,padding:'0 12px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.h==='/admin/settings'?700:400,color:t.h==='/admin/settings'?'#C8006A':'rgba(255,255,255,0.5)',borderBottom:t.h==='/admin/settings'?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Admin: {profile?.full_name||profile?.email}</span>
            <button onClick={signOut} style={{height:32,padding:'0 14px',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.6)',background:'transparent',cursor:'pointer'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.5vw,28px)',fontWeight:700,color:'#fff',marginBottom:4}}>Settings</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.45)'}}>Platform configuration and stats.</p>
        </div>

        <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:14}}>Platform stats</h2>
        <div className="stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:32}}>
          {[
            {n:String(stats.sellers),l:'Sellers',color:'#C8006A'},
            {n:String(stats.buyers),l:'Buyers',color:'#5B9DF0'},
            {n:String(stats.drivers),l:'Drivers',color:'#2DA84E'},
            {n:String(stats.orders),l:'Total orders',color:'#E8930A'},
            {n:`£${stats.revenue.toFixed(2)}`,l:'Revenue',color:'#86EFAC'},
          ].map((s,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:'18px 16px',border:'1px solid rgba(255,255,255,0.07)',textAlign:'center'}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:s.color,letterSpacing:'-0.02em',marginBottom:4}}>{s.n}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:18,padding:'24px',border:'1px solid rgba(255,255,255,0.07)'}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:6}}>Commission rate</h2>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:16,lineHeight:1.6}}>Platform commission taken from every delivered order. Set in code, not yet editable here.</p>
            <div style={{fontFamily:'Georgia,serif',fontSize:38,fontWeight:700,color:'#C8006A'}}>{Math.round(COMMISSION_RATE*100)}%</div>
          </div>

          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:18,padding:'24px',border:'1px solid rgba(255,255,255,0.07)'}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:6}}>Add an admin</h2>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:16,lineHeight:1.6}}>Promotes an existing registered meaLoyo user to admin by email. They must already have an account.</p>
            {promoteMsg && <div style={{background:'rgba(45,168,78,0.15)',border:'1px solid rgba(45,168,78,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#86EFAC',fontWeight:600}}>✅ {promoteMsg}</div>}
            {promoteError && <div style={{background:'rgba(255,107,107,0.15)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#FF8A8A',fontWeight:600}}>{promoteError}</div>}
            <form onSubmit={handlePromote} style={{display:'flex',gap:8}}>
              <input type="email" value={promoteEmail} onChange={e=>setPromoteEmail(e.target.value)} placeholder="user@example.com" required style={{flex:1,height:42,border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'0 14px',fontSize:13,color:'#fff',background:'rgba(255,255,255,0.05)',outline:'none'}}/>
              <button type="submit" disabled={promoting} className="promote-btn" style={{height:42,padding:'0 18px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:promoting?'not-allowed':'pointer',opacity:promoting?0.7:1,whiteSpace:'nowrap'}}>{promoting?'Adding...':'Add admin'}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
