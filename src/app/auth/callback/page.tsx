'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { dashboardPathForProfile } from '@/lib/authRedirect'
import type { Profile } from '@/lib/types'
import Logo from '@/components/Logo'

// OAuth landing page. Google/Facebook redirect here after sign-in. The
// @supabase/ssr browser client (detectSessionInUrl: true) parses the tokens
// from the URL and persists the session in cookies. We then look up the
// profile and send the user to wherever they belong.
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    // Bounce back to login, showing the real provider error when we have one.
    const bounce = (reason: string) => {
      const q = reason ? '&reason=' + encodeURIComponent(reason) : ''
      router.replace('/login?error=oauth' + q)
    }

    const finish = async () => {
      // When the provider (esp. Facebook) rejects the sign-in, Supabase redirects
      // back here with error_description in the query string or the hash rather
      // than a session. Surface that exact message instead of a generic one.
      const qs = new URLSearchParams(window.location.search)
      const hs = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const providerError = qs.get('error_description') || hs.get('error_description')
        || qs.get('error') || hs.get('error')
      if (providerError) {
        bounce(providerError)
        return
      }

      // The session may not be parsed from the URL on the very first tick, so
      // wait for it: up to 5 retries, 500ms apart.
      let user = null
      let lastError = ''
      for (let i = 0; i < 5 && !cancelled; i++) {
        const { data, error } = await supabase.auth.getSession()
        if (error) lastError = error.message
        if (data.session?.user) { user = data.session.user; break }
        await new Promise(r => setTimeout(r, 500))
      }
      if (cancelled) return

      // Never got a session — kick back to login with whatever we learned.
      if (!user) { bounce(lastError); return }

      // get_my_profile() returns the caller's row (or null). A brand-new OAuth
      // user has no role yet → dashboardPathForProfile sends them to finish
      // setup; everyone else goes straight to their dashboard by role + status.
      const { data: profile } = await supabase.rpc('get_my_profile')
      router.replace(dashboardPathForProfile(profile as Profile | null))
    }

    finish()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{ marginBottom:28 }}><Logo height={44} white/></div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>Signing you in…</p>
      </div>
    </div>
  )
}
