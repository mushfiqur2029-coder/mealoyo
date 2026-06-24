'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      const role = profile?.role || 'buyer'
      if (role === 'buyer') router.push('/buyer/dashboard')
      else if (role === 'seller') router.push('/seller/dashboard')
      else if (role === 'driver') router.push('/driver/dashboard')
      else if (role === 'admin') router.push('/admin/dashboard')
      else router.push('/')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;} .sbtn:hover{background:#A00055 !important;}`}</style>
      <Link href="/" style={{ marginBottom:28 }}>
        <img src="/Color_Logo.png" alt="meaLoyo" style={{ height:44, filter:'brightness(0) invert(1)' }}/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'40px 36px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>Welcome back</h1>
        <p style={{ fontSize:14, color:'#555', marginBottom:28 }}>Sign in to your meaLoyo account</p>
        {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={{ height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:15, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize:12, color:'#C8006A', fontWeight:600 }}>Forgot password?</Link>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required style={{ height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:15, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
          </div>
          <button type="submit" disabled={loading} className="sbtn" style={{ height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.35)', transition:'background 0.14s', opacity:loading?0.8:1, marginTop:4 }}>
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>
        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'24px 0' }}>
          <div style={{ flex:1, height:1, background:'#E8E8E8' }}/><span style={{ fontSize:12, color:'#888' }}>or</span><div style={{ flex:1, height:1, background:'#E8E8E8' }}/>
        </div>
        <p style={{ textAlign:'center', fontSize:13, color:'#555' }}>
          Don't have an account? <Link href="/register" style={{ color:'#C8006A', fontWeight:700 }}>Create account →</Link>
        </p>
      </div>
      <Link href="/" style={{ marginTop:24, fontSize:13, color:'rgba(255,255,255,0.65)' }}>← Back to meaLoyo</Link>
    </div>
  )
}
