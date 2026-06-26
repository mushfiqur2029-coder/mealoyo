'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { User, Profile } from '@/lib/types'

export default function SellerProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.rpc('get_my_profile')
      const p = profile as Profile | null
      setFullName(p?.full_name || '')
      setPhone(p?.phone || '')
      setEmail(p?.email || user.email || '')
      setStatus(p?.status || '')
      setLoading(false)
    }
    getData()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!user) return
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: dbError } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() }).eq('id', user.id)
    if (dbError) { setError(dbError.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading profile...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}
        .save-btn:hover{background:#A00055 !important;}
        .nav-link:hover{color:#C8006A !important;}
        .signout:hover{background:#FFE8F4!important;color:#C8006A!important;}
        @media(max-width:768px){.nav-links{display:none!important;}}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><Logo height={34}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:false},{l:'My listings',h:'/seller/listings',a:false},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false},{l:'Profile',h:'/seller/profile',a:true}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <button onClick={signOut} className="signout" style={{height:34,padding:'0 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',background:'#fff',cursor:'pointer',transition:'all 0.12s'}}>Sign out</button>
        </div>
      </nav>

      <div style={{maxWidth:560,margin:'0 auto',padding:'32px 20px 48px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,26px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>My profile</h1>
        <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24}}>Manage your seller account details.</p>

        {error && <div style={{background:'#FFE8F4',border:'1.5px solid rgba(200,0,106,0.25)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#C8006A',fontWeight:600}}>{error}</div>}
        {saved && <div style={{background:'#E4F6EA',border:'1.5px solid rgba(45,168,78,0.25)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#1A6030',fontWeight:600}}>✅ Profile updated</div>}

        <form onSubmit={handleSave} style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em'}}>Account status:</span>
            <span style={{background:status==='active'?'#E4F6EA':'#FFF4E0',color:status==='active'?'#2DA84E':'#E8930A',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{status}</span>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6}}>Full name</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} style={{height:46,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#F8F0F4',width:'100%'}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6}}>Phone number</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+44 7700 000000" style={{height:46,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#F8F0F4',width:'100%'}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6}}>Email address</label>
            <input value={email} disabled style={{height:46,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#F0F0F0',width:'100%',cursor:'not-allowed'}}/>
          </div>
          <button type="submit" disabled={saving} className="save-btn" style={{height:48,background:'#C8006A',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:saving?'not-allowed':'pointer',boxShadow:'0 6px 20px rgba(200,0,106,0.3)',transition:'background 0.14s',opacity:saving?0.8:1,marginTop:4}}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
