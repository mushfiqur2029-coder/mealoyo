'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; a plain <img> avoids next/image remotePatterns config */
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import CartButton from '@/components/CartButton'
import ProfileCompletionCard from '@/components/ProfileCompletionCard'
import { calculateProfileCompletion, ctxFromAuthUser } from '@/lib/profileCompletion'
import { pointsToPounds } from '@/lib/loyalty'
import type { User, Profile, Order, Listing } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/buyer/dashboard' },
  { l:'Browse food', h:'/browse' },
  { l:'My orders', h:'/buyer/orders' },
  { l:'Points', h:'/buyer/points' },
  { l:'Saved', h:'/buyer/saved' },
  { l:'Profile', h:'/buyer/profile' },
]

type SavedRow = { id: string; listings: Pick<Listing, 'id' | 'name' | 'cuisine' | 'price' | 'image_url'> | null }
type RecListing = Listing & { profiles?: Pick<Profile, 'full_name'> | null }

export default function BuyerDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  // Full profile row (address/postcode/etc) for the completion card.
  const [fullProfileRow, setFullProfileRow] = useState<Profile | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [refCopied, setRefCopied] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [deliveredCount, setDeliveredCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [spent, setSpent] = useState(0)
  const [points, setPoints] = useState(0)
  const [recommended, setRecommended] = useState<RecListing[]>([])
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      // referral_code isn't granted for direct reads post-lockdown (which also
      // fails the bundled avatar_url), so read the caller's own full row via the
      // definer RPC.
      const { data: avatarRow } = await supabase.rpc('get_my_profile_full')
      setAvatarUrl(avatarRow?.avatar_url || null)
      setReferralCode(avatarRow?.referral_code || null)
      setFullProfileRow(avatarRow as Profile | null)
      // Credit a referrer captured from a ?ref= link on registration. Runs once,
      // then clears — the RPC itself ignores self-referrals and repeats.
      const pendingRef = localStorage.getItem('mealoyo_ref')
      if (pendingRef) {
        await supabase.rpc('apply_referral', { p_code: pendingRef })
        localStorage.removeItem('mealoyo_ref')
      }
      const { data: orders } = await supabase.from('orders').select('*, listings(name,cuisine), profiles:seller_id(full_name)').eq('buyer_id', user.id).neq('status', 'pending_payment').order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).neq('status', 'pending_payment')
      setOrderCount(total ?? 0)
      const { count: delivered } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('status', 'delivered')
      setDeliveredCount(delivered ?? 0)
      const { count: inProgress } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).not('status', 'in', '(delivered,cancelled,pending_payment)')
      setInProgressCount(inProgress ?? 0)
      const { data: spendRows } = await supabase.from('orders').select('total_amount').eq('buyer_id', user.id).not('status', 'in', '(cancelled,pending_payment)')
      setSpent((spendRows || []).reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0))
      // Loyalty balance. Fails gracefully to 0 until the SQL (table + function) is run.
      const { data: pointsBalance } = await supabase.rpc('get_points_balance', { p_buyer_id: user.id })
      setPoints(typeof pointsBalance === 'number' ? pointsBalance : 0)
      const { data: recs } = await supabase.from('listings').select('*, profiles:seller_id(full_name)').eq('status', 'live').order('created_at', { ascending: false }).limit(3)
      setRecommended((recs as unknown as RecListing[]) || [])
      const { data: savedRows } = await supabase.from('saved_listings').select('id, listings(id,name,cuisine,price,image_url)').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(3)
      setSaved((savedRows as unknown as SavedRow[]) || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#B8730A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'

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
      .skel { background: linear-gradient(90deg, rgba(200,0,106,0.06) 0%, rgba(200,0,106,0.13) 50%, rgba(200,0,106,0.06) 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .stat-card { transition: transform 0.18s; }
      .stat-card:hover { transform: translateY(-2px); }
      .points-card { transition: transform 0.18s, box-shadow 0.18s; }
      .points-card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(200,0,106,0.32) !important; }
      .orow:hover { background: rgba(200,0,106,0.06) !important; }
      .qa-row:hover { background: rgba(200,0,106,0.06) !important; transform: translateX(2px); }
      .rec-card { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
      .rec-card:hover { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(200,0,106,0.14) !important; }
      .signout:hover { background: rgba(200,0,106,0.12) !important; color: #C8006A !important; }
      .browse-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      @media (max-width: 900px) {
        .nav-links { display: none !important; }
        .two-col { grid-template-columns: minmax(0,1fr) !important; }
        .col-right { position: static !important; }
      }
      @media (max-width: 600px) {
        .dash-grid { grid-template-columns: 1fr 1fr !important; }
        .rec-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/buyer/dashboard'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : 'var(--text-primary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <CartButton />
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'B'} href="/buyer/profile"/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:280, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:200, borderRadius:6, marginBottom:28}}/>
        <div className="dash-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:108, borderRadius:18}}/>)}
        </div>
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20}}>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:300, borderRadius:20}}/>
            <div className="skel" style={{height:220, borderRadius:20}}/>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:240, borderRadius:20}}/>
            <div className="skel" style={{height:200, borderRadius:20}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── DERIVED ──
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const quickActions = [
    { l:'Browse food', s:'Find home cooks near you', i:'🍽️', h:'/browse' },
    { l:'My orders', s:'Track & view history', i:'📦', h:'/buyer/orders' },
    { l:'Saved listings', s:'Dishes you loved', i:'❤️', h:'/buyer/saved' },
    { l:'Edit profile', s:'Update your details', i:'⚙️', h:'/buyer/profile' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Welcome header */}
        <div className="fade-up" style={{marginBottom:26}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,34px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>{greeting}, {firstName} 👋</h1>
          <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>{today}</p>
        </div>

        {/* Profile completion nag — dismissible per-session, hides at >=80%. */}
        {fullProfileRow && (
          <ProfileCompletionCard
            role="buyer"
            variant="compact"
            storageKey="pcc-dismiss-buyer"
            result={calculateProfileCompletion(fullProfileRow, 'buyer', ctxFromAuthUser(user))}
          />
        )}

        {/* Top stats */}
        <div className="dash-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {[
            { icon:'🛒', value:String(orderCount), label:'Total orders' },
            { icon:'✅', value:String(deliveredCount), label:'Delivered' },
            { icon:'⏳', value:String(inProgressCount), label:'In progress' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid var(--border)'}}>
              <div style={{fontSize:20, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
          {/* Money spent — magenta gradient */}
          <div className="stat-card" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:18, padding:'20px', boxShadow:'0 8px 24px rgba(200,0,106,0.25)'}}>
            <div style={{fontSize:20, marginBottom:10}}>💷</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{spent.toFixed(2)}</div>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Money spent</div>
          </div>
        </div>

        {/* Two-column */}
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20, alignItems:'start'}}>

          {/* LEFT */}
          <div style={{display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Recent orders */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Recent orders <span style={{fontSize:13, color:'#C8006A', fontFamily:'Inter'}}>· {orderCount} total</span></h3>
                <Link href="/buyer/orders" className="nav-link" style={{fontSize:13, fontWeight:700, color:'#C8006A'}}>View all →</Link>
              </div>
              {orders.length === 0 ? (
                <div style={{padding:'40px 32px', textAlign:'center'}}>
                  <div style={{fontSize:36, marginBottom:10}}>🛒</div>
                  <p style={{fontSize:14, color:'var(--text-primary)', marginBottom:16, lineHeight:1.6}}>No orders yet — find a home cook near you and place your first order.</p>
                  <Link href="/browse" className="browse-btn" style={{display:'inline-flex', alignItems:'center', height:42, padding:'0 20px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(200,0,106,0.28)', transition:'all 0.16s'}}>Browse food →</Link>
                </div>
              ) : orders.map((o, i) => {
                const cookFirst = (o.profiles?.full_name || 'Home cook').trim().split(/\s+/)[0]
                return (
                  <Link key={o.id} href={`/buyer/orders/${o.id}`} className="orow" style={{display:'flex', alignItems:'center', gap:12, padding:'14px 22px', borderBottom:i < orders.length - 1 ? '1px solid var(--border)' : 'none', transition:'background 0.12s'}}>
                    <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0}}>{cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                      <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginTop:1}}>👨‍🍳 {cookFirst}</div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                      <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Recommended for you */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'18px 22px 22px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Recommended for you</h3>
                <Link href="/browse" className="nav-link" style={{fontSize:13, fontWeight:700, color:'#C8006A'}}>See more →</Link>
              </div>
              {recommended.length === 0 ? (
                <div style={{padding:'24px 12px', textAlign:'center'}}>
                  <div style={{fontSize:34, marginBottom:8}}>🍽️</div>
                  <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.6}}>No dishes available right now. Check back soon for fresh home-cooked meals.</p>
                </div>
              ) : (
                <div className="rec-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14}}>
                  {recommended.map(l => (
                    <Link key={l.id} href={`/dish/${l.id}`} className="rec-card" style={{background:'var(--bg-card)', borderRadius:16, overflow:'hidden', border:'1.5px solid var(--border)', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', display:'flex', flexDirection:'column'}}>
                      <div style={{height:88, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, position:'relative', overflow:'hidden'}}>
                        {cuisineEmoji[l.cuisine] || '🍽️'}
                        {l.image_url && <img src={l.image_url} alt={l.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />}
                      </div>
                      <div style={{padding:'12px 14px', display:'flex', flexDirection:'column', flex:1}}>
                        <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                        <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.profiles?.full_name || 'Home cook'}</div>
                        <div style={{marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                          <span style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#C8006A'}}>£{parseFloat(l.price || '0').toFixed(2)}</span>
                          {l.rating ? <span style={{fontSize:12, fontWeight:700, color:'var(--text-primary)'}}>⭐ {l.rating.toFixed(1)}</span> : <span style={{fontSize:11, fontWeight:700, color:'#C8006A'}}>{l.cuisine}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT (sticky) */}
          <div className="col-right" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Loyalty points */}
            <Link href="/buyer/points" className="fade-up points-card" style={{display:'block', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:20, padding:'22px', boxShadow:'0 8px 24px rgba(200,0,106,0.25)', position:'relative', overflow:'hidden'}}>
              <div aria-hidden="true" style={{position:'absolute', top:-30, right:-20, fontSize:120, opacity:0.12, lineHeight:1}}>🎁</div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14}}>
                <span style={{fontSize:18}}>⭐</span>
                <span style={{fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.85)', textTransform:'uppercase', letterSpacing:'0.06em'}}>Loyalty points</span>
              </div>
              <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{points.toLocaleString('en-GB')}</div>
              <div style={{fontSize:13, color:'rgba(255,255,255,0.85)', marginTop:6}}>worth £{pointsToPounds(points).toFixed(2)} off your next order</div>
              <div style={{display:'inline-flex', alignItems:'center', gap:6, marginTop:16, fontSize:13, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.16)', padding:'7px 14px', borderRadius:100}}>View history →</div>
            </Link>

            {/* Refer a friend */}
            {referralCode && (
              <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'22px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                  <span style={{fontSize:18}}>🎉</span>
                  <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Refer a friend</h3>
                </div>
                <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.85, lineHeight:1.6, marginBottom:14}}>Share your code and earn <strong style={{color:'#C8006A'}}>150 points (£1)</strong> when a friend places their first order.</p>
                <div style={{display:'flex', alignItems:'center', gap:8, background:'var(--bg-secondary)', border:'1.5px dashed var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:10}}>
                  <span style={{flex:1, minWidth:0, fontSize:12.5, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>mealoyo.com/register?ref={referralCode}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://mealoyo.com/register?ref=${referralCode}`)
                    setRefCopied(true); setTimeout(() => setRefCopied(false), 2000)
                  }}
                  className="browse-btn"
                  style={{width:'100%', height:42, background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(200,0,106,0.28)', transition:'all 0.16s'}}>
                  {refCopied ? '✓ Link copied!' : 'Copy referral link'}
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px 12px'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Quick actions</h3>
              </div>
              {quickActions.map((a, i) => (
                <Link key={i} href={a.h} className="qa-row" style={{display:'flex', alignItems:'center', gap:13, padding:'13px 22px', borderTop:'1px solid var(--border)', transition:'all 0.14s'}}>
                  <div style={{width:38, height:38, borderRadius:10, background:'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0}}>{a.i}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{a.l}</div>
                    <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.75, marginTop:1}}>{a.s}</div>
                  </div>
                  <span style={{fontSize:16, color:'#C8006A', flexShrink:0}}>→</span>
                </Link>
              ))}
            </div>

            {/* Recently saved */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Recently saved</h3>
                <Link href="/buyer/saved" className="nav-link" style={{fontSize:13, fontWeight:700, color:'#C8006A'}}>All →</Link>
              </div>
              {saved.length === 0 ? (
                <div style={{padding:'32px 22px', textAlign:'center'}}>
                  <div style={{fontSize:32, marginBottom:8}}>🤍</div>
                  <p style={{fontSize:13, color:'var(--text-primary)', lineHeight:1.6}}>No saved dishes yet. Tap the heart on any dish to keep it here.</p>
                </div>
              ) : saved.map((s, i) => {
                const l = s.listings
                if (!l) return null
                return (
                  <Link key={s.id} href={`/dish/${l.id}`} className="qa-row" style={{display:'flex', alignItems:'center', gap:12, padding:'13px 22px', borderTop:i === 0 ? 'none' : '1px solid var(--border)', transition:'all 0.14s'}}>
                    <div style={{width:40, height:40, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0, position:'relative', overflow:'hidden'}}>
                      {cuisineEmoji[l.cuisine] || '🍽️'}
                      {l.image_url && <img src={l.image_url} alt={l.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                      <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginTop:1}}>{l.cuisine}</div>
                    </div>
                    <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>£{parseFloat(l.price || '0').toFixed(2)}</div>
                    <span style={{fontSize:15, flexShrink:0}}>❤️</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
