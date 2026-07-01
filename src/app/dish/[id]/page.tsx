'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
/* eslint-disable @next/next/no-img-element -- food photos load directly from Supabase Storage; next/image is unoptimized here anyway, and a plain <img> avoids remotePatterns config entirely */
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { isValidUKPostcode, lookupPostcode, haversineDistance, deliveryFeeForDistance, serviceFee, commission as calcCommission, FLAT_DELIVERY_FEE } from '@/lib/pricing'
import { pointsToPounds, maxRedeemablePounds, poundsToPoints } from '@/lib/loyalty'
import type { User, Listing, Profile } from '@/lib/types'

type DeliveryQuote =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; distance: number; fee: number }
  | { status: 'unavailable'; distance: number }
  | { status: 'flat'; fee: number }
  | { status: 'invalid' }
  | { status: 'notfound' }

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

export default function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Pick<Profile, 'id' | 'full_name' | 'postcode'> | null>(null)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [user, setUser] = useState<User | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [deliveryType, setDeliveryType] = useState<'collection' | 'delivery'>('collection')
  const [address, setAddress] = useState('')
  const [buyerPostcode, setBuyerPostcode] = useState('')
  const [savedAddress, setSavedAddress] = useState('')
  const [savedPostcode, setSavedPostcode] = useState('')
  const [usingSaved, setUsingSaved] = useState(false)
  const [quote, setQuote] = useState<DeliveryQuote>({ status: 'idle' })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [savedRowId, setSavedRowId] = useState<string | null>(null)
  const [pointsBalance, setPointsBalance] = useState(0)
  const [applyPoints, setApplyPoints] = useState(false)
  const router = useRouter()

  // Buyer bounced back from a cancelled Stripe Checkout — restore the form and
  // let them know their unpaid order is still saved. Read from the URL directly
  // to avoid needing a useSearchParams Suspense boundary.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cancelled') === 'true') {
      setCancelled(true)
    }
  }, [])

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(id, full_name, postcode)')
        .eq('id', id)
        .single()
      if (!listing) { setNotFound(true); setLoading(false); return }
      setListing(listing)
      setSeller(listing.profiles ?? null)
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', listing.seller_id)
      setOrderCount(count ?? 0)
      if (user) {
        const { data: savedRow } = await supabase.from('saved_listings').select('id').eq('buyer_id', user.id).eq('listing_id', id).maybeSingle()
        if (savedRow) { setIsSaved(true); setSavedRowId(savedRow.id) }
        // Loyalty balance for the redeem-at-checkout option. Falls back to 0
        // (no redeem UI shown) until the SQL is run.
        const { data: balance } = await supabase.rpc('get_points_balance', { p_buyer_id: user.id })
        setPointsBalance(typeof balance === 'number' ? balance : 0)
        // Pull the buyer's saved delivery address so we can auto-fill checkout.
        const { data: profileRow } = await supabase.from('profiles').select('address_line1, address_line2, city, postcode').eq('id', user.id).maybeSingle()
        if (profileRow?.address_line1) {
          const full = [profileRow.address_line1, profileRow.address_line2, profileRow.city, profileRow.postcode].filter(Boolean).join(', ')
          setSavedAddress(full)
          setSavedPostcode(profileRow.postcode || '')
        }
      }
      setLoading(false)
    }
    getData()
  }, [id, router])

  // Distance-based delivery quote. Recomputes when the buyer edits their
  // postcode or switches to delivery. Debounced so we don't hammer postcodes.io
  // on every keystroke.
  useEffect(() => {
    let active = true
    // Everything (including the synchronous decisions) runs inside the debounce
    // callback so no setState fires synchronously in the effect body.
    const t = setTimeout(async () => {
      if (!active) return
      if (deliveryType !== 'delivery' || !listing || !seller) { setQuote({ status: 'idle' }); return }
      const radius = listing.delivery_radius_miles ?? 3
      // Seller hasn't set a usable postcode → flat fee, settled at dispatch.
      if (!seller.postcode || !isValidUKPostcode(seller.postcode)) { setQuote({ status: 'flat', fee: FLAT_DELIVERY_FEE }); return }
      const pc = buyerPostcode.trim()
      if (!pc) { setQuote({ status: 'idle' }); return }
      if (!isValidUKPostcode(pc)) { setQuote({ status: 'invalid' }); return }
      setQuote({ status: 'checking' })
      const [buyerLoc, sellerLoc] = await Promise.all([lookupPostcode(pc), lookupPostcode(seller.postcode)])
      if (!active) return
      if (!buyerLoc) { setQuote({ status: 'notfound' }); return }
      if (!sellerLoc) { setQuote({ status: 'flat', fee: FLAT_DELIVERY_FEE }); return }
      const distance = haversineDistance(buyerLoc.latitude, buyerLoc.longitude, sellerLoc.latitude, sellerLoc.longitude)
      const fee = deliveryFeeForDistance(distance, radius)
      if (fee === null) setQuote({ status: 'unavailable', distance })
      else setQuote({ status: 'ok', distance, fee })
    }, 450)
    return () => { active = false; clearTimeout(t) }
  }, [buyerPostcode, deliveryType, listing, seller])

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

  // Choosing delivery auto-fills the buyer's saved address (if any) the first
  // time, so they don't retype it. They can still edit or clear it.
  const chooseDelivery = (type: 'collection' | 'delivery') => {
    setDeliveryType(type)
    if (type === 'delivery' && !address.trim() && savedAddress) {
      setAddress(savedAddress)
      if (savedPostcode && !buyerPostcode.trim()) setBuyerPostcode(savedPostcode)
      setUsingSaved(true)
    }
  }

  const clearSavedAddress = () => { setAddress(''); setBuyerPostcode(''); setUsingSaved(false) }

  const handleOrder = async () => {
    if (!user) { router.push('/login'); return }
    if (!listing || !seller) return
    const subtotal = parseFloat(listing.price) * quantity
    let deliveryFee = 0
    if (deliveryType === 'delivery') {
      if (!address.trim()) { setError('Please enter your delivery address'); return }
      if (quote.status === 'ok' || quote.status === 'flat') deliveryFee = quote.fee
      else if (quote.status === 'checking') { setError('Checking delivery distance — one moment…'); return }
      else { setError('Please enter a valid postcode we can deliver to'); return }
    }
    setOrdering(true)
    setError('')
    const svcFee = serviceFee(subtotal)
    const commission = calcCommission(subtotal) // 12% of food subtotal
    const sellerPayout = subtotal - commission // unaffected by loyalty discount (platform-funded)
    // Loyalty discount only reduces what the buyer pays, not the seller payout.
    const discountPounds = applyPoints ? maxRedeemablePounds(pointsBalance, subtotal) : 0
    const pointsToRedeem = poundsToPoints(discountPounds)
    const total = subtotal + svcFee + deliveryFee - discountPounds

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: seller.id,
        listing_id: listing.id,
        quantity,
        total_amount: total,
        delivery_fee: deliveryFee,
        service_fee: svcFee,
        platform_commission: commission,
        seller_payout: sellerPayout,
        // Created unpaid — a Stripe webhook flips this to 'pending' once the
        // buyer completes payment. The loyalty redemption and order-count bump
        // are also deferred to the webhook so they only fire on real payment.
        status: 'pending_payment',
        payment_status: 'unpaid',
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? address : null,
        notes: notes || null,
      })
      .select()
      .single()

    if (orderError) {
      setError(orderError.message)
      setOrdering(false)
      return
    }

    // Hand off to Stripe Checkout. On success the buyer returns to the order
    // confirmation page; on cancel they come back here with ?cancelled=true.
    setRedirecting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          listingId: listing.id,
          listingName: listing.name,
          amount: subtotal,
          deliveryFee,
          serviceFee: svcFee,
          discount: discountPounds,
          buyerEmail: user.email,
          buyerId: user.id,
          pointsToRedeem,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start payment')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment. Please try again.')
      setOrdering(false)
      setRedirecting(false)
    }
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
      .dt-card { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); cursor: pointer; }
      .dt-card:hover { border-color: #C8006A !important; }
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
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:500, height:66}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center', gap:14}}>
        <Link href="/" className="back-btn" style={{width:38, height:38, border:'1.5px solid #E0E0E0', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#1A1A1A', flexShrink:0, transition:'all 0.14s'}}>←</Link>
        <Link href="/" style={{flexShrink:0}}><Logo height={34}/></Link>
        {listing && <span className="crumb-name" style={{fontSize:14, color:'#1A1A1A', fontWeight:500, marginLeft:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>· {listing.name}</span>}
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1100, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="dish-grid" style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start'}}>
          <div>
            <div className="skel" style={{height:280, borderRadius:20, marginBottom:20}}/>
            <div style={{background:'#fff', borderRadius:20, padding:24, marginBottom:16, border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div className="skel" style={{height:26, borderRadius:8, width:'60%', marginBottom:12}}/>
              <div className="skel" style={{height:14, borderRadius:6, width:'40%', marginBottom:20}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'100%', marginBottom:8}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'90%', marginBottom:8}}/>
              <div className="skel" style={{height:13, borderRadius:6, width:'70%', marginBottom:20}}/>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {Array.from({length:4}).map((_,i)=>(<div key={i} className="skel" style={{height:58, borderRadius:10}}/>))}
              </div>
            </div>
            <div style={{background:'#fff', borderRadius:20, padding:24, border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', gap:14, alignItems:'center'}}>
              <div className="skel" style={{width:52, height:52, borderRadius:'50%'}}/>
              <div style={{flex:1}}>
                <div className="skel" style={{height:15, borderRadius:6, width:'45%', marginBottom:8}}/>
                <div className="skel" style={{height:12, borderRadius:6, width:'65%'}}/>
              </div>
            </div>
          </div>
          <div style={{background:'#fff', borderRadius:20, padding:24, border:'1.5px solid rgba(200,0,106,0.1)'}}>
            <div className="skel" style={{height:22, borderRadius:8, width:'55%', marginBottom:22}}/>
            <div className="skel" style={{height:40, borderRadius:10, width:'100%', marginBottom:18}}/>
            <div className="skel" style={{height:70, borderRadius:12, width:'100%', marginBottom:18}}/>
            <div className="skel" style={{height:70, borderRadius:12, width:'100%', marginBottom:18}}/>
            <div className="skel" style={{height:52, borderRadius:12, width:'100%'}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── ERROR / NOT FOUND ──
  if (notFound || !listing) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:560, margin:'0 auto', padding:'72px 20px'}}>
        <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 22px'}}>🍽️</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Dish not found</h1>
          <p style={{fontSize:15, color:'#1A1A1A', lineHeight:1.7, marginBottom:28, maxWidth:380, margin:'0 auto 28px'}}>This dish may have sold out, been removed by the cook, or the link is incorrect.</p>
          <Link href="/" className="order-btn" style={{display:'inline-flex', alignItems:'center', height:52, padding:'0 30px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>
            Browse other dishes →
          </Link>
        </div>
      </div>
    </div>
  )

  const price = parseFloat(listing.price)
  const totalAmount = price * quantity
  const svcFee = serviceFee(totalAmount)
  const radius = listing.delivery_radius_miles ?? 3
  const deliveryOffered = radius > 0
  // Effective delivery fee for the current quote (null = can't price yet / unavailable).
  const deliveryFee: number | null = deliveryType === 'delivery'
    ? (quote.status === 'ok' || quote.status === 'flat' ? quote.fee : null)
    : 0
  const canOrder = deliveryType === 'collection' || deliveryFee !== null
  // Loyalty redemption: whole-pound discount, capped by balance and subtotal.
  const redeemablePounds = maxRedeemablePounds(pointsBalance, totalAmount)
  const canRedeem = redeemablePounds >= 1
  const discount = applyPoints && canRedeem ? redeemablePounds : 0
  const pointsRedeemed = poundsToPoints(discount)
  const grandTotal = totalAmount + svcFee + (deliveryFee ?? 0) - discount
  const reviews = listing.reviews_count ?? 0
  const rating = listing.rating ?? 0
  const initial = (seller?.full_name?.trim()?.[0] || 'C').toUpperCase()
  const deliveryLabel = Array.isArray(listing.delivery_options)
    ? listing.delivery_options.join(', ')
    : (listing.delivery_options || 'Collection & delivery')

  const infoCards = [
    { icon:'⏱️', label:'Prep time', value: listing.prep_time || 'Made to order' },
    { icon:'👥', label:'Serves', value: listing.serves ? `${listing.serves} ${listing.serves === 1 ? 'person' : 'people'}` : '—' },
    { icon:'🍽️', label:'Cuisine', value: listing.cuisine },
    { icon:'📦', label:'Delivery', value: deliveryLabel },
  ]

  // ── ORDER PANEL (reused desktop) ──
  const orderPanel = (
    <div style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 4px 28px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.1)'}}>
      <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:20}}>Place your order</h2>

      {error && <div style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#C8006A', fontWeight:600}}>{error}</div>}

      {/* Quantity */}
      <div style={{marginBottom:18}}>
        <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8}}>Quantity</label>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="qty-btn" aria-label="Decrease quantity" style={{width:40, height:40, borderRadius:'50%', border:'1.5px solid #E0E0E0', background:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#1A1A1A'}}>−</button>
          <span style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1A1A', minWidth:28, textAlign:'center'}}>{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="qty-btn" aria-label="Increase quantity" style={{width:40, height:40, borderRadius:'50%', border:'1.5px solid #E0E0E0', background:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#C8006A'}}>+</button>
          <span style={{fontSize:13, color:'#1A1A1A', fontWeight:500, marginLeft:'auto'}}>£{price.toFixed(2)} each</span>
        </div>
      </div>

      {/* Delivery type */}
      <div style={{marginBottom:18}}>
        <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8}}>How do you want it?</label>
        <div style={{display:'grid', gridTemplateColumns: deliveryOffered ? '1fr 1fr' : '1fr', gap:8}}>
          {([
            { type:'collection' as const, icon:'📍', label:'Collect free', sub:'Pick up from cook' },
            ...(deliveryOffered ? [{ type:'delivery' as const, icon:'🚴', label:'Delivery',
              sub: quote.status === 'ok' ? `£${quote.fee.toFixed(2)} to your door`
                : quote.status === 'flat' ? 'From £3.99'
                : 'Enter postcode' }] : []),
          ]).map(opt => {
            const on = deliveryType === opt.type
            return (
              <div key={opt.type} className="dt-card" onClick={() => chooseDelivery(opt.type)}
                style={{padding:'14px 12px', border:on ? '2px solid #C8006A' : '1.5px solid #E0E0E0', borderRadius:12, background:on ? '#FFE8F4' : '#fff', textAlign:'center'}}>
                <div style={{fontSize:22, marginBottom:5}}>{opt.icon}</div>
                <div style={{fontSize:13, fontWeight:700, color:on ? '#C8006A' : '#1A1A1A'}}>{opt.label}</div>
                <div style={{fontSize:11, color:'#1A1A1A', fontWeight:400, marginTop:1}}>{opt.sub}</div>
              </div>
            )
          })}
        </div>
        {!deliveryOffered && <p style={{fontSize:12, color:'#1A1A1A', opacity:0.6, marginTop:8}}>This cook offers collection only.</p>}
      </div>

      {/* Delivery postcode + address */}
      {deliveryType === 'delivery' && (
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6}}>Delivery postcode</label>
          <input value={buyerPostcode} onChange={e => setBuyerPostcode(e.target.value)} placeholder="e.g. E3 4SS" autoCapitalize="characters"
            style={{width:'100%', height:42, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#FAFAFA', fontFamily:'Inter,system-ui,sans-serif', outline:'none', textTransform:'uppercase'}}/>
          {/* Live distance/fee feedback */}
          {quote.status === 'checking' && <p style={{fontSize:12, color:'#1A1A1A', opacity:0.7, marginTop:7}}>Checking distance…</p>}
          {quote.status === 'invalid' && <p style={{fontSize:12, color:'#C8006A', fontWeight:600, marginTop:7}}>Enter a valid UK postcode.</p>}
          {quote.status === 'notfound' && <p style={{fontSize:12, color:'#C8006A', fontWeight:600, marginTop:7}}>We couldn&apos;t find that postcode — please check it.</p>}
          {quote.status === 'ok' && <p style={{fontSize:13, color:'#C8006A', fontWeight:700, marginTop:7}}>{quote.distance.toFixed(1)} miles away — delivery £{quote.fee.toFixed(2)}</p>}
          {quote.status === 'unavailable' && <p style={{fontSize:13, color:'#C8006A', fontWeight:700, marginTop:7}}>Delivery not available to your postcode ({quote.distance.toFixed(1)} miles away). Try collection.</p>}
          {quote.status === 'flat' && <p style={{fontSize:12, color:'#1A1A1A', opacity:0.7, marginTop:7}}>Flat delivery £{quote.fee.toFixed(2)} — exact fee calculated at dispatch.</p>}

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:6, marginTop:14}}>
            <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em'}}>Delivery address</label>
            {usingSaved && (
              <span style={{fontSize:11, color:'#2DA84E', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                ✓ Using your saved address
                <button type="button" onClick={clearSavedAddress} style={{background:'none', border:'none', color:'#C8006A', fontSize:11, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0}}>Change</button>
              </span>
            )}
          </div>
          <textarea value={address} onChange={e => { setAddress(e.target.value); if (usingSaved) setUsingSaved(false) }} placeholder="Enter your full delivery address including postcode..." rows={3}
            style={{width:'100%', border:'1.5px solid #E0E0E0', borderRadius:10, padding:'10px 14px', fontSize:14, color:'#1A1A1A', background:'#FAFAFA', fontFamily:'Inter,system-ui,sans-serif', outline:'none', resize:'none', lineHeight:1.55}}/>
        </div>
      )}

      {/* Notes */}
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6}}>Special requests (optional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. extra spicy, no onions..." style={{width:'100%', height:42, border:'1.5px solid #E0E0E0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#FAFAFA', fontFamily:'Inter,system-ui,sans-serif', outline:'none'}}/>
      </div>

      {/* Loyalty points redemption */}
      {user && canRedeem && (
        <div onClick={() => setApplyPoints(v => !v)} className="dt-card" style={{display:'flex', alignItems:'center', gap:12, padding:'13px 15px', border:applyPoints ? '2px solid #C8006A' : '1.5px solid #E0E0E0', borderRadius:12, background:applyPoints ? '#FFE8F4' : '#fff', marginBottom:18}}>
          <div style={{fontSize:22, flexShrink:0}}>⭐</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:700, color:applyPoints ? '#C8006A' : '#1A1A1A'}}>Use {poundsToPoints(redeemablePounds).toLocaleString('en-GB')} points</div>
            <div style={{fontSize:12, color:'#1A1A1A', opacity:0.8, marginTop:1}}>£{redeemablePounds.toFixed(2)} off · you have {pointsBalance.toLocaleString('en-GB')} pts (£{pointsToPounds(pointsBalance).toFixed(2)})</div>
          </div>
          {/* Visual toggle */}
          <div aria-hidden="true" style={{width:42, height:24, borderRadius:100, background:applyPoints ? '#C8006A' : '#E0E0E0', position:'relative', flexShrink:0, transition:'background 0.16s'}}>
            <div style={{position:'absolute', top:2, left:applyPoints ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.16s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
          </div>
        </div>
      )}

      {/* Order summary */}
      <div style={{background:'#F8F0F4', borderRadius:12, padding:'14px 16px', marginBottom:18}}>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6}}>
          <span>Food subtotal (£{price.toFixed(2)} × {quantity})</span>
          <span style={{fontWeight:600}}>£{totalAmount.toFixed(2)}</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6}}>
          <span>Service fee</span>
          <span style={{fontWeight:600}}>£{svcFee.toFixed(2)}</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6}}>
          <span>{deliveryType === 'delivery' ? 'Delivery fee' : 'Collection'}</span>
          <span style={{fontWeight:600}}>
            {deliveryType !== 'delivery' ? 'Free' : deliveryFee !== null ? `£${deliveryFee.toFixed(2)}` : '—'}
          </span>
        </div>
        {discount > 0 && (
          <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'#2DA84E', marginBottom:6, fontWeight:600}}>
            <span>⭐ Points discount ({pointsRedeemed.toLocaleString('en-GB')} pts)</span>
            <span>−£{discount.toFixed(2)}</span>
          </div>
        )}
        <div style={{borderTop:'1px solid rgba(200,0,106,0.12)', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, color:'#1A1A1A'}}>
          <span>Total</span>
          <span style={{color:'#C8006A', fontFamily:'Georgia,serif', fontSize:18}}>£{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {cancelled && (
        <div style={{background:'#FFF4E5', border:'1px solid #F0C77E', borderRadius:12, padding:'12px 14px', marginBottom:12, fontSize:13, color:'#7A4E00', lineHeight:1.5}}>
          Payment cancelled — no charge was made. Your order is still saved, so you can try again whenever you&apos;re ready.
        </div>
      )}

      {/* CTA */}
      {user ? (
        <button onClick={handleOrder} disabled={ordering || !canOrder} className="order-btn"
          style={{width:'100%', height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:(ordering || !canOrder) ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', opacity:(ordering || !canOrder) ? 0.55 : 1}}>
          {redirecting ? 'Redirecting to payment...' : ordering ? 'Placing order...' : !canOrder ? 'Enter a deliverable postcode' : `Order for £${grandTotal.toFixed(2)} →`}
        </button>
      ) : (
        <div>
          <Link href="/login" className="order-btn" style={{display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:52, background:'#C8006A', color:'#fff', borderRadius:12, fontSize:16, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)', marginBottom:10}}>
            Sign in to order →
          </Link>
          <p style={{textAlign:'center', fontSize:12, color:'#1A1A1A'}}>Don&apos;t have an account? <Link href="/register" style={{color:'#C8006A', fontWeight:600}}>Register free</Link></p>
        </div>
      )}

      <p style={{textAlign:'center', fontSize:11, color:'#1A1A1A', marginTop:12, lineHeight:1.5}}>🔒 Secured by Stripe · Buyer protection on every order</p>
    </div>
  )

  // ── MAIN ──
  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div className="page-wrap" style={{maxWidth:1100, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="dish-grid" style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start'}}>

          {/* ── LEFT: dish info ── */}
          <div className="fade-up">

            {/* Hero image area */}
            <div style={{background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', borderRadius:20, height:'clamp(220px,32vw,300px)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(72px,12vw,108px)', marginBottom:20, position:'relative', overflow:'hidden', boxShadow:'0 4px 24px rgba(200,0,106,0.08)'}}>
              {listing.image_url
                ? <img src={listing.image_url} alt={listing.name} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />
                : <>
                    <div style={{position:'absolute', inset:0, background:'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5), transparent 60%)', pointerEvents:'none'}}/>
                    <span style={{position:'relative', filter:'drop-shadow(0 8px 20px rgba(200,0,106,0.18))'}}>{cuisineEmoji[listing.cuisine] || '🍽️'}</span>
                  </>}
              {listing.featured && (
                <div style={{position:'absolute', top:16, left:16, background:'#C8006A', color:'#fff', fontSize:11, fontWeight:800, padding:'5px 13px', borderRadius:100, boxShadow:'0 4px 12px rgba(200,0,106,0.35)', letterSpacing:'0.02em'}}>🔥 Featured</div>
              )}
              <button onClick={toggleSave} aria-label={isSaved ? 'Remove from saved' : 'Save dish'} className="save-btn" style={{position:'absolute', top:16, right:16, width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, cursor:'pointer', boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}>
                {isSaved ? '❤️' : '🤍'}
              </button>
            </div>

            {/* Dish details */}
            <div style={{background:'#fff', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:14, flexWrap:'wrap'}}>
                <div style={{minWidth:0}}>
                  <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,30px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:8}}>{listing.name}</h1>
                  <div style={{fontSize:13, color:'#1A1A1A', display:'flex', alignItems:'center', gap:7, fontWeight:500}}>
                    <div style={{width:24, height:24, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0}}>{initial}</div>
                    {seller?.full_name || 'Home cook'}
                    <span style={{background:'#FFE8F4', color:'#C8006A', padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>{listing.cuisine}</span>
                  </div>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em', lineHeight:1}}>£{price.toFixed(2)}</div>
                  <div style={{fontSize:12, color:'#1A1A1A', marginTop:4}}>per portion{listing.serves ? ` · serves ${listing.serves}` : ''}</div>
                </div>
              </div>

              {reviews > 0 && (
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:16, borderBottom:'1px solid #F5F0F3'}}>
                  <span style={{color:'#C8006A', fontSize:17, letterSpacing:'1px'}}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
                  <span style={{fontSize:15, fontWeight:700, color:'#1A1A1A'}}>{rating}</span>
                  <span style={{fontSize:13, color:'#1A1A1A'}}>· {reviews} {reviews === 1 ? 'review' : 'reviews'}</span>
                </div>
              )}

              {listing.description && (
                <p style={{fontSize:15, color:'#1A1A1A', lineHeight:1.75, marginBottom:18}}>{listing.description}</p>
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
                  <div key={i} className="info-card" style={{background:'#F8F0F4', borderRadius:12, padding:'13px 15px'}}>
                    <div style={{fontSize:11, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4}}>{item.icon} {item.label}</div>
                    <div style={{fontSize:13, fontWeight:600, color:'#1A1A1A', lineHeight:1.35}}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* About the cook */}
            <div style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:18}}>About the cook</h2>
              <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:18}}>
                <div style={{width:56, height:56, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#fff', flexShrink:0, boxShadow:'0 4px 16px rgba(200,0,106,0.33)'}}>
                  {initial}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
                    <span style={{fontSize:16, fontWeight:700, color:'#1A1A1A'}}>{seller?.full_name || 'Home cook'}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:4, background:'#E4F6EA', color:'#2DA84E', padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:700}}>✓ Verified</span>
                  </div>
                  <div style={{fontSize:13, color:'#1A1A1A'}}>{listing.cuisine} specialist · ID & hygiene checked</div>
                </div>
              </div>
              <div style={{display:'flex', gap:0, background:'#F8F0F4', borderRadius:12, padding:'14px 0'}}>
                {[
                  { v: reviews > 0 ? `★${rating}` : '★ New', l: 'Rating' },
                  { v: String(reviews), l: reviews === 1 ? 'Review' : 'Reviews' },
                  { v: String(orderCount), l: orderCount === 1 ? 'Order' : 'Orders' },
                ].map((s, i) => (
                  <div key={i} style={{flex:1, textAlign:'center', borderLeft: i > 0 ? '1px solid rgba(200,0,106,0.1)' : 'none'}}>
                    <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:10, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:5}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: order panel (sticky desktop / below on mobile) ── */}
          <div className="order-panel fade-up" style={{position:'sticky', top:82}}>
            {orderPanel}
          </div>

        </div>
      </div>

      {/* ── MOBILE BOTTOM ACTION BAR ── */}
      <div className="mobile-bar" style={{position:'fixed', bottom:0, left:0, right:0, zIndex:400, background:'rgba(255,255,255,0.98)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid rgba(200,0,106,0.12)', boxShadow:'0 -6px 24px rgba(200,0,106,0.1)', padding:'12px 18px', alignItems:'center', gap:14}}>
        <div style={{flexShrink:0}}>
          <div style={{fontSize:11, color:'#1A1A1A', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>Total</div>
          <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A', lineHeight:1}}>£{grandTotal.toFixed(2)}</div>
        </div>
        {user ? (
          <button onClick={handleOrder} disabled={ordering || !canOrder} className="order-btn" style={{flex:1, height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:(ordering || !canOrder) ? 'not-allowed' : 'pointer', boxShadow:'0 6px 18px rgba(200,0,106,0.3)', opacity:(ordering || !canOrder) ? 0.55 : 1}}>
            {redirecting ? 'Redirecting...' : ordering ? 'Placing...' : !canOrder ? 'Enter postcode' : 'Order now →'}
          </button>
        ) : (
          <Link href="/login" className="order-btn" style={{flex:1, height:50, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 18px rgba(200,0,106,0.3)'}}>
            Sign in to order →
          </Link>
        )}
      </div>
    </div>
  )
}
