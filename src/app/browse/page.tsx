'use client'
import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; next/image is unoptimized here anyway, and a plain <img> avoids remotePatterns config entirely */
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import CartButton from '@/components/CartButton'
import AddToCartButton from '@/components/AddToCartButton'
import LocationBar from '@/components/LocationBar'
import { useLocationFilter } from '@/lib/useLocationFilter'
import type { Listing, Profile } from '@/lib/types'

type BrowseListing = Listing & { profiles?: Pick<Profile, 'full_name' | 'postcode'> | null }

const cuisineEmoji: Record<string, string> = {
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
  { id:'Sri Lankan', label:'Sri Lankan', emoji:'🍚' },
  { id:'Afghan', label:'Afghan', emoji:'🥟' },
  { id:'East African', label:'East African', emoji:'🍲' },
  { id:'Chinese', label:'Chinese', emoji:'🥡' },
  { id:'Other', label:'Other', emoji:'🍽️' },
]

// UK's 14 declarable allergens — buyers EXCLUDE any they react to.
const ALLERGENS = ['Gluten','Crustaceans','Eggs','Fish','Peanuts','Soybeans','Dairy','Nuts','Celery','Mustard','Sesame','Sulphites','Lupin','Molluscs']

const SORTS = [
  { id:'rec', label:'Recommended' },
  { id:'rating', label:'Highest rated' },
  { id:'popular', label:'Most ordered' },
  { id:'price-asc', label:'Price: low to high' },
  { id:'price-desc', label:'Price: high to low' },
  { id:'new', label:'Newest' },
]

const NEW_DAYS = 14
const isNew = (l: Listing) => (Date.now() - new Date(l.created_at).getTime()) < NEW_DAYS * 86400000
// Social proof — only surfaced when meaningfully high. Rounds down to a tidy 10
// (27 → "20+ orders", 53 → "50+ orders") so the number reads as a milestone.
const ordersBadge = (l: Listing): string | null => {
  const c = l.order_count ?? 0
  if (c < 20) return null
  return `${Math.floor(c / 10) * 10}+ orders`
}
const deliveryOpts = (l: Listing): string[] => {
  const d = l.delivery_options
  if (Array.isArray(d)) return d.map(x => String(x).toLowerCase())
  if (typeof d === 'string') return d.split(',').map(x => x.trim().toLowerCase())
  return []
}

// Small dietary badge config — icons not words.
const dietBadges = (l: Listing) => [
  l.halal && { key:'halal', icon:'✓', label:'Halal', bg:'#E4F6EA', color:'#2DA84E' },
  l.vegan && { key:'vegan', icon:'🌱', label:'Vegan', bg:'#EBF7EE', color:'#2DA84E' },
  l.vegetarian && { key:'veg', icon:'🥬', label:'Vegetarian', bg:'#EBF2FD', color:'#1A6ECC' },
  l.spicy && { key:'spicy', icon:'🌶️', label:'Spicy', bg:'#FFE8F4', color:'#C8006A' },
].filter(Boolean) as { key:string; icon:string; label:string; bg:string; color:string }[]

