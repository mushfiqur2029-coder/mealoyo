'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BuyerProfile() {
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
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
      setFullName((profile as any)?.full_name || '')
      setPhone((profile as any)?.phone || '')
      setEmail((profile as any)?.email || user.email || '')
      setLoading(false)
    }
    getData()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name'); return }
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
        .signout:hover{background:#FFE8F4!important;color:#C8006A!important;}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/buyer/dashboard" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><img src="/Color_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:500}}>My profile</span>
          <div style={{display:'flex',gap:16,marginLeft:'auto',alignItems:'center'}}>
            <Link href="/buyer/orders" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Orders</Link>
            <Link href="/buyer/saved" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Saved</Link>
            <button onClick={signOut} className="signout" style={{height:34,padding:'0 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',background:'#fff',cursor:'pointer',transition:'all 0.12s'}}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:560,margin:'0 auto',padding:'32px 20px 48px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,26px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>My profile</h1>
        <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24}}>Manage your account details.</p>

        {error && <div style={{background:'#FFE8F4',border:'1.5px solid rgba(200,0,106,0.25)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#C8006A',fontWeight:600}}>{error}</div>}
        {saved && <div style={{background:'#E4F6EA',border:'1.5px solid rgba(45,168,78,0.25)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#1A6030',fontWeight:600}}>✅ Profile updated</div>}

        <form onSubmit={handleSave} style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',display:'flex',flexDirection:'column',gap:16}}>
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
