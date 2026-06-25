'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Invalid credentials'); setLoading(false); return }
    if (data.user) {
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as any)?.role !== 'admin') { await supabase.auth.signOut(); setError('Access denied. Admin only.'); setLoading(false); return }
      router.push('/admin/dashboard')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1A1A1A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
        <div style={{ width:40, height:40, background:'#C8006A', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔐</div>
        <span style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#C8006A' }}>meaLoyo Admin</span>
      </div>
      <div style={{ background:'#2A2A2A', borderRadius:20, padding:'36px', width:'100%', maxWidth:380, border:'1px solid rgba(200,0,106,0.2)' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#fff', marginBottom:6 }}>Admin access</h1>
        <p style={{ fontSize:13, color:'#fff', marginBottom:24 }}>Restricted to authorised administrators only</p>
        {error && <div style={{ background:'rgba(200,0,106,0.15)', border:'1px solid rgba(200,0,106,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#FF69B4', fontWeight:600 }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[{label:'Email',val:email,set:setEmail,type:'email',ph:'Admin email'},{label:'Password',val:password,set:setPassword,type:'password',ph:'Admin password'}].map(f => (
            <div key={f.label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required style={{ height:46, border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'0 14px', fontSize:14, color:'#fff', background:'rgba(255,255,255,0.06)', width:'100%' }}/>
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', marginTop:6, opacity:loading?0.8:1 }}>
            {loading ? 'Verifying...' : 'Access admin panel →'}
          </button>
        </form>
      </div>
      <p style={{ marginTop:20, fontSize:12, color:'rgba(255,255,255,0.2)' }}>This page is not publicly accessible</p>
    </div>
  )
}
