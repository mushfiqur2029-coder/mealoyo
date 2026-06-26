
'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { User, Listing, Profile } from '@/lib/types'

export default function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Pick<Profile, 'id' | 'full_name'> | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [deliveryType, setDeliveryType] = useState<'collection' | 'delivery'>('collection')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [savedRowId, setSavedRowId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: listing } = await supabase
        .from('listings')
        .select('*, profiles:seller_id(id, full_name)')
        .eq('id', id)
        .single()
      if (!listing) { router.push('/'); return }
      setListing(listing)
      setSeller(listing.profiles ?? null)
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

  const handleOrder = async () => {
    if (!user) { router.push('/login'); return }
    if (!listing || !seller) return
    if (deliveryType === 'delivery' && !address.trim()) {
      setError('Please enter your delivery address')
      return
    }
    setOrdering(true)
    setError('')
    const totalAmount = parseFloat(listing.price) * quantity
    const deliveryFee = deliveryType === 'delivery' ? 4.50 : 0
    const commission = totalAmount * 0.12
    const sellerPayout = totalAmount - commission

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: seller.id,
        listing_id: listing.id,
        quantity,
        total_amount: totalAmount + deliveryFee,
        delivery_fee: deliveryFee,
        platform_commission: commission,
        seller_payout: sellerPayout,
        status: 'pending',
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
    router.push(`/buyer/orders/${order.id}`)
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading...</p>
      </div>
    </div>
  )

  if (!listing) return null

  const cuisineEmoji: Record<string,string> = {
    'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
    'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Other':'🍽️'
  }

  const totalAmount = parseFloat(listing.price) * quantity
  const deliveryFee = deliveryType === 'delivery' ? 4.50 : 0
  const grandTotal = totalAmount + deliveryFee

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        input:focus,textarea:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}
        .dt-btn{transition:all 0.14s;cursor:pointer;}
        .dt-btn:hover{border-color:#C8006A !important;}
        .order-btn:hover{background:#A00055 !important;}
        @media(max-width:768px){.dish-grid{grid-template-columns:1fr !important;}}
      `}</style>

      {/* NAV */}
      <nav style={{background:'rgba(255,255,255,0.97)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:400,marginLeft:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{listing.name}</span>
        </div>
      </nav>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 20px 48px'}}>
        <div className="dish-grid" style={{display:'grid',gridTemplateColumns:'1fr 380px',gap:24,alignItems:'start'}}>

          {/* Left — dish info */}
          <div>
            {/* Hero */}
            <div style={{background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',borderRadius:20,height:280,display:'flex',alignItems:'center',justifyContent:'center',fontSize:96,marginBottom:20,position:'relative'}}>
              {cuisineEmoji[listing.cuisine] || '🍽️'}
              {listing.featured && <div style={{position:'absolute',top:16,left:16,background:'#C8006A',color:'#fff',fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20}}>Featured</div>}
              <button onClick={toggleSave} style={{position:'absolute',top:16,right:16,width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.95)',border:'1.5px solid rgba(200,0,106,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                {isSaved ? '❤️' : '🤍'}
              </button>
            </div>

            {/* Details */}
            <div style={{background:'#fff',borderRadius:20,padding:'24px',marginBottom:16,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:10}}>
                <div>
                  <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>{listing.name}</h1>
                  <div style={{fontSize:13,color:'#1A1A1A',display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff'}}>{seller?.full_name?.[0]||'C'}</div>
                    {seller?.full_name || 'Home cook'} · {listing.cuisine}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:28,fontWeight:700,color:'#C8006A',letterSpacing:'-0.02em'}}>£{parseFloat(listing.price).toFixed(2)}</div>
                  <div style={{fontSize:12,color:'#1A1A1A',marginTop:2}}>per portion · serves {listing.serves}</div>
                </div>
              </div>

              {(listing.reviews_count ?? 0) > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14}}>
                  <span style={{color:'#C8006A',fontSize:16,letterSpacing:'1px'}}>{'★'.repeat(Math.round(listing.rating ?? 0))}</span>
                  <span style={{fontSize:14,fontWeight:700,color:'#1A1A1A'}}>{listing.rating}</span>
                  <span style={{fontSize:13,color:'#1A1A1A'}}>({listing.reviews_count} reviews)</span>
                </div>
              )}

              <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.75,marginBottom:16}}>{listing.description}</p>

              {/* Tags */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                {listing.allergens && listing.allergens.length > 0 && (
                  <span style={{background:'#FFF4E0',color:'#8C5500',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>
                    ⚠️ Contains: {listing.allergens.join(', ')}
                  </span>
                )}
              </div>

              {/* Info grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {icon:'⏱️',label:'Prep time',value:listing.prep_time},
                  {icon:'👥',label:'Serves',value:`${listing.serves} ${listing.serves===1?'person':'people'}`},
                  {icon:'🍽️',label:'Cuisine',value:listing.cuisine},
                  {icon:'📦',label:'Delivery',value:Array.isArray(listing.delivery_options)?listing.delivery_options[0]:listing.delivery_options},
                ].map((item,i)=>(
                  <div key={i} style={{background:'#F8F0F4',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:11,color:'#C8006A',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{item.icon} {item.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* About the cook */}
            <div style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:16}}>About the cook</h2>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'#fff',flexShrink:0}}>
                  {seller?.full_name?.[0]||'C'}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:3}}>{seller?.full_name||'Home cook'}</div>
                  <div style={{fontSize:13,color:'#1A1A1A'}}>Verified home cook · {listing.cuisine} specialist</div>
                  {(listing.reviews_count ?? 0) > 0 && <div style={{fontSize:13,color:'#C8006A',fontWeight:600,marginTop:2}}>★ {listing.rating} rating · {listing.reviews_count} reviews</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Right — order panel */}
          <div style={{position:'sticky',top:80}}>
            <div style={{background:'#fff',borderRadius:20,padding:'24px',boxShadow:'0 4px 24px rgba(200,0,106,0.1)',border:'1.5px solid rgba(200,0,106,0.1)'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:20}}>Place your order</h2>

              {error && <div style={{background:'#FFE8F4',border:'1.5px solid rgba(200,0,106,0.25)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#C8006A',fontWeight:600}}>{error}</div>}

              {/* Quantity */}
              <div style={{marginBottom:18}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:8}}>Quantity</label>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <button onClick={()=>setQuantity(q=>Math.max(1,q-1))} style={{width:36,height:36,borderRadius:'50%',border:'1.5px solid #E0E0E0',background:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#1A1A1A'}}>−</button>
                  <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#1A1A1A',minWidth:24,textAlign:'center'}}>{quantity}</span>
                  <button onClick={()=>setQuantity(q=>q+1)} style={{width:36,height:36,borderRadius:'50%',border:'1.5px solid #E0E0E0',background:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#C8006A'}}>+</button>
                </div>
              </div>

              {/* Delivery type */}
              <div style={{marginBottom:18}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:8}}>How do you want it?</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {type:'collection' as const,icon:'📍',label:'Collect free',sub:'Pick up from cook'},
                    {type:'delivery' as const,icon:'🚴',label:'Delivery',sub:'£4.50 to your door'},
                  ].map(opt=>(
                    <div key={opt.type} className="dt-btn" onClick={()=>setDeliveryType(opt.type)}
                      style={{padding:'12px',border:deliveryType===opt.type?'2px solid #C8006A':'1.5px solid #E0E0E0',borderRadius:12,background:deliveryType===opt.type?'#FFE8F4':'#fff',textAlign:'center'}}>
                      <div style={{fontSize:20,marginBottom:4}}>{opt.icon}</div>
                      <div style={{fontSize:13,fontWeight:700,color:deliveryType===opt.type?'#C8006A':'#1A1A1A'}}>{opt.label}</div>
                      <div style={{fontSize:11,color:'#1A1A1A',fontWeight:400}}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery address */}
              {deliveryType === 'delivery' && (
                <div style={{marginBottom:18}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6}}>Delivery address</label>
                  <textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter your full delivery address including postcode..." rows={3}
                    style={{width:'100%',border:'1.5px solid #E0E0E0',borderRadius:10,padding:'10px 14px',fontSize:14,color:'#1A1A1A',background:'#FAFAFA',fontFamily:'Inter,system-ui,sans-serif',outline:'none',resize:'none',lineHeight:1.55}}/>
                </div>
              )}

              {/* Notes */}
              <div style={{marginBottom:20}}>
                <label style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6}}>Special requests (optional)</label>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. extra spicy, no onions..." style={{width:'100%',height:42,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#FAFAFA',fontFamily:'Inter,system-ui,sans-serif',outline:'none'}}/>
              </div>

              {/* Order summary */}
              <div style={{background:'#F8F0F4',borderRadius:12,padding:'14px 16px',marginBottom:18}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#1A1A1A',marginBottom:6}}>
                  <span>£{parseFloat(listing.price).toFixed(2)} × {quantity}</span>
                  <span style={{fontWeight:600}}>£{totalAmount.toFixed(2)}</span>
                </div>
                {deliveryType === 'delivery' && (
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#1A1A1A',marginBottom:6}}>
                    <span>Delivery fee</span>
                    <span style={{fontWeight:600}}>£{deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div style={{borderTop:'1px solid rgba(200,0,106,0.12)',paddingTop:8,marginTop:4,display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,color:'#1A1A1A'}}>
                  <span>Total</span>
                  <span style={{color:'#C8006A',fontFamily:'Georgia,serif'}}>£{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* CTA */}
              {user ? (
                <button onClick={handleOrder} disabled={ordering} className="order-btn"
                  style={{width:'100%',height:52,background:'#C8006A',color:'#fff',border:'none',borderRadius:12,fontSize:16,fontWeight:700,cursor:ordering?'not-allowed':'pointer',boxShadow:'0 6px 20px rgba(200,0,106,0.3)',transition:'background 0.14s',opacity:ordering?0.8:1}}>
                  {ordering ? 'Placing order...' : `Order for £${grandTotal.toFixed(2)} →`}
                </button>
              ) : (
                <div>
                  <Link href="/login" style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:52,background:'#C8006A',color:'#fff',borderRadius:12,fontSize:16,fontWeight:700,boxShadow:'0 6px 20px rgba(200,0,106,0.3)',marginBottom:10}}>
                    Sign in to order →
                  </Link>
                  <p style={{textAlign:'center',fontSize:12,color:'#1A1A1A'}}>Don&apos;t have an account? <Link href="/register" style={{color:'#C8006A',fontWeight:600}}>Register free</Link></p>
                </div>
              )}

              <p style={{textAlign:'center',fontSize:11,color:'#1A1A1A',marginTop:12,lineHeight:1.5}}>🔒 Secured by Stripe · Buyer protection on every order</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
