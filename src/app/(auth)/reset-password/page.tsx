'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;} .sbtn:hover{background:#A00055 !important;}`}</style>
      <Link href="/" style={{ marginBottom:28 }}>
        <img src="/Color_Logo.png" alt="meaLoyo" style={{ height:44, filter:'brightness(0) invert(1)' }}/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'40px 36px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        {done ? (
          <>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>Password updated</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24 }}>Your password has been changed. Sign in with your new password.</p>
            <Link href="/login" style={{ display:'inline-flex', alignItems:'center', height:46, padding:'0 24px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:14, fontWeight:700 }}>Go to sign in →</Link>
          </>
        ) : !ready ? (
          <>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>Invalid or expired link</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24 }}>This password reset link is invalid or has expired. Request a new one below.</p>
            <Link href="/forgot-password" style={{ display:'inline-flex', alignItems:'center', height:46, padding:'0 24px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:14, fontWeight:700 }}>Request new link →</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>Set a new password</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:28 }}>Choose a new password for your account.</p>
            {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>New password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required style={{ height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:15, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required style={{ height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:15, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
              </div>
              <button type="submit" disabled={loading} className="sbtn" style={{ height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.35)', transition:'background 0.14s', opacity:loading?0.8:1, marginTop:4 }}>
                {loading ? 'Updating...' : 'Update password →'}
              </button>
            </form>
          </>
        )}
      </div>
      <Link href="/" style={{ marginTop:24, fontSize:13, color:'rgba(255,255,255,0.65)' }}>← Back to meaLoyo</Link>
    </div>
  )
}
