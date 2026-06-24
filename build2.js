const fs = require('fs')
const path = require('path')
const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('✓', filePath)
}

// ── LOGIN PAGE ────────────────────────────────────────
write('src/app/(auth)/login/page.tsx', `'use client'
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
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;} .sbtn:hover{background:#A00055 !important;}\`}</style>
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
`)

// ── REGISTER PAGE ─────────────────────────────────────
write('src/app/(auth)/register/page.tsx', `'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Role = 'buyer' | 'seller' | 'driver'

export default function Register() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role>('buyer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const roles = [
    { id:'buyer' as Role, icon:'🛒', title:'I want to order food', sub:'Browse and order from home cooks', color:'#1A6ECC', bg:'#EBF2FD' },
    { id:'seller' as Role, icon:'👩‍🍳', title:'I want to sell food', sub:'List my home cooking and earn', color:'#C8006A', bg:'#FFE8F4' },
    { id:'driver' as Role, icon:'🚴', title:'I want to deliver food', sub:'Earn per drop, flexible hours', color:'#2DA84E', bg:'#E4F6EA' },
  ]

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName, phone, role } }
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, full_name: fullName, email, phone, role,
        status: role === 'buyer' ? 'active' : 'pending', created_at: new Date().toISOString(),
      })
      if (role === 'buyer') router.push('/buyer/dashboard')
      else router.push('/pending')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}\`}</style>
      <Link href="/" style={{ marginBottom:28 }}>
        <img src="/Color_Logo.png" alt="meaLoyo" style={{ height:40, filter:'brightness(0) invert(1)' }}/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'36px', width:'100%', maxWidth:480, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
          {['Choose role','Your details'].map((label,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:step>=i+1?'#C8006A':'#E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:step>=i+1?'#fff':'#888' }}>{i+1}</div>
                <span style={{ fontSize:10, color:step===i+1?'#C8006A':'#888', fontWeight:600, whiteSpace:'nowrap' }}>{label}</span>
              </div>
              {i<1 && <div style={{ flex:1, height:2, background:step>1?'#C8006A':'#E0E0E0', margin:'0 8px', marginBottom:16 }}/>}
            </div>
          ))}
        </div>
        {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
        {step === 1 && (
          <div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', marginBottom:4 }}>Join meaLoyo</h1>
            <p style={{ fontSize:14, color:'#555', marginBottom:20 }}>How do you want to use meaLoyo?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {roles.map(r => (
                <div key={r.id} onClick={() => setRole(r.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:role===r.id?r.bg:'#F8F8F8', border:role===r.id?\`2px solid \${r.color}\`:'1.5px solid #E0E0E0', borderRadius:14, cursor:'pointer', transition:'all 0.14s' }}>
                  <span style={{ fontSize:26 }}>{r.icon}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:role===r.id?r.color:'#1A1A1A' }}>{r.title}</div><div style={{ fontSize:12, color:'#666', marginTop:2 }}>{r.sub}</div></div>
                  <div style={{ width:20, height:20, borderRadius:'50%', border:role===r.id?\`2px solid \${r.color}\`:'2px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {role===r.id && <div style={{ width:10, height:10, borderRadius:'50%', background:r.color }}/>}
                  </div>
                </div>
              ))}
            </div>
            {(role==='seller'||role==='driver') && (
              <div style={{ background:'#FFF8E0', border:'1.5px solid #F5D080', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#8C5500', lineHeight:1.6 }}>
                ⏳ <strong>Approval required</strong> — {role==='seller'?'Seller':'Driver'} accounts are reviewed before going live. You will be notified within 24–48 hours.
              </div>
            )}
            <button onClick={() => setStep(2)} style={{ width:'100%', height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)' }}>Continue →</button>
          </div>
        )}
        {step === 2 && (
          <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <h1 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', marginBottom:4 }}>Your details</h1>
              <p style={{ fontSize:14, color:'#555', marginBottom:4 }}>
                Registering as <span style={{ color:'#C8006A', fontWeight:700 }}>{role==='buyer'?'a Buyer':role==='seller'?'a Seller':'a Driver'}</span>
                {' '}<button type="button" onClick={() => setStep(1)} style={{ background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>change</button>
              </p>
            </div>
            {[
              { label:'Full name', val:fullName, set:setFullName, type:'text', ph:'Your full name' },
              { label:'Email address', val:email, set:setEmail, type:'email', ph:'you@example.com' },
              { label:'Phone number', val:phone, set:setPhone, type:'tel', ph:'+44 7700 000000' },
              { label:'Password', val:password, set:setPassword, type:'password', ph:'Minimum 6 characters' },
              { label:'Confirm password', val:confirmPassword, set:setConfirmPassword, type:'password', ph:'Repeat your password' },
            ].map(f => (
              <div key={f.label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required style={{ height:46, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setStep(1)} style={{ flex:1, height:48, background:'#F5F5F5', color:'#1A1A1A', border:'1.5px solid #E0E0E0', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer' }}>← Back</button>
              <button type="submit" disabled={loading} style={{ flex:2, height:48, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?0.8:1 }}>
                {loading ? 'Creating account...' : 'Create account →'}
              </button>
            </div>
            <p style={{ textAlign:'center', fontSize:12, color:'#888', lineHeight:1.5 }}>
              By creating an account you agree to our <Link href="/terms" style={{ color:'#C8006A', fontWeight:600 }}>Terms</Link> and <Link href="/privacy" style={{ color:'#C8006A', fontWeight:600 }}>Privacy Policy</Link>
            </p>
          </form>
        )}
        <p style={{ textAlign:'center', fontSize:13, color:'#555', marginTop:20 }}>
          Already have an account? <Link href="/login" style={{ color:'#C8006A', fontWeight:700 }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
`)

console.log('\n✅ Part 2 done — auth pages created')
