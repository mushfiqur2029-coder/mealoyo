'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Listing, Profile } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const statusSteps = ['pending', 'accepted', 'cooking', 'ready', 'picked_up', 'delivered']
const statusLabels: Record<string, string> = {
  pending: 'Order placed',
  accepted: 'Cook accepted',
  cooking: 'Being cooked',
  ready: 'Ready for pickup',
  picked_up: 'Out for delivery',
  delivered: 'Delivered',
}
const statusShort: Record<string, string> = {
  pending: 'Placed',
  accepted: 'Accepted',
  cooking: 'Cooking',
  ready: 'Ready',
  picked_up: 'On its way',
  delivered: 'Delivered',
}
const statusIcons: Record<string, string> = {
  pending: '🕐', accepted: '✅', cooking: '👩‍🍳', ready: '📦', picked_up: '🚴', delivered: '🏠',
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Pick<Profile, 'full_name'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [justReviewed, setJustReviewed] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const router = useRouter()

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

      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name)')
        .eq('id', order.listing_id)
        .single()

      setListing(listing)
      setSeller(listing?.profiles ?? null)

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
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:66}}>
      <div style={{maxWidth:1040, margin:'0 auto', padding:'0 20px', height:66, display:'flex', alignItems:'center', gap:14}}>
        <Link href="/buyer/orders" className="back-btn" aria-label="Back to orders" style={{width:38, height:38, border:'1.5px solid #E0E0E0', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#1A1A1A', flexShrink:0, transition:'all 0.14s'}}>←</Link>
        <Link href="/" style={{flexShrink:0}}><Logo height={34}/></Link>
        {order && <span style={{fontSize:14, color:'#1A1A1A', fontWeight:500, marginLeft:4, whiteSpace:'nowrap'}}>· Order #{order.id.slice(0, 8).toUpperCase()}</span>}
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1040, margin:'0 auto', padding:'28px 20px 48px'}}>
        <div className="skel" style={{height:150, borderRadius:20, marginBottom:20}}/>
        <div className="order-grid" style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:20}}>
          <div>
            <div style={{background:'#fff', borderRadius:20, padding:24, marginBottom:16, border:'1.5px solid rgba(200,0,106,0.07)'}}>
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
            <div style={{background:'#fff', borderRadius:20, padding:24, border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div className="skel" style={{height:20, borderRadius:8, width:'40%', marginBottom:20}}/>
              {Array.from({length:4}).map((_, i) => (
                <div key={i} style={{display:'flex', gap:12, marginBottom:16, alignItems:'center'}}>
                  <div className="skel" style={{width:32, height:32, borderRadius:'50%', flexShrink:0}}/>
                  <div className="skel" style={{height:13, borderRadius:6, width:'45%'}}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'#fff', borderRadius:20, padding:24, border:'1.5px solid rgba(200,0,106,0.07)'}}>
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
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:560, margin:'0 auto', padding:'72px 20px'}}>
        <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 22px'}}>🧾</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Order not found</h1>
          <p style={{fontSize:15, color:'#1A1A1A', lineHeight:1.7, marginBottom:28, maxWidth:380, margin:'0 auto 28px'}}>We couldn&apos;t find this order on your account. It may have been removed, or the link is incorrect.</p>
          <Link href="/buyer/orders" className="prim-btn" style={{display:'inline-flex', alignItems:'center', height:52, padding:'0 30px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>
            View your orders →
          </Link>
        </div>
      </div>
    </div>
  )

  const currentStep = statusSteps.indexOf(order.status)
  const delivered = order.status === 'delivered'
  const emoji = cuisineEmoji[listing?.cuisine || 'Other'] || '🍽️'
  const deliveryFee = parseFloat(order.delivery_fee)
  const total = parseFloat(order.total_amount)
  const subtotal = total - deliveryFee
  const isDelivery = order.delivery_type === 'delivery'

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1040, margin:'0 auto', padding:'28px 20px 48px'}}>

        {/* ── STATUS HERO BANNER ── */}
        <div className="fade-up" style={{background:delivered ? 'linear-gradient(135deg,#2DA84E 0%,#157A33 100%)' : 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', borderRadius:20, padding:'30px 28px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden', boxShadow:delivered ? '0 12px 36px rgba(45,168,78,0.28)' : '0 12px 36px rgba(200,0,106,0.28)'}}>
          <div style={{position:'absolute', top:'-40%', right:'-5%', width:'45%', height:'200%', background:'radial-gradient(ellipse, rgba(255,255,255,0.1), transparent 65%)', pointerEvents:'none'}}/>
          <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:26, position:'relative'}}>
            <div style={{width:60, height:60, borderRadius:18, background:'rgba(255,255,255,0.16)', border:'1px solid rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0}}>{statusIcons[order.status]}</div>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4}}>{delivered ? 'Order complete' : 'Order status'}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,28px)', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1.1}}>{statusLabels[order.status]}</div>
            </div>
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

            {/* Order details */}
            <div style={{background:'#fff', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:18}}>Order details</h2>
              <div style={{display:'flex', gap:16, marginBottom:order.notes || isDelivery ? 16 : 0, alignItems:'flex-start'}}>
                <div style={{width:68, height:68, borderRadius:16, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, flexShrink:0}}>{emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:3}}>{listing?.name || 'Dish'}</div>
                  <div style={{fontSize:13, color:'#1A1A1A', marginBottom:8}}>by {seller?.full_name || 'Home cook'}</div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <span style={{background:'#F8F0F4', color:'#1A1A1A', padding:'4px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>Qty: {order.quantity}</span>
                    <span style={{background:'#FFE8F4', color:'#C8006A', padding:'4px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>{isDelivery ? '🚴 Delivery' : '📍 Collection'}</span>
                  </div>
                </div>
              </div>
              {isDelivery && order.delivery_address && (
                <div style={{background:'#F8F0F4', borderRadius:12, padding:'12px 15px', fontSize:13, color:'#1A1A1A', lineHeight:1.55, marginBottom:order.notes ? 10 : 0}}>
                  <span style={{fontWeight:700, color:'#C8006A'}}>📍 Delivery address</span><br/>{order.delivery_address}
                </div>
              )}
              {order.notes && (
                <div style={{background:'#F8F0F4', borderRadius:12, padding:'12px 15px', fontSize:13, color:'#1A1A1A', lineHeight:1.55}}>
                  <span style={{fontWeight:700, color:'#C8006A'}}>📝 Special request</span><br/>{order.notes}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div style={{background:'#fff', borderRadius:20, padding:'24px', marginBottom:16, boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:20}}>Order timeline</h2>
              {statusSteps.map((step, i) => {
                const done = i <= currentStep
                const isCurrent = i === currentStep
                const last = i === statusSteps.length - 1
                return (
                  <div key={step} style={{display:'flex', gap:14}}>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div style={{width:34, height:34, borderRadius:'50%', background:done ? '#C8006A' : '#F0E4EC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, transition:'background 0.3s', animation:isCurrent && !delivered ? 'pulseDot 1.8s ease-out infinite' : 'none'}}>
                        {done ? <span style={{fontSize:15}}>{statusIcons[step]}</span> : <span style={{color:'#1A1A1A', fontSize:12, fontWeight:700, opacity:0.4}}>{i + 1}</span>}
                      </div>
                      {!last && <div style={{width:2.5, flex:1, background:i < currentStep ? '#C8006A' : '#F0E4EC', minHeight:26, marginTop:4, marginBottom:4, transition:'background 0.3s'}}/>}
                    </div>
                    <div style={{paddingTop:7, paddingBottom:last ? 0 : 14}}>
                      <div style={{fontSize:14, fontWeight:done ? 700 : 500, color:done ? '#1A1A1A' : '#1A1A1A', opacity:done ? 1 : 0.45}}>{statusLabels[step]}</div>
                      {isCurrent && !delivered && <div style={{fontSize:12, color:'#C8006A', fontWeight:700, marginTop:3}}>● In progress</div>}
                      {isCurrent && delivered && <div style={{fontSize:12, color:'#2DA84E', fontWeight:700, marginTop:3}}>✓ Completed</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Review — only delivered & not yet reviewed */}
            {delivered && !reviewed && (
              <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.1)'}}>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:6}}>Rate your order</h2>
                <p style={{fontSize:14, color:'#1A1A1A', marginBottom:18}}>How was {seller?.full_name || 'the cook'}&apos;s food?</p>
                <div style={{display:'flex', gap:8, marginBottom:18}} onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className="star" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)}
                      style={{fontSize:38, color:star <= (hoverRating || rating) ? '#C8006A' : '#EAD9E4'}}>★</span>
                  ))}
                </div>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell others what you thought (optional)..." rows={3}
                  style={{width:'100%', border:'1.5px solid #E0E0E0', borderRadius:12, padding:'12px 15px', fontSize:14, color:'#1A1A1A', background:'#FAFAFA', fontFamily:'Inter,system-ui,sans-serif', outline:'none', resize:'none', lineHeight:1.55, marginBottom:14}}/>
                <button onClick={submitReview} disabled={rating === 0 || submittingReview} className={rating === 0 ? '' : 'prim-btn'}
                  style={{height:48, padding:'0 26px', background:rating === 0 ? '#EAD9E4' : '#C8006A', color:rating === 0 ? '#1A1A1A' : '#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:rating === 0 || submittingReview ? 'not-allowed' : 'pointer', boxShadow:rating === 0 ? 'none' : '0 6px 18px rgba(200,0,106,0.28)', opacity:submittingReview ? 0.8 : 1}}>
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
              <div style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 4px 24px rgba(200,0,106,0.08)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
                <h2 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', marginBottom:18}}>Payment summary</h2>
                <div style={{display:'flex', flexDirection:'column', gap:11, marginBottom:16}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:13, color:'#1A1A1A'}}>
                    <span style={{minWidth:0}}>{listing?.name || 'Dish'} × {order.quantity}</span>
                    <span style={{fontWeight:600, flexShrink:0}}>£{subtotal.toFixed(2)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A'}}>
                      <span>Delivery fee</span>
                      <span style={{fontWeight:600}}>£{deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{borderTop:'1px solid #F0E4EC', paddingTop:11, display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:15, fontWeight:700}}>
                    <span>Total paid</span>
                    <span style={{color:'#C8006A', fontFamily:'Georgia,serif', fontSize:22}}>£{total.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{background:'#F8F0F4', borderRadius:12, padding:'12px 15px', fontSize:12, color:'#1A1A1A', lineHeight:1.6}}>
                  🔒 Payment secured by Stripe. Funds release to the cook on delivery confirmation.
                </div>
                <div style={{marginTop:16, display:'flex', flexDirection:'column', gap:10}}>
                  <Link href={`/dish/${order.listing_id}`} className="prim-btn" style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, boxShadow:'0 6px 18px rgba(200,0,106,0.28)'}}>
                    Order again →
                  </Link>
                  <Link href="/buyer/dashboard" className="ghost-btn" style={{height:48, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid #E0E0E0', color:'#1A1A1A', borderRadius:12, fontSize:15, fontWeight:600, transition:'all 0.14s'}}>
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
