
'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; next/image is unoptimized here anyway, and a plain <img> avoids remotePatterns config entirely */
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import Logo from '@/components/Logo'
import HeroVideoBg from '@/components/HeroVideoBg'
import CartButton from '@/components/CartButton'
import AddToCartButton from '@/components/AddToCartButton'
import LocationBar from '@/components/LocationBar'
import { useLocationFilter } from '@/lib/useLocationFilter'
import type { Listing, Profile, Review } from '@/lib/types'

// The homepage listing feed carries the seller's postcode alongside their
// name so the distance filter can measure how far each dish is from the
// buyer. Override the default profiles pick from `Listing` (which only has
// full_name) to add postcode.
type HomeListing = Listing & { profiles?: Pick<Profile, 'full_name' | 'postcode'> | null }

function dashboardPath(role: string | null) {
  if (role === 'seller') return '/seller/dashboard'
  if (role === 'driver') return '/driver/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/buyer/dashboard'
}

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

// Occasion / order-type cards. Each one filters the live listings grid:
// office + party narrow to large portions (serves 10+), the rest show everything.
const orderTypes = [
  { id:'all',      emoji:'🍽️', name:'Order now',       desc:'Browse every live dish available today' },
  { id:'office',   emoji:'🏢', name:'Office catering',  desc:'Large portions that serve 10 or more' },
  { id:'party',    emoji:'🎉', name:'Party & events',   desc:'Big batches for celebrations & gatherings' },
  { id:'mealprep', emoji:'📦', name:'Meal prep',        desc:'Weekly meal boxes — more filters soon' },
]
const orderTypeLabel = (id: string) => orderTypes.find(o => o.id === id)?.name ?? ''

