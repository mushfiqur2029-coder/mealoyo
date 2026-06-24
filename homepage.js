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
  const filtered = listings.filter(l => (cat === 'all' || l.cat === cat) && l.name.toLowerCase().includes(search.toLowerCase()))

  const toggleSave = (id: number) => setSaved(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div style={{minHeight:'100vh', background:'#fff', fontFamily:'Inter,system-ui,sans-serif', overflowX:'hidden'}}>

      {/* GLOBAL STYLES */}
      <style>{\`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
        scrollbar-width: none;
        a { text-decoration: none; }
        button { font-family: Inter, system-ui, sans-serif; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-right { display: none !important; }
          .listings-grid { grid-template-columns: 1fr 1fr !important; }
          .cooks-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .nav-links { display: none !important; }
          .hero-left { padding: 48px 24px !important; }
          .trust-inner { gap: 0 !important; }
          .trust-item { padding: 10px 12px !important; font-size: 11px !important; }
        }
        @media (max-width: 480px) {
          .listings-grid { grid-template-columns: 1fr !important; }
          .cooks-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .hero-stats { gap: 16px !important; }
          .search-box { flex-direction: column !important; }
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
        }
        .lcard { transition: transform 0.18s, box-shadow 0.18s; }
        .lcard:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(200,0,106,0.12) !important; }
        .cook-card { transition: transform 0.16s, box-shadow 0.16s; }
        .cook-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(200,0,106,0.1) !important; }
        .cat-pill { transition: all 0.14s; }
        .cat-pill:hover { border-color: #C8006A !important; color: #C8006A !important; }
        .dmode { transition: all 0.14s; }
        .dmode:hover { border-color: #C8006A !important; }
        .save-btn { transition: transform 0.14s; }
        .save-btn:hover { transform: scale(1.12); }
        .order-btn { transition: background 0.12s, transform 0.1s; }
        .order-btn:hover { background: #A00055 !important; transform: scale(1.03); }
        .hero-search-btn { transition: background 0.12s, transform 0.1s; }
        .hero-search-btn:hover { background: #A00055 !important; }
        .nav-cta { transition: background 0.12s; }
        .nav-cta:hover { background: #A00055 !important; }
        .review-card { transition: transform 0.16s, box-shadow 0.16s; }
        .review-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(200,0,106,0.1) !important; }
      \`}</style>

      {/* ── NAV ── */}
      <nav style={{background:'rgba(255,255,255,0.92)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:200, height:66}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', height:66, display:'flex', alignItems:'center'}}>
          <Link href="/" style={{display:'flex', alignItems:'center', gap:9, marginRight:36, textDecoration:'none'}}>
            <div style={{width:36, height:36, background:'#C8006A', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, boxShadow:'0 4px 12px rgba(200,0,106,0.35)'}}>🏠</div>
            <span style={{fontFamily:'Georgia,serif', fontWeight:700, fontSize:22, color:'#C8006A', letterSpacing:'-0.02em'}}>Eat Home</span>
          </Link>
          <div className="nav-links" style={{display:'flex', gap:0, flex:1}}>
            {[{l:'Explore food',h:'/',a:true},{l:'Sell & cater',h:'/seller',a:false},{l:'Deliver & earn',h:'/driver',a:false}].map((t,i) => (
              <Link key={i} href={t.h} style={{height:66, padding:'0 16px', display:'flex', alignItems:'center', fontSize:14, fontWeight:t.a?600:400, color:t.a?'#C8006A':'#575757', borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent', textDecoration:'none', whiteSpace:'nowrap'}}>{t.l}</Link>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto', alignItems:'center'}}>
            <Link href="/login" style={{height:38, padding:'0 18px', display:'flex', alignItems:'center', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', textDecoration:'none', whiteSpace:'nowrap'}}>Sign in</Link>
            <Link href="/register" className="nav-cta" style={{height:38, padding:'0 18px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:14, fontWeight:700, color:'#fff', textDecoration:'none', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(200,0,106,0.3)'}}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{background:'linear-gradient(135deg, #C8006A 0%, #8B0047 50%, #5A002E 100%)', minHeight:'92vh', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', inset:0, background:'url("data:image/svg+xml,%3Csvg viewBox=\\'0 0 200 200\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cfilter id=\\'n\\'%3E%3CfeTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.75\\' numOctaves=\\'4\\' stitchTiles=\\'stitch\\'/%3E%3C/filter%3E%3Crect width=\\'100%25\\' height=\\'100%25\\' filter=\\'url(%23n)\\' opacity=\\'0.03\\'/%3E%3C/svg%3E")', pointerEvents:'none'}}/>
        <div style={{position:'absolute', top:'-20%', right:'-5%', width:'55%', height:'140%', background:'radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 65%)', pointerEvents:'none'}}/>
        <div style={{position:'absolute', bottom:'-10%', left:'-5%', width:'40%', height:'60%', background:'radial-gradient(ellipse, rgba(255,232,244,0.08) 0%, transparent 65%)', pointerEvents:'none'}}/>

        <div className="hero-grid" style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'92vh', alignItems:'center', gap:40}}>

          {/* Left */}
          <div className="hero-left" style={{padding:'80px 0', position:'relative', zIndex:1}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:100, padding:'6px 16px', marginBottom:24}}>
              <span style={{width:7, height:7, borderRadius:'50%', background:'#fff', display:'inline-block', opacity:0.9}}/>
              <span style={{fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.9)', letterSpacing:'0.05em'}}>London & Essex · 840+ home cooks</span>
            </div>

            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(36px,4.5vw,62px)', fontWeight:700, color:'#fff', lineHeight:1.06, letterSpacing:'-0.025em', marginBottom:20}}>
              Home cooked food,<br/>
              <span style={{background:'rgba(255,255,255,0.15)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', display:'inline'}}>
                delivered with love.
              </span>
            </h1>

            <p style={{fontSize:17, color:'rgba(255,255,255,0.75)', lineHeight:1.75, marginBottom:36, maxWidth:460, fontWeight:400}}>
              Authentic meals from verified home cooks in your neighbourhood. Real food, real kitchens — Bangladeshi, Pakistani, Indian, Caribbean and more.
            </p>

            {/* Search box */}
            <div style={{background:'#fff', borderRadius:16, padding:8, display:'flex', gap:6, boxShadow:'0 8px 40px rgba(0,0,0,0.2)', marginBottom:28, flexWrap:'wrap'}} className="search-box">
              <div style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:160, padding:'0 14px', background:'#F8F8F6', borderRadius:10}}>
                <span style={{fontSize:20, flexShrink:0}}>📍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Enter your postcode..."
                  style={{border:'none', outline:'none', fontFamily:'inherit', fontSize:15, fontWeight:500, color:'#1A1A1A', width:'100%', height:48, background:'transparent'}}
                />
              </div>
              <div style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:140, padding:'0 14px', background:'#F8F8F6', borderRadius:10}}>
                <span style={{fontSize:20, flexShrink:0}}>🍽️</span>
                <select style={{border:'none', outline:'none', fontFamily:'inherit', fontSize:15, fontWeight:500, color:'#1A1A1A', background:'transparent', width:'100%', height:48, cursor:'pointer', appearance:'none'}}>
                  <option>Any cuisine</option>
                  <option>Bangladeshi</option>
                  <option>Pakistani</option>
                  <option>Indian</option>
                  <option>Caribbean</option>
                  <option>Middle Eastern</option>
                  <option>West African</option>
                </select>
              </div>
              <button className="hero-search-btn" style={{height:56, padding:'0 28px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(200,0,106,0.4)', flexShrink:0}}>
                Find food →
              </button>
            </div>

            {/* Stats */}
            <div className="hero-stats" style={{display:'flex', gap:28, flexWrap:'wrap'}}>
              {[['840+','Home cooks'],['12k+','Monthly orders'],['4.8★','Avg rating'],['88%','Seller payout']].map(([n,l]) => (
                <div key={l} style={{display:'flex', flexDirection:'column'}}>
                  <span style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{n}</span>
                  <span style={{fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — food mosaic */}
          <div className="hero-right" style={{display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'40px 0 0', position:'relative', zIndex:1}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, width:'100%', maxWidth:460, alignSelf:'flex-end'}}>
              {[
                {wide:true, emoji:'🍛', tag:'Most ordered today', name:'Lamb biryani & raita', cook:"Fatima's Kitchen · Barking", price:'£12.50', rat:'★ 4.9', revs:'(128)'},
                {wide:false, emoji:'🫕', tag:'', name:'Karahi chicken', cook:'Mama Razia · Ilford', price:'£9.00', rat:'★ 4.8', revs:'(84)'},
                {wide:false, emoji:'🎂', tag:'', name:'Celebration cake', cook:"Bea's Bakery · Romford", price:'£22.00', rat:'★ 5.0', revs:'(29)'},
              ].map((c,i) => (
                <div key={i} style={{gridColumn:c.wide?'span 2':'auto', background:'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:20, overflow:'hidden', cursor:'pointer', transition:'transform 0.2s, background 0.2s'}}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform='translateY(-5px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'}
                >
                  <div style={{height:c.wide?160:108, display:'flex', alignItems:'center', justifyContent:'center', fontSize:c.wide?64:44, background:'rgba(255,255,255,0.06)', position:'relative'}}>
                    {c.emoji}
                    {c.tag && <div style={{position:'absolute', top:10, left:10, background:'#fff', color:'#C8006A', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100}}>🔥 {c.tag}</div>}
                  </div>
                  <div style={{padding:'12px 14px 14px'}}>
                    <div style={{fontSize:c.wide?14:13, fontWeight:700, color:'#fff', marginBottom:2, letterSpacing:'-0.01em'}}>{c.name}</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8}}>{c.cook}</div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontFamily:'Georgia,serif', fontSize:c.wide?16:14, fontWeight:700, color:'#fff'}}>{c.price}</span>
                      <span style={{fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600}}>{c.rat} <span style={{opacity:0.5}}>{c.revs}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div style={{background:'#FFE8F4', borderTop:'1px solid rgba(200,0,106,0.12)', borderBottom:'1px solid rgba(200,0,106,0.12)'}}>
        <div className="trust-inner" style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
          {[['✅','FSA registered cooks only'],['🔒','Stripe-secured payments'],['🛡️','Buyer protection'],['⚡','45 min delivery'],['🌿','Allergen declared']].map(([icon,text],i) => (
            <div key={i} className="trust-item" style={{display:'flex', alignItems:'center', gap:7, padding:'13px 20px', fontSize:12, fontWeight:600, color:'#A00055', whiteSpace:'nowrap'}}>
              {i>0 && <div style={{width:1, height:14, background:'rgba(200,0,106,0.2)', marginRight:20}}/>}
              <span style={{fontSize:15}}>{icon}</span>{text}
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORIES ── */}
      <section style={{background:'#fff', borderBottom:'1px solid #F0F0F0', padding:'36px 0'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:20, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Browse by cuisine</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>What are you craving?</h2>
            </div>
            <button style={{height:36, padding:'0 16px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>View all →</button>
          </div>
          <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:4, msOverflowStyle:'none', scrollbarWidth:'none'}}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} className="cat-pill" style={{display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:cat===c.id?'#FFE8F4':'#fff', border:cat===c.id?'2px solid #C8006A':'2px solid #E8E8E8', borderRadius:100, cursor:'pointer', fontSize:14, fontWeight:700, color:cat===c.id?'#C8006A':'#575757', whiteSpace:'nowrap', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                <span style={{fontSize:18}}>{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── LISTINGS ── */}
      <section style={{padding:'56px 0', background:'#F8F8F6'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12}}>
            <div style={{fontSize:15, fontWeight:600, color:'#1A1A1A'}}><span style={{color:'#C8006A', fontWeight:700}}>{filtered.length}</span> listings near you</div>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <select style={{height:38, padding:'0 14px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer', outline:'none'}}>
                <option>Recommended</option>
                <option>Price: Low → High</option>
                <option>Price: High → Low</option>
                <option>Highest rated</option>
              </select>
              <button style={{height:38, padding:'0 14px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>⚡ Filters</button>
            </div>
          </div>
          <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(272px,1fr))', gap:20}}>
            {filtered.map(l => (
              <div key={l.id} className="lcard" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1.5px solid transparent', cursor:'pointer'}}>
                <div style={{height:186, display:'flex', alignItems:'center', justifyContent:'center', fontSize:68, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', position:'relative'}}>
                  {l.emoji}
                  <div style={{position:'absolute', top:12, right:12}}>
                    <button className="save-btn" onClick={() => toggleSave(l.id)} style={{width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.95)', border:'1.5px solid #E8E8E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
                      {saved.includes(l.id)?'❤️':'🤍'}
                    </button>
                  </div>
                </div>
                <div style={{padding:'16px 18px'}}>
                  <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:4, letterSpacing:'-0.01em'}}>{l.name}</div>
                  <div style={{fontSize:12, color:'#8C8C8C', marginBottom:10, display:'flex', alignItems:'center', gap:5}}>
                    <div style={{width:18, height:18, borderRadius:'50%', background:'#C8006A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'#fff', flexShrink:0}}>{l.cook[0]}</div>
                    {l.cook}
                  </div>
                  <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                    {l.tags.map(t => (
                      <span key={t} style={{background:t==='Halal'?'#E4F6EA':t==='Vegan'?'#EBF2FD':'#FFE8F4', color:t==='Halal'?'#2DA84E':t==='Vegan'?'#1A6ECC':'#C8006A', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700}}>{t}</span>
                    ))}
                  </div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid #F5F5F5'}}>
                    <div>
                      <div style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em'}}>£{l.price.toFixed(2)}</div>
                      <div style={{fontSize:11, color:'#8C8C8C', marginTop:2}}>📍 {l.loc}</div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6}}>
                      <div style={{fontSize:12, fontWeight:700, color:'#1A1A1A'}}><span style={{color:'#C8006A'}}>★</span> {l.rat} <span style={{color:'#8C8C8C', fontWeight:400}}>({l.rev})</span></div>
                      <button className="order-btn" style={{height:30, padding:'0 16px', background:'#C8006A', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 10px rgba(200,0,106,0.3)'}}>Order</button>
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
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,38px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:12}}>From browse to bite in 4 steps</h2>
            <p style={{fontSize:16, color:'#575757', maxWidth:440, margin:'0 auto'}}>Authentic food, trusted cooks, flexible delivery — all in one place.</p>
          </div>
          <div className="hiw-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20}}>
            {[
              {n:'01', icon:'📍', title:'Enter your postcode', desc:'See verified home cooks within your delivery radius, sorted by cuisine, rating and availability.'},
              {n:'02', icon:'🛒', title:'Browse & pay securely', desc:'Pick your food, choose delivery or free collection. Pay by card, Apple Pay or Google Pay.'},
              {n:'03', icon:'👩‍🍳', title:'Cook prepares it fresh', desc:'Your cook gets the order and cooks fresh. Real-time updates and a live prep countdown.'},
              {n:'04', icon:'🏠', title:'Delivered or collected', desc:'Hot food at your door in 45 mins via community drivers, or collect free with QR code.'},
            ].map(s => (
              <div key={s.n} style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)', borderRadius:20, padding:'28px 22px', border:'1.5px solid rgba(200,0,106,0.1)'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:42, fontWeight:700, color:'rgba(200,0,106,0.12)', lineHeight:1, marginBottom:16}}>{s.n}</div>
                <div style={{fontSize:30, marginBottom:12}}>{s.icon}</div>
                <div style={{fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:8, letterSpacing:'-0.01em'}}>{s.title}</div>
                <div style={{fontSize:13, color:'#575757', lineHeight:1.65}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP COOKS ── */}
      <section style={{padding:'72px 0', background:'#F8F8F6'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:32, flexWrap:'wrap', gap:12}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Trusted food makers</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>Your local home cooks</h2>
              <p style={{fontSize:14, color:'#575757', marginTop:5}}>Every cook is FSA registered, ID verified and hygiene certified.</p>
            </div>
            <button style={{height:38, padding:'0 18px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>Browse all →</button>
          </div>
          <div className="cooks-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(185px,1fr))', gap:16}}>
            {cooks.map((c,i) => (
              <div key={i} className="cook-card" style={{background:'#fff', borderRadius:20, padding:'22px 16px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:'1.5px solid #F0F0F0', cursor:'pointer'}}>
                <div style={{width:56, height:56, borderRadius:'50%', background:c.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#fff', margin:'0 auto 12px', position:'relative', boxShadow:\`0 4px 16px \${c.color}40\`}}>
                  {c.init}
                  {c.online && <div style={{position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:'50%', background:'#2DA84E', border:'2.5px solid #fff'}}/>}
                </div>
                <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:2, letterSpacing:'-0.01em'}}>{c.name}</div>
                <div style={{fontSize:12, color:'#8C8C8C', marginBottom:10}}>{c.cuisine} · {c.area}</div>
                <div style={{display:'flex', justifyContent:'center', gap:16, marginBottom:12}}>
                  <div style={{textAlign:'center'}}><div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>★{c.rat}</div><div style={{fontSize:10, color:'#8C8C8C', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>Rating</div></div>
                  <div style={{width:1, background:'#F0F0F0'}}/>
                  <div style={{textAlign:'center'}}><div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>{c.orders}</div><div style={{fontSize:10, color:'#8C8C8C', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>Orders</div></div>
                </div>
                <span style={{background:'#FFE8F4', color:'#C8006A', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700}}>Top seller</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DELIVERY OPTIONS ── */}
      <section style={{padding:'72px 0', background:'#fff'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'start'}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Delivery options</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em', marginBottom:8}}>Get it your way</h2>
              <p style={{fontSize:15, color:'#575757', lineHeight:1.65, marginBottom:28, maxWidth:400}}>Four flexible ways to receive your food. No hidden charges. What you see is what you pay.</p>
              <div style={{display:'flex', flexDirection:'column', gap:12}}>
                {[
                  {icon:'📍', title:'Collect for free', desc:'Walk or drive to your cook. QR code confirms collection.', tag:'Always free', active:true},
                  {icon:'🚴', title:'Community delivery', desc:'Hot food at your door in under 45 mins via local drivers.', tag:'From £4.50', active:false},
                  {icon:'🎉', title:'Catering & events', desc:'Full catering for parties, weddings, Eid and office events.', tag:'Cook delivers', active:false},
                  {icon:'📦', title:'Postal nationwide', desc:'Meal prep, sauces and baked goods posted anywhere in UK.', tag:'From £2.99', active:false},
                ].map((d,i) => (
                  <div key={i} className="dmode" style={{display:'flex', alignItems:'flex-start', gap:14, padding:'16px', background:d.active?'#FFE8F4':'#fff', border:d.active?'2px solid #C8006A':'1.5px solid #E8E8E8', borderRadius:16, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                    <div style={{width:44, height:44, borderRadius:12, background:d.active?'#C8006A':'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>
                      {d.icon}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:3, letterSpacing:'-0.01em'}}>{d.title}</div>
                      <div style={{fontSize:12, color:'#575757', lineHeight:1.55, marginBottom:5}}>{d.desc}</div>
                      <span style={{fontSize:12, fontWeight:700, color:'#C8006A'}}>{d.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{fontSize:18, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.01em'}}>What do you need today?</div>
              <p style={{fontSize:14, color:'#575757', marginBottom:4}}>Select your order type and we will match you with the right cooks.</p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                {[
                  {emoji:'🍽️', name:'Today meal', desc:'Delivery or collection right now', active:true},
                  {emoji:'🏢', name:'Office lunches', desc:'Weekly catering contract', active:false},
                  {emoji:'🎉', name:'Party catering', desc:'Book for your event', active:false},
                  {emoji:'📦', name:'Meal prep', desc:'Weekly boxes delivered', active:false},
                ].map((o,i) => (
                  <div key={i} style={{padding:'18px 16px', background:o.active?'#FFE8F4':'#fff', border:o.active?'2px solid #C8006A':'1.5px solid #E8E8E8', borderRadius:16, cursor:'pointer', transition:'all 0.14s', boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                    <div style={{fontSize:24, marginBottom:10}}>{o.emoji}</div>
                    <div style={{fontSize:14, fontWeight:700, color:o.active?'#C8006A':'#1A1A1A', marginBottom:4, letterSpacing:'-0.01em'}}>{o.name}</div>
                    <div style={{fontSize:12, color:'#575757', lineHeight:1.4}}>{o.desc}</div>
                  </div>
                ))}
              </div>
              <button style={{height:52, background:'#C8006A', color:'#fff', border:'none', borderRadius:14, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(200,0,106,0.3)', marginTop:4}}>
                Find cooks near me →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section style={{padding:'72px 0', background:'#F8F8F6'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{textAlign:'center', marginBottom:40}}>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>What people say</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>Our community loves it</h2>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20}}>
            {[
              {stars:'★★★★★', q:'"Fatima biryani is the best I have had outside Dhaka. Tastes exactly like my mother cooking. I order every Friday."', name:'Rahul S.', loc:'Barking, East London', av:'RS', color:'#C8006A'},
              {stars:'★★★★★', q:'"We use Eat Home for office lunches every Tuesday. Incredible food, cheaper than any catering company."', name:'Sophie H.', loc:'Office manager, Stratford', av:'SH', color:'#A00055'},
              {stars:'★★★★★', q:'"Booked Auntie Dawn for my daughter birthday. 40 guests all raving about jerk chicken. Perfect and on time."', name:'Marcus W.', loc:'Ilford, Essex', av:'MW', color:'#C8006A'},
            ].map((r,i) => (
              <div key={i} className="review-card" style={{background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:'1.5px solid #F0F0F0', display:'flex', flexDirection:'column'}}>
                <div style={{color:'#C8006A', fontSize:16, letterSpacing:'2px', marginBottom:14}}>{r.stars}</div>
                <p style={{fontFamily:'Georgia,serif', fontSize:15, fontStyle:'italic', color:'#1A1A1A', lineHeight:1.75, marginBottom:18, flex:1}}>{r.q}</p>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:40, height:40, borderRadius:'50%', background:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0}}>{r.av}</div>
                  <div><div style={{fontSize:14, fontWeight:700, color:'#1A1A1A'}}>{r.name}</div><div style={{fontSize:12, color:'#8C8C8C'}}>{r.loc}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', padding:'80px 0', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right:'-5%', top:'-40%', width:'50%', height:'200%', borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none'}}/>
        <div style={{maxWidth:700, margin:'0 auto', padding:'0 24px', textAlign:'center', position:'relative', zIndex:1}}>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:'clamp(28px,4vw,46px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:12, lineHeight:1.15}}>Hungry? Order home cooked food now.</h2>
          <p style={{fontSize:17, color:'rgba(255,255,255,0.8)', marginBottom:32, lineHeight:1.65}}>840+ verified home cooks. Authentic food. No restaurant markup.</p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <button style={{height:54, padding:'0 36px', background:'#fff', color:'#C8006A', border:'none', borderRadius:14, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(0,0,0,0.15)'}}>Order food now</button>
            <Link href="/seller" style={{height:54, padding:'0 36px', background:'rgba(255,255,255,0.12)', color:'#fff', border:'2px solid rgba(255,255,255,0.3)', borderRadius:14, fontSize:16, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', textDecoration:'none'}}>Start selling your food</Link>
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
              <p style={{fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.7, maxWidth:260, marginBottom:16}}>The UK home cook food marketplace. Authentic meals from verified home cooks across London and Essex.</p>
              <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#E4F6EA', color:'#2DA84E', border:'1px solid rgba(45,168,78,0.25)', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>✓ FSA registered platform · Est. 2026</span>
            </div>
            {[
              {head:'Buy food', links:['Browse listings','Find local cooks','Event catering','Office lunches','Meal prep boxes']},
              {head:'Sell food', links:['Start selling','Seller dashboard','Pricing & packages','FSA guidance','Seller support']},
              {head:'Company', links:['About us','Deliver with us','Blog','Contact','Privacy policy']},
            ].map(s => (
              <div key={s.head}>
                <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.85)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14}}>{s.head}</div>
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {s.links.map(l => <a key={l} href="#" style={{fontSize:13, color:'rgba(255,255,255,0.42)', textDecoration:'none'}}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:20, display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.3)', flexWrap:'wrap', gap:8}}>
            <span>© 2026 Eat Home Ltd. Registered in England & Wales.</span>
            <span>Barking, East London · hello@eathome.co.uk</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
`)
console.log('HOMEPAGE DONE - world class version')