'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

// Role-specific onboarding content. Direct client SELECTs on profiles are
// RLS-blocked (42501), so the role is read via the get_my_profile RPC.
const ROLE_CONTENT = {
  seller: {
    icon: '👩‍🍳',
    label: 'Seller',
    intro: 'Your cook account is under review.',
    docTitle: 'Documents to prepare',
    docs: [
      'Level 2 Food Hygiene Certificate',
      'Council food business registration',
      'Photo ID',
    ],
  },
  driver: {
    icon: '🚴',
    label: 'Driver',
    intro: 'Your driver account is under review.',
    docTitle: 'Documents to prepare',
    docs: [
      'Right to Work document (passport or visa)',
      'Valid UK driving licence',
      'Vehicle insurance certificate',
      'DBS check (optional but recommended)',
    ],
  },
} as const

type PendingRole = keyof typeof ROLE_CONTENT

export default function Pending() {
  const [role, setRole] = useState<PendingRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if (!active) return
      const p = profile as Profile | null
      // Approved or buyer accounts don't belong on the pending screen.
      if (p?.status === 'active' || p?.role === 'buyer') { router.replace('/buyer/dashboard'); return }
      setRole(p?.role === 'driver' ? 'driver' : p?.role === 'seller' ? 'seller' : null)
      setLoading(false)
    })()
    return () => { active = false }
  }, [router])

  const content = role ? ROLE_CONTENT[role] : null

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif', textAlign:'center' }}>
      <div style={{ background:'#fff', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        {loading ? (
          <>
            <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10 }}>Loading…</h1>
            <p style={{ fontSize:15, color:'#1A1A1A', lineHeight:1.7 }}>Fetching your application status.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize:56, marginBottom:8 }}>{content?.icon ?? '⏳'}</div>
            {content && (
              <div style={{ display:'inline-block', background:'#FFE8F4', color:'#C8006A', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:100, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {content.label} application
              </div>
            )}
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10 }}>Application received</h1>
            <p style={{ fontSize:15, color:'#1A1A1A', lineHeight:1.7, marginBottom:24 }}>
              {content?.intro ?? 'Your account is under review.'} You will receive an email within <strong>24–48 hours</strong> once approved.
            </p>
            {content && (
              <div style={{ background:'#FFF6FB', border:'1.5px solid rgba(200,0,106,0.2)', borderRadius:12, padding:'18px 20px', marginBottom:24, textAlign:'left' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>{content.docTitle}</p>
                <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                  {content.docs.map(doc => (
                    <li key={doc} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13.5, color:'#1A1A1A', lineHeight:1.5, fontWeight:500 }}>
                      <span style={{ color:'#C8006A', fontWeight:700, flexShrink:0 }}>✓</span>
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/" style={{ display:'inline-block', height:48, padding:'0 32px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, lineHeight:'48px', boxShadow:'0 4px 16px rgba(200,0,106,0.3)' }}>Back to meaLoyo</Link>
          </>
        )}
      </div>
    </div>
  )
}
