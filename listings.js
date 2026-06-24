const fs = require('fs')

// ── SELLER LISTINGS PAGE ─────────────────────────────
fs.mkdirSync('src/app/(seller)/seller/listings', { recursive: true })
fs.writeFileSync('src/app/(seller)/seller/listings/page.tsx', `
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SellerListings() {
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const statusColor = (s:string) => s==='live'?'#2DA84E':s==='pending'?'#E8930A':'#C0392B'
  const statusBg = (s:string) => s==='live'?'#E4F6EA':s==='pending'?'#FFF4E0':'#FDECEA'

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{\`@keyframes spin{to{transform:rotate(360deg)}}\`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading listings...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing:border-box; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar{width:0;} * {scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        .lrow:hover{background:#FFF5FA !important;}
        .del-btn:hover{background:#FDECEA !important;color:#C0392B !important;}
        .nav-link:hover{color:#C8006A !important;}
      \`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/>
          </Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:false},{l:'My listings',h:'/seller/listings',a:true},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <Link href="/seller/listings/new" style={{height:36,padding:'0 18px',display:'flex',alignItems:'center',background:'#C8006A',borderRadius:8,fontSize:13,fontWeight:700,color:'#fff',boxShadow:'0 4px 12px rgba(200,0,106,0.3)',marginLeft:'auto'}}>
            + Add listing
          </Link>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>My listings</h1>
            <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>{listings.length} {listings.length===1?'dish':'dishes'} listed</p>
          </div>
          <Link href="/seller/listings/new" style={{height:42,padding:'0 20px',display:'flex',alignItems:'center',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
            + Add new dish
          </Link>
        </div>

        {listings.length === 0 ? (
          <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:48,marginBottom:16}}>🍽️</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No listings yet</h2>
            <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24,maxWidth:360,margin:'0 auto 24px',lineHeight:1.65}}>Add your first dish and start earning. Listings go live once our team verifies your account.</p>
            <Link href="/seller/listings/new" style={{display:'inline-flex',alignItems:'center',height:46,padding:'0 28px',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
              Add your first dish →
            </Link>
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',padding:'10px 20px',background:'#F8F0F4',borderBottom:'1px solid rgba(200,0,106,0.08)'}}>
              {['Dish','Cuisine','Price','Status','Actions'].map(h=>(
                <div key={h} style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>
              ))}
            </div>
            {listings.map((l,i)=>(
              <div key={l.id} className="lrow" style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',padding:'14px 20px',borderBottom:i<listings.length-1?'1px solid #F5F0F3':'none',alignItems:'center',transition:'background 0.12s',cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2}}>{l.name}</div>
                  <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:280}}>{l.description}</div>
                </div>
                <div style={{fontSize:13,color:'#1A1A1A',fontWeight:500}}>{l.cuisine}</div>
                <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A'}}>£{parseFloat(l.price).toFixed(2)}</div>
                <div>
                  <span style={{background:statusBg(l.status),color:statusColor(l.status),padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{l.status}</span>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <Link href={\`/seller/listings/\${l.id}/edit\`} style={{height:30,padding:'0 12px',display:'flex',alignItems:'center',border:'1.5px solid #E0E0E0',borderRadius:7,fontSize:12,fontWeight:600,color:'#1A1A1A',background:'#fff'}}>Edit</Link>
                  <button onClick={()=>deleteListing(l.id)} className="del-btn" style={{height:30,padding:'0 10px',border:'1.5px solid #E0E0E0',borderRadius:7,fontSize:12,fontWeight:600,color:'#1A1A1A',background:'#fff',cursor:'pointer',transition:'all 0.12s'}}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
`)
console.log('Seller listings page done')

