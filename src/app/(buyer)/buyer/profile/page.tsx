'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import AvatarUpload from '@/components/AvatarUpload'
import NavAvatar from '@/components/NavAvatar'
import ThemeToggle from '@/components/ThemeToggle'
import AddressLookup, { type AddressValue } from '@/components/AddressLookup'
import ProfileCompletionCard from '@/components/ProfileCompletionCard'
import { calculateProfileCompletion, ctxFromAuthUser } from '@/lib/profileCompletion'
import type { User, Profile } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/buyer/dashboard' },
  { l:'Browse food', h:'/browse' },
  { l:'My orders', h:'/buyer/orders' },
  { l:'Points', h:'/buyer/points' },
  { l:'Saved', h:'/buyer/saved' },
  { l:'Profile', h:'/buyer/profile' },
]

const inputStyle: React.CSSProperties = { height:48, border:'1.5px solid var(--border-subtle)', borderRadius:11, padding:'0 14px', fontSize:14, color:'var(--text-primary)', background:'var(--bg-secondary)', width:'100%', transition:'border-color 0.14s' }
const labelStyle: React.CSSProperties = { fontSize:11, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:7 }

export default function BuyerProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  // One AddressValue holds the whole delivery address — AddressLookup handles
  // the postcode search + dropdown + manual fallback in one place.
  const [address, setAddress] = useState<AddressValue>({ address_line1: '', address_line2: '', city: '', postcode: '' })
  // Original email at load time — compared on save to detect a change and
  // trigger Supabase's built-in email-verification flow only when needed.
  const [origEmail, setOrigEmail] = useState('')
  const [emailPending, setEmailPending] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState('')
  // Change-password card state
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwOk, setPwOk] = useState(false)
  // TEMPORARY — diagnostic panel for the "permission denied for table profiles"
  // bug hunt. Remove once root cause is confirmed.
  const [diag, setDiag] = useState('')
  const [diagRunning, setDiagRunning] = useState(false)
  // TEMPORARY — auto-diagnostic result banner. Populated on mount by the useEffect
  // below so the user doesn't have to click anything or open DevTools.
  const [autoDiag, setAutoDiag] = useState('Waiting for auto-diagnostic to run…')
  const [pwError, setPwError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // ── TEMPORARY DIAGNOSTIC ──────────────────────────────────────────────
      // Auto-runs on every profile page load. Fires the security-definer RPC
      // and the direct-table update side-by-side so we can see which one (or
      // both) is producing "permission denied for table profiles". Delete
      // this whole block once the bug is confirmed fixed.
      try {
        const diagResult = await supabase.rpc('update_my_avatar', { p_avatar_url: 'https://diagnostic-test.com/test.jpg' })
        console.error('DIAGNOSTIC RPC TEST:', JSON.stringify(diagResult))
        const diagUpdate = await supabase.from('profiles').update({ avatar_url: 'https://diagnostic-test.com/test.jpg' }).eq('id', user.id)
        console.error('DIAGNOSTIC DIRECT UPDATE:', JSON.stringify(diagUpdate))
        setAutoDiag(
          `▸ RPC update_my_avatar\n` +
          `  ${JSON.stringify(diagResult)}\n\n` +
          `▸ DIRECT .from('profiles').update()\n` +
          `  ${JSON.stringify(diagUpdate)}`
        )
      } catch (e) {
        console.error('DIAGNOSTIC THREW:', e)
        setAutoDiag(`THREW: ${e instanceof Error ? e.message : String(e)}`)
      }
      // ── END TEMPORARY DIAGNOSTIC ──────────────────────────────────────────

      const { data: profile } = await supabase.rpc('get_my_profile')
      const p = profile as Profile | null
      setFullName(p?.full_name || '')
      setPhone(p?.phone || '')
      const loadedEmail = p?.email || user.email || ''
      setEmail(loadedEmail)
      setOrigEmail(loadedEmail)
      setStatus(p?.status || 'active')
      // Address columns aren't part of the get_my_profile RPC's fixed column
      // list, and aren't granted for direct reads post-lockdown, so read the
      // caller's own full row via the definer RPC.
      const { data: row } = await supabase.rpc('get_my_profile_full')
      setAddress({
        address_line1: row?.address_line1 || '',
        address_line2: row?.address_line2 || '',
        city: row?.city || '',
        postcode: row?.postcode || '',
      })
      setAvatarUrl(row?.avatar_url || null)
      setLoading(false)
    }
    getData()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!user) return
    setSaving(true); setError(''); setSavedOk(false); setEmailPending(null)
    const { error: dbError } = await supabase.rpc('update_my_profile_basics', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_address_line1: address.address_line1.trim() || null,
      p_address_line2: address.address_line2.trim() || null,
      p_city: address.city.trim() || null,
      p_postcode: address.postcode.trim().toUpperCase() || null,
    })
    if (dbError) {
      console.error('[BuyerProfile] Save error:', { code: dbError.code, message: dbError.message, details: dbError.details, hint: dbError.hint, raw: JSON.stringify(dbError) })
      setError(dbError.message); setSaving(false); return
    }
    // If the email changed, ask Supabase to send the verification link to the
    // new address. The old email stays active for sign-in until confirmed.
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedOrig = origEmail.trim().toLowerCase()
    if (trimmedEmail && trimmedEmail !== trimmedOrig) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError('Please enter a valid email address'); setSaving(false); return
      }
      const { error: emailErr } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (emailErr) { setError(emailErr.message); setSaving(false); return }
      setEmailPending(trimmedEmail)
    } else {
      setSavedOk(true)
    }
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(''); setPwOk(false)
    if (!curPw) { setPwError('Please enter your current password'); return }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return }
    if (!email) { setPwError('Could not verify your account — please sign in again'); return }
    setPwSaving(true)
    // Verify the current password by re-authenticating before changing it.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: curPw })
    if (signInErr) { setPwError('Your current password is incorrect'); setPwSaving(false); return }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
    if (updErr) { setPwError(updErr.message); setPwSaving(false); return }
    setPwOk(true); setPwSaving(false)
    setCurPw(''); setNewPw(''); setConfirmPw('')
  }

  // TEMPORARY diagnostic — probes the exact failure mode of the profiles-write
  // path. Logs session identity, then calls the two RPCs and dumps every field
  // of the PostgrestError (code, message, details, hint) so we can tell whether
  // the error is a real "permission denied", a missing function (PGRST202), or
  // something else. Delete this block after the bug is fixed.
  const runDiagnostic = async () => {
    setDiagRunning(true); setDiag('Running…')
    const lines: string[] = []
    try {
      const { data: sessData } = await supabase.auth.getSession()
      const session = sessData?.session
      const uid = session?.user?.id ?? '(none)'
      const tokPrefix = session?.access_token?.substring(0, 20) ?? '(none)'
      console.log('[DIAG] session.user.id =', uid, 'token[:20] =', tokPrefix)
      lines.push(`session.user.id = ${uid}`)
      lines.push(`token[:20]      = ${tokPrefix}`)

      const avatar = await supabase.rpc('update_my_avatar', { p_avatar_url: 'https://test.com/test.jpg' })
      console.log('[DIAG] update_my_avatar full result:', avatar)
      lines.push('')
      lines.push('▸ update_my_avatar')
      lines.push(`  data  = ${JSON.stringify(avatar.data)}`)
      if (avatar.error) {
        lines.push(`  error.code    = ${avatar.error.code}`)
        lines.push(`  error.message = ${avatar.error.message}`)
        lines.push(`  error.details = ${avatar.error.details}`)
        lines.push(`  error.hint    = ${avatar.error.hint}`)
      } else {
        lines.push(`  error = null`)
      }

      const basics = await supabase.rpc('update_my_profile_basics', {
        p_full_name: fullName.trim() || 'Diag',
        p_phone: phone.trim() || '+44 0000000000',
        p_address_line1: address.address_line1.trim() || null,
        p_address_line2: address.address_line2.trim() || null,
        p_city: address.city.trim() || null,
        p_postcode: address.postcode.trim().toUpperCase() || null,
      })
      console.log('[DIAG] update_my_profile_basics full result:', basics)
      lines.push('')
      lines.push('▸ update_my_profile_basics')
      lines.push(`  data  = ${JSON.stringify(basics.data)}`)
      if (basics.error) {
        lines.push(`  error.code    = ${basics.error.code}`)
        lines.push(`  error.message = ${basics.error.message}`)
        lines.push(`  error.details = ${basics.error.details}`)
        lines.push(`  error.hint    = ${basics.error.hint}`)
      } else {
        lines.push(`  error = null`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[DIAG] threw:', e)
      lines.push('')
      lines.push(`THREW: ${msg}`)
    }
    setDiag(lines.join('\n'))
    setDiagRunning(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const initials = (fullName.trim() || email).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'B'

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
      input:focus { border-color: #C8006A !important; outline: none; background: var(--bg-card) !important; }
      .save-btn:hover { background: #A00055 !important; }
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      .signout-danger:hover { background: #C0392B !important; color: #fff !important; }
      @media (max-width: 900px) { .nav-links { display: none !important; } }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1000, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/buyer/profile'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : 'var(--text-primary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>

            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <NavAvatar url={avatarUrl} initial={initials[0]}/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  // TEMPORARY — fixed-position auto-diagnostic banner. Sits above every other
  // element (z-index 9999) and is rendered in both the loading and loaded
  // returns so it can't be hidden or scrolled past. Remove when bug is fixed.
  const diagBanner = (
    <div style={{position:'fixed', bottom:0, left:0, right:0, zIndex:9999, background:'#B8001A', color:'#fff', padding:'10px 14px', borderTop:'4px solid #FFD400', boxShadow:'0 -4px 20px rgba(0,0,0,0.35)', maxHeight:'40vh', overflow:'auto', fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace'}}>
      <div style={{fontWeight:800, fontSize:12, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:6, color:'#FFD400'}}>🧪 AUTO-DIAGNOSTIC (temporary)</div>
      <pre style={{margin:0, fontSize:11.5, whiteSpace:'pre-wrap', wordBreak:'break-all', color:'#fff', lineHeight:1.4}}>{autoDiag}</pre>
    </div>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:600, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:200, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:240, borderRadius:6, marginBottom:24}}/>
        <div className="skel" style={{height:420, borderRadius:22}}/>
      </div>
      {diagBanner}
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      {diagBanner}

      <div style={{maxWidth:600, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:22}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>My profile</h1>
          <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>Manage your account details.</p>
        </div>

        {/* TEMPORARY — diagnostic panel. Remove once bug is fixed. */}
        <div className="fade-up" style={{background:'#FFF4E0', border:'2px solid #B8730A', borderRadius:12, padding:'16px', marginBottom:18}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#B8730A', marginBottom:6}}>🧪 Diagnostic (temporary)</h3>
          <p style={{fontSize:12, color:'#5A3900', marginBottom:10}}>Runs update_my_avatar + update_my_profile_basics and dumps the raw PostgrestError fields. Also logged to the browser console.</p>
          <button type="button" onClick={runDiagnostic} disabled={diagRunning} style={{background:'#B8730A', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:700, fontSize:13, cursor:diagRunning ? 'not-allowed' : 'pointer', marginBottom:12, opacity:diagRunning ? 0.7 : 1}}>{diagRunning ? 'Running…' : 'Run RPC test'}</button>
          {diag && <pre style={{background:'#fff', padding:12, borderRadius:8, fontSize:11.5, whiteSpace:'pre-wrap', wordBreak:'break-all', color:'#1A1A1A', margin:0, fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace'}}>{diag}</pre>}
        </div>

        {/* Profile completion card */}
        <ProfileCompletionCard
          role="buyer"
          variant="full"
          result={calculateProfileCompletion(
            { full_name: fullName, phone, avatar_url: avatarUrl, address_line1: address.address_line1, address_line2: address.address_line2, city: address.city, postcode: address.postcode },
            'buyer',
            ctxFromAuthUser(user),
          )}
        />

        {/* Identity card */}
        <div id="pcc-avatar" className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'28px 24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', textAlign:'center', marginBottom:18}}>
          <div style={{marginBottom:14}}>
            {user && <AvatarUpload userId={user.id} initialUrl={avatarUrl} initials={initials} onUploaded={setAvatarUrl}/>}
          </div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>{fullName.trim() || 'Your name'}</h2>
          <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.8, marginBottom:12}}>{email}</p>
          <span style={{display:'inline-flex', alignItems:'center', gap:6, background:status === 'active' ? '#E4F6EA' : '#FFF4E0', color:status === 'active' ? '#2DA84E' : '#B8730A', padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:700, textTransform:'capitalize', letterSpacing:'0.02em'}}>
            <span style={{width:7, height:7, borderRadius:'50%', background:status === 'active' ? '#2DA84E' : '#B8730A'}}/>{status || 'active'} account
          </span>
        </div>

        {error && <div className="fade-up" style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600}}>{error}</div>}
        {savedOk && <div className="fade-up" style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#1A6030', fontWeight:600}}>✅ Profile updated</div>}

        {/* Appearance */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'22px 24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
          <div>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:2}}>Appearance</h3>
            <p style={{fontSize:12.5, color:'var(--text-primary)', opacity:0.6}}>Choose light, dark, or match your device.</p>
          </div>
          <ThemeToggle/>
        </div>

        {/* Details form */}
        <form onSubmit={handleSave} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:18, marginBottom:18}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>Account details</h3>
          <div id="pcc-name">
            <label style={labelStyle}>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle}/>
          </div>
          <div id="pcc-phone">
            <label style={labelStyle}>Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" style={inputStyle}/>
          </div>

          {/* Delivery address — one postcode lookup covers the whole thing. */}
          <div id="pcc-address" style={{borderTop:'1px solid var(--border-subtle)', paddingTop:18}}>
            <h4 style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>Delivery address</h4>
            <p style={{fontSize:12, color:'var(--text-primary)', opacity:0.6, marginBottom:14}}>Type your postcode and pick your address from the list — we&apos;ll save it so checkout auto-fills.</p>
            <AddressLookup value={address} onChange={setAddress}/>
          </div>

          <div id="pcc-email" style={{borderTop:'1px solid var(--border-subtle)', paddingTop:18}}>
            <label style={labelStyle}>Email address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" style={inputStyle}/>
            <p style={{fontSize:12, color:'#8C5500', opacity:0.9, fontWeight:600, marginTop:6, lineHeight:1.5}}>⚠️ Changing your email requires verification. You&apos;ll receive a link at the new address; the old email keeps working until you confirm.</p>
            {emailPending && (
              <div role="status" style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.28)', borderRadius:12, padding:'10px 14px', marginTop:10, fontSize:13, color:'#1A6030', fontWeight:600, lineHeight:1.5}}>
                ✅ Verification email sent to <strong>{emailPending}</strong>. Please check your inbox to confirm the change.
              </div>
            )}
          </div>
          <button type="submit" disabled={saving} className="save-btn" style={{height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:saving ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s', opacity:saving ? 0.8 : 1, marginTop:4}}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>

        {/* Change password */}
        <form id="pcc-password" onSubmit={handleChangePassword} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:16, marginBottom:18}}>
          <div>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:2}}>Change password</h3>
            <p style={{fontSize:12, color:'var(--text-primary)', opacity:0.6}}>Use at least 6 characters.</p>
          </div>
          {pwError && <div style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#C8006A', fontWeight:600}}>{pwError}</div>}
          {pwOk && <div style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.25)', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#1A6030', fontWeight:600}}>✅ Password updated</div>}
          <div>
            <label style={labelStyle}>Current password</label>
            <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Enter current password" autoComplete="current-password" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>New password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters" autoComplete="new-password" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Confirm new password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" style={inputStyle}/>
          </div>
          <button type="submit" disabled={pwSaving} className="save-btn" style={{height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:pwSaving ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s', opacity:pwSaving ? 0.8 : 1, marginTop:4}}>{pwSaving ? 'Saving…' : 'Save password'}</button>
        </form>

        {/* Danger zone */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'22px 24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid rgba(192,57,43,0.18)'}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#C0392B', marginBottom:4}}>Danger zone</h3>
          <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.8, marginBottom:16, lineHeight:1.5}}>Sign out of your account on this device.</p>
          <button onClick={signOut} className="signout-danger" style={{height:46, padding:'0 22px', background:'var(--bg-card)', color:'#C0392B', border:'1.5px solid #C0392B', borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
