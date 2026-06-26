'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) { setError(resetError.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;} .sbtn:hover{background:#A00055 !important;}`}</style>
      <Link href="/" style={{ marginBottom:28 }}>
        <Logo height={44} white/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'40px 36px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        {sent ? (
          <>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>Check your email</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24 }}>If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.</p>
            <Link href="/login" style={{ display:'inline-flex', alignItems:'center', height:46, padding:'0 24px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:14, fontWeight:700 }}>Back to sign in →</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>Forgot password?</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:28 }}>Enter your email and we&apos;ll send you a reset link.</p>
            {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={{ height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:15, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
              </div>
              <button type="submit" disabled={loading} className="sbtn" style={{ height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.35)', transition:'background 0.14s', opacity:loading?0.8:1, marginTop:4 }}>
                {loading ? 'Sending...' : 'Send reset link →'}
              </button>
            </form>
            <p style={{ textAlign:'center', fontSize:13, color:'#1A1A1A', marginTop:24 }}>
              <Link href="/login" style={{ color:'#C8006A', fontWeight:700 }}>← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
      <Link href="/" style={{ marginTop:24, fontSize:13, color:'rgba(255,255,255,0.65)' }}>← Back to meaLoyo</Link>
    </div>
  )
}
