'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; next/image is unoptimized here anyway, and a plain <img> avoids remotePatterns config entirely */
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import CartButton from '@/components/CartButton'
import { useCartStore } from '@/lib/cartStore'
import type { User, Listing, Profile } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

export default function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Pick<Profile, 'id' | 'full_name'> | null>(null)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [user, setUser] = useState<User | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [savedRowId, setSavedRowId] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const router = useRouter()

  // Cart plumbing — dish page just adds to the cart; the cart panel owns the
  // whole checkout flow (delivery vs collection, address, payment).
  const addItem = useCartStore(s => s.addItem)
  const clearCart = useCartStore(s => s.clearCart)
  const openCart = useCartStore(s => s.openCart)
  const inCart = useCartStore(s => s.items.find(i => i.listingId === id))
  const currentQty = inCart?.quantity ?? 0

  // Buyer bounced back from a cancelled Stripe Checkout — show a soft banner.
  // Read from the URL directly to avoid needing a useSearchParams Suspense boundary.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cancelled') === 'true') {
      const id = requestAnimationFrame(() => setCancelled(true))
      return () => cancelAnimationFrame(id)
    }
  }, [])

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name)')
        .eq('id', id)
        .single()
      if (!listing) { setNotFound(true); setLoading(false); return }
      setListing(listing)
      setSeller({ id: listing.seller_id, full_name: listing.profiles?.full_name ?? null })
      // Cook's lifetime order count — a nice-to-have trust stat. Best-effort;
      // any failure just leaves the stat at 0.
      try {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', listing.seller_id)
        setOrderCount(count ?? 0)
      } catch {
        setOrderCount(0)
      }
      if (user) {
        const { data: savedRow } = await supabase.from('saved_listings').select('id').eq('buyer_id', user.id).eq('listing_id', id).maybeSingle()
        if (savedRow) { setIsSaved(true); setSavedRowId(savedRow.id) }
      }
      setLoading(false)
    }
    getData()
  }, [id, router])

  const toggleSave = async () => {
    if (!user) { router.push('/login'); return }
    if (isSaved && savedRowId) {
      await supabase.from('saved_listings').delete().eq('id', savedRowId)
      setIsSaved(false)
      setSavedRowId(null)
    } else {
      const { data } = await supabase.from('saved_listings').insert({ buyer_id: user.id, listing_id: id }).select().single()
      setIsSaved(true)
      setSavedRowId(data?.id || null)
    }
  }

  // Add the current dish + quantity to the cart. Cross-seller carts prompt
  // before wiping the existing one. Success flashes an "Added" state and pops
  // the cart open so the buyer can pick delivery/collection.
  const addToCart = () => {
    if (!listing || !seller) return
    const item = {
      listingId: listing.id,
      listingName: listing.name,
      sellerId: listing.seller_id,
      sellerName: seller.full_name || 'Home cook',
      price: parseFloat(listing.price),
      quantity,
      imageUrl: listing.image_url,
      cuisineEmoji: cuisineEmoji[listing.cuisine] || '🍽️',
      deliveryOptions: ['Collection & delivery'],
    }
    const res = addItem(item)
    if (res.needsConfirm) {
      const ok = window.confirm(`Your cart has items from ${res.existingSellerName}. Start a new cart with this item?`)
      if (!ok) return
      clearCart()
      addItem(item)
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
    openCart()
  }

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      html { scroll-behavior: smooth; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      input:focus, textarea:focus { border-color: #C8006A !important; outline: none; background: #fff !important; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .qty-btn { transition: all 0.16s cubic-bezier(0.34,1.2,0.64,1); cursor: pointer; }
      .qty-btn:hover { border-color: #C8006A !important; transform: scale(1.08); }
      .order-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .order-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .save-btn { transition: transform 0.16s cubic-bezier(0.34,1.2,0.64,1); }
      .save-btn:hover { transform: scale(1.14); }
      .back-btn:hover { border-color: #C8006A !important; color: #C8006A !important; }
      .info-card { transition: transform 0.18s; }
      .info-card:hover { transform: translateY(-2px); }
      .mobile-bar { display: none; }
      @media (max-width: 900px) {
        .dish-grid { grid-template-columns: 1fr !important; }
        .order-panel { position: static !important; }
        .page-wrap { padding-bottom: 96px !important; }
        .mobile-bar { display: flex !important; }
        .crumb-name { display: none !important; }
      }
    `}</style>
  )

  // ── NAV (shared across states) ──
  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:500, height:66}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center', gap:14}}>
        <button
          onClick={() => {
            // After a cancelled Stripe Checkout, history.back() would bounce the
            // buyer straight back to Stripe — send them to Browse instead.
            if (cancelled) { router.push('/browse'); return }
            if (typeof window !== 'undefined' && window.history.length > 1) router.back()
            else router.push('/browse')
          }}
          aria-label="Go back"
          className="back-btn"
          style={{width:38, height:38, border:'1.5px solid var(--border-subtle)', borderRadius:10, background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'var(--text-primary)', flexShrink:0, cursor:'pointer', transition:'all 0.14s'}}
        >←</button>
        <Link href="/" style={{flexShrink:0}}><Logo height={34}/></Link>
        {listing && <span className="crumb-name" style={{fontSize:14, color:'var(--text-primary)', fontWeight:500, marginLeft:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>· {listing.name}</span>}
        <div style={{marginLeft:'auto', flexShrink:0}}><CartButton /></div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1100, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="dish-grid" style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start'}}>
          <div>
            <div className="skel" style={{height:280, borderRadius:20, marginBottom:20}}/>
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, marginBottom:16, border:'1.5px solid var(--border-subtle)'}}>
              <div className="skel" style={{height:26, borderRadius:8, width:'60%', marginBottom:12}}/>
              <div className="skel" style={{height:14, borderRadius:6, width:'40%', marginBottom:20}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'100%', marginBottom:8}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'90%', marginBottom:8}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'70%', marginBottom:20}}/>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {Array.from({length:4}).map((_,i)=>(<div key={i} className="skel" style={{height:58, borderRadius:10}}/>))}
              </div>
            </div>
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, border:'1.5px solid var(--border-subtle)', display:'flex', gap:14, alignItems:'center'}}>
              <div className="skel" style={{width:52, height:52, borderRadius:'50%'}}/>
              <div style={{flex:1}}>
                <div className="skel" style={{height:15, borderRadius:6, width:'45%', marginBottom:8}}/>
                <div className="skel" style={{height:12, borderRadius:6, width:'65%'}}/>
              </div>
            </div>
          </div>
          <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, border:'1.5px solid rgba(200,0,106,0.1)'}}>
            <div className="skel" style={{height:22, borderRadius:8, width:'55%', marginBottom:22}}/>
            <div className="skel" style={{height:40, borderRadius:10, width:'100%', marginBottom:18}}/>
            <div className="skel" style={{height:70, borderRadius:12, width:'100%', marginBottom:18}}/>
            <div className="skel" style={{height:52, borderRadius:12, width:'100%'}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── ERROR / NOT FOUND ──
  if (notFound || !listing) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:560, margin:'0 auto', padding:'72px 20px'}}>
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4 0%,var(--bg-secondary) 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 22px'}}>🍽️</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Dish not found</h1>
          <p style={{fontSize:15, color:'var(--text-primary)', lineHeight:1.7, marginBottom:28, maxWidth:380, margin:'0 auto 28px'}}>This dish may have sold out, been removed by the cook, or the link is incorrect.</p>
          <Link href="/" className="order-btn" style={{display:'inline-flex', alignItems:'center', height:52, padding:'0 30px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>
            Browse other dishes →
          </Link>
        </div>
      </div>
    </div>
  )

  // When the logged-in user owns this listing we swap the buyer order form for a
  // seller management panel — a cook shouldn't be ordering their own dish.
  const isOwner = !!user && user.id === listing.seller_id
  const price = parseFloat(listing.price)
  const lineTotal = price * quantity
  const reviews = listing.reviews_count ?? 0
  const rating = listing.rating ?? 0
  const initial = (seller?.full_name?.trim()?.[0] || 'C').toUpperCase()

  const infoCards = [
    { icon:'⏱️', label:'Prep time', value: listing.prep_time || 'Made to order' },
    { icon:'👥', label:'Serves', value: listing.serves ? `${listing.serves} ${listing.serves === 1 ? 'person' : 'people'}` : '—' },
    { icon:'🍽️', label:'Cuisine', value: listing.cuisine },
    { icon:'📦', label:'Delivery', value: 'Collection & delivery' },
  ]

  // ── ORDER PANEL — dish info + quantity + Add to cart. Delivery/collection
  //    choice happens in the cart, not here (Deliveroo-style flow).
  const orderPanel = (
    <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 4px 28px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.1)'}}>
      <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:20}}>Order this dish</h2>

      {/* Quantity */}
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8}}>Quantity</label>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="qty-btn" aria-label="Decrease quantity" style={{width:40, height:40, borderRadius:'50%', border:'1.5px solid var(--border-subtle)', background:'var(--bg-card)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'var(--text-primary)'}}>−</button>
          <span style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', minWidth:28, textAlign:'center'}}>{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="qty-btn" aria-label="Increase quantity" style={{width:40, height:40, borderRadius:'50%', border:'1.5px solid var(--border-subtle)', background:'var(--bg-card)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#C8006A'}}>+</button>
          <span style={{fontSize:13, color:'var(--text-primary)', fontWeight:500, marginLeft:'auto'}}>£{price.toFixed(2)} each</span>
        </div>
      </div>

      {/* Line total */}
      <div style={{background:'var(--bg-page)', borderRadius:12, padding:'14px 16px', marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <span style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>Subtotal</span>
        <span style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em'}}>£{lineTotal.toFixed(2)}</span>
      </div>

      {/* Info: delivery/collection are chosen in the cart, not here. */}
      <div style={{background:'#FFE8F4', border:'1px solid rgba(200,0,106,0.18)', borderRadius:12, padding:'12px 14px', marginBottom:18, fontSize:12.5, color:'#8B0047', lineHeight:1.55}}>
        📍 Choose <strong>collection</strong> or 🚴 <strong>delivery</strong> at checkout — service &amp; delivery fees are calculated then.
      </div>

      {cancelled && (
        <div style={{background:'#FFF4E5', border:'1px solid #F0C77E', borderRadius:12, padding:'12px 14px', marginBottom:12, fontSize:13, color:'#7A4E00', lineHeight:1.5}}>
          Payment cancelled — no charge was made. Add it back to your basket whenever you&apos;re ready.
        </div>
      )}

      {/* Add-to-cart CTA. currentQty > 0 morphs into "In cart · x" hint. */}
      <button onClick={addToCart} className="order-btn"
        style={{width:'100%', height:52, background:added ? '#2DA84E' : '#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:added ? '0 6px 20px rgba(45,168,78,0.3)' : '0 6px 20px rgba(200,0,106,0.3)', transition:'all 0.16s'}}>
        {added ? '✓ Added — opening cart…' : currentQty > 0 ? `Add ${quantity} more · £${lineTotal.toFixed(2)}` : `Add to cart · £${lineTotal.toFixed(2)}`}
      </button>
      {currentQty > 0 && !added && (
        <button onClick={openCart} style={{width:'100%', height:44, marginTop:10, background:'transparent', color:'#C8006A', border:'1.5px solid rgba(200,0,106,0.35)', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>
          Open cart ({currentQty} in cart) →
        </button>
      )}

      <p style={{textAlign:'center', fontSize:11, color:'var(--text-primary)', marginTop:12, lineHeight:1.5}}>🔒 Secured by Stripe · Buyer protection on every order</p>
    </div>
  )

  // ── SELLER VIEW (shown to the cook who owns this dish) ──
  const statusColor = listing.status === 'live'
    ? { bg:'#E4F6EA', fg:'#2DA84E', label:'Live' }
    : listing.status === 'paused'
    ? { bg:'#FFF4E5', fg:'#B57A00', label:'Paused' }
    : { bg:'#F0F0F0', fg:'#6A6A6A', label:listing.status || 'Draft' }
  const sellerPanel = (
    <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 4px 28px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.1)'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
        <span style={{fontSize:22}}>👨‍🍳</span>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)'}}>This is your listing</h2>
      </div>
      <p style={{fontSize:13, color:'var(--text-primary)', opacity:0.75, lineHeight:1.55, marginBottom:18}}>You&apos;re viewing this dish as the cook. Buyers see the order form here — here&apos;s how it&apos;s doing.</p>

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'var(--bg-page)', borderRadius:12, padding:'12px 15px', marginBottom:10}}>
        <span style={{fontSize:12, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Status</span>
        <span style={{background:statusColor.bg, color:statusColor.fg, padding:'4px 12px', borderRadius:100, fontSize:12, fontWeight:700}}>{statusColor.label}</span>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18}}>
        <div style={{background:'var(--bg-page)', borderRadius:12, padding:'13px 15px'}}>
          <div style={{fontSize:11, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>Price</div>
          <div style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)'}}>£{price.toFixed(2)}</div>
        </div>
        <div style={{background:'var(--bg-page)', borderRadius:12, padding:'13px 15px'}}>
          <div style={{fontSize:11, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>Orders</div>
          <div style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)'}}>{listing.order_count ?? 0}</div>
        </div>
      </div>

      <Link href={`/seller/listings/${listing.id}/edit`} className="order-btn" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:52, background:'#C8006A', color:'#fff', borderRadius:12, fontSize:16, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)', marginBottom:10}}>
        Edit this listing →
      </Link>
      <Link href="/seller/listings" className="back-btn" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:48, background:'var(--bg-card)', color:'var(--text-primary)', border:'1.5px solid var(--border-subtle)', borderRadius:12, fontSize:14, fontWeight:600, transition:'all 0.14s'}}>
        All my dishes
      </Link>
    </div>
  )

  // ── MAIN ──
  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div className="page-wrap" style={{maxWidth:1100, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="dish-grid" style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start'}}>

          {/* ── LEFT: dish info ── */}
          <div className="fade-up">

            {/* Hero image area */}
            <div style={{background:'linear-gradient(135deg,#FFE8F4 0%,var(--bg-secondary) 100%)', borderRadius:20, height:'clamp(220px,32vw,300px)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(72px,12vw,108px)', marginBottom:20, position:'relative', overflow:'hidden', boxShadow:'0 4px 24px rgba(200,0,106,0.08)'}}>
              <div style={{position:'absolute', inset:0, background:'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5), transparent 60%)', pointerEvents:'none'}}/>
              <span style={{position:'relative', filter:'drop-shadow(0 8px 20px rgba(200,0,106,0.18))'}}>{cuisineEmoji[listing.cuisine] || '🍽️'}</span>
              {listing.image_url && <img src={listing.image_url} alt={listing.name} onError={e => { e.currentTarget.style.display = 'none' }} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />}
              {listing.featured && (
                <div style={{position:'absolute', top:16, left:16, background:'#C8006A', color:'#fff', fontSize:11, fontWeight:800, padding:'5px 13px', borderRadius:100, boxShadow:'0 4px 12px rgba(200,0,106,0.35)', letterSpacing:'0.02em'}}>🔥 Featured</div>
              )}
              <button onClick={toggleSave} aria-label={isSaved ? 'Remove from saved' : 'Save dish'} className="save-btn" style={{position:'absolute', top:16, right:16, width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, cursor:'pointer', boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>
                {isSaved ? '❤️' : '🤍'}
              </button>
            </div>

            {/* Dish details */}
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border-subtle)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:14, flexWrap:'wrap'}}>
                <div style={{minWidth:0}}>
                  <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:8}}>{listing.name}</h1>
                  <div style={{fontSize:13, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:7, fontWeight:500}}>
                    <div style={{width:24, height:24, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0}}>{initial}</div>
                    {seller?.full_name || 'Home cook'}
                    <span style={{background:'#FFE8F4', color:'#C8006A', padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>{listing.cuisine}</span>
                  </div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em', lineHeight:1}}>£{price.toFixed(2)}</div>
                  <div style={{fontSize:12, color:'var(--text-primary)', marginTop:4}}>per portion{listing.serves ? ` · serves ${listing.serves}` : ''}</div>
                </div>
              </div>

              {reviews > 0 && (
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--bg-secondary)'}}>
                  <span style={{color:'#C8006A', fontSize:17, letterSpacing:'1px'}}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
                  <span style={{fontSize:15, fontWeight:700, color:'var(--text-primary)'}}>{rating}</span>
                  <span style={{fontSize:13, color:'var(--text-primary)'}}>· {reviews} {reviews === 1 ? 'review' : 'reviews'}</span>
                </div>
              )}

              {listing.description && (
                <p style={{fontSize:15, color:'var(--text-primary)', lineHeight:1.75, marginBottom:18}}>{listing.description}</p>
              )}

              {/* Allergen warning */}
              {listing.allergens && listing.allergens.length > 0 && (
                <div style={{display:'flex', gap:11, alignItems:'flex-start', background:'#FFF6E5', border:'1.5px solid #F5C97A', borderRadius:14, padding:'13px 15px', marginBottom:18}}>
                  <span style={{fontSize:18, lineHeight:1.2, flexShrink:0}}>⚠️</span>
                  <div>
                    <div style={{fontSize:12, fontWeight:800, color:'#8C5500', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3}}>Allergen warning</div>
                    <div style={{fontSize:13, color:'#8C5500', fontWeight:600, lineHeight:1.5}}>Contains: {listing.allergens.join(', ')}</div>
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {infoCards.map((item, i) => (
                  <div key={i} className="info-card" style={{background:'var(--bg-page)', borderRadius:12, padding:'13px 15px'}}>
                    <div style={{fontSize:11, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>{item.icon} {item.label}</div>
                    <div style={{fontSize:13, fontWeight:600, color:'var(--text-primary)', lineHeight:1.35}}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* About the cook */}
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border-subtle)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:18}}>About the cook</h2>
              <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:18}}>
                <div style={{width:56, height:56, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#fff', flexShrink:0, boxShadow:'0 4px 16px rgba(200,0,106,0.33)'}}>
                  {initial}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
                    <span style={{fontSize:16, fontWeight:700, color:'var(--text-primary)'}}>{seller?.full_name || 'Home cook'}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:4, background:'#E4F6EA', color:'#2DA84E', padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:700}}>✓ Verified</span>
                  </div>
                  <div style={{fontSize:13, color:'var(--text-primary)'}}>{listing.cuisine} specialist · ID & hygiene checked</div>
                </div>
              </div>
              <div style={{display:'flex', gap:0, background:'var(--bg-page)', borderRadius:12, padding:'14px 0'}}>
                {[
                  { v: reviews > 0 ? `★${rating}` : '★ New', l: 'Rating' },
                  { v: String(reviews), l: reviews === 1 ? 'Review' : 'Reviews' },
                  { v: String(orderCount), l: orderCount === 1 ? 'Order' : 'Orders' },
                ].map((s, i) => (
                  <div key={i} style={{flex:1, textAlign:'center', borderLeft: i > 0 ? '1px solid rgba(200,0,106,0.1)' : 'none'}}>
                    <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:10, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:5}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: order panel — or seller management panel if you own it ── */}
          <div className="order-panel fade-up" style={{position:'sticky', top:82}}>
            {isOwner ? sellerPanel : orderPanel}
          </div>

        </div>
      </div>

      {/* ── MOBILE BOTTOM ACTION BAR ── */}
      <div className="mobile-bar" style={{position:'fixed', bottom:0, left:0, right:0, zIndex:400, background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid rgba(200,0,106,0.12)', boxShadow:'0 -6px 24px rgba(200,0,106,0.1)', padding:'12px 18px', alignItems:'center', gap:14}}>
        {isOwner ? (
          <Link href={`/seller/listings/${listing.id}/edit`} className="order-btn" style={{flex:1, height:50, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 18px rgba(200,0,106,0.3)'}}>
            Edit your listing →
          </Link>
        ) : (
          <>
            <div style={{flexShrink:0}}>
              <div style={{fontSize:11, color:'var(--text-primary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>Subtotal</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A', lineHeight:1}}>£{lineTotal.toFixed(2)}</div>
            </div>
            <button onClick={addToCart} className="order-btn" style={{flex:1, height:50, background:added ? '#2DA84E' : '#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:added ? '0 6px 18px rgba(45,168,78,0.3)' : '0 6px 18px rgba(200,0,106,0.3)', transition:'all 0.16s'}}>
              {added ? '✓ Added' : 'Add to cart →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