export default function Home() {
  const [cat, setCat] = useState('all')
  const [orderType, setOrderType] = useState('all')
  const [postcode, setPostcode] = useState('')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [saved, setSaved] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('rec')
  const [listings, setListings] = useState<HomeListing[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const catRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  // Session comes from the app-wide AuthProvider. The homepage must NOT make its
  // own getUser() call: a second concurrent token refresh (the proxy already
  // calls getUser on navigation) can rotate the refresh token out from under the
  // first and drop the session — which is what made clicking the logo "sign out".
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Lock body scroll while the mobile menu overlay is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Saved listings + role follow the signed-in user from context (no getUser here).
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) { if (active) { setSaved([]); setRole(null) } return }
      const { data } = await supabase.from('saved_listings').select('listing_id').eq('buyer_id', user.id)
      if (active) setSaved((data || []).map(r => r.listing_id))
      const { data: profile } = await supabase.rpc('get_my_profile')
      if (active) setRole((profile as { role?: string } | null)?.role ?? null)
    })()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    const getListings = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name, postcode)')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
      setListings((data as unknown as HomeListing[]) || [])
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

  const ratedListings = listings.filter(l => (l.reviews_count ?? 0) > 0)
  const avgRating = ratedListings.length
    ? (ratedListings.reduce((sum, l) => sum + (l.rating ?? 0), 0) / ratedListings.length).toFixed(1)
    : null
  const payoutPct = Math.round((1 - COMMISSION_RATE) * 100)
  const showcaseListings = [...listings].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 3)

  // TODO: once we have a UK postcode geocoding table, filter `listings` by
  // distance from `postcode` here instead of just passing it through unused.
  // Occasion filter: office & party catering need dishes that serve a crowd (10+).
  const matchesOrderType = (l: HomeListing) =>
    (orderType === 'office' || orderType === 'party') ? (l.serves ?? 0) >= 10 : true

  // Distance filter (buyer postcode → 8 mi cap, expandable to 15). Hook
  // hydrates from localStorage / profile and geocodes every seller
  // postcode in one batched postcodes.io call. Its `filtered` is the
  // starting set for the homepage listing grid — cat + orderType + query
  // apply on top of that reduced feed.
  const location = useLocationFilter<HomeListing>(
    listings,
    l => l.profiles?.postcode ?? null,
  )

  const filtered = location.filtered.filter(l =>
    (cat === 'all' || l.cuisine === cat) &&
    matchesOrderType(l) &&
    (query === '' || l.name.toLowerCase().includes(query.toLowerCase()))
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price-asc') return parseFloat(a.price) - parseFloat(b.price)
    if (sort === 'price-desc') return parseFloat(b.price) - parseFloat(a.price)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return 0
  })

  const scrollToListings = () => {
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Hero search → the dedicated /browse shopping experience, carrying postcode + query.
  const goToBrowse = () => {
    const qs = new URLSearchParams()
    if (postcode.trim()) qs.set('postcode', postcode.trim())
    if (query.trim()) qs.set('q', query.trim())
    const s = qs.toString()
    router.push(s ? `/browse?${s}` : '/browse')
  }

  // Pick an occasion and jump to the (now filtered) listings grid.
  const selectOrderType = (id: string) => {
    setOrderType(id)
    setTimeout(scrollToListings, 60)
  }

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
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif', overflowX:'hidden'}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
        @keyframes menuIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
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
        .dmode:hover { border-color: #C8006A !important; background: var(--bg-secondary) !important; }
        .ot-card:hover { border-color: #C8006A !important; transform: translateY(-4px) !important; box-shadow: 0 14px 36px rgba(200,0,106,0.14) !important; }
        .scroll-arrow:hover { border-color: #C8006A !important; color: #C8006A !important; }
        .order-btn, .save-btn, .primary-btn, .nav-cta, .cat-pill, .scroll-arrow { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }

        /* Cuisine selector — clean, minimal, no decorative shadows anywhere */
        .cuisine-scroll { display: flex; flex-wrap: nowrap; gap: 8px; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; padding: 4px 2px; scroll-behavior: smooth; }
        .cuisine-card { flex-shrink: 0; width: 78px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 16px; cursor: pointer; border: 1.5px solid var(--border-subtle); background: var(--bg-card); transition: all 0.15s ease; -webkit-tap-highlight-color: transparent; }
        .cuisine-card .ce { font-size: 28px; line-height: 1; }
        .cuisine-card .cl { font-size: 11px; font-weight: 600; color: var(--text-primary); text-align: center; line-height: 1.15; letter-spacing: -0.01em; }
        .cuisine-card:hover { border-color: rgba(200,0,106,0.3); background: var(--bg-secondary); }
        .cuisine-card.on { background: #C8006A; border-color: transparent; }
        .cuisine-card.on .cl { color: #fff; }
        .cuisine-card.on:hover { background: #C8006A; filter: brightness(1.08); }
        .count-fade { animation: menuIn 0.3s ease; }
        /* Tablet 481–768px */
        @media (max-width: 768px) {
          .cuisine-card { width: 72px; }
          .cuisine-card .ce { font-size: 26px; }
        }
        /* Mobile ≤480px — smaller cards, no scroll arrows, single row */
        @media (max-width: 480px) {
          .cuisine-card { width: 64px; padding: 9px 6px; }
          .cuisine-card .ce { font-size: 23px; }
          .cuisine-card .cl { font-size: 10px; }
          .cuisine-arrows { display: none !important; }
        }

        /* Trust-bar marquee */
        .marquee-track { display: flex; width: max-content; animation: marquee 32s linear infinite; }
        .marquee-mask:hover .marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } }

        /* Loading skeletons */
        .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }

        /* Mobile nav */
        .hamburger { display: none; }
        .mobile-menu { display: none; }
        @media (max-width: 768px) {
          .nav-links-wrap { display: none !important; }
          .nav-desktop-cta { display: none !important; }
          .hamburger { display: flex !important; }
        }

        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-right { display: none !important; }
          .hero-left { padding: 56px 24px 48px !important; }
          .delivery-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
          .ot-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 768px) {
          .listings-grid { grid-template-columns: 1fr 1fr !important; }
          .cooks-grid { grid-template-columns: 1fr 1fr !important; }
          .search-row { flex-direction: column !important; }
          .search-field { width: 100% !important; }
          .search-row .primary-btn { width: 100% !important; }
          .hero-stats { gap: 20px !important; }
          .section-header { flex-direction: column !important; align-items: flex-start !important; }
          .cta-btns { flex-direction: column !important; align-items: center !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
          .ot-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .listings-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          .hiw-grid { grid-template-columns: 1fr !important; }
          .ot-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .nav-links-wrap { display: none !important; }
          .hero-stats { flex-wrap: wrap !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:500, height:66}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{marginRight:28, flexShrink:0}}>
            <Logo height={38}/>
          </Link>
          <div className="nav-links-wrap" style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Explore food',h:'/browse',a:true},{l:'Sell & cater',h:'/become-a-seller',a:false},{l:'Deliver & earn',h:'/become-a-driver',a:false}].map((t,i) => (
              <Link key={i} href={t.h} style={{height:66, padding:'0 14px', display:'flex', alignItems:'center', fontSize:14, fontWeight:t.a?700:500, color:t.a?'#C8006A':'var(--text-primary)', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', whiteSpace:'nowrap'}}>{t.l}</Link>
            ))}
          </div>
          {/* Right action row — cart stays visible on mobile; CTAs collapse into the hamburger */}
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
            {role !== 'seller' && role !== 'driver' && role !== 'admin' && <CartButton />}
            <div className="nav-desktop-cta" style={{display:'flex', gap:8, alignItems:'center'}}>
            {user ? (
              <>
                <Link href={dashboardPath(role)} className="nav-cta" style={{height:36, padding:'0 16px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(200,0,106,0.35)', transition:'background 0.12s'}}>My dashboard</Link>
                <Link href={dashboardPath(role)} title={user.email ?? 'Account'} style={{width:36, height:36, borderRadius:'50%', background:'#FFE8F4', color:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0}}>{user.email?.[0]?.toUpperCase() ?? 'A'}</Link>
              </>
            ) : (
              <>
                <Link href="/login" style={{height:36, padding:'0 14px', display:'flex', alignItems:'center', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap'}}>Sign in</Link>
                <Link href="/register" className="nav-cta" style={{height:36, padding:'0 16px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(200,0,106,0.35)', transition:'background 0.12s'}}>Get started</Link>
              </>
            )}
            </div>

            {/* Hamburger — visible under 768px */}
            <button
              className="hamburger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
              style={{width:42, height:42, borderRadius:10, border:'1.5px solid rgba(200,0,106,0.18)', background:'var(--bg-card)', cursor:'pointer', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:5, flexShrink:0}}
            >
            <span style={{display:'block', width:18, height:2, borderRadius:2, background:'#C8006A', transition:'transform 0.25s, opacity 0.2s', transform:menuOpen?'translateY(7px) rotate(45deg)':'none'}}/>
            <span style={{display:'block', width:18, height:2, borderRadius:2, background:'#C8006A', transition:'opacity 0.15s', opacity:menuOpen?0:1}}/>
            <span style={{display:'block', width:18, height:2, borderRadius:2, background:'#C8006A', transition:'transform 0.25s, opacity 0.2s', transform:menuOpen?'translateY(-7px) rotate(-45deg)':'none'}}/>
            </button>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{position:'fixed', inset:'66px 0 0', background:'rgba(26,26,26,0.35)', backdropFilter:'blur(2px)', zIndex:498}}/>
            <div style={{position:'fixed', top:66, left:0, right:0, background:'var(--bg-card)', borderBottom:'1px solid rgba(200,0,106,0.1)', boxShadow:'0 16px 40px rgba(26,26,26,0.12)', zIndex:499, padding:'14px 20px 22px', animation:'menuIn 0.22s ease'}}>
              <div style={{display:'flex', flexDirection:'column'}}>
                {[{l:'Explore food',h:'/browse',a:true},{l:'Sell & cater',h:'/become-a-seller',a:false},{l:'Deliver & earn',h:'/become-a-driver',a:false}].map((t,i) => (
                  <Link key={i} href={t.h} onClick={() => setMenuOpen(false)} style={{padding:'15px 4px', fontSize:16, fontWeight:t.a?700:600, color:t.a?'#C8006A':'var(--text-primary)', borderBottom:'1px solid #F3E6EE', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    {t.l}<span style={{color:'#C8006A', fontSize:18}}>›</span>
                  </Link>
                ))}
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:18}}>
                {user ? (
                  <Link href={dashboardPath(role)} onClick={() => setMenuOpen(false)} style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', borderRadius:10, fontSize:15, fontWeight:700, color:'#fff', boxShadow:'0 6px 18px rgba(200,0,106,0.35)'}}>My dashboard</Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMenuOpen(false)} style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid var(--border-subtle)', borderRadius:10, fontSize:15, fontWeight:600, color:'var(--text-primary)'}}>Sign in</Link>
                    <Link href="/register" onClick={() => setMenuOpen(false)} style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', borderRadius:10, fontSize:15, fontWeight:700, color:'#fff', boxShadow:'0 6px 18px rgba(200,0,106,0.35)'}}>Get started</Link>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* ── HERO ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', minHeight:'90vh', position:'relative', overflow:'hidden', display:'flex', alignItems:'center'}}>
        <HeroVideoBg src="/videos/hero-buyer.mp4" mobileSrc="/videos/hero-buyer-mobile.mp4" poster="/videos/hero-buyer-poster.jpg" />
        <div style={{position:'absolute', top:'-15%', right:'-5%', width:'55%', height:'130%', background:'radial-gradient(ellipse,rgba(255,255,255,0.06) 0%,transparent 65%)', pointerEvents:'none'}}/>
        <div style={{position:'absolute', bottom:'-10%', left:'5%', width:'30%', height:'50%', background:'radial-gradient(ellipse,rgba(255,232,244,0.06) 0%,transparent 65%)', pointerEvents:'none'}}/>

        <div className="hero-grid" style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', display:'grid', gridTemplateColumns:'55% 45%', width:'100%', gap:32, alignItems:'center'}}>
          <div className="hero-left" style={{padding:'72px 0', position:'relative', zIndex:1}}>

            {/* Brand badge */}
            <div style={{display:'inline-flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:100, padding:'6px 16px', marginBottom:24}}>
              <Logo height={22} white priority={false}/>
              <span style={{fontSize:12, fontWeight:700, color:'#fff', letterSpacing:'0.04em'}}>Available across the UK</span>
            </div>

            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(32px,3.8vw,58px)', fontWeight:700, color:'#fff', lineHeight:1.08, letterSpacing:'-0.025em', marginBottom:18}}>
              Home cooked food,<br/>
              <span style={{color:'rgba(255,255,255,0.78)', fontStyle:'italic'}}>delivered with love.</span>
            </h1>

            <p style={{fontSize:'clamp(14px,1.4vw,17px)', color:'rgba(255,255,255,0.82)', lineHeight:1.75, marginBottom:32, maxWidth:500, fontWeight:400}}>
              Authentic meals from verified home cooks in your area. Real food, real kitchens — Bangladeshi, Pakistani, Indian, Caribbean, Middle Eastern and more.
            </p>

            {/* Search */}
            <div style={{background:'var(--bg-card)', borderRadius:16, padding:8, boxShadow:'0 8px 48px rgba(0,0,0,0.28)', marginBottom:locationError?8:28}}>
              <div className="search-row" style={{display:'flex', gap:8}}>
                <div className="search-field" style={{display:'flex', alignItems:'center', gap:8, flex:1, padding:'0 8px 0 14px', background:'var(--bg-page)', borderRadius:10, minWidth:0}}>
                  <span style={{fontSize:18, flexShrink:0}}>📍</span>
                  <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="Enter your postcode to find home cooks near you" style={{border:'none', outline:'none', fontSize:14, fontWeight:500, color:'var(--text-primary)', width:'100%', height:44, background:'transparent', minWidth:0}}/>
                  <button type="button" onClick={detectLocation} disabled={detectingLocation} title="Use my location" style={{width:34, height:34, borderRadius:8, border:'none', background:detectingLocation?'transparent':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', cursor:detectingLocation?'default':'pointer', flexShrink:0, fontSize:16}}>
                    {detectingLocation
                      ? <span style={{width:16, height:16, border:'2.5px solid #FFE8F4', borderTop:'2.5px solid #C8006A', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite'}}/>
                      : '🧭'}
                  </button>
                </div>
                <button type="button" onClick={goToBrowse} className="primary-btn" style={{height:52, padding:'0 28px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(200,0,106,0.4)', transition:'background 0.12s', flexShrink:0}}>
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
                      <div style={{height:wide?148:96, display:'flex', alignItems:'center', justifyContent:'center', fontSize:wide?58:40, background:'rgba(255,255,255,0.06)', position:'relative', overflow:'hidden'}}>
                        {l.image_url
                          ? <img src={l.image_url} alt={l.name} loading="lazy" style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />
                          : (cuisineEmoji[l.cuisine] || '🍽️')}
                        {l.featured && <div style={{position:'absolute', top:8, left:8, background:'var(--bg-card)', color:'#C8006A', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:100}}>🔥 Featured</div>}
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

      {/* ── TRUST BAR (marquee) ── */}
      <div className="marquee-mask" style={{background:'#FFE8F4', borderTop:'1px solid rgba(200,0,106,0.12)', borderBottom:'1px solid rgba(200,0,106,0.12)', overflow:'hidden', position:'relative'}}>
        <div style={{position:'absolute', left:0, top:0, bottom:0, width:60, background:'linear-gradient(to right,#FFE8F4,transparent)', zIndex:2, pointerEvents:'none'}}/>
        <div style={{position:'absolute', right:0, top:0, bottom:0, width:60, background:'linear-gradient(to left,#FFE8F4,transparent)', zIndex:2, pointerEvents:'none'}}/>
        <div className="marquee-track">
          {[0,1].map(dup => (
            <div key={dup} aria-hidden={dup === 1} style={{display:'flex', alignItems:'center', flexShrink:0}}>
              {[['🍽️','Home cook marketplace'],['🔒','Stripe-secured payments'],['🛡️','Buyer protection on every order'],['⚡','Community delivery · 45 mins'],['🌿','Allergen declarations mandatory'],['🇬🇧','Available UK-wide']].map(([icon,text],i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:7, padding:'12px 26px', fontSize:12.5, fontWeight:700, color:'#C8006A', whiteSpace:'nowrap', flexShrink:0}}>
                  <span style={{fontSize:15}}>{icon}</span>{text}
                  <span style={{width:4, height:4, borderRadius:'50%', background:'rgba(200,0,106,0.3)', marginLeft:19}}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <section style={{background:'var(--bg-card)', borderBottom:'1px solid #F0F0F0', padding:'36px 0'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:12, flexWrap:'wrap'}}>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.1}}>What are you craving?</h2>
            <div className="cuisine-arrows" style={{display:'flex', gap:8, alignItems:'center'}}>
              <button className="scroll-arrow" aria-label="Scroll cuisines left" onClick={() => scrollCats(-1)} style={{width:32, height:32, borderRadius:'50%', background:'var(--bg-card)', border:'1.5px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:17, color:'var(--text-primary)', transition:'all 0.15s ease'}}>‹</button>
              <button className="scroll-arrow" aria-label="Scroll cuisines right" onClick={() => scrollCats(1)} style={{width:32, height:32, borderRadius:'50%', background:'var(--bg-card)', border:'1.5px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:17, color:'var(--text-primary)', transition:'all 0.15s ease'}}>›</button>
            </div>
          </div>
          <div style={{position:'relative'}}>
            <div ref={catRef} className="cuisine-scroll">
              {cats.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={`cuisine-card${cat === c.id ? ' on' : ''}`}>
                  <span className="ce">{c.emoji}</span>
                  <span className="cl">{c.id === 'all' ? 'All' : c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LISTINGS ── */}
      <section id="listings" style={{padding:'52px 0', background:'var(--bg-page)', scrollMarginTop:66}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          {/* Location bar — postcode chip + distance filter driver. Uses
              useLocationFilter's own state (localStorage → profile),
              independent of the hero-search `postcode` string above which
              is legacy /browse hand-off. */}
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap'}}>
            {location.postcode ? (
              <>
                <LocationBar
                  postcode={location.postcode}
                  onSubmit={location.setPostcode}
                  onClear={location.clearPostcode}
                  onGPS={location.useGPS}
                  loading={location.coordsLoading}
                  error={location.coordsError}
                />
                <span style={{fontSize:12.5, color:'var(--text-primary)', opacity:0.7, fontWeight:600}}>
                  Within {location.isRadiusRemoved ? 'any distance' : `${location.radiusMiles} mi`}
                </span>
              </>
            ) : (
              <div style={{flex:1, minWidth:260, maxWidth:520}}>
                <LocationBar
                  postcode={null}
                  onSubmit={location.setPostcode}
                  onClear={location.clearPostcode}
                  onGPS={location.useGPS}
                  loading={location.coordsLoading}
                  error={location.coordsError}
                  placeholder="Enter your postcode to see dishes near you"
                />
              </div>
            )}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12}}>
            <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)'}}><span style={{color:'#C8006A'}}>{filtered.length}</span> {filtered.length === 1 ? 'dish' : 'dishes'} available{cat !== 'all' ? ` in ${cats.find(c => c.id === cat)?.label}` : ''}</div>
              {orderType !== 'all' && (
                <button type="button" onClick={() => setOrderType('all')} style={{display:'inline-flex', alignItems:'center', gap:8, height:30, padding:'0 6px 0 12px', background:'#FFE8F4', border:'1.5px solid #C8006A', borderRadius:100, fontSize:12.5, fontWeight:700, color:'#C8006A', cursor:'pointer'}}>
                  {orderTypeLabel(orderType)}
                  <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', background:'#C8006A', color:'#fff', fontSize:11, lineHeight:1}}>✕</span>
                </button>
              )}
            </div>
            <div style={{display:'flex', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:6, height:38, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, background:'var(--bg-card)'}}>
                <span style={{fontSize:14}}>🔍</span>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes..." style={{border:'none', outline:'none', fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'transparent', width:160}}/>
              </div>
              <select value={sort} onChange={e => setSort(e.target.value)} style={{height:38, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', outline:'none'}}>
                <option value="rec">Recommended</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest rated</option>
              </select>
            </div>
          </div>
          {loadingListings ? (
            <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18}}>
              {Array.from({length:8}).map((_,i) => (
                <div key={i} style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.06)'}}>
                  <div className="skel" style={{height:180}}/>
                  <div style={{padding:'15px 16px'}}>
                    <div className="skel" style={{height:15, borderRadius:6, width:'72%', marginBottom:10}}/>
                    <div className="skel" style={{height:12, borderRadius:6, width:'52%', marginBottom:14}}/>
                    <div style={{display:'flex', gap:6, marginBottom:14}}>
                      <div className="skel" style={{height:18, borderRadius:20, width:54}}/>
                      <div className="skel" style={{height:18, borderRadius:20, width:46}}/>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:11, borderTop:'1px solid var(--bg-secondary)'}}>
                      <div className="skel" style={{height:20, borderRadius:6, width:60}}/>
                      <div className="skel" style={{height:34, borderRadius:9, width:96}}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            (() => {
              // Distance filter is the culprit when the buyer has a
              // location AND the raw listings feed isn't empty. Offer to
              // widen the radius before nuking cuisine / search filters.
              const distanceGated =
                location.buyerCoords && !location.isRadiusRemoved && listings.length > 0
              if (distanceGated) {
                return (
                  <div style={{background:'var(--bg-card)', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
                    <div style={{fontSize:48, marginBottom:16}}>📍</div>
                    <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>No dishes found within {location.radiusMiles} miles of {location.postcode?.toUpperCase()}</h2>
                    <p style={{fontSize:14, color:'var(--text-primary)', marginBottom:18, maxWidth:400, marginLeft:'auto', marginRight:'auto'}}>Try expanding your search or browse every dish on meaLoyo.</p>
                    <div style={{display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap'}}>
                      {!location.isRadiusExpanded && (
                        <button onClick={location.expandRadius} style={{height:42, padding:'0 22px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(200,0,106,0.28)'}}>Try {location.EXPANDED_RADIUS} miles</button>
                      )}
                      <button onClick={location.removeRadius} style={{height:42, padding:'0 22px', background:'transparent', color:'#C8006A', border:'1.5px solid #C8006A', borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer'}}>Browse all dishes</button>
                    </div>
                  </div>
                )
              }
              return (
                <div style={{background:'var(--bg-card)', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
                  <div style={{fontSize:48, marginBottom:16}}>🍽️</div>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>No dishes found</h2>
                  <p style={{fontSize:14, color:'var(--text-primary)'}}>Try a different category or search term.</p>
                </div>
              )
            })()
          ) : (
            <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:18}}>
              {sorted.map(l => {
                const tags = [l.halal && 'Halal', l.vegan && 'Vegan', l.vegetarian && 'Vegetarian', l.spicy && 'Spicy'].filter(Boolean) as string[]
                const dist = location.distanceFor(l)
                return (
                  <Link key={l.id} href={`/dish/${l.id}`} className="lcard" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'block'}}>
                    <div style={{height:180, display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, background:'linear-gradient(135deg,#FFE8F4 0%,var(--bg-secondary) 100%)', position:'relative', overflow:'hidden'}}>
                      {cuisineEmoji[l.cuisine] || '🍽️'}
                      {l.image_url && <img src={l.image_url} alt={l.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />}
                      <button className="save-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleSave(l.id) }} style={{position:'absolute', top:12, right:12, width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', transition:'transform 0.14s'}}>
                        {saved.includes(l.id)?'❤️':'🤍'}
                      </button>
                    </div>
                    <div style={{padding:'15px 16px'}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:4, letterSpacing:'-0.01em', lineHeight:1.3}}>{l.name}</div>
                      <div style={{fontSize:12, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:5, fontWeight:500, flexWrap:'wrap'}}>
                        <div style={{width:18, height:18, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0}}>{l.profiles?.full_name?.[0] || 'C'}</div>
                        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>{l.profiles?.full_name || 'Home cook'}</span>
                        <span style={{color:'#C8006A', fontWeight:600, whiteSpace:'nowrap'}}>· {l.cuisine}</span>
                        {typeof dist === 'number' && (
                          <span style={{marginLeft:'auto', background:'rgba(200,0,106,0.1)', color:'#C8006A', fontSize:10.5, fontWeight:800, padding:'2px 8px', borderRadius:100, whiteSpace:'nowrap'}}>📍 {dist < 0.1 ? '<0.1' : dist.toFixed(1)} mi</span>
                        )}
                      </div>
                      <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                        {tags.map(t => (
                          <span key={t} style={{background:t==='Halal'?'#E4F6EA':t==='Vegan'?'#EBF2FD':'#FFE8F4', color:t==='Halal'?'#2DA84E':t==='Vegan'?'#1A6ECC':'#C8006A', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700}}>{t}</span>
                        ))}
                      </div>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:11, borderTop:'1px solid var(--bg-secondary)'}}>
                        <div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
                          <div style={{fontSize:11, color:'var(--text-primary)', marginTop:1, fontWeight:600}}><span style={{color:'#C8006A'}}>★</span> {l.rating || '—'} <span style={{fontWeight:400}}>({l.reviews_count || 0} reviews)</span></div>
                        </div>
                        <AddToCartButton l={l} />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS FOR BUYERS ── */}
      <section style={{padding:'72px 0', background:'var(--bg-card)'}}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 20px'}}>
          <div style={{textAlign:'center', marginBottom:44}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>How it works for buyers</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,38px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:12}}>Home cooked food in three steps</h2>
            <p style={{fontSize:'clamp(14px,1.4vw,16px)', color:'var(--text-primary)', maxWidth:440, margin:'0 auto', fontWeight:400, lineHeight:1.65}}>Find a cook near you, order in seconds, and eat well.</p>
          </div>
          <div className="hiw-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20}}>
            {[
              {n:'01', icon:'📍', title:'Enter your postcode', desc:'Find verified home cooks near you, sorted by cuisine, rating and availability.'},
              {n:'02', icon:'🍽️', title:'Choose your dish', desc:'Collection is always free, or get it delivered from £2.49. Pay securely by card or Apple Pay.'},
              {n:'03', icon:'⭐', title:'Track & rate your order', desc:'Follow your order in real time, then rate your cook after it arrives to help the community.'},
            ].map(s => (
              <div key={s.n} className="hiw-card" style={{position:'relative', background:'linear-gradient(135deg,var(--bg-secondary) 0%,#FFE8F4 100%)', borderRadius:20, padding:'30px 24px', border:'1.5px solid rgba(200,0,106,0.1)', transition:'all 0.2s'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:44, fontWeight:700, color:'rgba(200,0,106,0.13)', lineHeight:1, marginBottom:14}}>{s.n}</div>
                <div style={{width:52, height:52, borderRadius:14, background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:14, boxShadow:'0 4px 14px rgba(200,0,106,0.12)'}}>{s.icon}</div>
                <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.01em'}}>{s.title}</div>
                <div style={{fontSize:13.5, color:'var(--text-primary)', lineHeight:1.7, fontWeight:400}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP COOKS ── */}
      <section style={{padding:'72px 0', background:'var(--bg-page)'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Trusted food makers</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.015em'}}>Top home cooks near you</h2>
              <p style={{fontSize:13, color:'var(--text-primary)', marginTop:4, fontWeight:400}}>Every cook is verified, ID checked and hygiene certified.</p>
            </div>
            <button type="button" onClick={scrollToListings} style={{height:36, padding:'0 16px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:700, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', flexShrink:0}}>Browse all →</button>
          </div>
          {loadingListings ? (
            <div className="cooks-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:14}}>
              {Array.from({length:6}).map((_,i) => (
                <div key={i} style={{background:'var(--bg-card)', borderRadius:18, padding:'20px 14px', textAlign:'center', boxShadow:'0 2px 12px rgba(200,0,106,0.05)', border:'1.5px solid rgba(200,0,106,0.06)'}}>
                  <div className="skel" style={{width:52, height:52, borderRadius:'50%', margin:'0 auto 12px'}}/>
                  <div className="skel" style={{height:13, borderRadius:6, width:'70%', margin:'0 auto 8px'}}/>
                  <div className="skel" style={{height:11, borderRadius:6, width:'45%', margin:'0 auto 14px'}}/>
                  <div className="skel" style={{height:22, borderRadius:20, width:90, margin:'0 auto'}}/>
                </div>
              ))}
            </div>
          ) : cooks.length === 0 ? (
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'48px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
              <p style={{fontSize:14, color:'var(--text-primary)'}}>No verified cooks live yet — check back soon.</p>
            </div>
          ) : (
            <div className="cooks-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:14}}>
              {cooks.map(c => (
                <div key={c.id} className="cook-card" style={{background:'var(--bg-card)', borderRadius:18, padding:'20px 14px', textAlign:'center', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)', transition:'all 0.18s', cursor:'pointer'}}>
                  <div style={{width:52, height:52, borderRadius:'50%', background:c.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#fff', margin:'0 auto 10px', boxShadow:`0 4px 16px ${c.color}55`}}>
                    {c.init}
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2}}>{c.name}</div>
                  <div style={{fontSize:11, color:'#C8006A', marginBottom:8, fontWeight:600}}>{c.cuisine}</div>
                  <div style={{display:'flex', justifyContent:'center', gap:14, marginBottom:10}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)'}}>★{c.rat}</div><div style={{fontSize:9, color:'var(--text-primary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Rating</div></div>
                    <div style={{width:1, background:'rgba(200,0,106,0.1)'}}/>
                    <div style={{textAlign:'center'}}><div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)'}}>{c.reviews}</div><div style={{fontSize:9, color:'var(--text-primary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Reviews</div></div>
                  </div>
                  <span style={{background:'#FFE8F4', color:'#C8006A', padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700}}>Verified cook</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ORDER TYPE / OCCASION FILTER ── */}
      <section style={{padding:'72px 0', background:'var(--bg-card)'}}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 20px'}}>
          <div style={{textAlign:'center', marginBottom:40}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>What&apos;s the occasion?</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,38px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:12}}>Find food for any moment</h2>
            <p style={{fontSize:'clamp(14px,1.4vw,16px)', color:'var(--text-primary)', maxWidth:440, margin:'0 auto', fontWeight:400, lineHeight:1.65}}>Tap an option to filter the dishes below.</p>
          </div>
          <div className="ot-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16}}>
            {orderTypes.map(o => {
              const active = orderType === o.id
              return (
                <button key={o.id} type="button" onClick={() => selectOrderType(o.id)} className="ot-card"
                  style={{textAlign:'left', minHeight:160, padding:'24px 20px', background:active?'#FFE8F4':'var(--bg-card)', border:active?'2px solid #C8006A':'1.5px solid var(--border-subtle)', borderRadius:18, boxShadow:'0 2px 10px rgba(0,0,0,0.04)', transition:'all 0.18s', cursor:'pointer', display:'flex', flexDirection:'column'}}>
                  <div style={{width:56, height:56, borderRadius:15, background:active?'#C8006A':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:16, transition:'background 0.18s'}}>{o.emoji}</div>
                  <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:active?'#C8006A':'var(--text-primary)', marginBottom:6, letterSpacing:'-0.01em'}}>{o.name}</div>
                  <div style={{fontSize:12.5, color:'var(--text-primary)', lineHeight:1.55, fontWeight:400}}>{o.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section style={{padding:'72px 0', background:'var(--bg-page)'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div style={{textAlign:'center', marginBottom:36}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Community voices</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,30px)', fontWeight:700, color:'var(--text-primary)'}}>Our community loves it</h2>
            {reviewCount !== null && reviewCount > 0 && <p style={{fontSize:13, color:'var(--text-primary)', marginTop:6, fontWeight:500}}>{reviewCount} verified reviews from real orders</p>}
          </div>
          {loadingReviews ? (
            <div style={{display:'flex', justifyContent:'center', padding:'40px 0'}}>
              <div style={{width:36, height:36, border:'4px solid #FFE8F4', borderTop:'4px solid #C8006A', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
            </div>
          ) : reviews.length === 0 ? (
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'48px 32px', textAlign:'center', boxShadow:'0 2px 10px rgba(200,0,106,0.06)'}}>
              <p style={{fontSize:14, color:'var(--text-primary)'}}>No reviews yet — be the first to order and leave one.</p>
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:18}}>
              {reviews.map((r,i) => {
                const name = r.profiles?.full_name || 'Buyer'
                const initials = name.split(' ').map((w:string) => w[0]).slice(0,2).join('').toUpperCase()
                const dishName = r.orders?.listings?.name
                return (
                  <div key={r.id} className="review-card" style={{background:'var(--bg-card)', borderRadius:18, padding:'22px', boxShadow:'0 2px 12px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.08)', display:'flex', flexDirection:'column', transition:'transform 0.18s'}}>
                    <div style={{color:'#C8006A', fontSize:14, letterSpacing:'2px', marginBottom:12}}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
                    <p style={{fontFamily:'Georgia,serif', fontSize:14, fontStyle:'italic', color:'var(--text-primary)', lineHeight:1.75, marginBottom:16, flex:1}}>&ldquo;{r.comment}&rdquo;</p>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:38, height:38, borderRadius:'50%', background:cookColors[i % cookColors.length], display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>{initials}</div>
                      <div>
                        <div style={{fontSize:13, fontWeight:700, color:'var(--text-primary)'}}>{name}</div>
                        {dishName && <div style={{fontSize:11, color:'var(--text-primary)', fontWeight:500}}>{dishName}</div>}
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
            <Logo height={48} white priority={false}/>
          </div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3.5vw,44px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:10, lineHeight:1.15}}>Hungry? Order home cooked food now.</h2>
          <p style={{fontSize:'clamp(14px,1.4vw,17px)', color:'rgba(255,255,255,0.85)', marginBottom:28, lineHeight:1.65, fontWeight:400}}>{cooks.length > 0 ? `${cooks.length} ` : ''}home cooks across the UK. Authentic food. No restaurant markup.</p>
          <div className="cta-btns" style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <button type="button" onClick={() => { if (user) scrollToListings(); else router.push('/register') }} style={{height:52, padding:'0 32px', background:'var(--bg-card)', color:'#C8006A', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(0,0,0,0.15)', flexShrink:0}}>Order food now</button>
            <Link href="/register" style={{height:52, padding:'0 32px', background:'rgba(255,255,255,0.12)', color:'#fff', border:'2px solid rgba(255,255,255,0.28)', borderRadius:12, fontSize:15, fontWeight:600, display:'flex', alignItems:'center', flexShrink:0}}>Start selling your food</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:'#1A1A1A', padding:'48px 0 24px'}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px'}}>
          <div className="footer-grid" style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:40, marginBottom:32}}>
            <div>
              <div style={{marginBottom:12}}>
                <Logo height={34} white priority={false}/>
              </div>
              <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, maxWidth:240, marginBottom:14, fontWeight:400}}>The UK home cook food marketplace. Authentic meals from verified home cooks across the UK.</p>
              <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'rgba(200,0,106,0.18)', color:'#FFE8F4', border:'1px solid rgba(200,0,106,0.28)', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>meaLoyo · Est. 2026</span>
            </div>
            {[
              {head:'Buy food', links:[
                {l:'Browse listings', action:scrollToListings}, {l:'Find local cooks', h:'/register'},
                {l:'Event catering', action:() => selectOrderType('party')}, {l:'Office lunches', action:() => selectOrderType('office')}, {l:'Meal prep boxes', action:() => selectOrderType('mealprep')},
              ]},
              {head:'Sell food', links:[
                {l:'Become a seller', h:'/become-a-seller'}, {l:'Start selling', h:'/register'},
                {l:'Seller dashboard', h:'/seller/dashboard'}, {l:'Seller support', h:'/seller-support'},
              ]},
              {head:'Drive & deliver', links:[
                {l:'Become a driver', h:'/become-a-driver'}, {l:'Driver dashboard', h:'/driver/dashboard'},
                {l:'Deliver with us', h:'/become-a-driver'},
              ]},
              {head:'Company', links:[
                {l:'About us', h:'/about'}, {l:'Blog', h:'/blog'},
                {l:'Contact', h:'/contact'}, {l:'Terms', h:'/terms'}, {l:'Privacy policy', h:'/privacy'},
              ]},
            ].map(s => (
              <div key={s.head}>
                <div style={{fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>{s.head}</div>
                <div style={{display:'flex', flexDirection:'column', gap:9, alignItems:'flex-start'}}>
                  {s.links.map(link => 'action' in link && link.action
                    ? <button key={link.l} type="button" onClick={link.action} className="footer-link" style={{fontSize:13, color:'rgba(255,255,255,0.45)', fontWeight:500, transition:'color 0.12s', background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left'}}>{link.l}</button>
                    : <Link key={link.l} href={(link as { h:string }).h} className="footer-link" style={{fontSize:13, color:'rgba(255,255,255,0.45)', fontWeight:500, transition:'color 0.12s'}}>{link.l}</Link>
                  )}
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
