'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import { pointsToPounds, POINTS_PER_POUND_EARN, POINTS_PER_POUND_REDEEM } from '@/lib/loyalty'
import type { User, Profile, LoyaltyPoint } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/buyer/dashboard' },
  { l:'Browse food', h:'/browse' },
  { l:'My orders', h:'/buyer/orders' },
  { l:'Points', h:'/buyer/points' },
  { l:'Saved', h:'/buyer/saved' },
  { l:'Profile', h:'/buyer/profile' },
]

export default function BuyerPoints() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState<LoyaltyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data: avatarRow } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
      setAvatarUrl(avatarRow?.avatar_url || null)
      // Balance + ledger. Both fail gracefully (0 / empty) until the SQL is run.
      const { data: bal } = await supabase.rpc('get_points_balance', { p_buyer_id: user.id })
      setBalance(typeof bal === 'number' ? bal : 0)
      const { data: rows } = await supabase
        .from('loyalty_points')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
      setHistory((rows as LoyaltyPoint[]) || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const earnedTotal = history.filter(h => h.type === 'earned').reduce((s, h) => s + h.points, 0)
  const redeemedTotal = history.filter(h => h.type === 'redeemed').reduce((s, h) => s + h.points, 0)

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
      .signout:hover { background: #FFE8F4 !important; color: #C8006A !important; }
      .browse-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .hrow:hover { background: var(--bg-secondary) !important; }
      @media (max-width: 900px) { .nav-links { display: none !important; } }
      @media (max-width: 600px) { .pts-stats { grid-template-columns: 1fr !important; } }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/buyer/points'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : 'var(--text-primary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'B'}/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}{nav}
      <div style={{maxWidth:760, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:220, borderRadius:8, marginBottom:20}}/>
        <div className="skel" style={{height:180, borderRadius:20, marginBottom:20}}/>
        <div className="skel" style={{height:320, borderRadius:20}}/>
      </div>
    </div>
  )

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}{nav}

      <div style={{maxWidth:760, margin:'0 auto', padding:'32px 20px 56px'}}>

        <div className="fade-up" style={{marginBottom:22}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,34px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Loyalty points</h1>
          <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>Earn {POINTS_PER_POUND_EARN} points for every £1 you spend. {POINTS_PER_POUND_REDEEM} points = £1 off.</p>
        </div>

        {/* Balance hero */}
        <div className="fade-up" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:22, padding:'30px 28px', boxShadow:'0 10px 30px rgba(200,0,106,0.28)', position:'relative', overflow:'hidden', marginBottom:20}}>
          <div aria-hidden="true" style={{position:'absolute', top:-30, right:-10, fontSize:150, opacity:0.12, lineHeight:1}}>🎁</div>
          <div style={{fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.85)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10}}>⭐ Your balance</div>
          <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(44px,8vw,60px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{balance.toLocaleString('en-GB')}</div>
          <div style={{fontSize:15, color:'rgba(255,255,255,0.9)', marginTop:8}}>worth <strong style={{color:'#fff'}}>£{pointsToPounds(balance).toFixed(2)}</strong> off your next order</div>
          <Link href="/" className="browse-btn" style={{display:'inline-flex', alignItems:'center', height:46, padding:'0 22px', marginTop:20, background:'var(--bg-card)', color:'#C8006A', borderRadius:11, fontSize:14, fontWeight:700, transition:'all 0.16s'}}>Browse food to earn more →</Link>
        </div>

        {/* Earned / redeemed totals */}
        <div className="pts-stats fade-up" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20}}>
          <div style={{background:'var(--bg-card)', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:20, marginBottom:10}}>🟢</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#2DA84E', lineHeight:1}}>+{earnedTotal.toLocaleString('en-GB')}</div>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Total earned</div>
          </div>
          <div style={{background:'var(--bg-card)', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:20, marginBottom:10}}>🎟️</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#C8006A', lineHeight:1}}>−{redeemedTotal.toLocaleString('en-GB')}</div>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Total redeemed</div>
          </div>
        </div>

        {/* History */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
          <div style={{padding:'18px 22px', borderBottom:'1px solid var(--bg-secondary)'}}>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Points history</h3>
          </div>
          {history.length === 0 ? (
            <div style={{padding:'48px 32px', textAlign:'center'}}>
              <div style={{fontSize:40, marginBottom:12}}>⭐</div>
              <p style={{fontSize:14, color:'var(--text-primary)', marginBottom:18, lineHeight:1.6, maxWidth:340, margin:'0 auto 18px'}}>No points yet. Place an order and you’ll earn {POINTS_PER_POUND_EARN} points for every £1 once it’s delivered.</p>
              <Link href="/" className="browse-btn" style={{display:'inline-flex', alignItems:'center', height:42, padding:'0 20px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(200,0,106,0.28)', transition:'all 0.16s'}}>Browse food →</Link>
            </div>
          ) : history.map((h, i) => {
            const earned = h.type === 'earned'
            return (
              <div key={h.id} className="hrow" style={{display:'flex', alignItems:'center', gap:13, padding:'15px 22px', borderBottom:i < history.length - 1 ? '1px solid var(--bg-secondary)' : 'none', transition:'background 0.12s'}}>
                <div style={{width:40, height:40, borderRadius:11, background:earned ? '#E4F6EA' : '#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{earned ? '🟢' : '🎟️'}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{earned ? 'Points earned' : 'Points redeemed'}</div>
                  <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginTop:1}}>{h.description || (earned ? 'Order reward' : 'Discount applied')} · {fmtDate(h.created_at)}</div>
                </div>
                <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:earned ? '#2DA84E' : '#C8006A', flexShrink:0}}>{earned ? '+' : '−'}{h.points.toLocaleString('en-GB')}</div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