// ── Reusable listing card ──
function Card({ l, saved, onToggleSave, distance }: { l: BrowseListing; saved: string[]; onToggleSave: (id: string) => void; distance?: number | null }) {
  const badges = dietBadges(l)
  const orders = ordersBadge(l)
  const isSaved = saved.includes(l.id)
  return (
    <Link href={`/dish/${l.id}`} className="bcard" style={{background:'var(--bg-card)', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 14px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', flexDirection:'column', height:'100%'}}>
      <div style={{position:'relative', aspectRatio:'4 / 3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, background:'linear-gradient(135deg,#FFE8F4 0%,var(--bg-secondary) 100%)', overflow:'hidden'}}>
        {cuisineEmoji[l.cuisine] || '🍽️'}
        {l.image_url && <img src={l.image_url} alt={l.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />}
        <div style={{position:'absolute', top:10, left:10, display:'flex', gap:6, flexWrap:'wrap'}}>
          {l.featured && <span style={{background:'var(--bg-card)', color:'#C8006A', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:100, boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>🔥 Featured</span>}
          {isNew(l) && <span style={{background:'#2DA84E', color:'#fff', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:100, boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>New</span>}
        </div>
        <button className="save-btn" aria-label={isSaved ? 'Remove from saved' : 'Save dish'} onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSave(l.id) }} style={{position:'absolute', top:10, right:10, width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          {isSaved ? '❤️' : '🤍'}
        </button>
        {badges.length > 0 && (
          <div style={{position:'absolute', bottom:10, left:10, display:'flex', gap:5}}>
            {badges.map(b => (
              <span key={b.key} title={b.label} style={{width:24, height:24, borderRadius:'50%', background:b.bg, color:b.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, boxShadow:'0 2px 6px rgba(0,0,0,0.1)'}}>{b.icon}</span>
            ))}
          </div>
        )}
        {orders && (
          <span style={{position:'absolute', bottom:10, right:10, display:'inline-flex', alignItems:'center', gap:4, background:'rgba(26,26,26,0.82)', color:'#fff', fontSize:10.5, fontWeight:800, padding:'4px 9px', borderRadius:100, boxShadow:'0 2px 8px rgba(0,0,0,0.18)'}}>🔥 {orders}</span>
        )}
      </div>
      <div style={{padding:'13px 14px', display:'flex', flexDirection:'column', flex:1}}>
        <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, marginBottom:6, letterSpacing:'-0.01em', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{l.name}</div>
        <div style={{fontSize:12, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontWeight:500, flexWrap:'wrap'}}>
          <span style={{width:18, height:18, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0}}>{l.profiles?.full_name?.[0]?.toUpperCase() || 'C'}</span>
          <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0}}>{l.profiles?.full_name || 'Home cook'}</span>
          <span style={{color:'#C8006A', fontWeight:600, whiteSpace:'nowrap'}}>· {l.cuisine}</span>
          {typeof distance === 'number' && (
            <span style={{marginLeft:'auto', background:'rgba(200,0,106,0.1)', color:'#C8006A', fontSize:10.5, fontWeight:800, padding:'2px 8px', borderRadius:100, whiteSpace:'nowrap'}}>
              📍 {distance < 0.1 ? '<0.1' : distance.toFixed(1)} mi
            </span>
          )}
        </div>
        <div style={{marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:11, borderTop:'1px solid var(--bg-secondary)'}}>
          <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
          <div style={{fontSize:12, fontWeight:700, color:'var(--text-primary)'}}>
            <span style={{color:'#C8006A'}}>★</span> {l.rating ? l.rating.toFixed(1) : '—'} <span style={{fontWeight:500, opacity:0.8}}>({l.reviews_count || 0})</span>
          </div>
        </div>
        <div style={{marginTop:10}}>
          <AddToCartButton l={l} compact />
        </div>
      </div>
    </Link>
  )
}

function Rail({ title, kicker, items, saved, onToggleSave, distanceFor }: { title: string; kicker: string; items: BrowseListing[]; saved: string[]; onToggleSave: (id: string) => void; distanceFor?: (l: BrowseListing) => number | null }) {
  if (!items.length) return null
  return (
    <section style={{marginBottom:38}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>{kicker}</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(19px,2.2vw,26px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.015em'}}>{title}</h2>
      </div>
      <div className="rail" style={{display:'flex', gap:16, overflowX:'auto', paddingBottom:6, scrollSnapType:'x proximity'}}>
        {items.map(l => (
          <div key={l.id} style={{flex:'0 0 240px', width:240, scrollSnapAlign:'start'}}><Card l={l} saved={saved} onToggleSave={onToggleSave} distance={distanceFor?.(l) ?? undefined} /></div>
        ))}
      </div>
    </section>
  )
}

function SkeletonRow() {
  return (
    <div className="rail" style={{display:'flex', gap:16, overflow:'hidden', marginBottom:38}}>
      {Array.from({ length:5 }).map((_, i) => (
        <div key={i} style={{flex:'0 0 240px'}}>
          <div className="skel" style={{aspectRatio:'4 / 3', borderRadius:18, marginBottom:10}} />
          <div className="skel" style={{height:14, borderRadius:6, width:'80%', marginBottom:8}} />
          <div className="skel" style={{height:12, borderRadius:6, width:'55%'}} />
        </div>
      ))}
    </div>
  )
}

function BrowsePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', background:'var(--bg-page)'}} />}>
      <Browse />
    </Suspense>
  )
}

function Browse() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [listings, setListings] = useState<BrowseListing[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [historyCuisines, setHistoryCuisines] = useState<string[]>([])

  // Filters / search
  const [postcode, setPostcode] = useState(params.get('postcode') || '')
  const [query, setQuery] = useState(params.get('q') || '')
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState('rec')
  const [diet, setDiet] = useState<{ halal: boolean; vegan: boolean; vegetarian: boolean }>({ halal:false, vegan:false, vegetarian:false })
  const [delivery, setDelivery] = useState<{ collection: boolean; delivery: boolean }>({ collection:false, delivery:false })
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([])
  const [priceLo, setPriceLo] = useState(0)
  const [priceHi, setPriceHi] = useState(100)
  const [panelOpen, setPanelOpen] = useState(false)
  const [visible, setVisible] = useState(12)

  const catRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Distance filter (buyer postcode → 8 mi cap, expandable to 15) ──
  // useLocationFilter hydrates the postcode from localStorage / profile,
  // batches the postcodes.io lookup for every seller in `listings`, and
  // exposes `filtered` + `distanceFor(item)` for badge rendering.
  const location = useLocationFilter<BrowseListing>(
    listings,
    l => l.profiles?.postcode ?? null,
  )

  // ── Single data fetch: all live listings + seller info ──
  // Can't embed `profiles:seller_id(full_name, postcode)` any more — the
  // 20260717 profiles-column lockdown revoked SELECT on postcode from anon,
  // so PostgREST 42501's the whole query and both the browse and homepage
  // feeds silently rendered "No live dishes yet". Fetch listings first
  // (no embed), then batch seller name+postcode via the definer RPC.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: listRows } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
      if (!active) return
      const listings = (listRows as unknown as BrowseListing[]) || []

      const sellerIds = Array.from(new Set(listings.map(l => l.seller_id).filter(Boolean)))
      const sellerMap = new Map<string, { full_name: string | null; postcode: string | null }>()
      if (sellerIds.length) {
        // Preferred path: bulk RPC (added in 20260720_seller_public_info_bulk).
        const { data: infoRows, error: infoErr } = await supabase.rpc('get_seller_public_info', { p_ids: sellerIds })
        if (!active) return
        if (!infoErr && Array.isArray(infoRows)) {
          for (const r of infoRows as { id: string; full_name: string | null; postcode: string | null }[]) {
            sellerMap.set(r.id, { full_name: r.full_name, postcode: r.postcode })
          }
        } else {
          // Fallback if the migration hasn't been applied yet. `full_name` is
          // already granted to anon (20260717_profiles_reads_grants); postcode
          // still requires the per-seller definer RPC.
          const { data: nameRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', sellerIds)
          if (!active) return
          for (const r of (nameRows || []) as { id: string; full_name: string | null }[]) {
            sellerMap.set(r.id, { full_name: r.full_name, postcode: null })
          }
        }
      }
      if (!active) return
      const rows = listings.map(l => ({ ...l, profiles: sellerMap.get(l.seller_id) ?? null }))
      setListings(rows)
      // Seed the price bounds from real data.
      const prices = rows.map(r => parseFloat(r.price)).filter(n => !isNaN(n))
      if (prices.length) {
        setPriceLo(Math.floor(Math.min(...prices)))
        setPriceHi(Math.ceil(Math.max(...prices)))
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!userId) { if (active) { setSaved([]); setHistoryCuisines([]); setAvatarUrl(null) } return }
      const { data: savedRows } = await supabase.from('saved_listings').select('listing_id').eq('buyer_id', userId)
      if (active) setSaved((savedRows || []).map(r => r.listing_id))
      // Own avatar via the definer RPC — no direct .select() on profiles
      // means a fragile base-table grant can't throw "permission denied for
      // table profiles" mid-browse.
      const { data: fullProfile } = await supabase.rpc('get_my_profile_full')
      if (active) setAvatarUrl(fullProfile?.avatar_url || null)
      // Past orders drive "Recommended for you". RLS scopes this to the buyer's own orders.
      const { data: orderRows } = await supabase.from('orders').select('listings(cuisine)').eq('buyer_id', userId)
      if (active) {
        const cuisines = (orderRows || [])
          .map(o => (o.listings as { cuisine?: string } | null)?.cuisine)
          .filter((c): c is string => !!c)
        setHistoryCuisines(Array.from(new Set(cuisines)))
      }
    })()
    return () => { active = false }
  }, [userId])

  // Price bounds from the dataset (for the slider min/max attributes).
  const priceBounds = useMemo(() => {
    const prices = listings.map(l => parseFloat(l.price)).filter(n => !isNaN(n))
    if (!prices.length) return { min: 0, max: 100 }
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
  }, [listings])

  const toggleSave = async (id: string) => {
    if (!userId) { router.push('/login'); return }
    const isSaved = saved.includes(id)
    setSaved(prev => isSaved ? prev.filter(x => x !== id) : [...prev, id])
    if (isSaved) await supabase.from('saved_listings').delete().eq('buyer_id', userId).eq('listing_id', id)
    else await supabase.from('saved_listings').insert({ buyer_id: userId, listing_id: id })
  }

  // ── Active filters ──
  const priceTouched = priceLo > priceBounds.min || priceHi < priceBounds.max
  const dietActive = diet.halal || diet.vegan || diet.vegetarian
  const deliveryActive = delivery.collection || delivery.delivery
  const hasFilters = cat !== 'all' || query.trim() !== '' || dietActive || deliveryActive || excludeAllergens.length > 0 || priceTouched
  const activeFilterCount = [cat !== 'all', dietActive, deliveryActive, excludeAllergens.length > 0, priceTouched].filter(Boolean).length

  const results = useMemo(() => {
    const matches = (l: BrowseListing) => {
      if (cat !== 'all' && l.cuisine !== cat) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = `${l.name} ${l.cuisine} ${l.profiles?.full_name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (diet.halal && !l.halal) return false
      if (diet.vegan && !l.vegan) return false
      if (diet.vegetarian && !l.vegetarian) return false
      if (delivery.collection || delivery.delivery) {
        const opts = deliveryOpts(l)
        const wantCollection = delivery.collection && opts.some(o => o.includes('collect'))
        const wantDelivery = delivery.delivery && opts.some(o => o.includes('deliver'))
        if (!wantCollection && !wantDelivery) return false
      }
      if (excludeAllergens.length && (l.allergens || []).some(a => excludeAllergens.includes(a))) return false
      const p = parseFloat(l.price)
      if (!isNaN(p) && (p < priceLo || p > priceHi)) return false
      return true
    }
    const sortFn = (a: BrowseListing, b: BrowseListing) => {
      if (sort === 'price-asc') return parseFloat(a.price) - parseFloat(b.price)
      if (sort === 'price-desc') return parseFloat(b.price) - parseFloat(a.price)
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sort === 'popular') return (b.order_count ?? 0) - (a.order_count ?? 0)
      if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      // Recommended: featured first, then rating, then reviews.
      const fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0
      if (fb !== fa) return fb - fa
      if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0)
      return (b.reviews_count ?? 0) - (a.reviews_count ?? 0)
    }
    // location.filtered already caps the feed to the buyer's radius (or
    // returns everything when no postcode is set). Apply the other filters
    // and the sort on top of that reduced set.
    return location.filtered.filter(matches).sort(sortFn)
  }, [location.filtered, cat, query, diet, delivery, excludeAllergens, priceLo, priceHi, sort])

  // ── Curated discovery rails (shown only when no filters are active) ──
  const recommended = useMemo(() => {
    if (historyCuisines.length) {
      const recs = listings.filter(l => historyCuisines.includes(l.cuisine)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      if (recs.length) return recs.slice(0, 10)
    }
    return [...listings].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10)
  }, [listings, historyCuisines])
  const topRated = useMemo(() => listings.filter(l => (l.rating ?? 0) >= 4.5).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10), [listings])
  const popular = useMemo(() => listings.filter(l => (l.order_count ?? 0) > 0).sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0)).slice(0, 10), [listings])
  const fresh = useMemo(() => listings.filter(isNew).slice(0, 10), [listings])

  // Reset pagination whenever the active result set changes. The rAF keeps the
  // state update out of the effect body (avoids cascading synchronous renders).
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(12))
    return () => cancelAnimationFrame(id)
  }, [cat, query, diet, delivery, excludeAllergens, priceLo, priceHi, sort])

  // Infinite scroll for the "All dishes" grid.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisible(v => Math.min(v + 12, results.length))
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [results.length])

  useEffect(() => {
    document.body.style.overflow = panelOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [panelOpen])

  const clearAll = () => {
    setCat('all'); setQuery(''); setDiet({ halal:false, vegan:false, vegetarian:false })
    setDelivery({ collection:false, delivery:false }); setExcludeAllergens([])
    setPriceLo(priceBounds.min); setPriceHi(priceBounds.max)
  }

  const recName = historyCuisines.length ? 'Recommended for you' : 'Featured dishes'

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes shimmer { 0% { background-position:-480px 0; } 100% { background-position:480px 0; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
        * { box-sizing:border-box; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar { width:0; height:0; }
        * { scrollbar-width:none; -ms-overflow-style:none; }
        a { text-decoration:none; color:inherit; }
        button, input, select { font-family:Inter, system-ui, sans-serif; }
        .skel { background:linear-gradient(90deg,#F3E6EE 0%,#FBF1F7 50%,#F3E6EE 100%); background-size:960px 100%; animation:shimmer 1.4s ease-in-out infinite; }
        .bcard { transition:transform 0.2s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.2s; }
        .bcard:hover { transform:translateY(-6px); box-shadow:0 20px 50px rgba(200,0,106,0.16); }
        .save-btn { transition:transform 0.14s; }
        .save-btn:hover { transform:scale(1.18); }
        .cat-pill { transition:all 0.15s cubic-bezier(0.34,1.2,0.64,1); }
        .cat-pill:hover { border-color:#C8006A; color:#C8006A; }
        /* Cuisine selector — clean, minimal, compact for the sticky filter bar */
        .cuisine-scroll { display:flex; flex-wrap:nowrap; gap:8px; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; flex:1; padding:4px 2px; scroll-behavior:smooth; }
        .cuisine-card { flex-shrink:0; width:74px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:8px 8px; border-radius:16px; cursor:pointer; border:1.5px solid var(--border-subtle); background:var(--bg-card); transition:all 0.15s ease; -webkit-tap-highlight-color:transparent; }
        .cuisine-card .ce { font-size:25px; line-height:1; }
        .cuisine-card .cl { font-size:11px; font-weight:600; color:var(--text-primary); text-align:center; line-height:1.15; letter-spacing:-0.01em; }
        .cuisine-card:hover { border-color:rgba(200,0,106,0.3); background:var(--bg-secondary); }
        .cuisine-card.on { background:#C8006A; border-color:transparent; }
        .cuisine-card.on .cl { color:#fff; }
        .cuisine-card.on:hover { background:#C8006A; filter:brightness(1.08); }
        /* Tablet 481–768px */
        @media (max-width:768px) {
          .cuisine-card { width:68px; }
          .cuisine-card .ce { font-size:23px; }
        }
        /* Mobile ≤480px */
        @media (max-width:480px) {
          .cuisine-card { width:62px; padding:7px 6px; }
          .cuisine-card .ce { font-size:21px; }
          .cuisine-card .cl { font-size:10px; }
        }
        .grid-fade { animation:fadeUp 0.35s ease both; }
        .nav-link:hover { color:#C8006A !important; }
        .signout:hover { background:#FFE8F4 !important; color:#C8006A !important; }
        .chip-x:hover { background:#A00055 !important; }
        .filter-btn:hover { border-color:#C8006A !important; color:#C8006A !important; }
        .panel { position:fixed; top:0; right:0; bottom:0; width:400px; max-width:92vw; background:var(--bg-card); z-index:610; box-shadow:-12px 0 48px rgba(26,26,26,0.18); display:flex; flex-direction:column; animation:slideIn 0.28s cubic-bezier(0.32,0.72,0,1); }
        .all-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:18px; }
        input[type=range] { accent-color:#C8006A; }
        @media (max-width:768px) {
          .nav-links { display:none !important; }
          .panel { width:100vw; max-width:100vw; }
          .all-grid { grid-template-columns:1fr 1fr !important; gap:12px !important; }
          .search-postcode { display:none !important; }
        }
        @media (max-width:480px) {
          .all-grid { gap:10px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:200, height:64}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center', gap:16}}>
          <Link href="/" style={{flexShrink:0}}><Logo height={34} /></Link>

          {/* Smart search: postcode + dish/cook */}
          <div style={{flex:1, display:'flex', alignItems:'center', gap:8, background:'var(--bg-page)', borderRadius:12, padding:'5px 6px 5px 12px', maxWidth:620}}>
            <div className="search-postcode" style={{display:'flex', alignItems:'center', gap:6, paddingRight:10, borderRight:'1.5px solid rgba(200,0,106,0.14)'}}>
              <span style={{fontSize:15}}>📍</span>
              <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode" style={{border:'none', outline:'none', background:'transparent', fontSize:13.5, fontWeight:600, color:'var(--text-primary)', width:88}} />
            </div>
            <span style={{fontSize:15, paddingLeft:2}}>🔍</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes, cuisines or cooks" style={{border:'none', outline:'none', background:'transparent', fontSize:13.5, fontWeight:500, color:'var(--text-primary)', flex:1, height:34, minWidth:0}} />
          </div>

          <div style={{display:'flex', alignItems:'center', marginLeft:'auto', flexShrink:0}}>
            <CartButton />
          </div>
          <div className="nav-links" style={{display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
            {user ? (
              <>
                <NavAvatar url={avatarUrl} initial={user.email?.[0]?.toUpperCase() || 'B'} href="/buyer/profile" />
                <Link href="/buyer/dashboard" className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', display:'flex', alignItems:'center', transition:'all 0.12s'}}>Dashboard</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', display:'flex', alignItems:'center', transition:'all 0.12s'}}>Sign in</Link>
                <Link href="/register" style={{height:36, padding:'0 16px', background:'#C8006A', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', boxShadow:'0 4px 12px rgba(200,0,106,0.35)'}}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── FILTER BAR (sticky) ── */}
      <div style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:64, zIndex:190}}>
        <div style={{maxWidth:1240, margin:'0 auto', padding:'12px 20px', display:'flex', alignItems:'center', gap:12}}>
          {/* Cuisine icon cards */}
          <div ref={catRef} className="cuisine-scroll">
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat===c.id} className={`cuisine-card${cat===c.id ? ' on' : ''}`}>
                <span className="ce">{c.emoji}</span>
                <span className="cl">{c.id === 'all' ? 'All' : c.label}</span>
              </button>
            ))}
          </div>
          {/* Sort */}
          <select value={sort} onChange={e => setSort(e.target.value)} style={{height:40, padding:'0 12px', border:'1.5px solid var(--border-subtle)', borderRadius:10, fontSize:13, fontWeight:700, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', outline:'none', flexShrink:0}}>
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {/* Filters */}
          <button onClick={() => setPanelOpen(true)} className="filter-btn" style={{height:40, padding:'0 16px', border:'1.5px solid var(--border-subtle)', borderRadius:10, fontSize:13, fontWeight:700, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', display:'flex', alignItems:'center', gap:8, flexShrink:0, transition:'all 0.14s'}}>
            <span style={{fontSize:15}}>⚙️</span>Filters
            {activeFilterCount > 0 && <span style={{minWidth:20, height:20, padding:'0 6px', borderRadius:100, background:'#C8006A', color:'#fff', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center'}}>{activeFilterCount}</span>}
          </button>
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div style={{maxWidth:1240, margin:'0 auto', padding:'0 20px 12px', display:'flex', flexWrap:'wrap', gap:8, alignItems:'center'}}>
            {cat !== 'all' && <Chip label={cat} onClear={() => setCat('all')} />}
            {query.trim() && <Chip label={`“${query.trim()}”`} onClear={() => setQuery('')} />}
            {diet.halal && <Chip label="Halal" onClear={() => setDiet(d => ({ ...d, halal:false }))} />}
            {diet.vegan && <Chip label="Vegan" onClear={() => setDiet(d => ({ ...d, vegan:false }))} />}
            {diet.vegetarian && <Chip label="Vegetarian" onClear={() => setDiet(d => ({ ...d, vegetarian:false }))} />}
            {delivery.collection && <Chip label="Collection" onClear={() => setDelivery(d => ({ ...d, collection:false }))} />}
            {delivery.delivery && <Chip label="Delivery" onClear={() => setDelivery(d => ({ ...d, delivery:false }))} />}
            {priceTouched && <Chip label={`£${priceLo}–£${priceHi}`} onClear={() => { setPriceLo(priceBounds.min); setPriceHi(priceBounds.max) }} />}
            {excludeAllergens.map(a => <Chip key={a} label={`No ${a}`} onClear={() => setExcludeAllergens(prev => prev.filter(x => x !== a))} />)}
            <button onClick={clearAll} style={{fontSize:12.5, fontWeight:700, color:'#C8006A', background:'none', border:'none', cursor:'pointer', padding:'4px 6px'}}>Clear all</button>
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:1240, margin:'0 auto', padding:'28px 20px 64px'}}>
        {/* Location bar — postcode chip + distance filter driver. Sourced
            from useLocationFilter (localStorage → profile), independent of
            the URL param above which is legacy search UI. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)', opacity: 0.7, fontWeight: 600 }}>
                Within {location.isRadiusRemoved ? 'any distance' : `${location.radiusMiles} mi`}
              </span>
            </>
          ) : (
            <div style={{ flex: 1, minWidth: 260, maxWidth: 520 }}>
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

        {loading ? (
          <>
            <div className="skel" style={{height:22, width:220, borderRadius:8, marginBottom:14}} />
            <SkeletonRow />
            <div className="skel" style={{height:22, width:180, borderRadius:8, marginBottom:14}} />
            <SkeletonRow />
          </>
        ) : listings.length === 0 ? (
          <div style={{background:'var(--bg-card)', borderRadius:20, padding:'72px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(200,0,106,0.06)'}}>
            <div style={{fontSize:52, marginBottom:16}}>🍳</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>No live dishes yet</h2>
            <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>Home cooks are getting set up — check back very soon for fresh meals near you.</p>
          </div>
        ) : (
          <>
            {/* Discovery rails — only when not actively filtering */}
            {!hasFilters && (
              <>
                <Rail title={recName} kicker={historyCuisines.length ? 'Picked from your taste' : 'Handpicked'} items={recommended} saved={saved} onToggleSave={toggleSave} distanceFor={location.distanceFor} />
                <Rail title="Top rated this week" kicker="Loved by buyers" items={topRated} saved={saved} onToggleSave={toggleSave} distanceFor={location.distanceFor} />
                <Rail title="Most popular" kicker="Ordered the most" items={popular} saved={saved} onToggleSave={toggleSave} distanceFor={location.distanceFor} />
                <Rail title="New on meaLoyo" kicker={`Added in the last ${NEW_DAYS} days`} items={fresh} saved={saved} onToggleSave={toggleSave} distanceFor={location.distanceFor} />
              </>
            )}

            {/* All dishes / results grid */}
            <section>
              <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>{hasFilters ? 'Your results' : 'Everything available'}</div>
                  <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(19px,2.2vw,26px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.015em'}}>
                    {hasFilters ? <><span style={{color:'#C8006A'}}>{results.length}</span> {results.length === 1 ? 'dish' : 'dishes'} found</> : 'All dishes'}
                  </h2>
                </div>
              </div>

              {results.length === 0 ? (
                (() => {
                  // Distinguish "no dishes near you" (distance filter is the
                  // reason) from "your filters exclude everything". If a
                  // buyer location is set AND the un-radiused feed has more
                  // matches, the distance filter is the culprit — offer to
                  // expand it before nuking the other filters.
                  const distanceGated =
                    location.buyerCoords && !location.isRadiusRemoved && listings.length > 0
                  if (distanceGated) {
                    return (
                      <div style={{background:'var(--bg-card)', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(200,0,106,0.06)'}}>
                        <div style={{fontSize:48, marginBottom:14}}>📍</div>
                        <h3 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>No dishes found within {location.radiusMiles} miles of {location.postcode?.toUpperCase()}</h3>
                        <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85, marginBottom:18, maxWidth:400, margin:'0 auto 18px'}}>Try expanding your search or browsing every dish on meaLoyo — you might spot something worth a longer trip.</p>
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
                    <div style={{background:'var(--bg-card)', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(200,0,106,0.06)'}}>
                      <div style={{fontSize:48, marginBottom:14}}>🔍</div>
                      <h3 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>Nothing matches those filters</h3>
                      <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85, marginBottom:18}}>Try widening your price range or clearing a filter.</p>
                      <button onClick={clearAll} style={{height:42, padding:'0 22px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(200,0,106,0.28)'}}>Clear all filters</button>
                    </div>
                  )
                })()
              ) : (
                <>
                  <div className="all-grid grid-fade" key={`${cat}-${sort}-${query}-${excludeAllergens.join()}-${priceLo}-${priceHi}-${dietActive}-${deliveryActive}`}>
                    {results.slice(0, visible).map(l => <Card key={l.id} l={l} saved={saved} onToggleSave={toggleSave} distance={location.distanceFor(l)} />)}
                  </div>
                  {visible < results.length && <div ref={sentinelRef} style={{height:1}} />}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── FILTER PANEL ── */}
      {panelOpen && (
        <>
          <div onClick={() => setPanelOpen(false)} style={{position:'fixed', inset:0, background:'rgba(26,26,26,0.4)', backdropFilter:'blur(2px)', zIndex:600, animation:'overlayIn 0.2s ease'}} />
          <div className="panel">
            <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0}}>
              <h3 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)'}}>Filters</h3>
              <button onClick={() => setPanelOpen(false)} aria-label="Close filters" style={{width:36, height:36, borderRadius:10, border:'1.5px solid var(--border-subtle)', background:'var(--bg-card)', cursor:'pointer', fontSize:16, color:'var(--text-primary)'}}>✕</button>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'22px'}}>
              {/* Dietary */}
              <FilterGroup title="Dietary">
                <div style={{display:'flex', flexWrap:'wrap', gap:9}}>
                  <Toggle active={diet.halal} label="Halal" onClick={() => setDiet(d => ({ ...d, halal:!d.halal }))} />
                  <Toggle active={diet.vegan} label="Vegan" onClick={() => setDiet(d => ({ ...d, vegan:!d.vegan }))} />
                  <Toggle active={diet.vegetarian} label="Vegetarian" onClick={() => setDiet(d => ({ ...d, vegetarian:!d.vegetarian }))} />
                </div>
              </FilterGroup>

              {/* Delivery type */}
              <FilterGroup title="Delivery type">
                <div style={{display:'flex', flexWrap:'wrap', gap:9}}>
                  <Toggle active={delivery.collection} label="🛍️ Collection" onClick={() => setDelivery(d => ({ ...d, collection:!d.collection }))} />
                  <Toggle active={delivery.delivery} label="🛵 Delivery" onClick={() => setDelivery(d => ({ ...d, delivery:!d.delivery }))} />
                </div>
              </FilterGroup>

              {/* Price range */}
              <FilterGroup title={`Price range · £${priceLo} – £${priceHi}`}>
                <div style={{display:'flex', flexDirection:'column', gap:14, paddingTop:4}}>
                  <label style={{fontSize:12, fontWeight:700, color:'var(--text-primary)'}}>
                    Min · £{priceLo}
                    <input type="range" min={priceBounds.min} max={priceBounds.max} value={priceLo} onChange={e => setPriceLo(Math.min(Number(e.target.value), priceHi))} style={{width:'100%', marginTop:6, display:'block'}} />
                  </label>
                  <label style={{fontSize:12, fontWeight:700, color:'var(--text-primary)'}}>
                    Max · £{priceHi}
                    <input type="range" min={priceBounds.min} max={priceBounds.max} value={priceHi} onChange={e => setPriceHi(Math.max(Number(e.target.value), priceLo))} style={{width:'100%', marginTop:6, display:'block'}} />
                  </label>
                </div>
              </FilterGroup>

              {/* Allergen exclusions */}
              <FilterGroup title="Exclude allergens">
                <p style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginBottom:10, lineHeight:1.5}}>Hide dishes that declare any of these.</p>
                <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                  {ALLERGENS.map(a => {
                    const on = excludeAllergens.includes(a)
                    return (
                      <button key={a} onClick={() => setExcludeAllergens(prev => on ? prev.filter(x => x !== a) : [...prev, a])} style={{padding:'7px 13px', borderRadius:100, fontSize:12.5, fontWeight:700, cursor:'pointer', border:on?'2px solid #C8006A':'2px solid var(--border-subtle)', background:on?'#FFE8F4':'var(--bg-card)', color:on?'#C8006A':'var(--text-primary)'}}>
                        {on ? '✕ ' : ''}{a}
                      </button>
                    )
                  })}
                </div>
              </FilterGroup>
            </div>

            <div style={{padding:'16px 22px', borderTop:'1px solid var(--border-subtle)', display:'flex', gap:12, flexShrink:0}}>
              <button onClick={clearAll} style={{flex:'0 0 auto', height:46, padding:'0 18px', border:'1.5px solid var(--border-subtle)', borderRadius:11, fontSize:14, fontWeight:700, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer'}}>Clear all</button>
              <button onClick={() => setPanelOpen(false)} style={{flex:1, height:46, background:'#C8006A', color:'#fff', border:'none', borderRadius:11, fontSize:14.5, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 18px rgba(200,0,106,0.3)'}}>
                Show {results.length} {results.length === 1 ? 'dish' : 'dishes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:7, height:30, padding:'0 6px 0 12px', background:'#FFE8F4', border:'1.5px solid #C8006A', borderRadius:100, fontSize:12.5, fontWeight:700, color:'#C8006A'}}>
      {label}
      <button onClick={onClear} className="chip-x" aria-label={`Remove ${label}`} style={{width:18, height:18, borderRadius:'50%', border:'none', background:'#C8006A', color:'#fff', fontSize:10, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.12s'}}>✕</button>
    </span>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:26}}>
      <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:12}}>{title}</div>
      {children}
    </div>
  )
}

function Toggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{padding:'9px 16px', borderRadius:100, fontSize:13, fontWeight:700, cursor:'pointer', border:active?'2px solid #C8006A':'2px solid var(--border-subtle)', background:active?'#FFE8F4':'var(--bg-card)', color:active?'#C8006A':'var(--text-primary)', transition:'all 0.14s'}}>
      {label}
    </button>
  )
}

export default BrowsePage