// ── NEW LISTING FORM ─────────────────────────────────
fs.mkdirSync('src/app/(seller)/seller/listings/new', { recursive: true })
fs.writeFileSync('src/app/(seller)/seller/listings/new/page.tsx', `
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ALLERGENS = ['Gluten','Dairy','Nuts','Eggs','Fish','Shellfish','Soya','Sesame','Celery','Mustard','Lupin','Sulphites','Molluscs','Peanuts']
const CUISINES = ['Bangladeshi','Pakistani','Indian','Caribbean','Middle Eastern','West African','Turkish','Sri Lankan','Afghan','East African','Chinese','Other']
const DELIVERY_OPTIONS = ['Collection only','Delivery only','Collection & delivery','Pre-order catering only','Postal UK-wide']

export default function NewListing() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    cuisine: '',
    serves: '1',
    prep_time: '1 hour',
    delivery_options: 'Collection & delivery',
    allergens: [] as string[],
    halal: false,
    vegan: false,
    vegetarian: false,
    spicy: false,
    spicy_level: 'mild',
    available_days: [] as string[],
    min_order_notice: '2 hours',
    max_daily_orders: '10',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    getUser()
  }, [])

  const set = (k: string, v: any) => setForm(prev => ({...prev, [k]: v}))

  const toggleAllergen = (a: string) => {
    setForm(prev => ({
      ...prev,
      allergens: prev.allergens.includes(a) ? prev.allergens.filter(x=>x!==a) : [...prev.allergens, a]
    }))
  }

  const toggleDay = (d: string) => {
    setForm(prev => ({
      ...prev,
      available_days: prev.available_days.includes(d) ? prev.available_days.filter(x=>x!==d) : [...prev.available_days, d]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Please enter a dish name'); return }
    if (!form.price || parseFloat(form.price) < 1) { setError('Please enter a valid price (minimum £1)'); return }
    if (!form.cuisine) { setError('Please select a cuisine type'); return }
    if (!form.description.trim()) { setError('Please add a description'); return }

    setLoading(true)
    setError('')

    const tags = []
    if (form.halal) tags.push('Halal')
    if (form.vegan) tags.push('Vegan')
    if (form.vegetarian) tags.push('Vegetarian')
    if (form.spicy) tags.push('Spicy')

    const { error: dbError } = await supabase.from('listings').insert({
      seller_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      cuisine: form.cuisine,
      serves: parseInt(form.serves),
      prep_time: form.prep_time,
      delivery_options: [form.delivery_options],
      allergens: form.allergens,
      status: 'pending',
      featured: false,
      rating: 0,
      reviews_count: 0,
    })

    if (dbError) { setError(dbError.message); setLoading(false); return }

    setSaved(true)
    setTimeout(() => router.push('/seller/listings'), 2000)
  }

  if (saved) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:20,padding:'48px 36px',textAlign:'center',maxWidth:420,boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:48,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>Listing submitted</h2>
        <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.65}}>Your dish has been submitted for review. Our team will verify and make it live within 24 hours.</p>
      </div>
    </div>
  )

  const inputStyle = {height:46,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#FAFAFA',width:'100%',fontFamily:'Inter,system-ui,sans-serif',outline:'none',transition:'border-color 0.14s'} as any
  const labelStyle = {fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:6,display:'block'}
  const sectionStyle = {background:'#fff',borderRadius:18,padding:'24px',marginBottom:16,boxShadow:'0 2px 10px rgba(200,0,106,0.05)',border:'1.5px solid rgba(200,0,106,0.07)'}

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{\`
        * { box-sizing:border-box; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar{width:0;} *{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        input:focus,select:focus,textarea:focus{border-color:#C8006A !important;background:#fff !important;}
        .check-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:100px;border:1.5px solid #E0E0E0;cursor:pointer;font-size:13px;font-weight:600;color:#1A1A1A;background:#fff;transition:all 0.14s;user-select:none;}
        .check-pill.on{border-color:#C8006A;background:#FFE8F4;color:#C8006A;}
        .check-pill:hover{border-color:#C8006A;}
        .day-pill{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;border:1.5px solid #E0E0E0;cursor:pointer;font-size:12px;font-weight:700;color:#1A1A1A;background:#fff;transition:all 0.14s;}
        .day-pill.on{border-color:#C8006A;background:#C8006A;color:#fff;}
        .submit-btn:hover{background:#A00055 !important;}
      \`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:800,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/seller/listings" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#1A1A1A',fontSize:18,flexShrink:0}}>←</Link>
          <img src="/Color_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:500,marginLeft:4}}>Add new dish</span>
        </div>
      </nav>

      <div style={{maxWidth:800,margin:'0 auto',padding:'28px 20px 48px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,26px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Add a new dish</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>Fill in the details below. Your listing will be reviewed and go live within 24 hours.</p>
        </div>

        {error && (
          <div style={{background:'#FFE8F4',border:'1.5px solid rgba(200,0,106,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#C8006A',fontWeight:600}}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Basic info */}
          <div style={sectionStyle}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Basic information</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={labelStyle}>Dish name *</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Lamb biryani with raita and salad" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Description *</label>
                <textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe your dish — ingredients, portion size, what makes it special, spice level..." rows={3}
                  style={{...inputStyle,height:'auto',padding:'12px 14px',lineHeight:1.55,resize:'vertical' as const}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <label style={labelStyle}>Cuisine *</label>
                  <select value={form.cuisine} onChange={e=>set('cuisine',e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238C8C8C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:36}}>
                    <option value="">Select cuisine</option>
                    {CUISINES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price per portion (£) *</label>
                  <input type="number" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="0.00" min="1" step="0.50" style={inputStyle}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <label style={labelStyle}>Serves how many people?</label>
                  <select value={form.serves} onChange={e=>set('serves',e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238C8C8C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:36}}>
                    <option value="1">1 person</option>
                    <option value="2">2 people</option>
                    <option value="3">3–4 people</option>
                    <option value="5">5–6 people</option>
                    <option value="10">Catering (10+)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Preparation time</label>
                  <select value={form.prep_time} onChange={e=>set('prep_time',e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238C8C8C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:36}}>
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>2 hours</option>
                    <option>3 hours</option>
                    <option>Pre-order only</option>
                    <option>Same day only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dietary tags */}
          <div style={sectionStyle}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Dietary information</h2>
            <p style={{fontSize:13,color:'#1A1A1A',marginBottom:16,fontWeight:400}}>Select all that apply to this dish.</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                {k:'halal',l:'🟢 Halal'},
                {k:'vegan',l:'🌿 Vegan'},
                {k:'vegetarian',l:'🥦 Vegetarian'},
                {k:'spicy',l:'🌶️ Spicy'},
              ].map(tag=>(
                <div key={tag.k} className={\`check-pill \${(form as any)[tag.k]?'on':''}\`} onClick={()=>set(tag.k,!(form as any)[tag.k])}>
                  {tag.l}
                </div>
              ))}
            </div>
            {form.spicy && (
              <div style={{marginTop:14}}>
                <label style={labelStyle}>Spice level</label>
                <div style={{display:'flex',gap:8}}>
                  {['mild','medium','hot','very hot'].map(l=>(
                    <div key={l} className={\`check-pill \${form.spicy_level===l?'on':''}\`} onClick={()=>set('spicy_level',l)} style={{textTransform:'capitalize' as const}}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Allergens */}
          <div style={sectionStyle}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Allergens</h2>
            <p style={{fontSize:13,color:'#1A1A1A',marginBottom:16,fontWeight:400,lineHeight:1.55}}>
              You must declare all 14 major allergens present in this dish. This is a legal requirement. Tick every allergen that is present.
            </p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {ALLERGENS.map(a=>(
                <div key={a} className={\`check-pill \${form.allergens.includes(a)?'on':''}\`} onClick={()=>toggleAllergen(a)}>
                  {form.allergens.includes(a)?'✓ ':''}{a}
                </div>
              ))}
            </div>
            {form.allergens.length === 0 && (
              <div style={{marginTop:12,padding:'10px 14px',background:'#FFF4E0',borderRadius:8,fontSize:12,color:'#8C5500',fontWeight:500}}>
                ⚠️ If your dish contains no allergens, that is fine — but please double check before submitting.
              </div>
            )}
          </div>

          {/* Delivery */}
          <div style={sectionStyle}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Delivery options</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div>
                <label style={labelStyle}>How can buyers receive this dish?</label>
                <select value={form.delivery_options} onChange={e=>set('delivery_options',e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238C8C8C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:36}}>
                  {DELIVERY_OPTIONS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Minimum order notice</label>
                <select value={form.min_order_notice} onChange={e=>set('min_order_notice',e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238C8C8C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:36}}>
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>3 hours</option>
                  <option>Same day</option>
                  <option>1 day ahead</option>
                  <option>2 days ahead</option>
                </select>
              </div>
            </div>
            <div style={{marginTop:14}}>
              <label style={labelStyle}>Maximum orders per day</label>
              <input type="number" value={form.max_daily_orders} onChange={e=>set('max_daily_orders',e.target.value)} min="1" max="50" style={{...inputStyle,maxWidth:180}}/>
              <p style={{fontSize:12,color:'#1A1A1A',marginTop:6}}>This prevents you from being overwhelmed. You can update this anytime.</p>
            </div>
          </div>

          {/* Availability */}
          <div style={sectionStyle}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Available days</h2>
            <p style={{fontSize:13,color:'#1A1A1A',marginBottom:16,fontWeight:400}}>Which days can buyers order this dish? Leave blank for all days.</p>
            <div style={{display:'flex',gap:10'}}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
                <div key={d} className={\`day-pill \${form.available_days.includes(d)?'on':''}\`} onClick={()=>toggleDay(d)}>{d}</div>
              ))}
            </div>
            {form.available_days.length === 0 && (
              <p style={{fontSize:12,color:'#2DA84E',marginTop:10,fontWeight:600}}>✓ Available every day</p>
            )}
          </div>

          {/* Submit */}
          <div style={{background:'#fff',borderRadius:18,padding:'24px',boxShadow:'0 2px 10px rgba(200,0,106,0.05)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{background:'#FFE8F4',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
              <p style={{fontSize:13,color:'#C8006A',fontWeight:600,lineHeight:1.6}}>
                📋 By submitting you confirm this dish is prepared in a registered food business premises, all allergen information is accurate, and you hold a valid Level 2 Food Hygiene Certificate.
              </p>
            </div>
            <div style={{display:'flex',gap:12'}}>
              <Link href="/seller/listings" style={{flex:1,height:50,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #E0E0E0',borderRadius:12,fontSize:14,fontWeight:600,color:'#1A1A1A',background:'#fff'}}>
                Cancel
              </Link>
              <button type="submit" disabled={loading} className="submit-btn"
                style={{flex:2,height:50,background:'#C8006A',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',boxShadow:'0 6px 20px rgba(200,0,106,0.3)',transition:'background 0.14s',opacity:loading?0.8:1}}>
                {loading?'Submitting...':'Submit listing →'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
`)
console.log('New listing form done')

