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
import { calculateProfileCompletion } from '@/lib/profileCompletion'
import { isValidUKPostcode, formatSortCode, isValidSortCode, isValidAccountNumber } from '@/lib/pricing'
import type { User, Profile } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
]

const inputStyle: React.CSSProperties = { height:48, border:'1.5px solid var(--border-subtle)', borderRadius:11, padding:'0 14px', fontSize:14, color:'var(--text-primary)', background:'var(--bg-secondary)', width:'100%', transition:'border-color 0.14s' }
const labelStyle: React.CSSProperties = { fontSize:11, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:7 }

// Small pill flagging fields whose change sends the account back for review.
const reviewBadge = (
  <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#FFF4E0', color:'#B8730A', fontSize:9.5, fontWeight:800, padding:'2px 7px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.04em', verticalAlign:'middle', marginLeft:8 }}>⏳ Needs re-approval</span>
)

export default function SellerProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  // Whole address in one state — AddressLookup handles the postcode search
  // dropdown and manual fallback.
  const [address, setAddress] = useState<AddressValue>({ address_line1: '', address_line2: '', city: '', postcode: '' })
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  // Snapshot of the sensitive fields as loaded, to detect real changes on save.
  const [orig, setOrig] = useState({ fullName:'', address_line1:'', address_line2:'', city:'' })
  // Original email at load time — powers the "email changed → send verification"
  // branch on save.
  const [origEmail, setOrigEmail] = useState('')
  const [emailPending, setEmailPending] = useState<string | null>(null)
  // Whether this seller has at least one live listing — feeds profile
  // completion scoring. Fetched alongside the profile row.
  const [hasListing, setHasListing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [reapprovalNote, setReapprovalNote] = useState(false)
  const [error, setError] = useState('')
  // Change-password card state
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwOk, setPwOk] = useState(false)
  const [pwError, setPwError] = useState('')
  // Bank details for manual withdrawal payouts
  const [bankName, setBankName] = useState('')
  const [sortCode, setSortCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankSaving, setBankSaving] = useState(false)
  const [bankOk, setBankOk] = useState(false)
  const [bankError, setBankError] = useState('')
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
      const loadedEmail = p?.email || user.email || ''
      setEmail(loadedEmail)
      setOrigEmail(loadedEmail)
      setStatus(p?.status || '')
      // postcode + address + bank aren't part of the get_my_profile RPC's fixed
      // column list, and aren't granted for direct reads post-lockdown, so read
      // the caller's own full row via the definer RPC.
      const { data: row } = await supabase.rpc('get_my_profile_full')
      const loadedAddress: AddressValue = {
        address_line1: row?.address_line1 || '',
        address_line2: row?.address_line2 || '',
        city: row?.city || '',
        postcode: row?.postcode || '',
      }
      setAddress(loadedAddress)
      setAvatarUrl(row?.avatar_url || null)
      setBankName(row?.bank_account_name || '')
      setSortCode(row?.bank_sort_code || '')
      setAccountNumber(row?.bank_account_number || '')
      setOrig({ fullName: p?.full_name || '', address_line1: loadedAddress.address_line1, address_line2: loadedAddress.address_line2, city: loadedAddress.city })
      // Live listing count — head request is cheap; only need to know >=1.
      const { count: liveCount } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'live')
      setHasListing((liveCount ?? 0) > 0)
      setLoading(false)
    }
    getData()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!phone.trim()) { setError('Phone number is required for sellers'); return }
    if (!address.postcode.trim()) { setError('Please enter your postcode — buyers need it to calculate delivery distance'); return }
    if (!isValidUKPostcode(address.postcode)) { setError('Please enter a valid UK postcode (e.g. E3 4SS)'); return }
    if (!user) return
    setSaving(true); setError(''); setSavedOk(false); setReapprovalNote(false); setEmailPending(null)

    // Email change is fully separated from the profile RPC path — see the
    // buyer profile page for the full reasoning. Short version:
    // supabase.auth.updateUser({ email }) trips an internal side-effect on
    // public.profiles that fails with "permission denied for table profiles",
    // so we only fire it when the email genuinely differs and we return early
    // (no RPC + no listings re-approval) in the same click. The seller can hit
    // Save again after confirming the email to update their profile details.
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedOrig = origEmail.trim().toLowerCase()
    const emailChanged = !!trimmedEmail && trimmedEmail !== trimmedOrig

    if (emailChanged) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError('Please enter a valid email address'); setSaving(false); return
      }
      const { error: emailErr } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (emailErr) {
        console.error('[SellerProfile] Save error (auth.updateUser email):', { name: emailErr.name, message: emailErr.message, raw: JSON.stringify(emailErr, Object.getOwnPropertyNames(emailErr)) })
        setError(emailErr.message); setSaving(false); return
      }
      setEmailPending(trimmedEmail)
      setSaving(false)
      return
    }

    // Re-approval is only required when a sensitive field (name or address)
    // changes. Phone + postcode can be updated freely.
    const sensitiveChanged =
      fullName.trim() !== orig.fullName.trim() ||
      address.address_line1.trim() !== orig.address_line1.trim() ||
      address.address_line2.trim() !== orig.address_line2.trim() ||
      address.city.trim() !== orig.city.trim()
    const willReapprove = sensitiveChanged && status === 'active'

    const { error: dbError } = await supabase.rpc('update_my_profile_basics', {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_address_line1: address.address_line1.trim() || null,
      p_address_line2: address.address_line2.trim() || null,
      p_city: address.city.trim() || null,
      p_postcode: address.postcode.trim().toUpperCase(),
      p_request_reapproval: willReapprove,
    })
    if (dbError) {
      console.error('[SellerProfile] Save error (basics RPC):', { code: dbError.code, message: dbError.message, details: dbError.details, hint: dbError.hint, raw: JSON.stringify(dbError) })
      setError(dbError.message); setSaving(false); return
    }

    if (willReapprove) {
      // Pull the seller's live listings down for re-review alongside the account.
      await supabase.from('listings').update({ status: 'pending' }).eq('seller_id', user.id).eq('status', 'active')
      setStatus('pending')
      setReapprovalNote(true)
    } else {
      setSavedOk(true)
    }
    // Re-baseline so a second save of the same values doesn't re-trigger review.
    setOrig({ fullName: fullName.trim(), address_line1: address.address_line1.trim(), address_line2: address.address_line2.trim(), city: address.city.trim() })
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
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: curPw })
    if (signInErr) { setPwError('Your current password is incorrect'); setPwSaving(false); return }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
    if (updErr) { setPwError(updErr.message); setPwSaving(false); return }
    setPwOk(true); setPwSaving(false)
    setCurPw(''); setNewPw(''); setConfirmPw('')
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    setBankError(''); setBankOk(false)
    if (!bankName.trim()) { setBankError('Please enter the account holder name'); return }
    if (!isValidSortCode(sortCode)) { setBankError('Sort code must be 6 digits (e.g. 12-34-56)'); return }
    if (!isValidAccountNumber(accountNumber)) { setBankError('Account number must be 8 digits'); return }
    if (!user) return
    setBankSaving(true)
    const { error: dbError } = await supabase.rpc('update_my_bank_details', {
      p_bank_account_name: bankName.trim(),
      p_bank_sort_code: formatSortCode(sortCode),
      p_bank_account_number: accountNumber.replace(/\D/g, ''),
    })
    if (dbError) {
      console.error('[SellerProfile] Bank save error:', { code: dbError.code, message: dbError.message, details: dbError.details, hint: dbError.hint, raw: JSON.stringify(dbError) })
      setBankError(dbError.message); setBankSaving(false); return
    }
    setBankOk(true); setBankSaving(false)
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
            const active = t.h === '/seller/profile'
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

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
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
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:600, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:22}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>My profile</h1>
          <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>Manage your seller account details.</p>
        </div>

        {/* Profile completion card */}
        <ProfileCompletionCard
          role="seller"
          variant="full"
          result={calculateProfileCompletion(
            {
              full_name: fullName, phone, avatar_url: avatarUrl,
              address_line1: address.address_line1, address_line2: address.address_line2, city: address.city, postcode: address.postcode,
              bank_account_name: bankName, bank_sort_code: sortCode, bank_account_number: accountNumber,
            },
            'seller',
            { hasListing },
          )}
        />

        {/* Identity card */}
        <div id="pcc-avatar" className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'28px 24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', textAlign:'center', marginBottom:18}}>
          <div style={{marginBottom:14}}>
            {user && <AvatarUpload userId={user.id} initialUrl={avatarUrl} initials={initials} onUploaded={setAvatarUrl}/>}
          </div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>{fullName.trim() || 'Your name'}</h2>
          <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.8, marginBottom:12}}>{email} · Home cook</p>
          <span style={{display:'inline-flex', alignItems:'center', gap:6, background:statusOk ? '#E4F6EA' : '#FFF4E0', color:statusOk ? '#2DA84E' : '#B8730A', padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:700, textTransform:'capitalize', letterSpacing:'0.02em'}}>
            <span style={{width:7, height:7, borderRadius:'50%', background:statusOk ? '#2DA84E' : '#B8730A'}}/>{status || 'pending'} {statusOk ? 'seller' : 'review'}
          </span>
        </div>

        {error && <div className="fade-up" style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600}}>{error}</div>}
        {savedOk && <div className="fade-up" style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.25)', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#1A6030', fontWeight:600}}>✅ Profile updated</div>}
        {reapprovalNote && <div className="fade-up" style={{background:'#FFF4E0', border:'1.5px solid rgba(184,115,10,0.3)', borderRadius:12, padding:'14px 16px', marginBottom:16, fontSize:13, color:'#8C5500', fontWeight:600, lineHeight:1.6}}>⏳ Your changes have been submitted. An admin will review and reapprove your account within 24 hours. Your listings have been paused until then.</div>}

        {/* Postcode required — highlight at the top when missing so distance
            quotes to buyers actually work. */}
        {!address.postcode.trim() && (
          <div className="fade-up" role="alert" style={{display:'flex', alignItems:'flex-start', gap:12, background:'#FFF4E0', border:'2px solid #F5A623', borderRadius:14, padding:'14px 16px', marginBottom:18, fontSize:13.5, color:'#8C5500', lineHeight:1.55, boxShadow:'0 4px 14px rgba(245,166,35,0.16)'}}>
            <span style={{fontSize:20, flexShrink:0}}>⚠️</span>
            <div>
              <div style={{fontWeight:800, marginBottom:2, color:'#8C5500'}}>Please add your postcode so buyers can calculate delivery distance</div>
              <div style={{fontSize:12.5, opacity:0.9}}>Without a postcode we can&apos;t work out delivery fees — buyers will see a flat &quot;fee at dispatch&quot; instead.</div>
            </div>
          </div>
        )}

        {/* Re-approval policy note */}
        <div className="fade-up" style={{background:'#FFF8F0', border:'1.5px solid #F3E0C0', borderRadius:14, padding:'12px 15px', marginBottom:18, fontSize:12.5, color:'#8C5500', lineHeight:1.55}}>
          ⏳ Changing your <strong>name</strong> or <strong>address</strong> sends your account back for a quick admin re-approval (your listings pause until then). Phone and postcode can be updated any time.
        </div>

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
            <label style={labelStyle}>Full name{reviewBadge}</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle}/>
          </div>
          <div id="pcc-phone">
            <label style={labelStyle}>Phone number <span style={{color:'#C0392B', fontWeight:800}}>*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" required style={inputStyle}/>
          </div>

          {/* Address — one postcode lookup, then pick from the dropdown. */}
          <div id="pcc-address" style={{borderTop:'1px solid var(--border-subtle)', paddingTop:18}}>
            <h4 style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>Address{reviewBadge}</h4>
            <p style={{fontSize:12, color:'var(--text-primary)', opacity:0.6, marginBottom:14}}>Where you cook from — used for verification and dispatch. Type your postcode and pick your address from the list.</p>
            <AddressLookup value={address} onChange={setAddress}/>
            <p style={{fontSize:12, color:address.postcode.trim() ? 'var(--text-primary)' : '#8C5500', opacity:address.postcode.trim() ? 0.6 : 1, fontWeight:address.postcode.trim() ? 400 : 600, marginTop:10}}>Postcode is required — buyers use it to calculate delivery distance.</p>
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
        <form onSubmit={handleChangePassword} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:16, marginBottom:18}}>
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

        {/* Bank details for withdrawals */}
        <form id="pcc-bank" onSubmit={handleSaveBank} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:16, marginBottom:18}}>
          <div>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:2}}>Bank details for withdrawals</h3>
            <p style={{fontSize:12, color:'var(--text-primary)', opacity:0.6}}>Where we send your earnings when you request a withdrawal.</p>
          </div>
          {bankError && <div style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#C8006A', fontWeight:600}}>{bankError}</div>}
          {bankOk && <div style={{background:'#E4F6EA', border:'1.5px solid rgba(45,168,78,0.25)', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#1A6030', fontWeight:600}}>✅ Bank details saved</div>}
          <div>
            <label style={labelStyle}>Account holder name</label>
            <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Name as it appears on your account" style={inputStyle}/>
          </div>
          <div style={{display:'flex', gap:14, flexWrap:'wrap'}}>
            <div style={{flex:'1 1 140px'}}>
              <label style={labelStyle}>Sort code</label>
              <input value={sortCode} onChange={e => setSortCode(formatSortCode(e.target.value))} placeholder="12-34-56" inputMode="numeric" style={inputStyle}/>
            </div>
            <div style={{flex:'1 1 160px'}}>
              <label style={labelStyle}>Account number</label>
              <input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" inputMode="numeric" style={inputStyle}/>
            </div>
          </div>
          <div style={{display:'flex', alignItems:'flex-start', gap:8, background:'var(--bg-secondary)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'11px 13px'}}>
            <span style={{fontSize:14, lineHeight:1.4}}>🔒</span>
            <p style={{fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, margin:0}}>Your bank details are encrypted and only used for manual payouts.</p>
          </div>
          <button type="submit" disabled={bankSaving} className="save-btn" style={{height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:bankSaving ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.14s', opacity:bankSaving ? 0.8 : 1, marginTop:4}}>{bankSaving ? 'Saving…' : 'Save bank details'}</button>
        </form>

        {/* Danger zone */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, padding:'22px 24px', boxShadow:'0 2px 16px var(--border-subtle)', border:'1.5px solid rgba(192,57,43,0.18)'}}>
          <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#C0392B', marginBottom:4}}>Danger zone</h3>
          <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.8, marginBottom:16, lineHeight:1.5}}>Sign out of your seller account on this device.</p>
          <button onClick={signOut} className="signout-danger" style={{height:46, padding:'0 22px', background:'var(--bg-card)', color:'#C0392B', border:'1.5px solid #C0392B', borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
