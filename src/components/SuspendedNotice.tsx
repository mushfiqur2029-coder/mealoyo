'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'

// Full-screen "your account is suspended" message. Shown to a suspended user on
// the login page after they sign in, and on the standalone /suspended page that
// the proxy redirects them to when they try to reach any protected route. The
// heading/body differ slightly between the two contexts, so both are props.
export default function SuspendedNotice({
  heading = 'Account suspended',
  body = 'Your account has been suspended. If you believe this is a mistake, please contact our support team.',
}: {
  heading?: string
  body?: string
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <style>{`*{box-sizing:border-box;} .susp-email:hover{background:#A00055 !important;} .susp-signout:hover{background:#F5F5F5 !important;}`}</style>
      <div style={{ marginBottom: 28 }}><Logo height={40} white /></div>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 460, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFF3E0', border: '2px solid #F5B942', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 34 }}>⚠️</div>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>{heading}</h1>
        <p style={{ fontSize: 14.5, color: '#4A4A4A', lineHeight: 1.6, marginBottom: 26 }}>{body}</p>
        <a
          href="mailto:hello@mealoyo.com"
          className="susp-email"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, background: '#C8006A', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 20px rgba(200,0,106,0.35)', transition: 'background 0.14s', marginBottom: 12 }}
        >
          ✉  Email hello@mealoyo.com
        </a>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="susp-signout"
          style={{ width: '100%', height: 48, background: '#fff', color: '#1A1A1A', border: '1.5px solid #E0E0E0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: signingOut ? 'wait' : 'pointer', transition: 'background 0.14s', opacity: signingOut ? 0.7 : 1 }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
