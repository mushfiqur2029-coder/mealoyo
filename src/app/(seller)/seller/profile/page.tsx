'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { User, Profile } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
  { l:'Profile', h:'/seller/profile' },
]

export default function SellerProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
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
    setSaving(true); setError(''); setSavedOk(false)
    const { error: dbError } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() }).eq('id', user.id)
    if (dbError) { setError(dbError.message); setSaving(false); return }
    setSavedOk(true); setSaving(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const initials = (fullName.trim() || email).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'S'
  const statusOk = status === 'active'

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      input:focus { border-color: #C8006A !important; outline: none; background: #fff !important; }
      .save-btn:hover { background: #A00055 !important; }
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      .signout-danger:hover { background: #C0392B !important; color: #fff !important; }
      @media (max-width: 900px) { .nav-links { display: none !important; } }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1000, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/profile'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>{initials[0]}</div>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:600, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:200, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:260, borderRadius:6, marginBottom:24}}/>
        <div className="skel" style={{height:420, borderRadius:22}}/>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:600, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:22}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,30px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4}}>My profile</h1>
          <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85}}>Manage your seller account details.</p>
        </div>

        {/* Identity card */}
        <div className="fade-up" style={{background:'#fff', borderRadius:22, padding:'28px 24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', textAlign:'center', marginBottom:18}}>
          <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:32, fontWeight:700, color:'#fff', margin:'0 auto 14px', boxShadow:'0 8px 22px rgba(200,0,106,0.28)'}}>{initials}</div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1A1A1A', marginBottom:4}}>{fullName.trim() || 'Your name'}</h2>
          <p style={{fontSize:13, color:'#1A1A1A', opacity:0.8, marginBottom:12}}>{email} · Home cook</p>
          <span style={{display:'inline-flex', alignItems:'center', gap:6, background:statusOk ? '#E4F6EA' : '#FFF4E0', color:statusOk ? '#2DA84E' : '#B8730A', padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:700, textTransform:'capitalize', letterSpacing:'0.02em'}}>
            <span style={{width:7, height:7, borderRadius:'50%', background:statusOk ? '#2DA84E' : '#B8730A'}}/>{status || 'pending'} {statusOk ? 'seller' : 'review'}
          </span>
        </div>

        {error && <div className="fade-up" style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600}}>{error}</div>}
        {savedOk && <div className="fade-up" style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#1A6030', fontWeight:600}}>✅ Profile updated</div>}

        {/* Details form */}
        <form onSubmit={handleSave} className="fade-up" style={{background:'#fff', borderRadius:22, padding:'24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', flexDirection:'column', gap:18, marginBottom:18}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A'}}>Account details</h3>
          <div>
            <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:7}}>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={{height:48, border:'1.5px solid #EAD9E4', borderRadius:11, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#FBF6F9', width:'100%', transition:'border-color 0.14s'}}/>
          </div>
          <div>
            <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:7}}>Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" style={{height:48, border:'1.5px solid #EAD9E4', borderRadius:11, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#FBF6F9', width:'100%', transition:'border-color 0.14s'}}/>
          </div>
          <div>
            <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6, marginBottom:7}}>Email address <span style={{fontSize:12}}>🔒</span></label>
            <div style={{position:'relative'}}>
              <input value={email} disabled style={{height:48, border:'1.5px solid #EAD9E4', borderRadius:11, padding:'0 40px 0 14px', fontSize:14, color:'#1A1A1A', opacity:0.7, background:'#F3ECF1', width:'100%', cursor:'not-allowed'}}/>
              <span style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.6}}>🔒</span>
            </div>
            <p style={{fontSize:12, color:'#1A1A1A', opacity:0.6, marginTop:6}}>Your email is used to sign in and can&apos;t be changed here.</p>
          </div>
          <button type="submit" disabled={saving} className="save-btn" style={{height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:saving ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s', opacity:saving ? 0.8 : 1, marginTop:4}}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>

        {/* Danger zone */}
        <div className="fade-up" style={{background:'#fff', borderRadius:22, padding:'22px 24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(192,57,43,0.18)'}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#C0392B', marginBottom:4}}>Danger zone</h3>
          <p style={{fontSize:13, color:'#1A1A1A', opacity:0.8, marginBottom:16, lineHeight:1.5}}>Sign out of your seller account on this device.</p>
          <button onClick={signOut} className="signout-danger" style={{height:46, padding:'0 22px', background:'#fff', color:'#C0392B', border:'1.5px solid #C0392B', borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
