'use client'
import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { commission, sellerReceives, COMMISSION_RATE } from '@/lib/pricing'
import type { CSSProperties } from 'react'
import type { User, Profile } from '@/lib/types'

const RADIUS_OPTIONS = [
  { v: '1', l: '1 mile' },
  { v: '2', l: '2 miles' },
  { v: '3', l: '3 miles (default)' },
  { v: '5', l: '5 miles' },
  { v: '0', l: 'Collection only (no delivery)' },
]

const ALLERGENS = ['Gluten','Dairy','Nuts','Eggs','Fish','Shellfish','Soya','Sesame','Celery','Mustard','Lupin','Sulphites','Molluscs','Peanuts']
const CUISINES = ['Bangladeshi','Pakistani','Indian','Caribbean','Middle Eastern','West African','Turkish','Sri Lankan','Afghan','East African','Chinese','Other']
const DIETARY = [{k:'halal',l:'Halal',e:'🟢'},{k:'vegan',l:'Vegan',e:'🌿'},{k:'vegetarian',l:'Vegetarian',e:'🥦'},{k:'spicy',l:'Spicy',e:'🌶️'}]
const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆',
  'West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚','Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}
const SECTIONS = ['Basics', 'Photo', 'Dietary', 'Allergens', 'Review']

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
  { l:'Profile', h:'/seller/profile' },
]

