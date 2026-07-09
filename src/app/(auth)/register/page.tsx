'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import OAuthButtons from '@/components/OAuthButtons'

type Role = 'buyer' | 'seller' | 'driver'

// Turn whatever Supabase / fetch throws into a human-readable string. Supabase
// auth errors can arrive as an AuthRetryableFetchError (transient 5xx, e.g. the
// confirmation email failing to send) whose `.message` serialises to "{}" — the
// raw object must never reach the UI.
function getErrorMessage(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.'
  if (typeof err === 'string') return err
  const e = err as { name?: string; status?: number; code?: string; message?: unknown; error_description?: string; msg?: string }
  if (e.name === 'AuthRetryableFetchError' || e.status === 500) {
    return 'We couldn’t complete your sign-up — the confirmation email failed to send. Please try again in a few minutes, or contact support if it keeps happening.'
  }
  if (e.status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (e.code === 'user_already_exists' || (typeof e.message === 'string' && /already (registered|exists)/i.test(e.message))) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  const msg = typeof e.message === 'string' ? e.message.trim() : (e.error_description || e.msg || '')
  if (msg && msg !== '{}') return msg
  return 'Something went wrong. Please try again.'
}

// Eye / eye-off toggle for password fields. Brand-pink stroke.
function EyeToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={shown ? 'Hide password' : 'Show password'}
      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
      {shown ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8006A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8006A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const refParam = searchParams.get('ref')
  // Stash any ?ref=CODE so we can credit the referrer once this buyer has an
  // active session (applied on their first dashboard load — see buyer/dashboard).
  // Kept in localStorage so it survives the email-confirmation round-trip.
  useEffect(() => {
    if (refParam && refParam.trim()) localStorage.setItem('mealoyo_ref', refParam.trim())
  }, [refParam])
  const roleParam = searchParams.get('role')
  const preselectedRole: Role | null = roleParam === 'seller' || roleParam === 'driver' ? roleParam : null
  // When arriving from a "become a seller/driver" CTA, pre-select that role and
  // jump straight to the sign-up step (the "change" link still returns to step 1).
  const [step, setStep] = useState<1 | 2>(preselectedRole ? 2 : 1)
  const [role, setRole] = useState<Role>(preselectedRole ?? 'buyer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const router = useRouter()

  const roles: { id: Role; icon: string; title: string; sub: string; noun: string }[] = [
    { id:'buyer',  icon:'🛒',  title:'Order food',   sub:'Browse and order from local home cooks', noun:'Buyer' },
    { id:'seller', icon:'👩‍🍳', title:'Sell food',    sub:'List your home cooking and earn money',  noun:'Seller' },
    { id:'driver', icon:'🚴',  title:'Deliver food', sub:'Earn per delivery, flexible hours',      noun:'Driver' },
  ]
  const current = roles.find(r => r.id === role)!

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError(''); setNotice('')
    const { data, error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName, phone, role } }
    })
    if (authError) { setError(getErrorMessage(authError)); setLoading(false); return }
    // The profile row is created automatically by the handle_new_user DB trigger
    // from the metadata above (full_name, phone, role + email). We deliberately
    // do NOT insert it from the client — the table blocks direct client writes.
    if (!data.session) {
      // Email confirmation is enabled: there's no session until the user confirms,
      // so we can't drop them into a protected dashboard yet.
      setNotice('Account created! Please check your email to confirm your address, then sign in.')
      setLoading(false)
      return
    }
    if (role === 'buyer') router.push('/buyer/dashboard')
    else router.push('/pending')
  }

  const goToStep = (s: 1 | 2) => { setError(''); setNotice(''); setStep(s) }

  const inputStyle: React.CSSProperties = { height:48, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}
        @keyframes stepIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .step-anim { animation: stepIn 0.28s cubic-bezier(0.34,1.15,0.64,1) both; }
        .role-card:hover { border-color:#C8006A !important; }
        .primary-btn:hover { background:#A00055 !important; }
      `}</style>
      <Link href="/" style={{ marginBottom:24 }}>
        <Logo height={38} white/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'32px 30px', width:'100%', maxWidth:480, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>

        {/* Step indicator: 1 → 2 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:26 }}>
          {([{ n:1, l:'Role' }, { n:2, l:'Sign up' }] as const).map((s, i) => (
            <div key={s.n} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:step>=s.n?'#C8006A':'#E8E8E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:step>=s.n?'#fff':'#1A1A1A', transition:'background 0.2s' }}>{s.n}</div>
                <span style={{ fontSize:12.5, fontWeight:700, color:step===s.n?'#C8006A':'#1A1A1A' }}>{s.l}</span>
              </div>
              {i===0 && <span style={{ fontSize:16, color:step>1?'#C8006A':'#C8C8C8', fontWeight:700 }}>→</span>}
            </div>
          ))}
        </div>

        {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
        {notice && (
          <div style={{ background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#1A7A36', fontWeight:600, lineHeight:1.5 }}>
            ✓ {notice} <Link href="/login" style={{ color:'#157A33', fontWeight:700, textDecoration:'underline' }}>Sign in →</Link>
          </div>
        )}

        {/* STEP 1 — role selection only */}
        {step === 1 && (
          <div key="step1" className="step-anim">
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:'#1A1A1A', marginBottom:6, letterSpacing:'-0.01em' }}>Join meaLoyo</h1>
            <p style={{ fontSize:15, color:'#1A1A1A', marginBottom:22 }}>How do you want to use meaLoyo?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
              {roles.map(r => {
                const on = role === r.id
                return (
                  <button key={r.id} type="button" onClick={() => setRole(r.id)} className="role-card"
                    style={{ display:'flex', alignItems:'center', gap:16, minHeight:80, padding:'0 18px', textAlign:'left', width:'100%', background:on?'#FFE8F4':'#fff', border:on?'2px solid #C8006A':'1.5px solid #E8E8E8', borderRadius:16, cursor:'pointer', transition:'all 0.15s' }}>
                    <span style={{ fontSize:32, lineHeight:1, flexShrink:0 }}>{r.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:700, color:on?'#C8006A':'#1A1A1A' }}>{r.title}</div>
                      <div style={{ fontSize:13, color:'#1A1A1A', marginTop:3 }}>{r.sub}</div>
                    </div>
                    <div style={{ width:22, height:22, flexShrink:0, borderRadius:'50%', border:on?'2px solid #C8006A':'2px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {on && <div style={{ width:11, height:11, borderRadius:'50%', background:'#C8006A' }}/>}
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => goToStep(2)} className="primary-btn" style={{ width:'100%', height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s' }}>Continue →</button>
            <p style={{ textAlign:'center', fontSize:13.5, color:'#1A1A1A', marginTop:20 }}>
              Already have an account? <Link href="/login" style={{ color:'#C8006A', fontWeight:700 }}>Sign in →</Link>
            </p>
          </div>
        )}

        {/* STEP 2 — sign up method */}
        {step === 2 && (
          <div key="step2" className="step-anim">
            {/* Back arrow + selected-role badge */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <button type="button" onClick={() => goToStep(1)} aria-label="Back to role selection"
                style={{ width:36, height:36, flexShrink:0, borderRadius:10, border:'1.5px solid #E8E8E8', background:'#fff', color:'#C8006A', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>←</button>
              <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.2)', borderRadius:100, padding:'7px 14px' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#C8006A' }}>Signing up as a {current.noun} {current.icon}</span>
                <span style={{ fontSize:13, color:'#1A1A1A' }}>·</span>
                <button type="button" onClick={() => goToStep(1)} style={{ background:'none', border:'none', color:'#C8006A', fontSize:13, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0 }}>change</button>
              </div>
            </div>

            <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:16, letterSpacing:'-0.01em' }}>Create your account</h1>

            {(role==='seller'||role==='driver') && (
              <div style={{ background:'#FFF8E0', border:'1.5px solid #F5D080', borderRadius:10, padding:'12px 14px', marginBottom:18, fontSize:12.5, color:'#8C5500', lineHeight:1.6 }}>
                ⏳ Your account will need admin approval before going live. We&rsquo;ll email you within 24–48 hours.
              </div>
            )}

            {/* Social sign up FIRST — OAuthButtons saves role + provider to localStorage before redirect */}
            <OAuthButtons selectedRole={role} />

            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0' }}>
              <div style={{ flex:1, height:1, background:'#E8E8E8' }}/><span style={{ fontSize:12.5, color:'#1A1A1A' }}>or sign up with email</span><div style={{ flex:1, height:1, background:'#E8E8E8' }}/>
            </div>

            {/* Email form */}
            <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { label:'Full name', val:fullName, set:setFullName, type:'text', ph:'Your full name', toggle:null as null | { shown:boolean; set:(v:boolean)=>void } },
                { label:'Email address', val:email, set:setEmail, type:'email', ph:'you@example.com', toggle:null },
                { label:'Phone number', val:phone, set:setPhone, type:'tel', ph:'+44 7700 000000', toggle:null },
                { label:'Password', val:password, set:setPassword, type:'password', ph:'Minimum 6 characters', toggle:{ shown:showPw, set:setShowPw } },
                { label:'Confirm password', val:confirmPassword, set:setConfirmPassword, type:'password', ph:'Repeat your password', toggle:{ shown:showConfirm, set:setShowConfirm } },
              ].map(f => {
                const inputType = f.toggle ? (f.toggle.shown ? 'text' : 'password') : f.type
                return (
                  <div key={f.label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</label>
                    <div style={{ position:'relative' }}>
                      <input type={inputType} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required style={{ ...inputStyle, padding:f.toggle ? '0 44px 0 14px' : '0 14px' }}/>
                      {f.toggle && <EyeToggle shown={f.toggle.shown} onClick={() => f.toggle!.set(!f.toggle!.shown)}/>}
                    </div>
                  </div>
                )
              })}
              <button type="submit" disabled={loading} className="primary-btn" style={{ width:'100%', height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?0.8:1, boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s', marginTop:2 }}>
                {loading ? 'Creating account…' : 'Create account →'}
              </button>
              <p style={{ textAlign:'center', fontSize:12, color:'#1A1A1A', lineHeight:1.5 }}>
                By creating an account you agree to our <Link href="/terms" style={{ color:'#C8006A', fontWeight:600 }}>Terms</Link> and <Link href="/privacy" style={{ color:'#C8006A', fontWeight:600 }}>Privacy Policy</Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Register() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)' }} />}>
      <RegisterForm />
    </Suspense>
  )
}
