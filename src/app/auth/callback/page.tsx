'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'

// OAuth landing page. Google/Facebook redirect here after sign-in. The
// @supabase/ssr browser client (detectSessionInUrl: true) parses the tokens
// from the URL and persists the session in cookies. We then decide whether the
// user still needs to finish setting up their profile.
export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const routeByRole = (role: string | null | undefined) => {
      if (role === 'seller' || role === 'driver') router.replace('/pending')
      else if (role === 'admin') router.replace('/admin/dashboard')
      else if (role === 'buyer') router.replace('/buyer/dashboard')
      else router.replace('/auth/complete-profile')
    }

    const finish = async () => {
      // The session may not be parsed from the URL on the very first tick, so
      // give it a few short retries before giving up.
      let user = null
      for (let i = 0; i < 12 && !cancelled; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) { user = data.session.user; break }
        await new Promise(r => setTimeout(r, 250))
      }
      if (cancelled) return
      if (!user) { setError('We couldn’t complete sign-in. Please try again.'); return }

      // A DB trigger creates the profile row on first sign-in, but OAuth users
      // arrive with no role or phone — treat that as "needs to finish setup".
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.role || !profile.phone) {
        router.replace('/auth/complete-profile')
        return
      }
      routeByRole(profile.role)
    }

    finish()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{ marginBottom:28 }}><Logo height={44} white/></div>
      {error ? (
        <div style={{ background:'#fff', borderRadius:20, padding:'32px 30px', maxWidth:400, textAlign:'center', boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize:38, marginBottom:12 }}>😕</div>
          <p style={{ fontSize:14, color:'#1A1A1A', marginBottom:20, lineHeight:1.6 }}>{error}</p>
          <button onClick={() => router.replace('/login')} style={{ height:48, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer' }}>Back to sign in</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>Signing you in…</p>
        </div>
      )}
    </div>
  )
}
