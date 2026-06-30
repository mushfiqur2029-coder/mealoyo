'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Profile, Listing } from '@/lib/types'

type SavedRow = { id: string; listing_id: string; listings: Listing | null }

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/buyer/dashboard' },
  { l:'Browse food', h:'/' },
  { l:'My orders', h:'/buyer/orders' },
  { l:'Points', h:'/buyer/points' },
  { l:'Saved', h:'/buyer/saved' },
  { l:'Profile', h:'/buyer/profile' },
]

export default function BuyerSaved() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('saved_listings')
        .select('id, listing_id, listings(*, profiles:seller_id(full_name))')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
      setSaved((data as unknown as SavedRow[]) || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const unsave = async (savedId: string) => {
    await supabase.from('saved_listings').delete().eq('id', savedId)
    setSaved(prev => prev.filter(s => s.id !== savedId))
  }

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
      .lcard { transition: transform 0.2s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.2s; }
      .lcard:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(200,0,106,0.14) !important; }
      .unsave-btn:hover { transform: scale(1.12); }
      .order-btn:hover { background: #A00055 !important; }
      .browse-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      @media (max-width: 900px) { .nav-links { display: none !important; } }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/buyer/saved'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <div style={{width:34, height:34, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff'}}>{profile?.full_name?.[0]?.toUpperCase() || 'B'}</div>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:220, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:160, borderRadius:6, marginBottom:26}}/>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18}}>
          {Array.from({length:6}).map((_, i) => <div key={i} className="skel" style={{height:268, borderRadius:20}}/>)}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4}}>Saved dishes</h1>
          <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85}}>{saved.length} {saved.length === 1 ? 'dish' : 'dishes'} saved for later</p>
        </div>

        {saved.length === 0 ? (
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:48, marginBottom:16}}>🤍</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', marginBottom:8}}>No saved dishes yet</h2>
            <p style={{fontSize:14, color:'#1A1A1A', opacity:0.85, marginBottom:24, lineHeight:1.65}}>Tap the heart on any dish to save it here for later.</p>
            <Link href="/" className="browse-btn" style={{display:'inline-flex', alignItems:'center', height:46, padding:'0 28px', background:'#C8006A', borderRadius:10, fontSize:14, fontWeight:700, color:'#fff', boxShadow:'0 4px 14px rgba(200,0,106,0.3)', transition:'all 0.16s'}}>Browse food →</Link>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18}}>
            {saved.map(s => {
              const l = s.listings
              if (!l) return null
              return (
                <div key={s.id} className="lcard fade-up" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', flexDirection:'column'}}>
                  <Link href={`/dish/${l.id}`} style={{display:'block'}}>
                    <div style={{height:160, display:'flex', alignItems:'center', justifyContent:'center', fontSize:56, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', position:'relative'}}>
                      {cuisineEmoji[l.cuisine] || '🍽️'}
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); unsave(s.id) }} className="unsave-btn" title="Remove from saved" style={{position:'absolute', top:12, right:12, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', transition:'transform 0.14s'}}>❤️</button>
                      {l.featured && <span style={{position:'absolute', top:14, left:14, background:'#fff', color:'#C8006A', fontSize:10, fontWeight:700, padding:'4px 9px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.04em', boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>★ Featured</span>}
                    </div>
                  </Link>
                  <div style={{padding:'15px 16px', display:'flex', flexDirection:'column', flex:1}}>
                    <Link href={`/dish/${l.id}`} style={{display:'block'}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:4, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                      <div style={{fontSize:12.5, color:'#1A1A1A', opacity:0.85, marginBottom:12, fontWeight:500}}>{l.profiles?.full_name || 'Home cook'} <span style={{color:'#C8006A', fontWeight:700}}>· {l.cuisine}</span></div>
                    </Link>
                    <div style={{marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #F5F0F3'}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
                      <Link href={`/dish/${l.id}`} className="order-btn" style={{height:34, padding:'0 16px', background:'#C8006A', color:'#fff', borderRadius:9, fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', boxShadow:'0 4px 12px rgba(200,0,106,0.25)', transition:'background 0.14s'}}>Order now →</Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
