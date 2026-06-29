'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

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

export default function Register() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role>('buyer')
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

  const roles = [
    { id:'buyer' as Role, icon:'🛒', title:'I want to order food', sub:'Browse and order from home cooks', color:'#1A6ECC', bg:'#EBF2FD' },
    { id:'seller' as Role, icon:'👩‍🍳', title:'I want to sell food', sub:'List my home cooking and earn', color:'#C8006A', bg:'#FFE8F4' },
    { id:'driver' as Role, icon:'🚴', title:'I want to deliver food', sub:'Earn per drop, flexible hours', color:'#2DA84E', bg:'#E4F6EA' },
  ]

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

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}`}</style>
      <Link href="/" style={{ marginBottom:28 }}>
        <Logo height={40} white/>
      </Link>
      <div style={{ background:'#fff', borderRadius:24, padding:'36px', width:'100%', maxWidth:480, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
          {['Choose role','Your details'].map((label,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:step>=i+1?'#C8006A':'#E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:step>=i+1?'#fff':'#1A1A1A' }}>{i+1}</div>
                <span style={{ fontSize:10, color:step===i+1?'#C8006A':'#1A1A1A', fontWeight:600, whiteSpace:'nowrap' }}>{label}</span>
              </div>
              {i<1 && <div style={{ flex:1, height:2, background:step>1?'#C8006A':'#E0E0E0', margin:'0 8px', marginBottom:16 }}/>}
            </div>
          ))}
        </div>
        {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}
        {notice && (
          <div style={{ background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.3)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#1A7A36', fontWeight:600, lineHeight:1.5 }}>
            ✓ {notice} <Link href="/login" style={{ color:'#157A33', fontWeight:700, textDecoration:'underline' }}>Sign in →</Link>
          </div>
        )}
        {step === 1 && (
          <div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', marginBottom:4 }}>Join meaLoyo</h1>
            <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:20 }}>How do you want to use meaLoyo?</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {roles.map(r => (
                <div key={r.id} onClick={() => setRole(r.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:role===r.id?r.bg:'#F8F8F8', border:role===r.id?`2px solid ${r.color}`:'1.5px solid #E0E0E0', borderRadius:14, cursor:'pointer', transition:'all 0.14s' }}>
                  <span style={{ fontSize:26 }}>{r.icon}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:role===r.id?r.color:'#1A1A1A' }}>{r.title}</div><div style={{ fontSize:12, color:'#1A1A1A', marginTop:2 }}>{r.sub}</div></div>
                  <div style={{ width:20, height:20, borderRadius:'50%', border:role===r.id?`2px solid ${r.color}`:'2px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
              <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:4 }}>
                Registering as <span style={{ color:'#C8006A', fontWeight:700 }}>{role==='buyer'?'a Buyer':role==='seller'?'a Seller':'a Driver'}</span>
                {' '}<button type="button" onClick={() => setStep(1)} style={{ background:'none', border:'none', color:'#1A1A1A', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>change</button>
              </p>
            </div>
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
                    <input type={inputType} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required style={{ height:46, border:'1.5px solid #E0E0E0', borderRadius:10, padding:f.toggle ? '0 44px 0 14px' : '0 14px', fontSize:14, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }}/>
                    {f.toggle && <EyeToggle shown={f.toggle.shown} onClick={() => f.toggle!.set(!f.toggle!.shown)}/>}
                  </div>
                </div>
              )
            })}
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setStep(1)} style={{ flex:1, height:48, background:'#F5F5F5', color:'#1A1A1A', border:'1.5px solid #E0E0E0', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer' }}>← Back</button>
              <button type="submit" disabled={loading} style={{ flex:2, height:48, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?0.8:1 }}>
                {loading ? 'Creating account...' : 'Create account →'}
              </button>
            </div>
            <p style={{ textAlign:'center', fontSize:12, color:'#1A1A1A', lineHeight:1.5 }}>
              By creating an account you agree to our <Link href="/terms" style={{ color:'#C8006A', fontWeight:600 }}>Terms</Link> and <Link href="/privacy" style={{ color:'#C8006A', fontWeight:600 }}>Privacy Policy</Link>
            </p>
          </form>
        )}
        <p style={{ textAlign:'center', fontSize:13, color:'#1A1A1A', marginTop:20 }}>
          Already have an account? <Link href="/login" style={{ color:'#C8006A', fontWeight:700 }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
