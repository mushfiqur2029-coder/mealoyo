'use client'
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
      <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:'4px solid rgba(200,0,106,0.2)',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:'#C8006A',fontWeight:600}}>Loading admin panel...</p></div>
    </div>
  )

  const totalPending = sellers.length + drivers.length + listings.length

  return (
    <div style={{minHeight:'100vh',background:'#0D0006',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;} a{text-decoration:none;} .approve:hover{background:#009836!important;} .reject:hover{background:#991010!important;} @media(max-width:768px){.admin-grid{grid-template-columns:1fr 1fr!important;}}`}</style>

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
