'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Google + Facebook social sign-in buttons. Used on the login and register
// pages. Both providers route back to /auth/callback, which decides whether the
// user still needs to finish their profile (see src/app/auth/callback).
export default function OAuthButtons() {
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null)
  const [error, setError] = useState('')

  const signIn = async (provider: 'google' | 'facebook') => {
    setBusy(provider); setError('')
    // Facebook only gets public_profile — we deliberately do NOT request email.
    // Facebook's email permission is unreliable (and often not granted), which
    // made the sign-in fail with "Error getting user email from external
    // provider". Instead we let Facebook users through without an email and
    // collect it ourselves on /auth/complete-profile. Google still returns email
    // reliably (space-separated scopes).
    const scopes = provider === 'facebook' ? 'public_profile' : 'email profile'
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/auth/callback', scopes },
    })
    // On success the browser is redirected away, so we only land here on error.
    if (error) { setError(error.message); setBusy(null) }
  }

  const btn: React.CSSProperties = {
    position: 'relative', width: '100%', height: 48, display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: '#fff',
    border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontWeight: 700,
    color: '#1A1A1A', cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`.oauth-btn:hover{background:#FAFAFA !important;border-color:#C8006A !important;}`}</style>
      {error && (
        <div style={{ background: '#FFE8F4', border: '1.5px solid rgba(200,0,106,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#C8006A', fontWeight: 600 }}>{error}</div>
      )}
      <button type="button" className="oauth-btn" onClick={() => signIn('google')} disabled={!!busy} style={{ ...btn, opacity: busy && busy !== 'google' ? 0.6 : 1 }}>
        <span style={{ position: 'absolute', left: 16, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
          </svg>
        </span>
        {busy === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>
      <button type="button" className="oauth-btn" onClick={() => signIn('facebook')} disabled={!!busy} style={{ ...btn, opacity: busy && busy !== 'facebook' ? 0.6 : 1 }}>
        <span style={{ position: 'absolute', left: 16, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/>
          </svg>
        </span>
        {busy === 'facebook' ? 'Redirecting to Facebook…' : 'Continue with Facebook'}
      </button>
    </div>
  )
}
