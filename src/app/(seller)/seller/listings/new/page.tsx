
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { CSSProperties } from 'react'
import type { User, Profile } from '@/lib/types'

const ALLERGENS = ['Gluten','Dairy','Nuts','Eggs','Fish','Shellfish','Soya','Sesame','Celery','Mustard','Lupin','Sulphites','Molluscs','Peanuts']
const CUISINES = ['Bangladeshi','Pakistani','Indian','Caribbean','Middle Eastern','West African','Turkish','Sri Lankan','Afghan','East African','Chinese','Other']

export default function NewListing() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(true)
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
  })

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      setCheckingProfile(false)
    }
    getData()
  }, [router])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const set = (k: string, v: string | boolean | string[]) => setForm(prev => ({...prev, [k]: v}))

  const toggleAllergen = (a: string) => setForm(prev => ({
    ...prev,
    allergens: prev.allergens.includes(a)
      ? prev.allergens.filter(x => x !== a)
      : [...prev.allergens, a]
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Please enter a dish name'); return }
    if (!form.price || parseFloat(form.price) < 1) { setError('Price must be at least £1'); return }
    if (!form.cuisine) { setError('Please select a cuisine type'); return }
    if (!form.description.trim()) { setError('Please add a description'); return }
    if (!user) return
    setLoading(true)
    setError('')
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

  if (checkingProfile) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading...</p>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,system-ui,sans-serif',padding:24}}>
      <div style={{background:'#fff',borderRadius:24,padding:'48px 36px',maxWidth:480,width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56,marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1A1A',marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.7,marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44,padding:'0 24px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  if (saved) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:20,padding:'48px 36px',textAlign:'center',maxWidth:420,boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:48,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>Listing submitted</h2>
        <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.65}}>Your dish has been submitted for review. Our team will verify and make it live within 24 hours.</p>
      </div>
    </div>
  )

  const inp: CSSProperties = {height:46,border:'1.5px solid #E0E0E0',borderRadius:10,padding:'0 14px',fontSize:14,color:'#1A1A1A',background:'#FAFAFA',width:'100%',fontFamily:'Inter,system-ui,sans-serif',outline:'none'}
  const lbl = {fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:6,display:'block'}
  const sec = {background:'#fff',borderRadius:18,padding:'24px',marginBottom:16,boxShadow:'0 2px 10px rgba(200,0,106,0.05)',border:'1.5px solid rgba(200,0,106,0.07)'}
  const sel = {...inp, appearance:'none' as const, paddingRight:36}

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        input:focus,select:focus,textarea:focus{border-color:#C8006A !important;outline:none;background:#fff !important;}
        .pill{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:100px;border:1.5px solid #E0E0E0;cursor:pointer;font-size:13px;font-weight:600;color:#1A1A1A;background:#fff;transition:all 0.14s;user-select:none;margin:4px;}
        .pill.on{border-color:#C8006A;background:#FFE8F4;color:#C8006A;}
        .pill:hover{border-color:#C8006A;}
        .sub:hover{background:#A00055 !important;}
        .nav-link:hover{color:#C8006A !important;}
        @media(max-width:768px){.nav-links{display:none!important;}}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}><Logo height={34}/></Link>
          <div className="nav-links" style={{display:'flex',gap:0,flex:1}}>
            {[{l:'Dashboard',h:'/seller/dashboard',a:false},{l:'My listings',h:'/seller/listings',a:true},{l:'Orders',h:'/seller/orders',a:false},{l:'Earnings',h:'/seller/earnings',a:false},{l:'Profile',h:'/seller/profile',a:false}].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div style={{maxWidth:800,margin:'0 auto',padding:'28px 20px 48px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,26px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Add a new dish</h1>
        <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400,marginBottom:24}}>Your listing will be reviewed and go live within 24 hours.</p>

        {error && (
          <div style={{background:'#FFE8F4',border:'1.5px solid rgba(200,0,106,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#C8006A',fontWeight:600}}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Basic info */}
          <div style={sec}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:18}}>Basic information</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={lbl}>Dish name *</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Lamb biryani with raita and salad" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Description *</label>
                <textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe your dish — ingredients, portion size, what makes it special..." rows={3}
                  style={{...inp,height:'auto',padding:'12px 14px',lineHeight:1.55,resize:'vertical' as const}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <label style={lbl}>Cuisine *</label>
                  <select value={form.cuisine} onChange={e=>set('cuisine',e.target.value)} style={sel}>
                    <option value="">Select cuisine</option>
                    {CUISINES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Price per portion (£) *</label>
                  <input type="number" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="0.00" min="1" step="0.50" style={inp}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div>
                  <label style={lbl}>Serves how many?</label>
                  <select value={form.serves} onChange={e=>set('serves',e.target.value)} style={sel}>
                    <option value="1">1 person</option>
                    <option value="2">2 people</option>
                    <option value="3">3–4 people</option>
                    <option value="5">5–6 people</option>
                    <option value="10">Catering (10+)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Preparation time</label>
                  <select value={form.prep_time} onChange={e=>set('prep_time',e.target.value)} style={sel}>
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>2 hours</option>
                    <option>3 hours</option>
                    <option>Pre-order only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dietary */}
          <div style={sec}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Dietary information</h2>
            <p style={{fontSize:13,color:'#1A1A1A',marginBottom:14,fontWeight:400}}>Select all that apply.</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {[{k:'halal',l:'🟢 Halal'},{k:'vegan',l:'🌿 Vegan'},{k:'vegetarian',l:'🥦 Vegetarian'},{k:'spicy',l:'🌶️ Spicy'}].map(tag=>(
                <div key={tag.k} className={`pill ${(form as unknown as Record<string, boolean>)[tag.k]?'on':''}`} onClick={()=>set(tag.k,!(form as unknown as Record<string, boolean>)[tag.k])}>{tag.l}</div>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div style={sec}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:6}}>Allergens declared</h2>
            <p style={{fontSize:13,color:'#1A1A1A',marginBottom:14,fontWeight:400,lineHeight:1.55}}>
              Legal requirement — tick every allergen present in this dish.
            </p>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {ALLERGENS.map(a=>(
                <div key={a} className={`pill ${form.allergens.includes(a)?'on':''}`} onClick={()=>toggleAllergen(a)}>
                  {form.allergens.includes(a)?'✓ ':''}{a}
                </div>
              ))}
            </div>
            {form.allergens.length === 0 && (
              <p style={{fontSize:12,color:'#E8930A',marginTop:10,fontWeight:600}}>⚠️ No allergens selected — please confirm this dish is allergen-free before submitting.</p>
            )}
          </div>

          {/* Delivery */}
          <div style={sec}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:16,fontWeight:700,color:'#1A1A1A',marginBottom:14}}>Delivery options</h2>
            <label style={lbl}>How can buyers receive this dish?</label>
            <select value={form.delivery_options} onChange={e=>set('delivery_options',e.target.value)} style={sel}>
              <option>Collection & delivery</option>
              <option>Collection only</option>
              <option>Delivery only</option>
              <option>Pre-order catering only</option>
              <option>Postal UK-wide</option>
            </select>
          </div>

          {/* Submit */}
          <div style={sec}>
            <div style={{background:'#FFE8F4',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
              <p style={{fontSize:13,color:'#C8006A',fontWeight:600,lineHeight:1.6}}>
                📋 By submitting you confirm this dish is prepared in a registered food business, all allergen information is accurate, and you hold a valid Level 2 Food Hygiene Certificate.
              </p>
            </div>
            <div style={{display:'flex',gap:12}}>
              <Link href="/seller/listings" style={{flex:1,height:50,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #E0E0E0',borderRadius:12,fontSize:14,fontWeight:600,color:'#1A1A1A',background:'#fff'}}>
                Cancel
              </Link>
              <button type="submit" disabled={loading} className="sub"
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
