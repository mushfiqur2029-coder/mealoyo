'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { dashboardPathForProfile } from '@/lib/authRedirect'
import type { Profile } from '@/lib/types'
import Logo from '@/components/Logo'

type Role = 'buyer' | 'seller' | 'driver'

// Shown after a first-time Google/Facebook sign-in when the profile is still
// missing a role/phone/password. Collecting a password here means the account
// can also be used with the normal email + password sign-in afterwards.
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

export default function CompleteProfile() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  // We never request email from Facebook, so Facebook users arrive without one
  // (or with a stale one). We always ask Facebook users to confirm/enter their
  // email here; Google users only see the field if their email is somehow
  // missing. `existingEmail` is what's already on the auth account, so we can
  // skip a needless updateUser (and its re-confirmation email) when unchanged.
  const [emailNeeded, setEmailNeeded] = useState(false)
  const [existingEmail, setExistingEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<Role>('buyer')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      // Restore the role the user picked before the OAuth redirect (saved by
      // OAuthButtons). Without this every OAuth sign-up defaulted to buyer,
      // ignoring a seller/driver selection. Read once, then clear it.
      const savedRole = localStorage.getItem('mealoyo-oauth-role')
      localStorage.removeItem('mealoyo-oauth-role')
      const pendingRole = savedRole === 'seller' || savedRole === 'driver' ? savedRole : null
      if (pendingRole) setRole(pendingRole)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const meta = user.user_metadata || {}
      setFullName((meta.full_name as string) || (meta.name as string) || '')
      // Facebook users always confirm/enter their email here (we don't request
      // it from Facebook); everyone else only when the provider gave us none.
      // Pre-fill from the account when an email is present, otherwise leave blank.
      const isFacebook = user.app_metadata?.provider === 'facebook'
      setExistingEmail(user.email || '')
      if (user.email) setEmail(user.email)
      setEmailNeeded(isFacebook || !user.email)
      // A genuinely new OAuth user has a profile row but no role yet. Anyone who
      // already picked a role has finished setup — skip this screen and send
      // them to their dashboard rather than making them fill it in again. The
      // exception is a pending seller/driver registration: a new OAuth user's
      // profile can default to buyer, so we must NOT shortcut them past role
      // completion when they explicitly chose seller/driver.
      // role/status/phone aren't granted for direct reads post-lockdown; the
      // get_my_profile RPC returns all of these identity columns for the caller.
      const { data: profile } = await supabase.rpc('get_my_profile')
      if (profile?.full_name) setFullName(prev => prev || profile.full_name || '')
      if (profile?.phone) setPhone(profile.phone)
      if (profile?.role && !pendingRole) {
        router.replace(dashboardPathForProfile(profile as Profile))
        return
      }
      setChecking(false)
    }
    load()
  }, [router])

  const roles = [
    { id:'buyer' as Role, icon:'🛒', title:'I want to order food', sub:'Browse and order from home cooks', color:'#1A6ECC', bg:'#EBF2FD' },
    { id:'seller' as Role, icon:'👩‍🍳', title:'I want to sell food', sub:'List my home cooking and earn', color:'#C8006A', bg:'#FFE8F4' },
    { id:'driver' as Role, icon:'🚴', title:'I want to deliver food', sub:'Earn per drop, flexible hours', color:'#2DA84E', bg:'#E4F6EA' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (emailNeeded) {
      if (!email.trim()) { setError('Please enter your email address'); return }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return }
    }
    if (!phone.trim()) { setError('Please enter your phone number'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true); setError('')

    // Set a password so the account also works with email + password sign-in,
    // and set the email too if the provider didn't give us one. (Supabase may
    // send a confirmation link for the new email — the user can still continue.)
    const updates: { password: string; email?: string } = { password }
    // Only write the email when it's new/changed — re-setting the same address
    // would trigger an unnecessary Supabase re-confirmation email.
    if (emailNeeded && email.trim() && email.trim() !== existingEmail) updates.email = email.trim()
    const { error: pwError } = await supabase.auth.updateUser(updates)
    if (pwError) { setError(pwError.message); setLoading(false); return }

    // Write role/name/phone via a security-definer RPC (role changes aren't
    // allowed through a plain client update).
    const { error: rpcError } = await supabase.rpc('complete_oauth_profile', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_role: role,
    })
    if (rpcError) { setError(rpcError.message); setLoading(false); return }

    // Credit a referrer if this buyer arrived via a referral link.
    const ref = typeof window !== 'undefined' ? localStorage.getItem('mealoyo_ref') : null
    if (ref && role === 'buyer') {
      await supabase.rpc('apply_referral', { p_code: ref })
      localStorage.removeItem('mealoyo_ref')
    }

    if (role === 'buyer') router.replace('/buyer/dashboard')
    else router.replace('/pending')
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  const inputStyle: React.CSSProperties = { height:46, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#F8F0F4', width:'100%' }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;} input:focus{border-color:#C8006A !important;outline:none;background:#fff !important;} .sbtn:hover{background:#A00055 !important;}`}</style>
      <div style={{ marginBottom:24 }}><Logo height={40} white/></div>
      <div style={{ background:'#fff', borderRadius:24, padding:'36px', width:'100%', maxWidth:480, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:4 }}>Complete your profile</h1>
        <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:22 }}>Just a few details to get you started on meaLoyo.</p>
        {error && <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Full name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required style={inputStyle}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Phone number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" required style={inputStyle}/>
          </div>
          {emailNeeded && (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle}/>
              <span style={{ fontSize:11.5, color:'#6B6B6B' }}>{existingEmail ? 'Confirm the email we should use for order updates and sign-in.' : 'Please add your email — we’ll use it for order updates and sign-in.'}</span>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Set a password</label>
            <div style={{ position:'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required style={{ ...inputStyle, padding:'0 44px 0 14px' }}/>
              <EyeToggle shown={showPw} onClick={() => setShowPw(s => !s)}/>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>Confirm password</label>
            <div style={{ position:'relative' }}>
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required style={{ ...inputStyle, padding:'0 44px 0 14px' }}/>
              <EyeToggle shown={showConfirm} onClick={() => setShowConfirm(s => !s)}/>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em' }}>How will you use meaLoyo?</label>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {roles.map(r => (
                <div key={r.id} onClick={() => setRole(r.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', background:role===r.id?r.bg:'#F8F8F8', border:role===r.id?`2px solid ${r.color}`:'1.5px solid #E0E0E0', borderRadius:14, cursor:'pointer', transition:'all 0.14s' }}>
                  <span style={{ fontSize:24 }}>{r.icon}</span>
                  <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700, color:role===r.id?r.color:'#1A1A1A' }}>{r.title}</div><div style={{ fontSize:12, color:'#1A1A1A', marginTop:2 }}>{r.sub}</div></div>
                  <div style={{ width:20, height:20, borderRadius:'50%', border:role===r.id?`2px solid ${r.color}`:'2px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {role===r.id && <div style={{ width:10, height:10, borderRadius:'50%', background:r.color }}/>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(role==='seller'||role==='driver') && (
            <div style={{ background:'#FFF8E0', border:'1.5px solid #F5D080', borderRadius:10, padding:'12px 14px', fontSize:12, color:'#8C5500', lineHeight:1.6 }}>
              ⏳ <strong>Approval required</strong> — {role==='seller'?'Seller':'Driver'} accounts are reviewed before going live. You will be notified within 24–48 hours.
            </div>
          )}

          <button type="submit" disabled={loading} className="sbtn" style={{ height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.35)', transition:'background 0.14s', opacity:loading?0.8:1, marginTop:4 }}>
            {loading ? 'Setting up…' : 'Finish & continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
