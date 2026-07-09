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
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    const finish = async () => {
      // When the provider (esp. Facebook) rejects the sign-in, Supabase redirects
      // back here with error_description in the query string or the hash rather
      // than a session. Surface that exact message instead of a generic one.
      const qs = new URLSearchParams(window.location.search)
      const hs = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const providerError = qs.get('error_description') || hs.get('error_description')
        || qs.get('error') || hs.get('error')
      // A missing/unshared email is NOT a failure for us — Facebook is allowed to
      // sign in without one, and we collect it on /auth/complete-profile. So only
      // bounce back to login on a genuine error, not an email-related one.
      if (providerError && !/email/i.test(providerError)) {
        router.replace('/login?error=oauth&reason=' + encodeURIComponent(providerError))
        return
      }

      // Facebook's code→session exchange lands noticeably slower than Google's,
      // and on a brand-new user's FIRST sign-in the old short poll (5 × 500ms)
      // could time out and fall through to the homepage — so it only worked on
      // the second attempt. OAuthButtons tags the redirect with ?provider= (and
      // a localStorage fallback); when it's Facebook we give the exchange a 1s
      // head start before polling.
      const provider = qs.get('provider') || hs.get('provider')
        || (typeof window !== 'undefined' ? localStorage.getItem('mealoyo-oauth-provider') : null)
      const isFacebook = provider === 'facebook'
      if (isFacebook) await sleep(1000)

      // Poll for the session: up to 15 tries, 600ms apart (~9s). Break as soon
      // as it lands, so Google users (usually ready immediately) don't wait.
      let user = null
      for (let i = 0; i < 15 && !cancelled; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) { user = data.session.user; break }
        await sleep(600)
      }
      if (cancelled) return

      // Still no session after all retries: do NOT drop to the homepage (which
      // left the user staring at a "Sign in" nav). Send them back to login with
      // a clear, retryable message.
      if (!user) {
        router.replace('/login?error=session_timeout')
        return
      }

      if (typeof window !== 'undefined') localStorage.removeItem('mealoyo-oauth-provider')

      // If the user chose to register as a seller/driver before the OAuth
      // redirect (saved by OAuthButtons), always send them to complete-profile
      // so that choice is actually applied. A brand-new OAuth user's profile can
      // default to buyer, which would otherwise shortcut them straight to the
      // buyer dashboard and silently discard their seller/driver selection.
      // (complete-profile reads and clears mealoyo-oauth-role.)
      const pendingRole = localStorage.getItem('mealoyo-oauth-role')
      if (pendingRole === 'seller' || pendingRole === 'driver') {
        router.replace('/auth/complete-profile')
        return
      }

      // Facebook signs users in without an email (we don't request it). Send them
      // to finish their profile, where they enter one — a missing email is never
      // an error here.
      if (user.app_metadata?.provider === 'facebook' && !user.email) {
        router.replace('/auth/complete-profile')
        return
      }

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
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.55;}}`}</style>
      <div style={{ marginBottom:28, animation:'pulse 1.6s ease-in-out infinite' }}><Logo height={44} white/></div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }}/>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>Completing your sign in…</p>
      </div>
    </div>
  )
}