export default function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const router = useRouter()

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    cuisine: '',
    serves: '1',
    prep_time: '1 hour',
    delivery_options: 'Collection & delivery',
    delivery_radius: '3',
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

      const { data: listing, error: fetchErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      // Not found, fetch error, or not owned by this seller → error state
      if (fetchErr || !listing || listing.seller_id !== user.id) {
        setNotFound(true)
        setLoadingData(false)
        setTimeout(() => router.push('/seller/listings'), 2600)
        return
      }

      const delivery = Array.isArray(listing.delivery_options)
        ? (listing.delivery_options[0] || 'Collection & delivery')
        : (listing.delivery_options || 'Collection & delivery')

      setStatus(listing.status || 'pending')
      setForm({
        name: listing.name || '',
        description: listing.description || '',
        price: listing.price != null ? String(listing.price) : '',
        cuisine: listing.cuisine || '',
        serves: listing.serves != null ? String(listing.serves) : '1',
        prep_time: listing.prep_time || '1 hour',
        delivery_options: delivery,
        delivery_radius: listing.delivery_radius_miles != null ? String(listing.delivery_radius_miles) : '3',
        allergens: Array.isArray(listing.allergens) ? listing.allergens : [],
        halal: !!listing.halal,
        vegan: !!listing.vegan,
        vegetarian: !!listing.vegetarian,
        spicy: !!listing.spicy,
      })
      setLoadingData(false)
    }
    getData()
  }, [id, router])

  // Scrollspy → progress indicator
  useEffect(() => {
    if (loadingData || updated || notFound || profile?.status === 'pending') return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const idx = sectionRefs.current.findIndex(r => r === e.target)
            if (idx >= 0) setActiveStep(idx)
          }
        })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )
    sectionRefs.current.forEach(r => r && observer.observe(r))
    return () => observer.disconnect()
  }, [loadingData, updated, notFound, profile])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }
  const set = (k: string, v: string | boolean | string[]) => setForm(prev => ({...prev, [k]: v}))
  const toggleAllergen = (a: string) => setForm(prev => ({
    ...prev,
    allergens: prev.allergens.includes(a) ? prev.allergens.filter(x => x !== a) : [...prev.allergens, a]
  }))
  const scrollTo = (i: number) => sectionRefs.current[i]?.scrollIntoView({ behavior:'smooth', block:'start' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Please enter a dish name'); return }
    if (!form.price || parseFloat(form.price) < 1) { setError('Price must be at least £1'); return }
    if (!form.cuisine) { setError('Please select a cuisine type'); return }
    if (!form.description.trim()) { setError('Please add a description'); return }
    if (!user) return
    setLoading(true)
    setError('')
    const { error: dbError } = await supabase.from('listings').update({
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      cuisine: form.cuisine,
      serves: parseInt(form.serves),
      prep_time: form.prep_time,
      delivery_options: [form.delivery_options],
      delivery_radius_miles: parseFloat(form.delivery_radius),
      allergens: form.allergens,
      halal: form.halal,
      vegan: form.vegan,
      vegetarian: form.vegetarian,
      spicy: form.spicy,
    }).eq('id', id).eq('seller_id', user.id)
    if (dbError) { setError(dbError.message); setLoading(false); return }
    setUpdated(true)
    setTimeout(() => router.push('/seller/listings'), 1800)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    if (!user) return
    setDeleting(true)
    const { error: delErr } = await supabase.from('listings').delete().eq('id', id).eq('seller_id', user.id)
    if (delErr) { setError(delErr.message); setDeleting(false); return }
    router.push('/seller/listings')
  }

  const statusColor = (s: string) => s === 'live' ? '#2DA84E' : s === 'pending' ? '#B8730A' : '#C0392B'
  const statusBg = (s: string) => s === 'live' ? '#E4F6EA' : s === 'pending' ? '#FFF4E0' : '#FDECEA'

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      input:focus, select:focus, textarea:focus { border-color: #C8006A !important; outline: none; background: #fff !important; box-shadow: 0 0 0 3px rgba(200,0,106,0.08); }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .chip { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; padding: 0 14px; border-radius: 12px; border: 1.5px solid #E0E0E0; cursor: pointer; font-size: 13px; font-weight: 600; color: #1A1A1A; background: #fff; transition: all 0.15s cubic-bezier(0.34,1.2,0.64,1); user-select: none; }
      .chip:hover { border-color: #C8006A; transform: translateY(-1px); }
      .chip.on { border-color: #C8006A; background: #FFE8F4; color: #C8006A; box-shadow: 0 2px 8px rgba(200,0,106,0.12); }
      .diet-chip { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px; border-radius: 100px; border: 1.5px solid #E0E0E0; cursor: pointer; font-size: 14px; font-weight: 600; color: #1A1A1A; background: #fff; transition: all 0.15s cubic-bezier(0.34,1.2,0.64,1); user-select: none; }
      .diet-chip:hover { border-color: #C8006A; transform: translateY(-1px); }
      .diet-chip.on { border-color: #C8006A; background: #FFE8F4; color: #C8006A; box-shadow: 0 2px 8px rgba(200,0,106,0.12); }
      .sub:hover { background: #A00055 !important; transform: translateY(-1px); }
      .del-hdr:hover { background: #FDECEA !important; border-color: #C0392B !important; }
      .step-dot { cursor: pointer; transition: all 0.18s; }
      .upload-zone:hover { border-color: #C8006A !important; background: #FFF5FA !important; }
      .mobile-bar { display: none; }
      @media (max-width: 900px) {
        .nav-links { display: none !important; }
        .form-grid { grid-template-columns: 1fr !important; }
        .preview-col { position: static !important; order: -1; margin-bottom: 8px; }
        .desktop-submit { display: none !important; }
        .mobile-bar { display: flex !important; }
        .form-wrap { padding-bottom: 92px !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/listings'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : '#1A1A1A', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loadingData) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1080, margin:'0 auto', padding:'28px 20px'}}>
        <div className="skel" style={{height:30, width:240, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:14, width:340, borderRadius:6, marginBottom:24}}/>
        <div className="form-grid" style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:24, alignItems:'start'}}>
          <div>
            {Array.from({length:3}).map((_, i) => (
              <div key={i} style={{background:'#fff', borderRadius:20, padding:26, marginBottom:18, border:'1.5px solid rgba(200,0,106,0.07)'}}>
                <div className="skel" style={{height:18, width:'40%', borderRadius:6, marginBottom:18}}/>
                <div className="skel" style={{height:48, width:'100%', borderRadius:12, marginBottom:14}}/>
                <div className="skel" style={{height:48, width:'100%', borderRadius:12}}/>
              </div>
            ))}
          </div>
          <div style={{background:'#fff', borderRadius:20, overflow:'hidden', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div className="skel" style={{height:130}}/>
            <div style={{padding:18}}>
              <div className="skel" style={{height:16, width:'70%', borderRadius:6, marginBottom:10}}/>
              <div className="skel" style={{height:12, width:'100%', borderRadius:6}}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── NOT FOUND / NOT OWNED ──
  if (notFound) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}{nav}
      <div style={{maxWidth:460, margin:'0 auto', padding:'56px 20px'}}>
        <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'48px 36px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#FDECEA,#FFF4F2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:38, margin:'0 auto 18px'}}>🔍</div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Listing not found</h2>
          <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>This dish doesn&apos;t exist or isn&apos;t one of yours. Taking you back to your listings…</p>
          <Link href="/seller/listings" className="sub" style={{display:'inline-flex', alignItems:'center', height:46, padding:'0 24px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:14, fontWeight:700}}>Back to my listings</Link>
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL ──
  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}{nav}
      <div style={{maxWidth:480, margin:'0 auto', padding:'56px 20px'}}>
        <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'48px 36px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Awaiting approval</h2>
          <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You&apos;ll be able to manage listings within 24–48 hours.</p>
          <button onClick={signOut} className="sub" style={{height:46, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
        </div>
      </div>
    </div>
  )

  // ── SUCCESS ──
  if (updated) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      {pageStyles}
      <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'48px 36px', textAlign:'center', maxWidth:420, boxShadow:'0 4px 24px rgba(200,0,106,0.12)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#E4F6EA,#F0FBF3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:8}}>Changes saved</h2>
        <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.65}}>Your listing has been updated. Taking you back to your listings…</p>
      </div>
    </div>
  )

  const inp: CSSProperties = {height:48, border:'1.5px solid #E0E0E0', borderRadius:12, padding:'0 14px', fontSize:14, color:'#1A1A1A', background:'#FAFAFA', width:'100%', fontFamily:'Inter,system-ui,sans-serif', outline:'none', transition:'all 0.15s'}
  const lbl = {fontSize:11, fontWeight:700, color:'#1A1A1A', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:7, display:'block'}
  const sec: CSSProperties = {background:'#fff', borderRadius:20, padding:'26px', marginBottom:18, boxShadow:'0 2px 12px rgba(200,0,106,0.05)', border:'1.5px solid rgba(200,0,106,0.07)', scrollMarginTop:88}
  const sel = {...inp, appearance:'none' as const, paddingRight:36, cursor:'pointer'}
  const secTitle = (n: number, t: string, s?: string) => (
    <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:18}}>
      <div style={{width:30, height:30, borderRadius:9, background:'#FFE8F4', color:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, fontFamily:'Georgia,serif', flexShrink:0}}>{n}</div>
      <div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A'}}>{t}</h2>
        {s && <p style={{fontSize:12, color:'#1A1A1A', opacity:0.7, fontWeight:500}}>{s}</p>}
      </div>
    </div>
  )

  const dietaryActive = DIETARY.filter(d => (form as unknown as Record<string, boolean>)[d.k])

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      {/* Progress indicator */}
      <div style={{background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:64, zIndex:90}}>
        <div style={{maxWidth:1080, margin:'0 auto', padding:'14px 20px', display:'flex', alignItems:'center', gap:6, overflowX:'auto'}}>
          {SECTIONS.map((s, i) => {
            const done = i < activeStep
            const active = i === activeStep
            return (
              <div key={s} style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                <div className="step-dot" onClick={() => scrollTo(i)} style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, background:active ? '#C8006A' : done ? '#E4F6EA' : '#F0E4EC', color:active ? '#fff' : done ? '#2DA84E' : '#1A1A1A', transition:'all 0.18s', flexShrink:0}}>{done ? '✓' : i + 1}</div>
                  <span style={{fontSize:13, fontWeight:active ? 700 : 600, color:active ? '#C8006A' : '#1A1A1A', whiteSpace:'nowrap'}}>{s}</span>
                </div>
                {i < SECTIONS.length - 1 && <div style={{width:24, height:2, background:done ? '#2DA84E' : '#EBD7BE', borderRadius:2}}/>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="form-wrap" style={{maxWidth:1080, margin:'0 auto', padding:'28px 20px 48px'}}>
        {/* Header with status badge + delete */}
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:22}}>
          <div>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,30px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>Edit dish</h1>
              <span style={{background:statusBg(status), color:statusColor(status), padding:'5px 12px', borderRadius:100, fontSize:12, fontWeight:700, textTransform:'capitalize'}}>{status}</span>
            </div>
            <p style={{fontSize:14, color:'#1A1A1A', opacity:0.8}}>Update the details below — changes are reviewed and reflected within 24 hours.</p>
          </div>
          <button onClick={handleDelete} disabled={deleting} className="del-hdr" style={{height:44, padding:'0 18px', display:'inline-flex', alignItems:'center', gap:8, border:'1.5px solid #E0E0E0', borderRadius:12, fontSize:14, fontWeight:700, color:'#C0392B', background:'#fff', cursor:deleting ? 'not-allowed' : 'pointer', transition:'all 0.15s', opacity:deleting ? 0.7 : 1, flexShrink:0}}>
            🗑️ {deleting ? 'Deleting…' : 'Delete listing'}
          </button>
        </div>

        {error && (
          <div className="fade-up" style={{background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.25)', borderRadius:12, padding:'13px 16px', marginBottom:18, fontSize:13, color:'#C8006A', fontWeight:600}}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:24, alignItems:'start'}}>

            {/* LEFT: form sections */}
            <div>
              {/* 1. Basics */}
              <div ref={el => { sectionRefs.current[0] = el }} style={sec}>
                {secTitle(1, 'Basic information', 'The essentials buyers see first')}
                <div style={{display:'flex', flexDirection:'column', gap:16}}>
                  <div>
                    <label style={lbl}>Dish name *</label>
                    <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Lamb biryani with raita and salad" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Description *</label>
                    <textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe your dish — ingredients, portion size, what makes it special..." rows={3}
                      style={{...inp, height:'auto', padding:'12px 14px', lineHeight:1.55, resize:'vertical' as const}}/>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
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
                  {parseFloat(form.price) > 0 && (
                    <div style={{background:'#FFF5FA', border:'1.5px solid rgba(200,0,106,0.14)', borderRadius:12, padding:'12px 15px', display:'flex', flexDirection:'column', gap:6}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:13, color:'#1A1A1A'}}>
                        <span>Platform commission ({Math.round(COMMISSION_RATE*100)}%)</span>
                        <span style={{fontWeight:700, color:'#C8006A', fontFamily:'Georgia,serif'}}>£{commission(parseFloat(form.price)).toFixed(2)}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:13, color:'#1A1A1A'}}>
                        <span>You receive ({Math.round((1-COMMISSION_RATE)*100)}%)</span>
                        <span style={{fontWeight:700, color:'#C8006A', fontFamily:'Georgia,serif', fontSize:15}}>£{sellerReceives(parseFloat(form.price)).toFixed(2)}</span>
                      </div>
                      <p style={{fontSize:11, color:'#1A1A1A', opacity:0.6, marginTop:2}}>Per portion, before delivery. Buyers also pay a small service fee.</p>
                    </div>
                  )}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
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
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
                    <div>
                      <label style={lbl}>Delivery options</label>
                      <select value={form.delivery_options} onChange={e=>set('delivery_options',e.target.value)} style={sel}>
                        <option>Collection &amp; delivery</option>
                        <option>Collection only</option>
                        <option>Delivery only</option>
                        <option>Pre-order catering only</option>
                        <option>Postal UK-wide</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Delivery radius</label>
                      <select value={form.delivery_radius} onChange={e=>set('delivery_radius',e.target.value)} style={sel}>
                        {RADIUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  </div>
                  <p style={{fontSize:12, color:'#1A1A1A', opacity:0.65, marginTop:-6}}>Buyers beyond your radius (or over 5 miles) won&apos;t see a delivery option — collection only.</p>
                </div>
              </div>

              {/* 2. Photo */}
              <div ref={el => { sectionRefs.current[1] = el }} style={sec}>
                {secTitle(2, 'Dish photo', 'A great photo can double your orders')}
                <div className="upload-zone" style={{border:'2px dashed #E0BCD2', borderRadius:14, background:'#FAFAFA', padding:'36px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.16s'}}>
                  <div style={{width:60, height:60, borderRadius:'50%', background:'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 12px'}}>📷</div>
                  <p style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:4}}>Add a photo of your dish</p>
                  <p style={{fontSize:12, color:'#1A1A1A', opacity:0.7}}>Drag &amp; drop or click to upload · JPG or PNG</p>
                  <span style={{display:'inline-block', marginTop:14, padding:'4px 12px', background:'#FFF4E0', color:'#B8730A', borderRadius:100, fontSize:11, fontWeight:700}}>Photo upload coming soon</span>
                </div>
              </div>

              {/* 3. Dietary */}
              <div ref={el => { sectionRefs.current[2] = el }} style={sec}>
                {secTitle(3, 'Dietary information', 'Select all that apply')}
                <div style={{display:'flex', flexWrap:'wrap', gap:10}}>
                  {DIETARY.map(tag => {
                    const on = (form as unknown as Record<string, boolean>)[tag.k]
                    return (
                      <div key={tag.k} className={`diet-chip ${on ? 'on' : ''}`} onClick={() => set(tag.k, !on)}>
                        <span style={{fontSize:16}}>{tag.e}</span>{tag.l}{on && <span style={{fontWeight:800}}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 4. Allergens */}
              <div ref={el => { sectionRefs.current[3] = el }} style={sec}>
                {secTitle(4, 'Allergens declared', 'Legal requirement — tick every allergen present')}
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(116px,1fr))', gap:10}}>
                  {ALLERGENS.map(a => {
                    const on = form.allergens.includes(a)
                    return (
                      <div key={a} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleAllergen(a)}>
                        <span style={{width:18, height:18, borderRadius:5, border:on ? 'none' : '1.5px solid #CBB8C4', background:on ? '#C8006A' : '#fff', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0}}>{on ? '✓' : ''}</span>
                        {a}
                      </div>
                    )
                  })}
                </div>
                {form.allergens.length === 0 && (
                  <p style={{fontSize:12, color:'#B8730A', marginTop:14, fontWeight:600, background:'#FFF4E0', padding:'10px 12px', borderRadius:10}}>⚠️ No allergens selected — please confirm this dish is allergen-free before saving.</p>
                )}
              </div>

              {/* 5. Review */}
              <div ref={el => { sectionRefs.current[4] = el }} style={sec}>
                {secTitle(5, 'Review & save', 'Confirm your changes')}
                <div style={{background:'#FFE8F4', borderRadius:12, padding:'14px 16px', marginBottom:18}}>
                  <p style={{fontSize:13, color:'#C8006A', fontWeight:600, lineHeight:1.6}}>
                    📋 By saving you confirm this dish is prepared in a registered food business, all allergen information is accurate, and you hold a valid Level 2 Food Hygiene Certificate.
                  </p>
                </div>
                <div className="desktop-submit" style={{display:'flex', gap:12}}>
                  <Link href="/seller/listings" style={{flex:1, height:52, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid #E0E0E0', borderRadius:12, fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#fff'}}>Cancel</Link>
                  <button type="submit" disabled={loading} className="sub"
                    style={{flex:2, height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', transition:'all 0.15s', opacity:loading ? 0.8 : 1}}>
                    {loading ? 'Saving…' : 'Update listing →'}
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: live preview */}
            <div className="preview-col" style={{position:'sticky', top:140}}>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>Live preview</div>
              <div style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 20px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
                <div style={{height:130, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:56, position:'relative'}}>
                  {cuisineEmoji[form.cuisine] || '🍽️'}
                  <span style={{position:'absolute', top:12, right:12, background:statusBg(status), color:statusColor(status), padding:'4px 11px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'capitalize'}}>{status}</span>
                </div>
                <div style={{padding:'18px'}}>
                  <h3 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', lineHeight:1.25, marginBottom:6}}>{form.name || 'Your dish name'}</h3>
                  <p style={{fontSize:13, color:'#1A1A1A', opacity:0.85, lineHeight:1.5, marginBottom:14, minHeight:38, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{form.description || 'Your description will appear here as buyers see it.'}</p>
                  <div style={{display:'flex', gap:14, marginBottom:12, fontSize:12, color:'#1A1A1A', fontWeight:600}}>
                    <span>👥 Serves {form.serves}</span>
                    <span>⏱️ {form.prep_time}</span>
                  </div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:14}}>
                    {form.cuisine && <span style={{background:'#F8F0F4', color:'#C8006A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>{form.cuisine}</span>}
                    {dietaryActive.slice(0, 2).map(d => <span key={d.k} style={{background:'#F8F0F4', color:'#1A1A1A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:600}}>{d.e} {d.l}</span>)}
                    {form.allergens.length > 0 && <span style={{background:'#FFF4E0', color:'#B8730A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>⚠️ {form.allergens.length} allergen{form.allergens.length === 1 ? '' : 's'}</span>}
                  </div>
                  <div style={{paddingTop:14, borderTop:'1px solid #F5F0F3', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em'}}>£{form.price ? parseFloat(form.price).toFixed(2) : '0.00'}</div>
                    <span style={{height:34, padding:'0 14px', background:'#C8006A', color:'#fff', borderRadius:9, fontSize:12, fontWeight:700, display:'flex', alignItems:'center'}}>Order now</span>
                  </div>
                </div>
              </div>
              <p style={{fontSize:12, color:'#1A1A1A', opacity:0.65, textAlign:'center', marginTop:12, lineHeight:1.5}}>This is how your dish appears to buyers.</p>
            </div>
          </div>

          {/* Sticky mobile submit bar */}
          <div className="mobile-bar" style={{position:'fixed', bottom:0, left:0, right:0, zIndex:95, background:'rgba(255,255,255,0.98)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderTop:'1px solid rgba(200,0,106,0.1)', padding:'12px 16px', gap:12, alignItems:'center', boxShadow:'0 -4px 20px rgba(0,0,0,0.06)'}}>
            <div style={{flexShrink:0}}>
              <div style={{fontSize:11, color:'#1A1A1A', opacity:0.7, fontWeight:600}}>Price</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#C8006A'}}>£{form.price ? parseFloat(form.price).toFixed(2) : '0.00'}</div>
            </div>
            <button type="submit" disabled={loading} className="sub" style={{flex:1, height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', opacity:loading ? 0.8 : 1}}>
              {loading ? 'Saving…' : 'Update listing →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