// ── UPDATE HOMEPAGE — REAL DATA FROM SUPABASE ────────
fs.writeFileSync('src/app/page.tsx', `
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const cities = ['London','Manchester','Birmingham','Leeds','Bristol','Sheffield','Liverpool','Edinburgh','Glasgow','Cardiff','Newcastle','Nottingham']

const cats = [
  { id:'all', label:'All food', emoji:'🍽️' },
  { id:'Bangladeshi', label:'Bangladeshi', emoji:'🍛' },
  { id:'Pakistani', label:'Pakistani', emoji:'🫕' },
  { id:'Indian', label:'Indian', emoji:'🥘' },
  { id:'Caribbean', label:'Caribbean', emoji:'🍗' },
  { id:'Middle Eastern', label:'Middle Eastern', emoji:'🧆' },
  { id:'West African', label:'West African', emoji:'🫘' },
  { id:'Baked goods', label:'Baked goods', emoji:'🎂' },
]

export default function Home() {
  const [listings, setListings] = useState<any[]>([])
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [saved, setSavedIds] = useState<string[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const catRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchListings = async () => {
      setLoadingListings(true)
      let query = supabase.from('listings').select(\`
        *,
        profiles:seller_id (full_name, id)
      \`).eq('status','live')

      if (cat !== 'all') query = query.eq('cuisine', cat)
      if (search) query = query.ilike('name', \`%\${search}%\`)

      const { data } = await query.order('created_at', { ascending: false })
      setListings(data || [])
      setLoadingListings(false)
    }
    fetchListings()
  }, [cat, search])

  const scrollCats = (dir: number) => {
    if (catRef.current) catRef.current.scrollLeft += dir * 200
  }

  const cuisineEmoji: Record<string,string> = {
    'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
    'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Other':'🍽️'
  }

  return (
    <div style={{minHeight:'100vh', background:'#fff', fontFamily:'Inter,system-ui,sans-serif', overflowX:'hidden'}}>
      <style>{\`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
        html { scroll-behavior:smooth; }
        ::-webkit-scrollbar { width:0; height:0; }
        * { scrollbar-width:none; -ms-overflow-style:none; }
        a { text-decoration:none; color:inherit; }
        button { font-family:Inter,system-ui,sans-serif; }
        .lcard { transition:transform 0.2s cubic-bezier(0.34,1.2,0.64,1),box-shadow 0.2s; }
        .lcard:hover { transform:translateY(-6px) !important; box-shadow:0 20px 60px rgba(200,0,106,0.15) !important; }
        .cat-pill:hover { border-color:#C8006A !important; color:#C8006A !important; background:#FFE8F4 !important; }
        .order-btn:hover { background:#A00055 !important; }
        .primary-btn:hover { background:#A00055 !important; }
        .nav-cta:hover { background:#A00055 !important; }
        .footer-link:hover { color:#fff !important; }
        .hiw-card:hover { transform:translateY(-4px) !important; }
        .review-card:hover { transform:translateY(-4px) !important; }
        .scroll-arrow:hover { background:#C8006A !important; color:#fff !important; border-color:#C8006A !important; }
        .save-btn:hover { transform:scale(1.18) !important; }
        .dmode:hover { border-color:#C8006A !important; background:#FFF5FA !important; }
        .ot-card:hover { border-color:#C8006A !important; background:#FFF5FA !important; }
        @media(max-width:1024px){.hero-grid{grid-template-columns:1fr !important;}.hero-right{display:none !important;}.hero-left{padding:56px 24px 48px !important;}.delivery-grid{grid-template-columns:1fr !important;}.hiw-grid{grid-template-columns:1fr 1fr !important;}.footer-grid{grid-template-columns:1fr 1fr !important;gap:32px !important;}}
        @media(max-width:768px){.listings-grid{grid-template-columns:1fr 1fr !important;}.cooks-grid{grid-template-columns:1fr 1fr !important;}.search-row{flex-direction:column !important;}.section-header{flex-direction:column !important;align-items:flex-start !important;}.cta-btns{flex-direction:column !important;}.hiw-grid{grid-template-columns:1fr 1fr !important;}.ot-grid{grid-template-columns:1fr 1fr !important;}}
        @media(max-width:480px){.listings-grid{grid-template-columns:1fr !important;}.hiw-grid{grid-template-columns:1fr !important;}.footer-grid{grid-template-columns:1fr !important;}.nav-links-wrap{display:none !important;}.hero-stats{flex-wrap:wrap !important;}}
      \`}</style>

      {/* NAV */}
      <nav style={{background:'rgba(255,255,255,0.97)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:500,height:66}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px',height:66,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:38,width:'auto'}}/>
          </Link>
          <div className="nav-links-wrap" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Explore food',h:'/',a:true},{l:'Sell & cater',h:'/seller/dashboard',a:false},{l:'Deliver & earn',h:'/driver/dashboard',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} style={{height:66,padding:'0 14px',display:'flex',alignItems:'center',fontSize:14,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',whiteSpace:'nowrap'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center',flexShrink:0}}>
            <Link href="/login" style={{height:36,padding:'0 14px',display:'flex',alignItems:'center',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',whiteSpace:'nowrap'}}>Sign in</Link>
            <Link href="/register" className="nav-cta" style={{height:36,padding:'0 16px',display:'flex',alignItems:'center',background:'#C8006A',borderRadius:8,fontSize:13,fontWeight:700,color:'#fff',whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(200,0,106,0.35)',transition:'background 0.12s'}}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)',minHeight:'88vh',position:'relative',overflow:'hidden',display:'flex',alignItems:'center'}}>
        <div style={{position:'absolute',top:'-15%',right:'-5%',width:'55%',height:'130%',background:'radial-gradient(ellipse,rgba(255,255,255,0.06) 0%,transparent 65%)',pointerEvents:'none'}}/>
        <div className="hero-grid" style={{maxWidth:1240,margin:'0 auto',padding:'0 20px',display:'grid',gridTemplateColumns:'55% 45%',width:'100%',gap:32,alignItems:'center'}}>
          <div className="hero-left" style={{padding:'72px 0',position:'relative',zIndex:1}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.14)',border:'1px solid rgba(255,255,255,0.22)',borderRadius:100,padding:'5px 14px',marginBottom:22}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#fff',display:'inline-block',flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:700,color:'#fff',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>Available across the UK</span>
            </div>
            <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(32px,3.8vw,58px)',fontWeight:700,color:'#fff',lineHeight:1.08,letterSpacing:'-0.025em',marginBottom:18}}>
              Home cooked food,<br/><span style={{color:'rgba(255,255,255,0.78)',fontStyle:'italic'}}>delivered with love.</span>
            </h1>
            <p style={{fontSize:'clamp(14px,1.4vw,17px)',color:'rgba(255,255,255,0.82)',lineHeight:1.75,marginBottom:32,maxWidth:500,fontWeight:400}}>
              Authentic meals from verified home cooks in your area. Real food, real kitchens — Bangladeshi, Pakistani, Indian, Caribbean, Middle Eastern and more.
            </p>
            <div style={{background:'#fff',borderRadius:16,padding:8,boxShadow:'0 8px 48px rgba(0,0,0,0.28)',marginBottom:28}}>
              <div className="search-row" style={{display:'flex',gap:8,marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1,padding:'0 14px',background:'#F8F0F4',borderRadius:10,minWidth:0}}>
                  <span style={{fontSize:18,flexShrink:0}}>📍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dishes or cooks..." style={{border:'none',outline:'none',fontSize:14,fontWeight:500,color:'#1A1A1A',width:'100%',height:44,background:'transparent',minWidth:0}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1,padding:'0 14px',background:'#F8F0F4',borderRadius:10,minWidth:0}}>
                  <span style={{fontSize:18,flexShrink:0}}>🏙️</span>
                  <select value={city} onChange={e=>setCity(e.target.value)} style={{border:'none',outline:'none',fontSize:14,fontWeight:500,color:city?'#1A1A1A':'#8C8C8C',background:'transparent',width:'100%',height:44,cursor:'pointer',appearance:'none' as const,minWidth:0}}>
                    <option value="">Select city</option>
                    {cities.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="search-row" style={{display:'flex',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1,padding:'0 14px',background:'#F8F0F4',borderRadius:10,minWidth:0}}>
                  <span style={{fontSize:18,flexShrink:0}}>🍽️</span>
                  <select value={cuisine} onChange={e=>setCuisine(e.target.value)} style={{border:'none',outline:'none',fontSize:14,fontWeight:500,color:cuisine?'#1A1A1A':'#8C8C8C',background:'transparent',width:'100%',height:44,cursor:'pointer',appearance:'none' as const,minWidth:0}}>
                    <option value="">Any cuisine</option>
                    {['Bangladeshi','Pakistani','Indian','Caribbean','Middle Eastern','West African'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button className="primary-btn" style={{height:52,padding:'0 28px',background:'#C8006A',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(200,0,106,0.4)',transition:'background 0.12s',flexShrink:0}}>
                  Find food →
                </button>
              </div>
            </div>
            <div className="hero-stats" style={{display:'flex',gap:24,flexWrap:'wrap'}}>
              {[['Real food','From real kitchens'],['12%','Seller commission'],['4.8★','Average rating'],['88%','Goes to seller']].map(([n,l])=>(
                <div key={l}>
                  <div style={{fontFamily:'Georgia,serif',fontSize:'clamp(18px,2vw,26px)',fontWeight:700,color:'#fff',letterSpacing:'-0.02em',lineHeight:1}}>{n}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',marginTop:3,textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:700,whiteSpace:'nowrap'}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-right" style={{display:'flex',alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,padding:'40px 0'}}>
            <div style={{background:'rgba(255,255,255,0.1)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:24,padding:28,maxWidth:380,width:'100%'}}>
              <img src="/Color_Logo.png" alt="meaLoyo" style={{height:44,width:'auto',filter:'brightness(0) invert(1)',marginBottom:20}}/>
              <h3 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#fff',marginBottom:8,letterSpacing:'-0.01em'}}>Real home cooked food</h3>
              <p style={{fontSize:14,color:'rgba(255,255,255,0.75)',lineHeight:1.7,marginBottom:20}}>Verified home cooks. Fresh ingredients. Authentic recipes passed down through generations.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[{icon:'✅',t:'Every cook verified & hygiene certified'},{icon:'🔒',t:'Stripe-secured payments, buyer protected'},{icon:'⚡',t:'Hot food delivered in under 45 minutes'},{icon:'💰',t:'Cooks keep 88% — you get better food'}].map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'rgba(255,255,255,0.85)',fontWeight:500}}>
                    <span style={{fontSize:16,flexShrink:0}}>{p.icon}</span>{p.t}
                  </div>
                ))}
              </div>
              <div style={{marginTop:20,display:'flex',gap:10}}>
                <Link href="/register" style={{flex:1,height:44,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',borderRadius:10,fontSize:14,fontWeight:700,color:'#C8006A'}}>Order food</Link>
                <Link href="/register" style={{flex:1,height:44,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,fontSize:14,fontWeight:600,color:'#fff'}}>Start selling</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div style={{background:'#FFE8F4',borderTop:'1px solid rgba(200,0,106,0.12)',borderBottom:'1px solid rgba(200,0,106,0.12)'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',overflowX:'auto'}}>
          {[['🍽️','Home cook marketplace'],['🔒','Stripe-secured payments'],['🛡️','Buyer protection on every order'],['⚡','Community delivery · 45 mins'],['🌿','Allergen declarations mandatory'],['🇬🇧','Available UK-wide']].map(([icon,text],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'12px 16px',fontSize:12,fontWeight:700,color:'#C8006A',whiteSpace:'nowrap',flexShrink:0}}>
              {i>0&&<div style={{width:1,height:14,background:'rgba(200,0,106,0.2)',marginRight:16}}/>}
              <span style={{fontSize:15}}>{icon}</span>{text}
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <section style={{background:'#fff',borderBottom:'1px solid #F0F0F0',padding:'32px 0'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px'}}>
          <div className="section-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:18,gap:12,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Browse by cuisine</div>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.2vw,30px)',fontWeight:700,color:'#1A1A1A'}}>What are you craving?</h2>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button className="scroll-arrow" onClick={()=>scrollCats(-1)} style={{width:36,height:36,borderRadius:'50%',background:'#fff',border:'1.5px solid #E0E0E0',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,color:'#1A1A1A',transition:'all 0.14s'}}>‹</button>
              <button className="scroll-arrow" onClick={()=>scrollCats(1)} style={{width:36,height:36,borderRadius:'50%',background:'#fff',border:'1.5px solid #E0E0E0',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,color:'#1A1A1A',transition:'all 0.14s'}}>›</button>
            </div>
          </div>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute',left:0,top:0,bottom:0,width:40,background:'linear-gradient(to right,#fff,transparent)',zIndex:1,pointerEvents:'none'}}/>
            <div style={{position:'absolute',right:0,top:0,bottom:0,width:40,background:'linear-gradient(to left,#fff,transparent)',zIndex:1,pointerEvents:'none'}}/>
            <div ref={catRef} style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:4,paddingTop:4,scrollBehavior:'smooth'}}>
              {cats.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)} className="cat-pill" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',background:cat===c.id?'#FFE8F4':'#fff',border:cat===c.id?'2px solid #C8006A':'2px solid #E8E8E8',borderRadius:100,fontSize:14,fontWeight:700,color:cat===c.id?'#C8006A':'#1A1A1A',whiteSpace:'nowrap',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.04)',transition:'all 0.14s',cursor:'pointer'}}>
                  <span style={{fontSize:18,lineHeight:1}}>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LISTINGS */}
      <section style={{padding:'52px 0',background:'#F8F0F4'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
            <div style={{fontSize:15,fontWeight:700,color:'#1A1A1A'}}>
              {loadingListings ? 'Loading...' : <><span style={{color:'#C8006A'}}>{listings.length}</span> {listings.length===1?'dish':'dishes'} available</>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <select style={{height:38,padding:'0 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,fontWeight:600,color:'#1A1A1A',background:'#fff',cursor:'pointer',outline:'none'}}>
                <option>Recommended</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Highest rated</option>
              </select>
            </div>
          </div>

          {loadingListings ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{background:'#fff',borderRadius:20,overflow:'hidden',border:'1.5px solid rgba(200,0,106,0.07)'}}>
                  <div style={{height:180,background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)',animation:'pulse 1.5s ease-in-out infinite'}}/>
                  <div style={{padding:16}}>
                    <div style={{height:16,background:'#F0E8F0',borderRadius:8,marginBottom:8,width:'70%'}}/>
                    <div style={{height:12,background:'#F0E8F0',borderRadius:8,width:'50%'}}/>
                  </div>
                  <style>{\`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}\`}</style>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div style={{fontSize:48,marginBottom:16}}>🍽️</div>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No listings yet in this area</h2>
              <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.65,maxWidth:360,margin:'0 auto 24px'}}>
                {cat !== 'all' ? \`No \${cat} dishes available right now. Try a different cuisine.\` : 'Be the first home cook in your area — list your food and start earning today.'}
              </p>
              <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
                {cat !== 'all' && <button onClick={()=>setCat('all')} style={{height:42,padding:'0 20px',background:'#FFE8F4',color:'#C8006A',border:'1.5px solid rgba(200,0,106,0.2)',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>View all cuisines</button>}
                <Link href="/register" style={{height:42,padding:'0 20px',display:'flex',alignItems:'center',background:'#C8006A',color:'#fff',borderRadius:10,fontSize:14,fontWeight:700,boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>Start selling your food →</Link>
              </div>
            </div>
          ) : (
            <div className="listings-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}}>
              {listings.map(l=>(
                <div key={l.id} className="lcard" style={{background:'#fff',borderRadius:20,overflow:'hidden',boxShadow:'0 2px 16px rgba(200,0,106,0.07)',border:'1.5px solid rgba(200,0,106,0.07)',cursor:'pointer'}}>
                  <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',fontSize:64,background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)',position:'relative'}}>
                    {cuisineEmoji[l.cuisine] || '🍽️'}
                    <button className="save-btn" onClick={e=>e.stopPropagation()} style={{position:'absolute',top:12,right:12,width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.95)',border:'1.5px solid rgba(200,0,106,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',transition:'transform 0.14s'}}>🤍</button>
                    {l.featured && <div style={{position:'absolute',top:12,left:12,background:'#C8006A',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20}}>Featured</div>}
                  </div>
                  <div style={{padding:'15px 16px'}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:4,lineHeight:1.3}}>{l.name}</div>
                    <div style={{fontSize:12,color:'#1A1A1A',marginBottom:8,display:'flex',alignItems:'center',gap:5,fontWeight:500}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:'#C8006A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff',flexShrink:0}}>
                        {l.profiles?.full_name?.[0] || 'C'}
                      </div>
                      {l.profiles?.full_name || 'Home cook'} <span style={{color:'#C8006A',fontWeight:600}}>· {l.cuisine}</span>
                    </div>
                    {l.allergens && l.allergens.length > 0 && (
                      <div style={{fontSize:11,color:'#1A1A1A',marginBottom:10,fontWeight:400}}>
                        ⚠️ Contains: {l.allergens.slice(0,3).join(', ')}{l.allergens.length>3?\` +\${l.allergens.length-3} more`:''}
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:11,borderTop:'1px solid #F5F0F3'}}>
                      <div>
                        <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
                        <div style={{fontSize:11,color:'#1A1A1A',marginTop:1,fontWeight:600}}>
                          {l.reviews_count > 0 ? <><span style={{color:'#C8006A'}}>★</span> {l.rating} ({l.reviews_count})</> : 'New listing'}
                        </div>
                      </div>
                      <Link href={\`/register\`} className="order-btn" style={{height:34,padding:'0 16px',background:'#C8006A',color:'#fff',border:'none',borderRadius:9,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',boxShadow:'0 4px 12px rgba(200,0,106,0.3)',transition:'all 0.12s'}}>Order now</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{padding:'72px 0',background:'#fff'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px'}}>
          <div style={{textAlign:'center',marginBottom:44}}>
            <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Simple process</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(22px,2.8vw,38px)',fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.02em',marginBottom:12}}>From browse to bite in 4 steps</h2>
          </div>
          <div className="hiw-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:18}}>
            {[
              {n:'01',icon:'📍',title:'Enter your postcode',desc:'See home cooks within your area sorted by cuisine, rating and availability.'},
              {n:'02',icon:'🛒',title:'Browse & pay securely',desc:'Pick your food, choose delivery or free collection. Pay by card or Apple Pay.'},
              {n:'03',icon:'👩‍🍳',title:'Cook prepares it fresh',desc:'Your cook gets the order and cooks fresh. Real-time updates keep you informed.'},
              {n:'04',icon:'🏠',title:'Delivered or collected',desc:'Hot food at your door in 45 mins or collect free with QR code confirmation.'},
            ].map(s=>(
              <div key={s.n} className="hiw-card" style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)',borderRadius:20,padding:'26px 20px',border:'1.5px solid rgba(200,0,106,0.1)',transition:'all 0.2s'}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:38,fontWeight:700,color:'rgba(200,0,106,0.12)',lineHeight:1,marginBottom:14}}>{s.n}</div>
                <div style={{fontSize:28,marginBottom:10}}>{s.icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:7}}>{s.title}</div>
                <div style={{fontSize:12,color:'#1A1A1A',lineHeight:1.65,fontWeight:400}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)',padding:'76px 20px',position:'relative',overflow:'hidden',textAlign:'center'}}>
        <div style={{position:'absolute',right:'-5%',top:'-40%',width:'50%',height:'200%',borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
        <div style={{maxWidth:660,margin:'0 auto',position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
            <img src="/White_Logo.png" alt="meaLoyo" style={{height:48,width:'auto'}}/>
          </div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(24px,3.5vw,44px)',fontWeight:700,color:'#fff',letterSpacing:'-0.02em',marginBottom:10,lineHeight:1.15}}>Hungry? Find a home cook near you.</h2>
          <p style={{fontSize:'clamp(14px,1.4vw,17px)',color:'rgba(255,255,255,0.85)',marginBottom:28,lineHeight:1.65,fontWeight:400}}>Home cooked food across the UK. Authentic recipes. No restaurant markup.</p>
          <div className="cta-btns" style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <Link href="/register" style={{height:52,padding:'0 32px',background:'#fff',color:'#C8006A',borderRadius:12,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',boxShadow:'0 6px 20px rgba(0,0,0,0.15)'}}>Order food now</Link>
            <Link href="/register" style={{height:52,padding:'0 32px',background:'rgba(255,255,255,0.12)',color:'#fff',border:'2px solid rgba(255,255,255,0.28)',borderRadius:12,fontSize:15,fontWeight:600,display:'flex',alignItems:'center'}}>Start selling your food</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{background:'#1A1A1A',padding:'48px 0 24px'}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 20px'}}>
          <div className="footer-grid" style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:40,marginBottom:32}}>
            <div>
              <div style={{marginBottom:12}}>
                <img src="/White_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/>
              </div>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.7,maxWidth:240,marginBottom:14,fontWeight:400}}>The UK home cook food marketplace. Authentic meals from verified home cooks across the UK.</p>
              <span style={{display:'inline-flex',alignItems:'center',gap:5,background:'rgba(200,0,106,0.18)',color:'#FFE8F4',border:'1px solid rgba(200,0,106,0.28)',padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700}}>meaLoyo · Est. 2026</span>
            </div>
            {[
              {head:'Buy food',links:['Browse listings','Find local cooks','Event catering','Office lunches','Meal prep boxes']},
              {head:'Sell food',links:['Start selling','Seller dashboard','Pricing & packages','Compliance guide','Seller support']},
              {head:'Company',links:['About us','Deliver with us','Blog','Contact','Privacy policy']},
            ].map(s=>(
              <div key={s.head}>
                <div style={{fontSize:11,fontWeight:700,color:'#fff',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>{s.head}</div>
                <div style={{display:'flex',flexDirection:'column',gap:9}}>
                  {s.links.map(l=><a key={l} href="#" className="footer-link" style={{fontSize:13,color:'rgba(255,255,255,0.45)',fontWeight:500,transition:'color 0.12s'}}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:18,display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.3)',flexWrap:'wrap',gap:8}}>
            <span>© 2026 meaLoyo Ltd. Registered in England & Wales.</span>
            <span>UK-wide · hello@mealoyo.com</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
`)
console.log('Homepage updated — now pulls real listings from Supabase')

console.log('')
console.log('════════════════════════════════')
console.log('ALL DONE')
console.log('════════════════════════════════')
console.log('/seller/listings      — view all listings')
console.log('/seller/listings/new  — add new dish form')
console.log('/                     — homepage now shows REAL listings from database')