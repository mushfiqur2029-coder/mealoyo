
'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const cuisineEmoji: Record<string,string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const cats = [
  { id:'all', label:'All food', emoji:'🍽️' },
  { id:'Bangladeshi', label:'Bangladeshi', emoji:'🍛' },
  { id:'Pakistani', label:'Pakistani', emoji:'🫕' },
  { id:'Indian', label:'Indian', emoji:'🥘' },
  { id:'Caribbean', label:'Caribbean', emoji:'🍗' },
  { id:'Middle Eastern', label:'Middle Eastern', emoji:'🧆' },
  { id:'West African', label:'West African', emoji:'🫘' },
  { id:'Turkish', label:'Turkish', emoji:'🥙' },
  { id:'Other', label:'Other', emoji:'🍽️' },
]

const COMMISSION_RATE = 0.12
const cookColors = ['#C8006A','#A00055']


// ── REAL PNG LOGOS ──
const Logo = ({height=38, white=false}:{height?:number, white?:boolean}) => (
  <img
    src={white ? '/White_Logo.png' : '/Color_Logo.png'}
    alt="meaLoyo"
    style={{height, width:'auto', objectFit:'contain', display:'block'}}
  />
)

export default function Home() {
  const [cat, setCat] = useState('all')
  const [postcode, setPostcode] = useState('')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [saved, setSaved] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [listings, setListings] = useState<any[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const catRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const getUserSaved = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('saved_listings').select('listing_id').eq('buyer_id', user.id)
      setSaved((data || []).map(r => r.listing_id))
    }
    getUserSaved()
    const getListings = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name)')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoadingListings(false)
    }
    const getStats = async () => {
      const { count: reviewsTotal } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
      setReviewCount(reviewsTotal ?? 0)
    }
    const getReviews = async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*, profiles:buyer_id(full_name), orders(listings(name))')
        .eq('verified', true)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3)
      setReviews(data || [])
      setLoadingReviews(false)
    }
    getListings()
    getStats()
    getReviews()
  }, [])

  const cooks = (() => {
    const bySeller = new Map<string, { name: string, cuisine: string, ratings: number[], reviewsTotal: number }>()
    for (const l of listings) {
      const key = l.seller_id
      const name = l.profiles?.full_name || 'Home cook'
      const entry = bySeller.get(key) || { name, cuisine: l.cuisine, ratings: [] as number[], reviewsTotal: 0 }
      if (l.rating) entry.ratings.push(l.rating)
      entry.reviewsTotal += l.reviews_count || 0
      bySeller.set(key, entry)
    }
    return Array.from(bySeller.entries()).map(([id, c], i) => ({
      id,
      name: c.name,
      cuisine: c.cuisine,
      rat: c.ratings.length ? (c.ratings.reduce((a, b) => a + b, 0) / c.ratings.length).toFixed(1) : '—',
      reviews: c.reviewsTotal,
      init: c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
      color: cookColors[i % cookColors.length],
    })).slice(0, 6)
  })()

  const ratedListings = listings.filter(l => l.reviews_count > 0)
  const avgRating = ratedListings.length
    ? (ratedListings.reduce((sum, l) => sum + l.rating, 0) / ratedListings.length).toFixed(1)
    : null
  const payoutPct = Math.round((1 - COMMISSION_RATE) * 100)
  const showcaseListings = [...listings].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 3)

  // TODO: once we have a UK postcode geocoding table, filter `listings` by
  // distance from `postcode` here instead of just passing it through unused.
  const filtered = listings.filter(l =>
    (cat === 'all' || l.cuisine === cat) &&
    (query === '' || l.name.toLowerCase().includes(query.toLowerCase()))
  )

  const toggleSave = async (id: string) => {
    if (!userId) { router.push('/login'); return }
    const isSaved = saved.includes(id)
    setSaved(prev => isSaved ? prev.filter(x => x !== id) : [...prev, id])
    if (isSaved) {
      await supabase.from('saved_listings').delete().eq('buyer_id', userId).eq('listing_id', id)
    } else {
      await supabase.from('saved_listings').insert({ buyer_id: userId, listing_id: id })
    }
  }

  const scrollCats = (dir: number) => {
    if (catRef.current) catRef.current.scrollLeft += dir * 200
  }

  const detectLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }
    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}`)
          const json = await res.json()
          const found = json.result?.[0]?.postcode
          if (found) setPostcode(found)
          else setLocationError('Could not find a postcode near you')
        } catch {
          setLocationError('Could not detect your location')
        } finally {
          setDetectingLocation(false)
        }
      },
      () => {
        setLocationError('Location permission denied')
        setDetectingLocation(false)
      }
    )
  }

  return (
    <div style={{minHeight:'100vh', background:'#fff', fontFamily:'Inter,system-ui,sans-serif', overflowX:'hidden'}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        * { scrollbar-width: none; -ms-overflow-style: none; }
        a { text-decoration: none; color: inherit; }
        button { font-family: Inter, system-ui, sans-serif; }

        .lcard { transition: transform 0.2s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.2s; }
        .lcard:hover { transform: translateY(-6px) !important; box-shadow: 0 20px 60px rgba(200,0,106,0.15) !important; }
        .cook-card:hover { transform: translateY(-4px) !important; box-shadow: 0 12px 36px rgba(200,0,106,0.12) !important; }
        .cat-pill:hover { border-color: #C8006A !important; color: #C8006A !important; background: #FFE8F4 !important; }
        .save-btn:hover { transform: scale(1.18) !important; }
        .order-btn:hover { background: #A00055 !important; }
        .primary-btn:hover { background: #A00055 !important; }
        .nav-cta:hover { background: #A00055 !important; }
        .footer-link:hover { color: #fff !important; }
        .hiw-card:hover { transform: translateY(-4px) !important; }
        .review-card:hover { transform: translateY(-4px) !important; }
        .dmode:hover { border-color: #C8006A !important; background: #FFF5FA !important; }
        .ot-card:hover { border-color: #C8006A !important; background: #FFF5FA !important; }
        .scroll-arrow:hover { background: #C8006A !important; color: #fff !important; border-color: #C8006A !important; }

        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-right { display: none !important; }
          .hero-left { padding: 56px 24px 48px !important; }
          .delivery-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 768px) {
          .listings-grid { grid-template-columns: 1fr 1fr !important; }
          .cooks-grid { grid-template-columns: 1fr 1fr !important; }
          .search-row { flex-direction: column !important; }
          .search-field { width: 100% !important; }
          .hero-stats { gap: 20px !important; }
          .section-header { flex-direction: column !important; align-items: flex-start !important; }
          .cta-btns { flex-direction: column !important; align-items: center !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
          .ot-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .listings-grid { grid-template-columns: 1fr !important; }
          .hiw-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .nav-links-wrap { display: none !important; }
          .hero-stats { flex-wrap: wrap !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:500, height:66}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{marginRight:28, flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:38, width:'auto'}}/>
          </Link>
          <div className="nav-links-wrap" style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Explore food',h:'/',a:true},{l:'Sell & cater',h:'/register',a:false},{l:'Deliver & earn',h:'/register',a:false}].map((t,i) => (
              <Link key={i} href={t.h} style={{height:66, padding:'0 14px', display:'flex', alignItems:'center', fontSize:14, fontWeight:t.a?700:500, color:t.a?'#C8006A':'#1A1A1A', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', whiteSpace:'nowrap'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
            <Link href="/login" style={{height:36, padding:'0 14px', display:'flex', alignItems:'center', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', whiteSpace:'nowrap'}}>Sign in</Link>
            <Link href="/register" className="nav-cta" style={{height:36, padding:'0 16px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(200,0,106,0.35)', transition:'background 0.12s'}}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', minHeight:'90vh', position:'relative', overflow:'hidden', display:'flex', alignItems:'center'}}>
        <div style={{position:'absolute', top:'-15%', right:'-5%', width:'55%', height:'130%', background:'radial-gradient(ellipse,rgba(255,255,255,0.06) 0%,transparent 65%)', pointerEvents:'none'}}/>
        <div style={{position:'absolute', bottom:'-10%', left:'5%', width:'30%', height:'50%', background:'radial-gradient(ellipse,rgba(255,232,244,0.06) 0%,transparent 65%)', pointerEvents:'none'}}/>

        <div className="hero-grid" style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', display:'grid', gridTemplateColumns:'55% 45%', width:'100%', gap:32, alignItems:'center'}}>
          <div className="hero-left" style={{padding:'72px 0', position:'relative', zIndex:1}}>

            {/* Brand badge */}
            <div style={{display:'inline-flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:100, padding:'6px 16px', marginBottom:24}}>
              <img src="/Color_Logo.png" alt="meaLoyo" style={{height:22, width:'auto'}}/>
              <span style={{fontSize:12, fontWeight:700, color:'#fff', letterSpacing:'0.04em'}}>meaLoyo — Available across the UK</span>
            </div>

            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(32px,3.8vw,58px)', fontWeight:700, color:'#fff', lineHeight:1.08, letterSpacing:'-0.025em', marginBottom:18}}>
              Home cooked food,<br/>
              <span style={{color:'rgba(255,255,255,0.78)', fontStyle:'italic'}}>delivered with love.</span>
            </h1>

            <p style={{fontSize:'clamp(14px,1.4vw,17px)', color:'rgba(255,255,255,0.82)', lineHeight:1.75, marginBottom:32, maxWidth:500, fontWeight:400}}>
              Authentic meals from verified home cooks in your area. Real food, real kitchens — Bangladeshi, Pakistani, Indian, Caribbean, Middle Eastern and more.
            </p>

            {/* Search */}
            <div style={{background:'#fff', borderRadius:16, padding:8, boxShadow:'0 8px 48px rgba(0,0,0,0.28)', marginBottom:locationError?8:28}}>
              <div className="search-row" style={{display:'flex', gap:8}}>
                <div className="search-field" style={{display:'flex', alignItems:'center', gap:8, flex:1, padding:'0 8px 0 14px', background:'#F8F0F4', borderRadius:10, minWidth:0}}>
                  <span style={{fontSize:18, flexShrink:0}}>📍</span>
                  <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="Enter your postcode to find home cooks near you" style={{border:'none', outline:'none', fontSize:14, fontWeight:500, color:'#1A1A1A', width:'100%', height:44, background:'transparent', minWidth:0}}/>
                  <button type="button" onClick={detectLocation} disabled={detectingLocation} title="Use my location" style={{width:34, height:34, borderRadius:8, border:'none', background:detectingLocation?'transparent':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', cursor:detectingLocation?'default':'pointer', flexShrink:0, fontSize:16}}>
                    {detectingLocation
                      ? <span style={{width:16, height:16, border:'2.5px solid #FFE8F4', borderTop:'2.5px solid #C8006A', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite'}}/>
                      : '🧭'}
                  </button>
                </div>
                <button className="primary-btn" style={{height:52, padding:'0 28px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(200,0,106,0.4)', transition:'background 0.12s', flexShrink:0}}>
                  Find food →
                </button>
              </div>
            </div>
            {locationError && <p style={{fontSize:12, color:'#fff', background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'6px 12px', display:'inline-block', marginBottom:20}}>{locationError}</p>}

            <div className="hero-stats" style={{display:'flex', gap:24, flexWrap:'wrap'}}>
              {[
                [loadingListings ? '—' : String(cooks.length), 'Home cooks UK-wide'],
                [loadingListings ? '—' : String(listings.length), 'Dishes listed'],
                [avgRating ? `${avgRating}★` : '—', 'Avg rating'],
                [`${payoutPct}%`, 'Seller payout'],
              ].map(([n,l]) => (
                <div key={l}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(18px,2vw,26px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{n}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:3, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:700, whiteSpace:'nowrap'}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero right */}
          {showcaseListings.length > 0 && (
            <div className="hero-right" style={{display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'40px 0 0', position:'relative', zIndex:1}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, width:'100%', maxWidth:420, alignSelf:'flex-end'}}>
                {showcaseListings.map((l,i) => {
                  const wide = i === 0
                  return (
                    <div key={l.id} style={{gridColumn:wide?'span 2':'auto', background:'rgba(255,255,255,0.11)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:18, overflow:'hidden', transition:'transform 0.2s'}}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='translateY(-5px)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform='translateY(0)'}>
                      <div style={{height:wide?148:96, display:'flex', alignItems:'center', justifyContent:'center', fontSize:wide?58:40, background:'rgba(255,255,255,0.06)', position:'relative'}}>
                        {cuisineEmoji[l.cuisine] || '🍽️'}
                        {l.featured && <div style={{position:'absolute', top:8, left:8, background:'#fff', color:'#C8006A', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:100}}>🔥 Featured</div>}
                      </div>
                      <div style={{padding:'10px 12px 12px'}}>
                        <div style={{fontSize:wide?13:12, fontWeight:700, color:'#fff', marginBottom:1}}>{l.name}</div>
                        <div style={{fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:6}}>{l.profiles?.full_name || 'Home cook'} · {l.cuisine}</div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <span style={{fontFamily:'Georgia,serif', fontSize:wide?15:13, fontWeight:700, color:'#fff'}}>£{parseFloat(l.price).toFixed(2)}</span>
                          <span style={{fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600}}>★ {l.rating || '—'} ({l.reviews_count || 0})</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div style={{background:'#FFE8F4', borderTop:'1px solid rgba(200,0,106,0.12)', borderBottom:'1px solid rgba(200,0,106,0.12)'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', overflowX:'auto'}}>
          {[['🍽️','Home cook marketplace'],['🔒','Stripe-secured payments'],['🛡️','Buyer protection on every order'],['⚡','Community delivery · 45 mins'],['🌿','Allergen declarations mandatory'],['🇬🇧','Available UK-wide']].map(([icon,text],i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:6, padding:'12px 16px', fontSize:12, fontWeight:700, color:'#C8006A', whiteSpace:'nowrap', flexShrink:0}}>
              {i > 0 && <div style={{width:1, height:14, background:'rgba(200,0,106,0.2)', marginRight:16}}/>}
              <span style={{fontSize:15}}>{icon}</span>{text}
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <section style={{background:'#fff', borderBottom:'1px solid #F0F0F0', padding:'32px 0'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, gap:12, flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Browse by cuisine</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>What are you craving?</h2>
            </div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <button className="scroll-arrow" onClick={() => scrollCats(-1)} style={{width:36, height:36, borderRadius:'50%', background:'#fff', border:'1.5px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:'#1A1A1A', transition:'all 0.14s'}}>‹</button>
              <button className="scroll-arrow" onClick={() => scrollCats(1)} style={{width:36, height:36, borderRadius:'50%', background:'#fff', border:'1.5px solid #E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:'#1A1A1A', transition:'all 0.14s'}}>›</button>
            </div>
          </div>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:0, top:0, bottom:0, width:40, background:'linear-gradient(to right, #fff, transparent)', zIndex:1, pointerEvents:'none'}}/>
            <div style={{position:'absolute', right:0, top:0, bottom:0, width:40, background:'linear-gradient(to left, #fff, transparent)', zIndex:1, pointerEvents:'none'}}/>
            <div ref={catRef} style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:4, paddingTop:4, scrollBehavior:'smooth', msOverflowStyle:'none' as any, scrollbarWidth:'none' as any}}>
              {cats.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} className="cat-pill" style={{display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:cat===c.id?'#FFE8F4':'#fff', border:cat===c.id?'2px solid #C8006A':'2px solid #E8E8E8', borderRadius:100, fontSize:14, fontWeight:700, color:cat===c.id?'#C8006A':'#1A1A1A', whiteSpace:'nowrap', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'all 0.14s', cursor:'pointer'}}>
                  <span style={{fontSize:18, lineHeight:1}}>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LISTINGS ── */}
      <section style={{padding:'52px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          {postcode.trim() && (
            <div style={{fontSize:13, fontWeight:600, color:'#C8006A', marginBottom:14}}>📍 Showing food near {postcode.trim()}</div>
          )}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12}}>
            <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A'}}><span style={{color:'#C8006A'}}>{filtered.length}</span> dishes available</div>
            <div style={{display:'flex', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:6, height:38, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, background:'#fff'}}>
                <span style={{fontSize:14}}>🔍</span>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes..." style={{border:'none', outline:'none', fontSize:13, fontWeight:600, color:'#1A1A1A', background:'transparent', width:160}}/>
              </div>
              <select style={{height:38, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', outline:'none'}}>
                <option>Recommended</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Highest rated</option>
              </select>
            </div>
          </div>
          {loadingListings ? (
            <div style={{display:'flex', justifyContent:'center', padding:'60px 0'}}>
              <div style={{width:40, height:40, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{background:'#fff', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
              <div style={{fontSize:48, marginBottom:16}}>🍽️</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1A1A1A', marginBottom:6}}>No dishes found</h2>
              <p style={{fontSize:14, color:'#1A1A1A'}}>Try a different category or search term.</p>
            </div>
          ) : (
            <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18}}>
              {filtered.map(l => {
                const tags = [l.halal && 'Halal', l.vegan && 'Vegan', l.vegetarian && 'Vegetarian', l.spicy && 'Spicy'].filter(Boolean) as string[]
                return (
                  <Link key={l.id} href={`/dish/${l.id}`} className="lcard" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'block'}}>
                    <div style={{height:180, display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', position:'relative'}}>
                      {cuisineEmoji[l.cuisine] || '🍽️'}
                      <button className="save-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleSave(l.id) }} style={{position:'absolute', top:12, right:12, width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', transition:'transform 0.14s'}}>
                        {saved.includes(l.id)?'❤️':'🤍'}
                      </button>
                    </div>
                    <div style={{padding:'15px 16px'}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:4, letterSpacing:'-0.01em', lineHeight:1.3}}>{l.name}</div>
                      <div style={{fontSize:12, color:'#1A1A1A', marginBottom:10, display:'flex', alignItems:'center', gap:5, fontWeight:500}}>
                        <div style={{width:18, height:18, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0}}>{l.profiles?.full_name?.[0] || 'C'}</div>
                        {l.profiles?.full_name || 'Home cook'} <span style={{color:'#C8006A', fontWeight:600}}>· {l.cuisine}</span>
                      </div>
                      <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                        {tags.map(t => (
                          <span key={t} style={{background:t==='Halal'?'#E4F6EA':t==='Vegan'?'#EBF2FD':'#FFE8F4', color:t==='Halal'?'#2DA84E':t==='Vegan'?'#1A6ECC':'#C8006A', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700}}>{t}</span>
                        ))}
                      </div>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:11, borderTop:'1px solid #F5F0F3'}}>
                        <div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
                          <div style={{fontSize:11, color:'#1A1A1A', marginTop:1, fontWeight:600}}><span style={{color:'#C8006A'}}>★</span> {l.rating || '—'} <span style={{fontWeight:400}}>({l.reviews_count || 0} reviews)</span></div>
                        </div>
                        <span className="order-btn" style={{height:34, padding:'0 16px', background:'#C8006A', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', boxShadow:'0 4px 12px rgba(200,0,106,0.3)', transition:'all 0.12s'}}>Order now</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{padding:'72px 0', background:'#fff'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div style={{textAlign:'center', marginBottom:44}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Simple process</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,38px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:12}}>From browse to bite in 4 steps</h2>
            <p style={{fontSize:'clamp(14px,1.4vw,16px)', color:'#1A1A1A', maxWidth:420, margin:'0 auto', fontWeight:400, lineHeight:1.65}}>Authentic food, trusted cooks, flexible delivery.</p>
          </div>
          <div className="hiw-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18}}>
            {[
              {n:'01', icon:'📍', title:'Enter your postcode', desc:'See home cooks within your area, sorted by cuisine, rating and availability.'},
              {n:'02', icon:'🛒', title:'Browse & pay securely', desc:'Pick your food, choose delivery or free collection. Pay by card or Apple Pay.'},
              {n:'03', icon:'👩‍🍳', title:'Cook prepares it fresh', desc:'Your cook gets the order and cooks fresh. Real-time updates keep you informed.'},
              {n:'04', icon:'🏠', title:'Delivered or collected', desc:'Hot food at your door in 45 mins via community drivers, or collect free with QR code.'},
            ].map(s => (
              <div key={s.n} className="hiw-card" style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'26px 20px', border:'1.5px solid rgba(200,0,106,0.1)', transition:'all 0.2s'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'rgba(200,0,106,0.12)', lineHeight:1, marginBottom:14}}>{s.n}</div>
                <div style={{fontSize:28, marginBottom:10}}>{s.icon}</div>
                <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:7}}>{s.title}</div>
                <div style={{fontSize:12, color:'#1A1A1A', lineHeight:1.65, fontWeight:400}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP COOKS ── */}
      <section style={{padding:'72px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Trusted food makers</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>Top home cooks near you</h2>
              <p style={{fontSize:13, color:'#1A1A1A', marginTop:4, fontWeight:400}}>Every cook is verified, ID checked and hygiene certified.</p>
            </div>
            <button style={{height:36, padding:'0 16px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:700, color:'#1A1A1A', background:'#fff', cursor:'pointer', flexShrink:0}}>Browse all →</button>
          </div>
          {loadingListings ? (
            <div style={{display:'flex', justifyContent:'center', padding:'40px 0'}}>
              <div style={{width:36, height:36, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
            </div>
          ) : cooks.length === 0 ? (
            <div style={{background:'#fff', borderRadius:20, padding:'48px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
              <p style={{fontSize:14, color:'#1A1A1A'}}>No verified cooks live yet — check back soon.</p>
            </div>
          ) : (
            <div className="cooks-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:14}}>
              {cooks.map(c => (
                <div key={c.id} className="cook-card" style={{background:'#fff', borderRadius:18, padding:'20px 14px', textAlign:'center', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', transition:'all 0.18s', cursor:'pointer'}}>
                  <div style={{width:52, height:52, borderRadius:'50%', background:c.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#fff', margin:'0 auto 10px', boxShadow:`0 4px 16px ${c.color}55`}}>
                    {c.init}
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:2}}>{c.name}</div>
                  <div style={{fontSize:11, color:'#C8006A', marginBottom:8, fontWeight:600}}>{c.cuisine}</div>
                  <div style={{display:'flex', justifyContent:'center', gap:14, marginBottom:10}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:13, fontWeight:700, color:'#1A1A1A'}}>★{c.rat}</div><div style={{fontSize:9, color:'#1A1A1A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Rating</div></div>
                    <div style={{width:1, background:'rgba(200,0,106,0.1)'}}/>
                    <div style={{textAlign:'center'}}><div style={{fontSize:13, fontWeight:700, color:'#1A1A1A'}}>{c.reviews}</div><div style={{fontSize:9, color:'#1A1A1A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Reviews</div></div>
                  </div>
                  <span style={{background:'#FFE8F4', color:'#C8006A', padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700}}>Verified cook</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── DELIVERY & ORDER TYPE ── */}
      <section style={{padding:'72px 0', background:'#fff'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="delivery-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'start'}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Delivery options</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'#1A1A1A', marginBottom:8}}>Get it your way</h2>
              <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.65, marginBottom:24, maxWidth:380, fontWeight:400}}>Four flexible ways to receive your food. No hidden charges.</p>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {[
                  {icon:'📍', title:'Collect for free', desc:'Walk or drive to your cook. QR code confirms collection instantly.', tag:'Always free', active:true},
                  {icon:'🚴', title:'Community delivery', desc:'Hot food at your door in under 45 mins via local drivers.', tag:'From £4.50', active:false},
                  {icon:'🎉', title:'Catering & events', desc:'Full catering for parties, weddings, Eid and office events.', tag:'Cook delivers', active:false},
                  {icon:'📦', title:'Postal nationwide', desc:'Meal prep, sauces and baked goods posted anywhere in UK.', tag:'From £2.99', active:false},
                ].map((d,i) => (
                  <div key={i} className="dmode" style={{display:'flex', alignItems:'flex-start', gap:12, padding:'14px', background:d.active?'#FFE8F4':'#fff', border:d.active?'2px solid #C8006A':'1.5px solid #E8E8E8', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'all 0.14s'}}>
                    <div style={{width:40, height:40, borderRadius:10, background:d.active?'#C8006A':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{d.icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:2}}>{d.title}</div>
                      <div style={{fontSize:12, color:'#1A1A1A', lineHeight:1.5, marginBottom:4, fontWeight:400}}>{d.desc}</div>
                      <span style={{fontSize:11, fontWeight:700, color:'#C8006A'}}>{d.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:17, fontWeight:700, color:'#1A1A1A', marginBottom:6}}>What do you need today?</div>
              <p style={{fontSize:14, color:'#1A1A1A', marginBottom:18, fontWeight:400}}>Select your order type and we will match you with the right cooks.</p>
              <div className="ot-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18}}>
                {[
                  {emoji:'🍽️', name:'Today meal', desc:'Delivery or collection now', active:true},
                  {emoji:'🏢', name:'Office lunches', desc:'Weekly catering contract', active:false},
                  {emoji:'🎉', name:'Party catering', desc:'Book for your event', active:false},
                  {emoji:'📦', name:'Meal prep', desc:'Weekly boxes delivered', active:false},
                ].map((o,i) => (
                  <div key={i} className="ot-card" style={{padding:'16px', background:o.active?'#FFE8F4':'#fff', border:o.active?'2px solid #C8006A':'1.5px solid #E8E8E8', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'all 0.14s', cursor:'pointer'}}>
                    <div style={{fontSize:22, marginBottom:8}}>{o.emoji}</div>
                    <div style={{fontSize:13, fontWeight:700, color:o.active?'#C8006A':'#1A1A1A', marginBottom:3}}>{o.name}</div>
                    <div style={{fontSize:11, color:'#1A1A1A', lineHeight:1.4, fontWeight:400}}>{o.desc}</div>
                  </div>
                ))}
              </div>
              <button className="primary-btn" style={{width:'100%', height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'background 0.12s'}}>
                Find cooks near me →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section style={{padding:'72px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div style={{textAlign:'center', marginBottom:36}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Community voices</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'#1A1A1A'}}>Our community loves it</h2>
            {reviewCount !== null && reviewCount > 0 && <p style={{fontSize:13, color:'#1A1A1A', marginTop:6, fontWeight:500}}>{reviewCount} verified reviews from real orders</p>}
          </div>
          {loadingReviews ? (
            <div style={{display:'flex', justifyContent:'center', padding:'40px 0'}}>
              <div style={{width:36, height:36, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
            </div>
          ) : reviews.length === 0 ? (
            <div style={{background:'#fff', borderRadius:20, padding:'48px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
              <p style={{fontSize:14, color:'#1A1A1A'}}>No reviews yet — be the first to order and leave one.</p>
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18}}>
              {reviews.map((r,i) => {
                const name = r.profiles?.full_name || 'Buyer'
                const initials = name.split(' ').map((w:string) => w[0]).slice(0,2).join('').toUpperCase()
                const dishName = r.orders?.listings?.name
                return (
                  <div key={r.id} className="review-card" style={{background:'#fff', borderRadius:18, padding:'22px', boxShadow:'0 2px 12px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.08)', display:'flex', flexDirection:'column', transition:'transform 0.18s'}}>
                    <div style={{color:'#C8006A', fontSize:14, letterSpacing:'2px', marginBottom:12}}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
                    <p style={{fontFamily:'Georgia,serif', fontSize:14, fontStyle:'italic', color:'#1A1A1A', lineHeight:1.75, marginBottom:16, flex:1}}>"{r.comment}"</p>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:38, height:38, borderRadius:'50%', background:cookColors[i % cookColors.length], display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>{initials}</div>
                      <div>
                        <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A'}}>{name}</div>
                        {dishName && <div style={{fontSize:11, color:'#1A1A1A', fontWeight:500}}>{dishName}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', padding:'76px 20px', position:'relative', overflow:'hidden', textAlign:'center'}}>
        <div style={{position:'absolute', right:'-5%', top:'-40%', width:'50%', height:'200%', borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none'}}/>
        <div style={{maxWidth:660, margin:'0 auto', position:'relative', zIndex:1}}>
          <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
            <img src="/White_Logo.png" alt="meaLoyo" style={{height:48, width:'auto'}}/>
          </div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3.5vw,44px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:10, lineHeight:1.15}}>Hungry? Order home cooked food now.</h2>
          <p style={{fontSize:'clamp(14px,1.4vw,17px)', color:'rgba(255,255,255,0.85)', marginBottom:28, lineHeight:1.65, fontWeight:400}}>{cooks.length > 0 ? `${cooks.length} ` : ''}home cooks across the UK. Authentic food. No restaurant markup.</p>
          <div className="cta-btns" style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <button style={{height:52, padding:'0 32px', background:'#fff', color:'#C8006A', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(0,0,0,0.15)', flexShrink:0}}>Order food now</button>
            <Link href="/register" style={{height:52, padding:'0 32px', background:'rgba(255,255,255,0.12)', color:'#fff', border:'2px solid rgba(255,255,255,0.28)', borderRadius:12, fontSize:15, fontWeight:600, display:'flex', alignItems:'center', flexShrink:0}}>Start selling your food</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:'#1A1A1A', padding:'48px 0 24px'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="footer-grid" style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:40, marginBottom:32}}>
            <div>
              <div style={{marginBottom:12}}>
                <img src="/White_Logo.png" alt="meaLoyo" style={{height:34, width:'auto'}}/>
              </div>
              <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, maxWidth:240, marginBottom:14, fontWeight:400}}>The UK home cook food marketplace. Authentic meals from verified home cooks across the UK.</p>
              <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'rgba(200,0,106,0.18)', color:'#FFE8F4', border:'1px solid rgba(200,0,106,0.28)', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>meaLoyo · Est. 2026</span>
            </div>
            {[
              {head:'Buy food', links:['Browse listings','Find local cooks','Event catering','Office lunches','Meal prep boxes']},
              {head:'Sell food', links:['Start selling','Seller dashboard','Pricing & packages','Compliance guide','Seller support']},
              {head:'Company', links:['About us','Deliver with us','Blog','Contact','Privacy policy']},
            ].map(s => (
              <div key={s.head}>
                <div style={{fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>{s.head}</div>
                <div style={{display:'flex', flexDirection:'column', gap:9}}>
                  {s.links.map(l => <a key={l} href="#" className="footer-link" style={{fontSize:13, color:'rgba(255,255,255,0.45)', fontWeight:500, transition:'color 0.12s'}}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:18, display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.3)', flexWrap:'wrap', gap:8}}>
            <span>© 2026 meaLoyo Ltd. Registered in England & Wales.</span>
            <span>UK-wide · hello@mealoyo.com</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
