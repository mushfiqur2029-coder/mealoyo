const fs = require('fs')

fs.writeFileSync('src/app/page.tsx', `
'use client'
import { useState } from 'react'
import Link from 'next/link'

const listings = [
  { id:1, name:'Lamb biryani & raita', cook:'Fatima Kitchen', loc:'Barking E6', price:12.50, emoji:'🍛', tags:['Halal','Spicy'], rat:4.9, rev:128, cat:'bd' },
  { id:2, name:'Karahi chicken', cook:'Mama Razia', loc:'Ilford IG1', price:9.00, emoji:'🫕', tags:['Halal'], rat:4.8, rev:84, cat:'pk' },
  { id:3, name:'Jerk chicken & rice', cook:'Auntie Dawn', loc:'Stratford E15', price:10.00, emoji:'🍱', tags:['Spicy'], rat:5.0, rev:67, cat:'cb' },
  { id:4, name:'Dhal makhani & naan', cook:'Sunita Kitchen', loc:'Romford RM1', price:8.50, emoji:'🥘', tags:['Vegan','Halal'], rat:4.7, rev:43, cat:'in' },
  { id:5, name:'Mutton pilau rice', cook:'Noor Kitchen', loc:'Dagenham RM8', price:11.00, emoji:'🫙', tags:['Halal'], rat:4.9, rev:92, cat:'bd' },
  { id:6, name:'Shawarma plate', cook:'Abu Omar', loc:'Walthamstow E17', price:9.50, emoji:'🧆', tags:['Halal'], rat:4.6, rev:38, cat:'me' },
  { id:7, name:'Egusi soup & yam', cook:'Mama Bisi', loc:'Forest Gate E7', price:13.00, emoji:'🫘', tags:['Halal'], rat:4.8, rev:55, cat:'wa' },
  { id:8, name:'Victoria sponge cake', cook:'Bea Bakery', loc:'Romford RM3', price:22.00, emoji:'🎂', tags:[], rat:5.0, rev:29, cat:'bk' },
]

const cats = [
  { id:'all', label:'All food', emoji:'🍽️' },
  { id:'bd', label:'Bangladeshi', emoji:'🍛' },
  { id:'pk', label:'Pakistani', emoji:'🫕' },
  { id:'in', label:'Indian', emoji:'🥘' },
  { id:'cb', label:'Caribbean', emoji:'🍗' },
  { id:'me', label:'Middle Eastern', emoji:'🧆' },
  { id:'wa', label:'West African', emoji:'🫘' },
  { id:'bk', label:'Baked goods', emoji:'🎂' },
]

const cooks = [
  { name:'Fatima Begum', area:'Barking', cuisine:'Bangladeshi', rat:4.9, orders:128, online:true, init:'FB', color:'#C8006A' },
  { name:'Mama Razia', area:'Ilford', cuisine:'Pakistani', rat:4.8, orders:84, online:true, init:'MR', color:'#A00055' },
  { name:'Auntie Dawn', area:'Stratford', cuisine:'Caribbean', rat:5.0, orders:67, online:false, init:'AD', color:'#C8006A' },
  { name:'Sunita Patel', area:'Romford', cuisine:'Indian', rat:4.7, orders:43, online:true, init:'SP', color:'#A00055' },
  { name:'Noor Kitchen', area:'Dagenham', cuisine:'Bangladeshi', rat:4.9, orders:92, online:false, init:'NK', color:'#C8006A' },
  { name:'Mama Bisi', area:'Forest Gate', cuisine:'West African', rat:4.8, orders:55, online:true, init:'MB', color:'#A00055' },
]

export default function Home() {
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState<number[]>([])
  const filtered = listings.filter(l =>
    (cat === 'all' || l.cat === cat) &&
    l.name.toLowerCase().includes(search.toLowerCase())
  )
  const toggleSave = (id: number) =>
    setSaved(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div style={{minHeight:'100vh', background:'#fff', fontFamily:'Inter,system-ui,sans-serif', overflowX:'hidden'}}>

      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
        * { scrollbar-width: none; }
        a { text-decoration: none; }
        button { font-family: Inter, system-ui, sans-serif; }

        .lcard { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
        .lcard:hover { transform: translateY(-5px) !important; box-shadow: 0 16px 48px rgba(200,0,106,0.14) !important; }
        .cook-card { transition: transform 0.16s, box-shadow 0.16s; cursor: pointer; }
        .cook-card:hover { transform: translateY(-4px) !important; box-shadow: 0 10px 32px rgba(200,0,106,0.12) !important; }
        .cat-pill { transition: all 0.14s; cursor: pointer; }
        .cat-pill:hover { border-color: #C8006A !important; color: #C8006A !important; background: #FFE8F4 !important; }
        .dmode { transition: all 0.14s; cursor: pointer; }
        .dmode:hover { border-color: #C8006A !important; background: #FFF5FA !important; }
        .ot-card { transition: all 0.14s; cursor: pointer; }
        .ot-card:hover { border-color: #C8006A !important; background: #FFF5FA !important; }
        .save-btn { transition: transform 0.14s; cursor: pointer; }
        .save-btn:hover { transform: scale(1.15) !important; }
        .order-btn { transition: all 0.12s; cursor: pointer; }
        .order-btn:hover { background: #A00055 !important; transform: scale(1.04); }
        .primary-btn { transition: all 0.12s; cursor: pointer; }
        .primary-btn:hover { background: #A00055 !important; }
        .nav-link { transition: color 0.12s; }
        .nav-link:hover { color: #C8006A !important; }
        .footer-link { transition: color 0.12s; }
        .footer-link:hover { color: #fff !important; }
        .review-card { transition: transform 0.16s; }
        .review-card:hover { transform: translateY(-4px) !important; }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; min-height: auto !important; }
          .hero-right { display: none !important; }
          .hero-left { padding: 56px 24px 48px !important; }
          .delivery-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .listings-grid { grid-template-columns: 1fr !important; }
          .cooks-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .hiw-grid { grid-template-columns: 1fr !important; }
          .ot-grid { grid-template-columns: 1fr 1fr !important; }
          .hero-stats { gap: 16px !important; flex-wrap: wrap; }
          .search-box { flex-direction: column !important; gap: 10px !important; }
          .search-field { min-width: unset !important; width: 100% !important; }
          .cta-btns { flex-direction: column !important; }
          .nav-end-btns { gap: 6px !important; }
          .trust-scroll { flex-direction: column !important; align-items: flex-start !important; padding: 16px 20px !important; }
          .trust-sep { display: none !important; }
          .section-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      \`}</style>

      {/* ── NAV ── */}
      <nav style={{background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(200,0,106,0.1)', position:'sticky', top:0, zIndex:500, height:66}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', height:66, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{display:'flex', alignItems:'center', gap:9, marginRight:32, flexShrink:0}}>
            <div style={{width:36, height:36, background:'#C8006A', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, boxShadow:'0 4px 14px rgba(200,0,106,0.4)', flexShrink:0}}>🏠</div>
            <span style={{fontFamily:'Georgia,serif', fontWeight:700, fontSize:22, color:'#C8006A', letterSpacing:'-0.02em', whiteSpace:'nowrap'}}>Eat Home</span>
          </Link>
          <div style={{display:'flex', gap:0, flex:1}} className="nav-links-wrap">
            {[{l:'Explore food',h:'/',a:true},{l:'Sell & cater',h:'/seller',a:false},{l:'Deliver & earn',h:'/driver',a:false}].map((t,i) => (
              <Link key={i} href={t.h} className="nav-link" style={{height:66, padding:'0 16px', display:'flex', alignItems:'center', fontSize:14, fontWeight:t.a?700:500, color:t.a?'#C8006A':'#1A1A1A', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', whiteSpace:'nowrap'}}>{t.l}</Link>
            ))}
          </div>
          <div className="nav-end-btns" style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
            <Link href="/login" style={{height:38, padding:'0 16px', display:'flex', alignItems:'center', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', whiteSpace:'nowrap'}}>Sign in</Link>
            <Link href="/register" className="primary-btn" style={{height:38, padding:'0 18px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:14, fontWeight:700, color:'#fff', whiteSpace:'nowrap', boxShadow:'0 4px 14px rgba(200,0,106,0.35)'}}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', minHeight:'92vh', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:'-20%', right:'-8%', width:'60%', height:'150%', background:'radial-gradient(ellipse,rgba(255,255,255,0.07) 0%,transparent 65%)', pointerEvents:'none'}}/>
        <div style={{position:'absolute', bottom:'-15%', left:'-8%', width:'45%', height:'65%', background:'radial-gradient(ellipse,rgba(255,232,244,0.08) 0%,transparent 65%)', pointerEvents:'none'}}/>

        <div className="hero-grid" style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'92vh', alignItems:'center', gap:40}}>

          {/* Hero left */}
          <div className="hero-left" style={{padding:'80px 0', position:'relative', zIndex:1}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:100, padding:'6px 16px', marginBottom:24}}>
              <span style={{width:7, height:7, borderRadius:'50%', background:'#fff', display:'inline-block'}}/>
              <span style={{fontSize:12, fontWeight:700, color:'#fff', letterSpacing:'0.05em'}}>London & Essex · 840+ home cooks</span>
            </div>

            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(34px,4.5vw,62px)', fontWeight:700, color:'#fff', lineHeight:1.06, letterSpacing:'-0.025em', marginBottom:20}}>
              Home cooked food,<br/>
              <span style={{color:'rgba(255,255,255,0.75)', fontStyle:'italic'}}>delivered with love.</span>
            </h1>

            <p style={{fontSize:'clamp(15px,1.6vw,18px)', color:'rgba(255,255,255,0.85)', lineHeight:1.75, marginBottom:36, maxWidth:460, fontWeight:400}}>
              Authentic meals from verified home cooks in your neighbourhood. Real food, real kitchens — Bangladeshi, Pakistani, Indian, Caribbean and more.
            </p>

            {/* Search */}
            <div style={{background:'#fff', borderRadius:16, padding:8, display:'flex', gap:8, boxShadow:'0 8px 40px rgba(0,0,0,0.25)', marginBottom:32, flexWrap:'wrap'}} className="search-box">
              <div className="search-field" style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:160, padding:'0 14px', background:'#F8F0F4', borderRadius:10}}>
                <span style={{fontSize:20, flexShrink:0}}>📍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Enter your postcode..." style={{border:'none', outline:'none', fontFamily:'inherit', fontSize:15, fontWeight:500, color:'#1A1A1A', width:'100%', height:48, background:'transparent'}}/>
              </div>
              <div className="search-field" style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:140, padding:'0 14px', background:'#F8F0F4', borderRadius:10}}>
                <span style={{fontSize:20, flexShrink:0}}>🍽️</span>
                <select style={{border:'none', outline:'none', fontFamily:'inherit', fontSize:15, fontWeight:500, color:'#1A1A1A', background:'transparent', width:'100%', height:48, cursor:'pointer', appearance:'none' as const}}>
                  <option>Any cuisine</option>
                  <option>Bangladeshi</option>
                  <option>Pakistani</option>
                  <option>Indian</option>
                  <option>Caribbean</option>
                  <option>Middle Eastern</option>
                  <option>West African</option>
                </select>
              </div>
              <button className="primary-btn" style={{height:56, padding:'0 28px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(200,0,106,0.4)', flexShrink:0}}>
                Find food →
              </button>
            </div>

            {/* Stats */}
            <div className="hero-stats" style={{display:'flex', gap:28}}>
              {[['840+','Home cooks'],['12k+','Monthly orders'],['4.8★','Avg rating'],['88%','Seller payout']].map(([n,l]) => (
                <div key={l}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,28px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{n}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero right */}
          <div className="hero-right" style={{display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'40px 0 0', position:'relative', zIndex:1}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, width:'100%', maxWidth:460, alignSelf:'flex-end'}}>
              {[
                {wide:true, emoji:'🍛', tag:'Most ordered today', name:'Lamb biryani & raita', cook:"Fatima's Kitchen · Barking", price:'£12.50', rat:'★ 4.9', revs:'(128)'},
                {wide:false, emoji:'🫕', tag:'', name:'Karahi chicken', cook:'Mama Razia · Ilford', price:'£9.00', rat:'★ 4.8', revs:'(84)'},
                {wide:false, emoji:'🎂', tag:'', name:'Celebration cake', cook:"Bea's Bakery · Romford", price:'£22.00', rat:'★ 5.0', revs:'(29)'},
              ].map((c,i) => (
                <div key={i} style={{gridColumn:c.wide?'span 2':'auto', background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:20, overflow:'hidden', transition:'transform 0.2s'}}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='translateY(-5px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform='translateY(0)'}>
                  <div style={{height:c.wide?160:108, display:'flex', alignItems:'center', justifyContent:'center', fontSize:c.wide?64:44, background:'rgba(255,255,255,0.06)', position:'relative'}}>
                    {c.emoji}
                    {c.tag && <div style={{position:'absolute', top:10, left:10, background:'#fff', color:'#C8006A', fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:100}}>🔥 {c.tag}</div>}
                  </div>
                  <div style={{padding:'12px 14px 14px'}}>
                    <div style={{fontSize:c.wide?14:13, fontWeight:700, color:'#fff', marginBottom:2}}>{c.name}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:8}}>{c.cook}</div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontFamily:'Georgia,serif', fontSize:c.wide?16:14, fontWeight:700, color:'#fff'}}>{c.price}</span>
                      <span style={{fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600}}>{c.rat} <span style={{opacity:0.6}}>{c.revs}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div style={{background:'#FFE8F4', borderTop:'1px solid rgba(200,0,106,0.15)', borderBottom:'1px solid rgba(200,0,106,0.15)'}}>
        <div className="trust-scroll" style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
          {[['🏠','Home cook marketplace'],['🔒','Stripe-secured payments'],['🛡️','Buyer protection on every order'],['⚡','Community delivery · 45 mins'],['🌿','Allergen declarations mandatory']].map(([icon,text],i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:7, padding:'13px 18px', fontSize:12, fontWeight:700, color:'#C8006A', whiteSpace:'nowrap'}}>
              {i > 0 && <div className="trust-sep" style={{width:1, height:14, background:'rgba(200,0,106,0.25)', marginRight:18}}/>}
              <span style={{fontSize:15}}>{icon}</span>{text}
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <section style={{background:'#fff', borderBottom:'1px solid #F0F0F0', padding:'36px 0'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:20, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Browse by cuisine</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>What are you craving?</h2>
            </div>
            <button style={{height:36, padding:'0 16px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:700, color:'#1A1A1A', background:'#fff', cursor:'pointer', flexShrink:0}}>View all →</button>
          </div>
          <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:4, msOverflowStyle:'none' as any, scrollbarWidth:'none' as any}}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} className="cat-pill" style={{display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:cat===c.id?'#FFE8F4':'#fff', border:cat===c.id?'2px solid #C8006A':'2px solid #E0E0E0', borderRadius:100, fontSize:14, fontWeight:700, color:cat===c.id?'#C8006A':'#1A1A1A', whiteSpace:'nowrap', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                <span style={{fontSize:18}}>{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── LISTINGS ── */}
      <section style={{padding:'56px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12}}>
            <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A'}}><span style={{color:'#C8006A'}}>{filtered.length}</span> listings near you</div>
            <div style={{display:'flex', gap:8}}>
              <select style={{height:38, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', outline:'none'}}>
                <option>Recommended</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Highest rated</option>
              </select>
              <button style={{height:38, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:700, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>Filters</button>
            </div>
          </div>
          <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(272px,1fr))', gap:20}}>
            {filtered.map(l => (
              <div key={l.id} className="lcard" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
                <div style={{height:186, display:'flex', alignItems:'center', justifyContent:'center', fontSize:68, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', position:'relative'}}>
                  {l.emoji}
                  <div style={{position:'absolute', top:12, right:12}}>
                    <button className="save-btn" onClick={e => { e.stopPropagation(); toggleSave(l.id); }} style={{width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.96)', border:'1.5px solid rgba(200,0,106,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                      {saved.includes(l.id)?'❤️':'🤍'}
                    </button>
                  </div>
                </div>
                <div style={{padding:'16px 18px'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:4, letterSpacing:'-0.01em'}}>{l.name}</div>
                  <div style={{fontSize:13, color:'#1A1A1A', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontWeight:500}}>
                    <div style={{width:20, height:20, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0}}>{l.cook[0]}</div>
                    {l.cook}
                  </div>
                  <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                    {l.tags.map(t => (
                      <span key={t} style={{background:t==='Halal'?'#E4F6EA':t==='Vegan'?'#EBF2FD':'#FFE8F4', color:t==='Halal'?'#2DA84E':t==='Vegan'?'#1A6ECC':'#C8006A', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700}}>{t}</span>
                    ))}
                  </div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #F5F0F3'}}>
                    <div>
                      <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{l.price.toFixed(2)}</div>
                      <div style={{fontSize:12, color:'#1A1A1A', marginTop:2, fontWeight:500}}>📍 {l.loc}</div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6}}>
                      <div style={{fontSize:13, fontWeight:700, color:'#1A1A1A'}}><span style={{color:'#C8006A'}}>★</span> {l.rat} ({l.rev})</div>
                      <button className="order-btn" style={{height:32, padding:'0 16px', background:'#C8006A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, boxShadow:'0 4px 12px rgba(200,0,106,0.3)'}}>Order</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{padding:'72px 0', background:'#fff'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{textAlign:'center', marginBottom:48}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Simple process</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,38px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:12, lineHeight:1.2}}>From browse to bite in 4 steps</h2>
            <p style={{fontSize:'clamp(14px,1.5vw,16px)', color:'#1A1A1A', maxWidth:440, margin:'0 auto', fontWeight:400}}>Authentic food, trusted cooks, flexible delivery — all in one place.</p>
          </div>
          <div className="hiw-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20}}>
            {[
              {n:'01', icon:'📍', title:'Enter your postcode', desc:'See home cooks within your delivery radius, sorted by cuisine, rating and availability.'},
              {n:'02', icon:'🛒', title:'Browse & pay securely', desc:'Pick your food, choose delivery or free collection. Pay by card, Apple Pay or Google Pay.'},
              {n:'03', icon:'👩‍🍳', title:'Cook prepares it fresh', desc:'Your cook gets the order and cooks fresh. Real-time updates keep you informed.'},
              {n:'04', icon:'🏠', title:'Delivered or collected', desc:'Hot food at your door in 45 mins via community drivers, or collect free with QR code.'},
            ].map(s => (
              <div key={s.n} style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'28px 22px', border:'1.5px solid rgba(200,0,106,0.1)'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:40, fontWeight:700, color:'rgba(200,0,106,0.15)', lineHeight:1, marginBottom:16}}>{s.n}</div>
                <div style={{fontSize:30, marginBottom:12}}>{s.icon}</div>
                <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:8, letterSpacing:'-0.01em'}}>{s.title}</div>
                <div style={{fontSize:13, color:'#1A1A1A', lineHeight:1.65, fontWeight:400}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP COOKS ── */}
      <section style={{padding:'72px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:32, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Trusted food makers</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>Your local home cooks</h2>
              <p style={{fontSize:14, color:'#1A1A1A', marginTop:5, fontWeight:400}}>Every cook is verified, ID checked and hygiene certified.</p>
            </div>
            <button style={{height:38, padding:'0 18px', border:'1.5px solid #E0E0E0', borderRadius:8, fontSize:13, fontWeight:700, color:'#1A1A1A', background:'#fff', cursor:'pointer', flexShrink:0}}>Browse all →</button>
          </div>
          <div className="cooks-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16}}>
            {cooks.map((c,i) => (
              <div key={i} className="cook-card" style={{background:'#fff', borderRadius:20, padding:'22px 16px', textAlign:'center', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
                <div style={{width:56, height:56, borderRadius:'50%', background:c.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#fff', margin:'0 auto 12px', position:'relative', boxShadow:\`0 4px 16px \${c.color}50\`}}>
                  {c.init}
                  {c.online && <div style={{position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:'50%', background:'#2DA84E', border:'2.5px solid #fff'}}/>}
                </div>
                <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:2, letterSpacing:'-0.01em'}}>{c.name}</div>
                <div style={{fontSize:12, color:'#1A1A1A', marginBottom:10, fontWeight:500}}>{c.cuisine} · {c.area}</div>
                <div style={{display:'flex', justifyContent:'center', gap:16, marginBottom:12}}>
                  <div><div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>★{c.rat}</div><div style={{fontSize:10, color:'#1A1A1A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Rating</div></div>
                  <div style={{width:1, background:'rgba(200,0,106,0.1)'}}/>
                  <div><div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>{c.orders}</div><div style={{fontSize:10, color:'#1A1A1A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em'}}>Orders</div></div>
                </div>
                <span style={{background:'#FFE8F4', color:'#C8006A', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>Verified cook</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DELIVERY & ORDER TYPE ── */}
      <section style={{padding:'72px 0', background:'#fff'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div className="delivery-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'start'}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Delivery options</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em', marginBottom:8}}>Get it your way</h2>
              <p style={{fontSize:15, color:'#1A1A1A', lineHeight:1.65, marginBottom:28, maxWidth:380, fontWeight:400}}>Four flexible ways to receive your food. No hidden charges. What you see is what you pay.</p>
              <div style={{display:'flex', flexDirection:'column', gap:12}}>
                {[
                  {icon:'📍', title:'Collect for free', desc:'Walk or drive to your cook. QR code confirms collection instantly.', tag:'Always free', active:true},
                  {icon:'🚴', title:'Community delivery', desc:'Hot food at your door in under 45 mins via local drivers.', tag:'From £4.50', active:false},
                  {icon:'🎉', title:'Catering & events', desc:'Full catering for parties, weddings, Eid and office events.', tag:'Cook delivers', active:false},
                  {icon:'📦', title:'Postal nationwide', desc:'Meal prep, sauces and baked goods posted anywhere in the UK.', tag:'From £2.99', active:false},
                ].map((d,i) => (
                  <div key={i} className="dmode" style={{display:'flex', alignItems:'flex-start', gap:14, padding:'16px', background:d.active?'#FFE8F4':'#fff', border:d.active?'2px solid #C8006A':'1.5px solid #E0E0E0', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                    <div style={{width:44, height:44, borderRadius:12, background:d.active?'#C8006A':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>{d.icon}</div>
                    <div>
                      <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:3}}>{d.title}</div>
                      <div style={{fontSize:12, color:'#1A1A1A', lineHeight:1.55, marginBottom:5, fontWeight:400}}>{d.desc}</div>
                      <span style={{fontSize:12, fontWeight:700, color:'#C8006A'}}>{d.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.01em', marginBottom:6}}>What do you need today?</div>
              <p style={{fontSize:14, color:'#1A1A1A', marginBottom:20, fontWeight:400}}>Select your order type and we will match you with the right cooks.</p>
              <div className="ot-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20}}>
                {[
                  {emoji:'🍽️', name:'Today meal', desc:'Delivery or collection right now', active:true},
                  {emoji:'🏢', name:'Office lunches', desc:'Weekly catering contract', active:false},
                  {emoji:'🎉', name:'Party catering', desc:'Book for your event', active:false},
                  {emoji:'📦', name:'Meal prep', desc:'Weekly boxes delivered', active:false},
                ].map((o,i) => (
                  <div key={i} className="ot-card" style={{padding:'18px 16px', background:o.active?'#FFE8F4':'#fff', border:o.active?'2px solid #C8006A':'1.5px solid #E0E0E0', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                    <div style={{fontSize:24, marginBottom:10}}>{o.emoji}</div>
                    <div style={{fontSize:14, fontWeight:700, color:o.active?'#C8006A':'#1A1A1A', marginBottom:4}}>{o.name}</div>
                    <div style={{fontSize:12, color:'#1A1A1A', lineHeight:1.4, fontWeight:400}}>{o.desc}</div>
                  </div>
                ))}
              </div>
              <button className="primary-btn" style={{width:'100%', height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:14, fontSize:16, fontWeight:700, boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>
                Find cooks near me →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section style={{padding:'72px 0', background:'#F8F0F4'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{textAlign:'center', marginBottom:40}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Community voices</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>Our community loves it</h2>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20}}>
            {[
              {stars:'★★★★★', q:'Fatima biryani is the best I have had outside Dhaka. Tastes exactly like my mother cooking. I order every Friday without fail.', name:'Rahul S.', loc:'Barking, East London', av:'RS', color:'#C8006A'},
              {stars:'★★★★★', q:'We use Eat Home for our office lunches every Tuesday. Incredible food, cheaper than any catering company in London.', name:'Sophie H.', loc:'Office manager, Stratford', av:'SH', color:'#A00055'},
              {stars:'★★★★★', q:'Booked Auntie Dawn for my daughter birthday. 40 guests all raving about the jerk chicken. Perfect and on time.', name:'Marcus W.', loc:'Ilford, Essex', av:'MW', color:'#C8006A'},
            ].map((r,i) => (
              <div key={i} className="review-card" style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 2px 12px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.08)', display:'flex', flexDirection:'column'}}>
                <div style={{color:'#C8006A', fontSize:16, letterSpacing:'2px', marginBottom:14}}>{r.stars}</div>
                <p style={{fontFamily:'Georgia,serif', fontSize:15, fontStyle:'italic', color:'#1A1A1A', lineHeight:1.75, marginBottom:18, flex:1}}>"{r.q}"</p>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:40, height:40, borderRadius:'50%', background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0}}>{r.av}</div>
                  <div>
                    <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>{r.name}</div>
                    <div style={{fontSize:12, color:'#1A1A1A', fontWeight:500}}>{r.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', padding:'80px 24px', position:'relative', overflow:'hidden', textAlign:'center'}}>
        <div style={{position:'absolute', right:'-5%', top:'-40%', width:'50%', height:'200%', borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none'}}/>
        <div style={{maxWidth:680, margin:'0 auto', position:'relative', zIndex:1}}>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,46px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:12, lineHeight:1.15}}>Hungry? Order home cooked food now.</h2>
          <p style={{fontSize:'clamp(15px,1.6vw,17px)', color:'rgba(255,255,255,0.85)', marginBottom:32, lineHeight:1.65, fontWeight:400}}>840+ home cooks. Authentic food. No restaurant markup.</p>
          <div className="cta-btns" style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <button style={{height:54, padding:'0 36px', background:'#fff', color:'#C8006A', border:'none', borderRadius:14, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(0,0,0,0.15)', flexShrink:0}}>Order food now</button>
            <Link href="/seller" style={{height:54, padding:'0 36px', background:'rgba(255,255,255,0.12)', color:'#fff', border:'2px solid rgba(255,255,255,0.3)', borderRadius:14, fontSize:16, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0}}>Start selling your food</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:'#1A1A1A', padding:'52px 0 28px'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div className="footer-grid" style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:36}}>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <div style={{width:30, height:30, background:'#C8006A', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15}}>🏠</div>
                <span style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A'}}>Eat Home</span>
              </div>
              <p style={{fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.7, maxWidth:260, marginBottom:16, fontWeight:400}}>The UK home cook food marketplace. Authentic meals from verified home cooks across London and Essex.</p>
              <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'rgba(200,0,106,0.2)', color:'#FFE8F4', border:'1px solid rgba(200,0,106,0.3)', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>🏠 Eat Home · Est. 2026</span>
            </div>
            {[
              {head:'Buy food', links:['Browse listings','Find local cooks','Event catering','Office lunches','Meal prep boxes']},
              {head:'Sell food', links:['Start selling','Seller dashboard','Pricing & packages','Compliance guide','Seller support']},
              {head:'Company', links:['About us','Deliver with us','Blog','Contact','Privacy policy']},
            ].map(s => (
              <div key={s.head}>
                <div style={{fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14}}>{s.head}</div>
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {s.links.map(l => <a key={l} href="#" className="footer-link" style={{fontSize:13, color:'rgba(255,255,255,0.5)', fontWeight:500}}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:20, display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.35)', flexWrap:'wrap', gap:8, fontWeight:400}}>
            <span>© 2026 Eat Home Ltd. Registered in England & Wales.</span>
            <span>Barking, East London · hello@eathome.co.uk</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
`)

console.log('DONE — world class Eat Home homepage')