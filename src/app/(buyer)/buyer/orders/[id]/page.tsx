
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OrderPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<any>(null)
  const [listing, setListing] = useState<any>(null)
  const [seller, setSeller] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', params.id)
        .eq('buyer_id', user.id)
        .single()

      if (!order) { router.push('/buyer/dashboard'); return }
      setOrder(order)

      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(full_name)')
        .eq('id', order.listing_id)
        .single()

      setListing(listing)
      setSeller(listing?.profiles)

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', params.id)
        .single()

      if (existingReview) setReviewed(true)
      setLoading(false)
    }
    getData()
  }, [params.id])

  const submitReview = async () => {
    if (rating === 0) return
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
    setSubmittingReview(false)
  }

  const statusSteps = ['pending','accepted','cooking','ready','picked_up','delivered']
  const statusLabels: Record<string,string> = {
    pending:'Order placed',
    accepted:'Cook accepted',
    cooking:'Being cooked',
    ready:'Ready for pickup',
    picked_up:'Out for delivery',
    delivered:'Delivered'
  }
  const statusIcons: Record<string,string> = {
    pending:'🕐',accepted:'✅',cooking:'👩‍🍳',ready:'📦',picked_up:'🚴',delivered:'🏠'
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading order...</p>
      </div>
    </div>
  )

  const currentStep = statusSteps.indexOf(order.status)

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        .star:hover{color:#C8006A !important;transform:scale(1.2);}
        textarea:focus{border-color:#C8006A !important;outline:none;}
        @media(max-width:768px){.order-grid{grid-template-columns:1fr !important;}}
      `}</style>

      <nav style={{background:'rgba(255,255,255,0.97)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1000,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/buyer/dashboard" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><img src="/Color_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>Order #{order.id.slice(0,8).toUpperCase()}</span>
        </div>
      </nav>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'28px 20px 48px'}}>

        {/* Status banner */}
        <div style={{background:order.status==='delivered'?'linear-gradient(135deg,#2DA84E,#1A7A35)':'linear-gradient(135deg,#C8006A,#8B0047)',borderRadius:20,padding:'24px',marginBottom:20,color:'#fff'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <span style={{fontSize:32}}>{statusIcons[order.status]}</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.7)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>Order status</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700}}>{statusLabels[order.status]}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{display:'flex',gap:4,marginTop:16}}>
            {statusSteps.map((step,i)=>(
              <div key={step} style={{flex:1,height:4,borderRadius:2,background:i<=currentStep?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.25)',transition:'background 0.3s'}}/>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>Order placed</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>Delivered</span>
          </div>
        </div>

        <div className="order-grid" style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:20}}>

          {/* Left */}
          <div>
            {/* Order details */}
            <div style={{background:'#fff',borderRadius:20,padding:'24px',marginBottom:16,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Order details</h2>
              <div style={{display:'flex',gap:16,marginBottom:16,alignItems:'flex-start'}}>
                <div style={{width:64,height:64,borderRadius:14,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,flexShrink:0}}>🍛</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:2}}>{listing?.name}</div>
                  <div style={{fontSize:13,color:'#1A1A1A',marginBottom:4}}>by {seller?.full_name}</div>
                  <div style={{fontSize:13,color:'#1A1A1A'}}>Quantity: {order.quantity} · {order.delivery_type === 'delivery' ? '🚴 Delivery' : '📍 Collection'}</div>
                </div>
              </div>
              {order.notes && (
                <div style={{background:'#F8F0F4',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#1A1A1A'}}>
                  📝 Note: {order.notes}
                </div>
              )}
            </div>

            {/* Status timeline */}
            <div style={{background:'#fff',borderRadius:20,padding:'24px',marginBottom:16,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Order timeline</h2>
              {statusSteps.map((step,i)=>(
                <div key={step} style={{display:'flex',gap:12,marginBottom:i<statusSteps.length-1?12:0}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:i<=currentStep?'#C8006A':'#E0E0E0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,transition:'background 0.3s'}}>
                      {i<=currentStep ? <span style={{color:'#fff'}}>✓</span> : <span style={{color:'#888',fontSize:11}}>{i+1}</span>}
                    </div>
                    {i<statusSteps.length-1 && <div style={{width:2,flex:1,background:i<currentStep?'#C8006A':'#E0E0E0',minHeight:20,marginTop:4,transition:'background 0.3s'}}/>}
                  </div>
                  <div style={{paddingTop:6,paddingBottom:i<statusSteps.length-1?12:0}}>
                    <div style={{fontSize:14,fontWeight:i<=currentStep?700:500,color:i<=currentStep?'#1A1A1A':'#888'}}>{statusLabels[step]}</div>
                    {i===currentStep && <div style={{fontSize:12,color:'#C8006A',fontWeight:600,marginTop:2}}>Current status</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Review section — only for delivered orders */}
            {order.status === 'delivered' && !reviewed && (
              <div style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
                <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Rate your order</h2>
                <p style={{fontSize:13,color:'#1A1A1A',marginBottom:16}}>How was {seller?.full_name}'s food?</p>
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  {[1,2,3,4,5].map(star=>(
                    <span key={star} className="star" onClick={()=>setRating(star)} style={{fontSize:32,cursor:'pointer',color:star<=rating?'#C8006A':'#E0E0E0',transition:'all 0.14s'}}>★</span>
                  ))}
                </div>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Tell others what you thought (optional)..." rows={3}
                  style={{width:'100%',border:'1.5px solid #E0E0E0',borderRadius:10,padding:'10px 14px',fontSize:14,color:'#1A1A1A',background:'#FAFAFA',fontFamily:'Inter,system-ui,sans-serif',outline:'none',resize:'none',lineHeight:1.55,marginBottom:12}}/>
                <button onClick={submitReview} disabled={rating===0||submittingReview}
                  style={{height:44,padding:'0 24px',background:rating===0?'#E0E0E0':'#C8006A',color:rating===0?'#888':'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:rating===0?'not-allowed':'pointer',transition:'all 0.14s'}}>
                  {submittingReview?'Submitting...':'Submit review →'}
                </button>
              </div>
            )}

            {reviewed && order.status === 'delivered' && (
              <div style={{background:'#E4F6EA',borderRadius:20,padding:'20px 24px',border:'1.5px solid rgba(45,168,78,0.25)',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:24}}>✅</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'#1A6030',marginBottom:2}}>Review submitted</div>
                  <div style={{fontSize:13,color:'#2DA84E'}}>Thank you for rating your order</div>
                </div>
              </div>
            )}
          </div>

          {/* Right — payment summary */}
          <div>
            <div style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',position:'sticky',top:80}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Payment summary</h2>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                {[
                  {l:`${listing?.name} × ${order.quantity}`,v:`£${(order.total_amount - order.delivery_fee).toFixed(2)}`},
                  ...(order.delivery_fee>0?[{l:'Delivery fee',v:`£${parseFloat(order.delivery_fee).toFixed(2)}`}]:[]),
                ].map((row,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#1A1A1A'}}>
                    <span>{row.l}</span><span style={{fontWeight:600}}>{row.v}</span>
                  </div>
                ))}
                <div style={{borderTop:'1px solid #F0E8F0',paddingTop:10,display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700}}>
                  <span>Total paid</span>
                  <span style={{color:'#C8006A',fontFamily:'Georgia,serif'}}>£{parseFloat(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
              <div style={{background:'#F8F0F4',borderRadius:10,padding:'12px 14px',fontSize:12,color:'#1A1A1A',lineHeight:1.6}}>
                🔒 Payment secured by Stripe. Funds released to seller on delivery confirmation.
              </div>
              <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
                <Link href="/" style={{height:42,display:'flex',alignItems:'center',justifyContent:'center',background:'#C8006A',color:'#fff',borderRadius:10,fontSize:14,fontWeight:700,boxShadow:'0 4px 14px rgba(200,0,106,0.25)'}}>
                  Order more food
                </Link>
                <Link href="/buyer/dashboard" style={{height:42,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #E0E0E0',color:'#1A1A1A',borderRadius:10,fontSize:14,fontWeight:600}}>
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
