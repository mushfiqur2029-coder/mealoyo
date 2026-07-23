'use client'
import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { useCartStore } from '@/lib/cartStore'
import { playBeep, requestNotificationPermission, showPushNotification } from '@/lib/notifications'
import type { Order, Listing, Profile } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const statusSteps = ['pending', 'accepted', 'cooking', 'ready', 'picked_up', 'reached', 'delivered']
const statusLabels: Record<string, string> = {
  pending_payment: 'Order placed',
  pending: 'Order placed',
  accepted: 'Cook accepted',
  cooking: 'Being cooked',
  ready: 'Ready for pickup',
  picked_up: 'Out for delivery',
  reached: 'Driver is at your door',
  delivered: 'Delivered',
}
const statusShort: Record<string, string> = {
  pending: 'Placed',
  accepted: 'Accepted',
  cooking: 'Cooking',
  ready: 'Ready',
  picked_up: 'On its way',
  reached: 'Arrived',
  delivered: 'Delivered',
}
const statusIcons: Record<string, string> = {
  pending_payment: '🕐', pending: '🕐', accepted: '✅', cooking: '👩‍🍳', ready: '📦', picked_up: '🚴', reached: '🚪', delivered: '🏠',
}
// Simple, friendly estimated delivery / progress message per status.
const etaMessages: Record<string, string> = {
  pending_payment: 'Confirming your payment…',
  pending: 'Waiting for cook to accept',
  accepted: 'Cook accepted — preparing your food',
  cooking: 'Being cooked fresh for you — ready in ~45 mins',
  ready: 'Ready — driver will collect shortly',
  picked_up: 'On the way to you — arriving soon',
  reached: 'Driver is here — read out your delivery code',
  delivered: 'Delivered — enjoy your meal!',
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Pick<Profile, 'full_name'> | null>(null)
  // Sibling rows from the same cart checkout (share stripe_session_id).
  // Empty for single-item / non-cart orders; the primary row's own listing
  // is always in the list, so cartItems.length is 1 for singletons.
  const [cartItems, setCartItems] = useState<Array<{
    id: string
    listing_id: string | null
    listing_name: string | null
    listing_image: string | null
    quantity: number
    line_total: number
  }>>([])
  // Coarse collection address (address_line1 + city) — shown prominently for
  // collection orders. Fetched via the definer RPC since the base column grant
  // hides these fields from cross-user reads.
  const [sellerCollectionAddress, setSellerCollectionAddress] = useState<{ address_line1: string | null; city: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [justReviewed, setJustReviewed] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Pulsing status banner + ref to the delivery-code card so we can scroll
  // it into view the moment the driver marks the order as "reached".
  const [statusBanner, setStatusBanner] = useState<{ text: string; tone: 'onway' | 'arrived' } | null>(null)
  const deliveryCodeRef = useRef<HTMLDivElement | null>(null)
  // Scrolled to when Stripe redirects back with ?payment=success, so the
  // buyer lands looking at the status hero (with the "Payment confirmed!"
  // banner sitting just above it) instead of at the top of the page nav.
  const statusHeroRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  // Celebrate a fresh Stripe payment when Checkout redirects back with
  // ?payment=success. Also clear the cart — the checkout that produced this
  // order has finished, so anything left in the local cart is stale.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment') === 'success') {
      useCartStore.getState().clearCart()
      const id = requestAnimationFrame(() => setPaymentSuccess(true))
      return () => cancelAnimationFrame(id)
    }
  }, [])

  // Once the order has loaded AND we know we came back from a successful
  // Stripe checkout, gently scroll the status hero into view. Deferred a tick
  // so React can paint the hero card before we ask the browser to scroll to
  // it. Only fires once — hence the paymentSuccess + order gate below runs
  // as an effect, not on every render.
  useEffect(() => {
    if (!paymentSuccess || !order) return
    const id = requestAnimationFrame(() => {
      statusHeroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [paymentSuccess, order])

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .eq('buyer_id', user.id)
        .single()

      if (!order) { setNotFound(true); setLoading(false); return }
      setOrder(order)
      // If the buyer reloaded the page mid-delivery, resurrect the banner so
      // they still see the "arrived / on the way" call-out — AND scroll to
      // the delivery code so it's not below the fold when the driver is
      // literally at the door.
      if (order.status === 'reached' && order.delivery_type === 'delivery') {
        setStatusBanner({ text: '🚪 Your driver is at the door! Show them your delivery code', tone: 'arrived' })
        setTimeout(() => {
          deliveryCodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 160)
      } else if (order.status === 'picked_up' && order.delivery_type === 'delivery') {
        setStatusBanner({ text: 'Your order has been picked up and is on its way!', tone: 'onway' })
      }
      // Backstop loyalty award: if the order is already delivered, make sure
      // points were granted. Idempotent DB-side; no-ops until the SQL is run.
      if (order.status === 'delivered') supabase.rpc('award_loyalty_points', { p_order_id: order.id })

      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name)')
        .eq('id', order.listing_id)
        .single()

      setListing(listing)
      setSeller(listing?.profiles ?? null)

      // Cart siblings — every row from the same Stripe session. RLS on
      // orders scopes to buyer_id already; the redundant .eq is defensive.
      // Falls back to just this order if the row has no session_id
      // (single-item /api/orders/create flow, or a legacy pre-cart row).
      if (order.stripe_session_id) {
        const { data: sibs } = await supabase
          .from('orders')
          .select('id, listing_id, quantity, total_amount, service_fee, delivery_fee, listings(name, image_url)')
          .eq('stripe_session_id', order.stripe_session_id)
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: true })
        type SibRow = {
          id: string
          listing_id: string | null
          quantity: number
          total_amount: string | null
          service_fee: string | null
          delivery_fee: string | null
          listings: { name: string | null; image_url: string | null } | null
        }
        const rows = (sibs as SibRow[] | null) || []
        if (rows.length) {
          setCartItems(rows.map(r => ({
            id: r.id,
            listing_id: r.listing_id,
            listing_name: r.listings?.name ?? null,
            listing_image: r.listings?.image_url ?? null,
            quantity: r.quantity,
            // Line total = row total minus its share of service/delivery fees
            // (only the primary carries those; siblings have 0/0).
            line_total: parseFloat(r.total_amount || '0') - parseFloat(r.service_fee || '0') - parseFloat(r.delivery_fee || '0'),
          })))
        }
      }
      // Fetch the coarse collection address once we know the seller. This is
      // safe for the buyer to see — they've just ordered from this seller.
      if (listing?.seller_id) {
        const { data: addrRow } = await supabase.rpc('get_seller_public_address', { p_seller_id: listing.seller_id })
        const first = Array.isArray(addrRow) && addrRow.length > 0 ? addrRow[0] : null
        if (first) setSellerCollectionAddress({ address_line1: first.address_line1 ?? null, city: first.city ?? null })
      }

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', id)
        .single()

      if (existingReview) setReviewed(true)
      setLoading(false)
    }
    getData()
  }, [id, router])

  // Ticker for whichever handover-code countdown is currently visible.
  useEffect(() => {
    const collectionActive = order?.status === 'ready' && order?.delivery_type === 'collection' && !!order?.collection_code_expires_at
    const deliveryActive = (order?.status === 'picked_up' || order?.status === 'reached') && order?.delivery_type === 'delivery' && !!order?.delivery_code_expires_at
    if (!collectionActive && !deliveryActive) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [order?.status, order?.delivery_type, order?.collection_code_expires_at, order?.delivery_code_expires_at])

  // Ask for notification permission on mount so buyer alerts don't get
  // silently dropped when the driver events fire.
  useEffect(() => {
    void requestNotificationPermission()
  }, [])

  // Higher-pitch tone (1000 Hz) for the "your driver arrived" moment so the
  // buyer's ear can distinguish it from the 880 Hz "picked up" signal, per
  // the notifications-lib convention.
  const notifyBuyer = (title: string, body: string, tone: 'onway' | 'arrived' = 'onway') => {
    playBeep(tone === 'arrived' ? 1000 : 880, 0.35, 0.6)
    showPushNotification(title, body)
  }

  // ── REALTIME: live status updates from the seller, no refresh needed ──
  useEffect(() => {
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          // Merge the new base-order columns over existing state, keeping the
          // already-joined listing/seller data we loaded on mount.
          const prevRow = payload.old as Partial<Order>
          const next = payload.new as Order
          setOrder(prev => (prev ? { ...prev, ...next } : prev))
          // Award points live the moment the status flips to delivered.
          if (next.status === 'delivered') supabase.rpc('award_loyalty_points', { p_order_id: next.id })
          // Buyer notifications — bracketed by "was this different before?"
          // so a page reload doesn't re-fire them on the same row state.
          if (prevRow.status !== 'picked_up' && next.status === 'picked_up' && next.delivery_type === 'delivery') {
            notifyBuyer('Your order is on the way! 🚴', 'Driver is heading to you.', 'onway')
            setStatusBanner({ text: 'Your order has been picked up and is on its way!', tone: 'onway' })
          }
          if (prevRow.status !== 'reached' && next.status === 'reached' && next.delivery_type === 'delivery') {
            notifyBuyer('Your driver has arrived! 🚪', 'Show them your delivery code.', 'arrived')
            setStatusBanner({ text: '🚪 Your driver is at the door! Show them your delivery code', tone: 'arrived' })
            // Give React a tick to render the code card, then scroll it into view.
            setTimeout(() => {
              deliveryCodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 120)
          }
          // Delivery code just appeared (driver generated it without status flip).
          if (!prevRow.delivery_code && next.delivery_code && next.delivery_type === 'delivery' && next.status !== 'reached') {
            notifyBuyer('Delivery code ready! 🏠', 'Your driver is nearby — open your order to see your code.', 'onway')
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const submitReview = async () => {
    if (rating === 0 || !order) return
    setSubmittingReview(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('reviews').insert({
      order_id: order.id,
      buyer_id: user!.id,
      seller_id: order.seller_id,
      rating,
      comment: comment.trim() || null,
      verified: true,
    })
    setReviewed(true)
    setJustReviewed(true)
    setSubmittingReview(false)
  }

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(200,0,106,0.45); } 70% { box-shadow: 0 0 0 10px rgba(200,0,106,0); } 100% { box-shadow: 0 0 0 0 rgba(200,0,106,0); } }
      @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); } 70% { box-shadow: 0 0 0 9px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
      @keyframes checkPop { 0% { transform: scale(0); opacity: 0; } 55% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes checkRing { 0% { box-shadow: 0 0 0 0 rgba(45,168,78,0.45); } 70% { box-shadow: 0 0 0 14px rgba(45,168,78,0); } 100% { box-shadow: 0 0 0 0 rgba(45,168,78,0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      html { scroll-behavior: smooth; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      textarea:focus { border-color: #C8006A !important; outline: none; background: #fff !important; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .star { transition: transform 0.14s cubic-bezier(0.34,1.4,0.64,1), color 0.14s; cursor: pointer; }
      .star:hover { transform: scale(1.18); }
      .prim-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .prim-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .ghost-btn:hover { border-color: #C8006A !important; color: #C8006A !important; }
      .back-btn:hover { border-color: #C8006A !important; color: #C8006A !important; }
      @media (max-width: 860px) {
        .order-grid { grid-template-columns: 1fr !important; }
        .pay-panel { position: static !important; }
      }
      @media (max-width: 600px) {
        .step-label { display: none !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:66}}>
      <div style={{maxWidth:1040, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center', gap:14}}>
        <Link href="/buyer/orders" className="back-btn" aria-label="Back to orders" style={{width:38, height:38, border:'1.5px solid var(--border-subtle)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'var(--text-primary)', flexShrink:0, transition:'all 0.14s'}}>←</Link>
        <Link href="/" style={{flexShrink:0}}><Logo height={34}/></Link>
        {order && <span style={{fontSize:14, color:'var(--text-primary)', fontWeight:500, marginLeft:4, whiteSpace:'nowrap'}}>· Order #{order.id.slice(0, 8).toUpperCase()}</span>}
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1040, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="skel" style={{height:150, borderRadius:20, marginBottom:20}}/>
        <div className="order-grid" style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:20}}>
          <div>
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, marginBottom:16, border:'1.5px solid var(--border-subtle)'}}>
              <div className="skel" style={{height:20, borderRadius:8, width:'40%', marginBottom:18}}/>
              <div style={{display:'flex', gap:16}}>
                <div className="skel" style={{width:64, height:64, borderRadius:14, flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div className="skel" style={{height:15, borderRadius:6, width:'60%', marginBottom:8}}/>
                  <div className="skel" style={{height:12, borderRadius:6, width:'40%', marginBottom:8}}/>
                  <div className="skel" style={{height:12, borderRadius:6, width:'50%'}}/>
                </div>
              </div>
            </div>
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, border:'1.5px solid var(--border-subtle)'}}>
              <div className="skel" style={{height:20, borderRadius:8, width:'40%', marginBottom:20}}/>
              {Array.from({length:4}).map((_, i) => (
                <div key={i} style={{display:'flex', gap:12, marginBottom:16, alignItems:'center'}}>
                  <div className="skel" style={{width:32, height:32, borderRadius:'50%', flexShrink:0}}/>
                  <div className="skel" style={{height:13, borderRadius:6, width:'45%'}}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'var(--bg-card)', borderRadius:20, padding:24, border:'1.5px solid var(--border-subtle)'}}>
            <div className="skel" style={{height:20, borderRadius:8, width:'55%', marginBottom:20}}/>
            <div className="skel" style={{height:13, borderRadius:6, width:'100%', marginBottom:12}}/>
            <div className="skel" style={{height:13, borderRadius:6, width:'80%', marginBottom:20}}/>
            <div className="skel" style={{height:42, borderRadius:10, width:'100%', marginBottom:10}}/>
            <div className="skel" style={{height:42, borderRadius:10, width:'100%'}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── ERROR / NOT FOUND ──
  if (notFound || !order) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:560, margin:'0 auto', padding:'72px 20px'}}>
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4 0%,var(--bg-secondary) 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 22px'}}>🧾</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Order not found</h1>
          <p style={{fontSize:15, color:'var(--text-primary)', lineHeight:1.7, marginBottom:28, maxWidth:380, margin:'0 auto 28px'}}>We couldn&apos;t find this order on your account. It may have been removed, or the link is incorrect.</p>
          <Link href="/buyer/orders" className="prim-btn" style={{display:'inline-flex', alignItems:'center', height:52, padding:'0 30px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>
            View your orders →
          </Link>
        </div>
      </div>
    </div>
  )

  // A brand-new paid order may still read 'pending_payment' for the few seconds
  // until the Stripe webpage → webhook flips it to 'pending'; show it as placed.
  const displayStatus = order.status === 'pending_payment' ? 'pending' : order.status
  const currentStep = statusSteps.indexOf(displayStatus)
  const delivered = order.status === 'delivered'
  const emoji = cuisineEmoji[listing?.cuisine || 'Other'] || '🍽️'
  const deliveryFee = parseFloat(order.delivery_fee)
  const serviceFeeAmt = parseFloat(order.service_fee || '0')
  const total = parseFloat(order.total_amount)
  const subtotal = total - deliveryFee - serviceFeeAmt
  const isDelivery = order.delivery_type === 'delivery'
  const showCollectionCode = order.status === 'ready' && order.delivery_type === 'collection'
  const showDeliveryCode = (order.status === 'picked_up' || order.status === 'reached') && order.delivery_type === 'delivery'

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1040, margin:'0 auto', padding:'28px 20px 48px'}}>

        {/* ── PAYMENT SUCCESS BANNER ── */}
        {paymentSuccess && (
          <div className="fade-up" style={{display:'flex', alignItems:'center', gap:14, background:'#EAF7EE', border:'1px solid #A8DDB8', borderRadius:16, padding:'16px 18px', marginBottom:16}}>
            <div style={{width:44, height:44, borderRadius:'50%', background:'#2DA84E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, animation:'checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, checkRing 1.6s ease-out 0.3s 2'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#157A33', lineHeight:1.2}}>Payment confirmed!</div>
              <div style={{fontSize:13.5, color:'#2A6B3E', marginTop:2}}>Your order has been placed.</div>
            </div>
          </div>
        )}

        {/* ── STATUS HERO BANNER ── */}
        <div ref={statusHeroRef} className="fade-up" style={{background:delivered ? 'linear-gradient(135deg,#2DA84E 0%,#157A33 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', borderRadius:20, padding:'30px 28px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden', boxShadow:delivered ? '0 12px 36px rgba(45,168,78,0.28)' : '0 12px 36px rgba(200,0,106,0.28)'}}>
          <div style={{position:'absolute', top:'-40%', right:'-5%', width:'45%', height:'200%', background:'radial-gradient(ellipse, rgba(255,255,255,0.1), transparent 65%)', pointerEvents:'none'}}/>
          <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:26, position:'relative'}}>
            <div style={{width:60, height:60, borderRadius:18, background:'rgba(255,255,255,0.16)', border:'1px solid rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0}}>{statusIcons[order.status]}</div>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>{delivered ? 'Order complete' : 'Order status'}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,28px)', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1.1}}>{statusLabels[order.status]}</div>
            </div>
          </div>

          {/* Estimated delivery / progress message */}
          <div style={{position:'relative', display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:100, padding:'8px 16px', marginBottom:22}}>
            {!delivered && <span style={{width:8, height:8, borderRadius:'50%', background:'var(--bg-card)', flexShrink:0, animation:'pulseRing 1.8s ease-out infinite'}}/>}
            <span style={{fontSize:13.5, fontWeight:600, color:'#fff'}}>{delivered ? '🎉 ' : '⏱ '}{etaMessages[order.status] || 'Tracking your order'}</span>
          </div>

          {/* ── PROGRESS STEPS ── */}
          <div style={{display:'flex', position:'relative'}}>
            {statusSteps.map((step, i) => {
              const done = i <= currentStep
              const isCurrent = i === currentStep && !delivered
              return (
                <div key={step} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative'}}>
                  {/* connector to the left */}
                  {i > 0 && (
                    <div style={{position:'absolute', top:16, right:'50%', width:'100%', height:3, borderRadius:2, background:done ? '#fff' : 'rgba(255,255,255,0.25)', transition:'background 0.3s'}}/>
                  )}
                  <div style={{position:'relative', zIndex:1, width:34, height:34, borderRadius:'50%', background:done ? '#fff' : 'rgba(255,255,255,0.16)', border:done ? 'none' : '1.5px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, transition:'all 0.3s', animation:isCurrent ? 'pulseRing 1.8s ease-out infinite' : 'none'}}>
                    {done ? <span style={{color:delivered ? '#157A33' : '#C8006A', fontSize:15, fontWeight:800}}>{i < currentStep || delivered ? '✓' : ''}</span> : null}
                    {done && (i === currentStep && !delivered) && <span style={{color:'#C8006A', fontSize:13}}>{statusIcons[step]}</span>}
                    {!done && <span style={{color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:700}}>{i + 1}</span>}
                  </div>
                  <span className="step-label" style={{marginTop:8, fontSize:11, fontWeight:done ? 700 : 500, color:done ? '#fff' : 'rgba(255,255,255,0.6)', textAlign:'center', whiteSpace:'nowrap'}}>{statusShort[step]}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="order-grid" style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:20}}>

          {/* ── LEFT COLUMN ── */}
          <div className="fade-up">

            {/* Pulsing status banner — surfaced when the driver picks up or
                arrives. Auto-dismissed only via a page navigation; stays
                visible so the buyer doesn't miss it if they were scrolled
                past the code card. */}
            {statusBanner && (
              <div
                role="status"
                style={{
                  marginBottom: 16,
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: statusBanner.tone === 'arrived' ? 'linear-gradient(135deg,#FFE8F4 0%,#FFD3EA 100%)' : 'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)',
                  border: statusBanner.tone === 'arrived' ? '2px solid #C8006A' : '1.5px solid rgba(200,0,106,0.35)',
                  fontSize: 14, fontWeight: 700,
                  color: statusBanner.tone === 'arrived' ? '#8B0047' : '#8B0047',
                  animation: statusBanner.tone === 'arrived' ? 'buyerArrivedPulse 1.2s ease-in-out infinite' : 'fadeUp 0.4s ease',
                  boxShadow: statusBanner.tone === 'arrived' ? '0 8px 24px rgba(200,0,106,0.22)' : '0 4px 14px rgba(200,0,106,0.14)',
                }}
              >
                {statusBanner.text}
                <style>{`
                  @keyframes buyerArrivedPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(200,0,106,0.55); }
                    50%      { box-shadow: 0 0 0 10px rgba(200,0,106,0); }
                  }
                `}</style>
              </div>
            )}

            {/* Delivery code — delivery-only, shown once the driver has picked up */}
            {showDeliveryCode && (() => {
              const code = order.delivery_code
              const expiresMs = order.delivery_code_expires_at ? new Date(order.delivery_code_expires_at).getTime() - now : 0
              const expired = code && expiresMs <= 0
              const totalSec = Math.max(0, Math.floor(expiresMs / 1000))
              const mm = Math.floor(totalSec / 60).toString().padStart(2, '0')
              const ss = (totalSec % 60).toString().padStart(2, '0')
              return (
                <div ref={deliveryCodeRef} style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'26px 24px', marginBottom:16, border:'1.5px solid rgba(200,0,106,0.22)', boxShadow:'0 6px 22px rgba(200,0,106,0.14)'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
                    <span style={{width:38, height:38, borderRadius:11, background:'#C8006A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>🛵</span>
                    <div>
                      <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.01em'}}>Your driver is on the way!</div>
                      <div style={{fontSize:13, color:'#8B0047', fontWeight:600, marginTop:2}}>Show this 4-digit code to your driver to confirm delivery</div>
                    </div>
                  </div>

                  {code ? (
                    <>
                      <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:14, flexWrap:'wrap'}}>
                        {code.split('').map((d, i) => (
                          <span key={i} style={{width:38, height:54, borderRadius:10, background:'var(--bg-card)', border:'2px solid rgba(200,0,106,0.3)', boxShadow:'0 2px 10px rgba(200,0,106,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em', minWidth:0}}>{d}</span>
                        ))}
                      </div>
                      <div style={{textAlign:'center', fontSize:13, fontWeight:700, color:expired ? '#C0392B' : '#8B0047'}}>
                        {expired ? '⚠ Code expired — ask the driver to generate a new one' : `Code expires in ${mm}:${ss}`}
                      </div>
                    </>
                  ) : (
                    <div style={{textAlign:'center', padding:'22px 8px'}}>
                      <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.65)', border:'1.5px solid rgba(200,0,106,0.2)', borderRadius:100, padding:'10px 18px', fontSize:13.5, fontWeight:700, color:'#8B0047'}}>
                        <span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#C8006A', animation:'pulseDot 1.6s ease-out infinite'}}/>
                        Waiting for driver to generate your delivery code…
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Collection code — pickup-only, shown once the cook marks the order ready */}
            {showCollectionCode && (() => {
              const code = order.collection_code
              const expiresMs = order.collection_code_expires_at ? new Date(order.collection_code_expires_at).getTime() - now : 0
              const expired = code && expiresMs <= 0
              const totalSec = Math.max(0, Math.floor(expiresMs / 1000))
              const mm = Math.floor(totalSec / 60).toString().padStart(2, '0')
              const ss = (totalSec % 60).toString().padStart(2, '0')
              return (
                <div style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'26px 24px', marginBottom:16, border:'1.5px solid rgba(200,0,106,0.22)', boxShadow:'0 6px 22px rgba(200,0,106,0.14)'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
                    <span style={{width:38, height:38, borderRadius:11, background:'#C8006A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>📍</span>
                    <div>
                      <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.01em'}}>Your order is ready for collection!</div>
                      <div style={{fontSize:13, color:'#8B0047', fontWeight:600, marginTop:2}}>Show this code to your cook to confirm collection</div>
                    </div>
                  </div>

                  {code ? (
                    <>
                      <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:14, flexWrap:'wrap'}}>
                        {code.split('').map((d, i) => (
                          <span key={i} style={{width:38, height:54, borderRadius:10, background:'var(--bg-card)', border:'2px solid rgba(200,0,106,0.3)', boxShadow:'0 2px 10px rgba(200,0,106,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em', minWidth:0}}>{d}</span>
                        ))}
                      </div>
                      <div style={{textAlign:'center', fontSize:13, fontWeight:700, color:expired ? '#C0392B' : '#8B0047'}}>
                        {expired ? '⚠ Code expired — ask the cook to generate a new one' : `Code expires in ${mm}:${ss}`}
                      </div>
                    </>
                  ) : (
                    <div style={{textAlign:'center', padding:'22px 8px'}}>
                      <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.65)', border:'1.5px solid rgba(200,0,106,0.2)', borderRadius:100, padding:'10px 18px', fontSize:13.5, fontWeight:700, color:'#8B0047'}}>
                        <span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#C8006A', animation:'pulseDot 1.6s ease-out infinite'}}/>
                        Waiting for cook to generate your collection code…
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Collection point — prominent card for collection orders once
                the seller has been fetched. */}
            {!isDelivery && sellerCollectionAddress && sellerCollectionAddress.address_line1 && (
              <div className="fade-up" style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'22px 24px', marginBottom:16, border:'1.5px solid rgba(200,0,106,0.22)', boxShadow:'0 6px 22px rgba(200,0,106,0.12)'}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
                  <span style={{width:44, height:44, borderRadius:12, background:'#C8006A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0}}>📍</span>
                  <div>
                    <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', lineHeight:1.2}}>Collection point</div>
                    <div style={{fontSize:12.5, color:'#8B0047', fontWeight:600, marginTop:2}}>Pick up from {seller?.full_name || 'the cook'}</div>
                  </div>
                </div>
                <div style={{background:'var(--bg-card)', borderRadius:12, padding:'14px 16px', fontSize:15, fontWeight:700, color:'var(--text-primary)', lineHeight:1.45}}>
                  {sellerCollectionAddress.address_line1}
                  {sellerCollectionAddress.city ? `, ${sellerCollectionAddress.city}` : ''}
                </div>
                <p style={{fontSize:12, color:'#8B0047', marginTop:10, lineHeight:1.55}}>You&apos;ll receive the exact collection details (buzzer, entry code) when the cook marks your order ready.</p>
              </div>
            )}

            {/* Order details — single dish or full cart items list */}
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border-subtle)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:cartItems.length > 1 ? 6 : 18}}>
                {cartItems.length > 1 ? `Your order · ${cartItems.length} items from ${seller?.full_name || 'this cook'}` : 'Order details'}
              </h2>
              {cartItems.length > 1 ? (
                <>
                  <div style={{fontSize:13, color:'var(--text-secondary)', marginBottom:16}}>
                    {cartItems.reduce((s, i) => s + i.quantity, 0)} dishes total
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
                    {cartItems.map(item => (
                      <div key={item.id} style={{display:'flex', gap:14, alignItems:'center', padding:'10px 12px', background:'var(--bg-page)', borderRadius:12}}>
                        <div style={{width:52, height:52, borderRadius:12, background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden'}}>
                          {item.listing_image
                            /* eslint-disable-next-line @next/next/no-img-element -- supabase storage URL, remotePatterns already permissive */
                            ? <img src={item.listing_image} alt={item.listing_name || ''} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                            : <span style={{fontSize:24}}>🍽️</span>}
                        </div>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {item.quantity}× {item.listing_name || 'Dish'}
                          </div>
                        </div>
                        <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>£{item.line_total.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:isDelivery || order.notes ? 16 : 0}}>
                    <span style={{background:'#FFE8F4', color:'#C8006A', padding:'4px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>{isDelivery ? '🚴 Delivery' : '📍 Collection'}</span>
                  </div>
                </>
              ) : (
                <div style={{display:'flex', gap:16, marginBottom:order.notes || isDelivery ? 16 : 0, alignItems:'flex-start'}}>
                  <div style={{width:68, height:68, borderRadius:16, background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, flexShrink:0}}>{emoji}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:3}}>{listing?.name || 'Dish'}</div>
                    <div style={{fontSize:13, color:'var(--text-primary)', marginBottom:8}}>by {seller?.full_name || 'Home cook'}</div>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      <span style={{background:'var(--bg-page)', color:'var(--text-primary)', padding:'4px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>Qty: {order.quantity}</span>
                      <span style={{background:'#FFE8F4', color:'#C8006A', padding:'4px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>{isDelivery ? '🚴 Delivery' : '📍 Collection'}</span>
                    </div>
                  </div>
                </div>
              )}
              {isDelivery && order.delivery_address && (
                <div style={{background:'var(--bg-page)', borderRadius:12, padding:'12px 15px', fontSize:13, color:'var(--text-primary)', lineHeight:1.55, marginBottom:order.notes ? 10 : 0}}>
                  <span style={{fontWeight:700, color:'#C8006A'}}>📍 Delivery address</span><br/>{order.delivery_address}
                </div>
              )}
              {order.notes && (
                <div style={{background:'var(--bg-page)', borderRadius:12, padding:'12px 15px', fontSize:13, color:'var(--text-primary)', lineHeight:1.55}}>
                  <span style={{fontWeight:700, color:'#C8006A'}}>📝 Special request</span><br/>{order.notes}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border-subtle)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:20}}>Order timeline</h2>
              {statusSteps.map((step, i) => {
                const done = i <= currentStep
                const isCurrent = i === currentStep
                const last = i === statusSteps.length - 1
                return (
                  <div key={step} style={{display:'flex', gap:14}}>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div style={{width:34, height:34, borderRadius:'50%', background:done ? '#C8006A' : 'var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, transition:'background 0.3s', animation:isCurrent && !delivered ? 'pulseDot 1.8s ease-out infinite' : 'none'}}>
                        {done ? <span style={{fontSize:15}}>{statusIcons[step]}</span> : <span style={{color:'var(--text-primary)', fontSize:12, fontWeight:700, opacity:0.4}}>{i + 1}</span>}
                      </div>
                      {!last && <div style={{width:2.5, flex:1, background:i < currentStep ? '#C8006A' : 'var(--border-subtle)', minHeight:26, marginTop:4, marginBottom:4, transition:'background 0.3s'}}/>}
                    </div>
                    <div style={{paddingTop:7, paddingBottom:last ? 0 : 14}}>
                      <div style={{fontSize:14, fontWeight:done ? 700 : 500, color:'var(--text-primary)', opacity:done ? 1 : 0.45}}>{statusLabels[step]}</div>
                      {isCurrent && !delivered && <div style={{fontSize:12, color:'#C8006A', fontWeight:700, marginTop:3}}>● In progress</div>}
                      {isCurrent && delivered && <div style={{fontSize:12, color:'#2DA84E', fontWeight:700, marginTop:3}}>✓ Completed</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Review — only delivered & not yet reviewed */}
            {delivered && !reviewed && (
              <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.1)'}}>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>Rate your order</h2>
                <p style={{fontSize:14, color:'var(--text-primary)', marginBottom:18}}>How was {seller?.full_name || 'the cook'}&apos;s food?</p>
                <div style={{display:'flex', gap:8, marginBottom:18}} onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className="star" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)}
                      style={{fontSize:38, color:star <= (hoverRating || rating) ? '#C8006A' : 'var(--border-subtle)'}}>★</span>
                  ))}
                </div>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell others what you thought (optional)..." rows={3}
                  style={{width:'100%', border:'1.5px solid var(--border-subtle)', borderRadius:12, padding:'12px 15px', fontSize:14, color:'var(--text-primary)', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif', outline:'none', resize:'none', lineHeight:1.55, marginBottom:14}}/>
                <button onClick={submitReview} disabled={rating === 0 || submittingReview} className={rating === 0 ? '' : 'prim-btn'}
                  style={{height:48, padding:'0 26px', background:rating === 0 ? 'var(--border-subtle)' : '#C8006A', color:rating === 0 ? 'var(--text-primary)' : '#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:rating === 0 || submittingReview ? 'not-allowed' : 'pointer', boxShadow:rating === 0 ? 'none' : '0 6px 18px rgba(200,0,106,0.28)', opacity:submittingReview ? 0.8 : 1}}>
                  {submittingReview ? 'Submitting...' : 'Submit review →'}
                </button>
              </div>
            )}

            {/* Review success state */}
            {delivered && reviewed && (
              <div className="fade-up" style={{background:'linear-gradient(135deg,#E4F6EA,#F0FBF3)', borderRadius:20, padding:'24px', border:'1.5px solid rgba(45,168,78,0.28)', display:'flex', alignItems:'center', gap:14}}>
                <div style={{width:48, height:48, borderRadius:'50%', background:'#2DA84E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, boxShadow:'0 4px 14px rgba(45,168,78,0.35)'}}>✓</div>
                <div>
                  <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#157A33', marginBottom:2}}>{justReviewed ? 'Thanks for your review!' : 'Review submitted'}</div>
                  <div style={{fontSize:13, color:'#2DA84E', fontWeight:600}}>Your feedback helps the community find great home cooks.</div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: payment summary (sticky) ── */}
          <div className="fade-up">
            <div className="pay-panel" style={{position:'sticky', top:82}}>
              <div style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:18}}>Payment summary</h2>
                <div style={{display:'flex', flexDirection:'column', gap:11, marginBottom:16}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:13, color:'var(--text-primary)'}}>
                    <span style={{minWidth:0}}>{listing?.name || 'Dish'} × {order.quantity}</span>
                    <span style={{fontWeight:600, flexShrink:0}}>£{subtotal.toFixed(2)}</span>
                  </div>
                  {serviceFeeAmt > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-primary)'}}>
                      <span>Service fee</span>
                      <span style={{fontWeight:600}}>£{serviceFeeAmt.toFixed(2)}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-primary)'}}>
                      <span>Delivery fee</span>
                      <span style={{fontWeight:600}}>£{deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{borderTop:'1px solid var(--border-subtle)', paddingTop:11, display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:15, fontWeight:700}}>
                    <span>Total paid</span>
                    <span style={{color:'#C8006A', fontFamily:'Georgia,serif', fontSize:22}}>£{total.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{background:'var(--bg-page)', borderRadius:12, padding:'12px 15px', fontSize:12, color:'var(--text-primary)', lineHeight:1.6}}>
                  🔒 Payment secured by Stripe. Funds release to the cook on delivery confirmation.
                </div>
                <div style={{marginTop:16, display:'flex', flexDirection:'column', gap:10}}>
                  <Link href={`/dish/${order.listing_id}`} className="prim-btn" style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 18px rgba(200,0,106,0.28)'}}>
                    Order again →
                  </Link>
                  <Link href="/buyer/dashboard" className="ghost-btn" style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid var(--border-subtle)', color:'var(--text-primary)', borderRadius:12, fontSize:15, fontWeight:600, transition:'all 0.14s'}}>
                    Back to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
