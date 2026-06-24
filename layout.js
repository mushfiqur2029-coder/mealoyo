const fs = require('fs')

// Main layout
fs.writeFileSync('src/app/layout.tsx', `
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eat Home — Home cooked food, delivered',
  description: 'Order authentic home cooked food from local home cooks in your neighbourhood',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`)
console.log('layout.tsx done')

// Main homepage
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

export default function Home() {
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const filtered = listings.filter(l => (cat === 'all' || l.cat === cat) && l.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{minHeight:'100vh', background:'#F8F8F6'}}>

      {/* NAV */}
      <nav style={{background:'#fff', borderBottom:'1px solid #E8E8E8', position:'sticky', top:0, zIndex:100, height:64}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', height:64, display:'flex', alignItems:'center', gap:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginRight:32}}>
            <div style={{width:34, height:34, background:'#C8006A', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>🏠</div>
            <span style={{fontFamily:'Georgia,serif', fontWeight:700, fontSize:22, color:'#C8006A', letterSpacing:'-0.02em'}}>Eat Home</span>
          </div>
          <div style={{display:'flex', gap:0, flex:1}}>
            {['Explore food','Sell & cater','Deliver & earn'].map((t,i) => (
              <Link key={i} href={i===1?'/seller':i===2?'/driver':'/'} style={{height:64, padding:'0 16px', display:'flex', alignItems:'center', fontSize:14, fontWeight:i===0?600:400, color:i===0?'#C8006A':'#575757', borderBottom:i===0?'2.5px solid #C8006A':'2px solid transparent', textDecoration:'none'}}>{t}</Link>
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginLeft:'auto'}}>
            <Link href="/login" style={{height:38, padding:'0 18px', display:'flex', alignItems:'center', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', textDecoration:'none'}}>Sign in</Link>
            <Link href="/register" style={{height:38, padding:'0 18px', display:'flex', alignItems:'center', background:'#C8006A', borderRadius:8, fontSize:14, fontWeight:700, color:'#fff', textDecoration:'none'}}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div style={{background:'#0D0006', minHeight:'90vh', display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden', position:'relative'}}>
        <div style={{position:'absolute', left:'-10%', top:'-20%', width:'70%', height:'140%', background:'radial-gradient(ellipse,rgba(200,0,106,0.18) 0%,transparent 65%)', pointerEvents:'none'}}/>
        
        {/* Hero left */}
        <div style={{padding:'80px 48px 80px 10%', display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:1}}>
          <div style={{display:'inline-flex', alignItems:'center', gap:8, background:'rgba(200,0,106,0.15)', border:'1px solid rgba(200,0,106,0.3)', borderRadius:100, padding:'5px 14px', marginBottom:24, width:'fit-content'}}>
            <span style={{width:6, height:6, borderRadius:'50%', background:'#C8006A', display:'inline-block'}}/>
            <span style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.06em'}}>London & Essex — 840+ cooks</span>
          </div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(38px,4.8vw,64px)', fontWeight:700, color:'#fff', lineHeight:1.06, letterSpacing:'-0.025em', marginBottom:18}}>
            Home cooked food,<br/><span style={{color:'#C8006A'}}>delivered to you.</span>
          </h1>
          <p style={{fontSize:17, color:'rgba(255,255,255,0.6)', lineHeight:1.72, marginBottom:32, maxWidth:440}}>
            Authentic meals from verified home cooks in your neighbourhood. Real food, real kitchens, real flavour.
          </p>

          {/* Search */}
          <div style={{background:'#fff', borderRadius:14, padding:8, display:'flex', gap:6, boxShadow:'0 4px 24px rgba(0,0,0,0.3)', marginBottom:24}}>
            <div style={{display:'flex', alignItems:'center', gap:8, flex:1, padding:'0 12px'}}>
              <span style={{fontSize:18}}>📍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search food or postcode..."
                style={{border:'none', outline:'none', fontFamily:'inherit', fontSize:15, fontWeight:600, color:'#1A1A1A', width:'100%', height:44, background:'transparent'}}
              />
            </div>
            <button onClick={() => {}} style={{height:52, padding:'0 28px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:16, fontWeight:700, cursor:'pointer'}}>
              Find food
            </button>
          </div>

          {/* Stats */}
          <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
            {[['840+','Home cooks'],['12k+','Monthly orders'],['4.8★','Avg rating'],['88%','Seller payout']].map(([n,l]) => (
              <div key={l}>
                <div style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>{n}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:3, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero right — food cards */}
        <div style={{display:'flex', alignItems:'flex-end', padding:'40px 10% 0 24px', overflow:'hidden'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%', maxWidth:460, alignSelf:'flex-end'}}>
            {[
              {wide:true, emoji:'🍛', tag:'Popular today', name:'Lamb biryani & raita', cook:"Fatima's Kitchen · Barking", price:'£12.50', rat:'★ 4.9 (128)'},
              {wide:false, emoji:'🫕', tag:'', name:'Karahi chicken', cook:'Mama Razia · Ilford', price:'£9.00', rat:'★ 4.8'},
              {wide:false, emoji:'🎂', tag:'', name:'Celebration cake', cook:"Bea's Bakery · Romford", price:'£22.00', rat:'★ 5.0'},
            ].map((c, i) => (
              <div key={i} style={{gridColumn:c.wide?'span 2':'auto', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, overflow:'hidden', cursor:'pointer'}}>
                <div style={{height:c.wide?148:100, display:'flex', alignItems:'center', justifyContent:'center', fontSize:c.wide?60:42, background:'rgba(0,0,0,0.2)'}}>{c.emoji}</div>
                <div style={{padding:'10px 13px 13px'}}>
                  {c.tag && <div style={{display:'inline-block', background:'#C8006A', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5}}>{c.tag}</div>}
                  <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:1}}>{c.name}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.45)'}}>{c.cook}</div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6}}>
                    <span style={{fontSize:14, fontWeight:800, color:'#C8006A', fontFamily:'Georgia,serif'}}>{c.price}</span>
                    <span style={{fontSize:11, color:'rgba(255,255,255,0.5)'}}>{c.rat}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRUST BAR */}
      <div style={{background:'#A00055', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'center', gap:0, flexWrap:'wrap'}}>
          {['✅ FSA registered cooks only','🔒 Stripe-secured payments','🛡️ Buyer protection on every order','⚡ 45 min community delivery','🌿 Allergen declarations mandatory'].map((t,i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:7, padding:'12px 20px', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)'}}>
              {i>0 && <div style={{width:1, height:16, background:'rgba(255,255,255,0.15)', marginRight:20}}/>}
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <div style={{background:'#fff', borderBottom:'1px solid #E8E8E8', padding:'32px 0'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
            <div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Browse by cuisine</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.015em'}}>What are you craving?</h2>
            </div>
            <button style={{height:36, padding:'0 16px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#fff', cursor:'pointer'}}>View all</button>
          </div>
          <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:4}}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#fff', border:cat===c.id?'2px solid #C8006A':'2px solid #E8E8E8', borderRadius:100, cursor:'pointer', fontSize:14, fontWeight:700, color:cat===c.id?'#C8006A':'#575757', background:cat===c.id?'#FFE8F4':'#fff', whiteSpace:'nowrap', flexShrink:0}}>
                <span style={{fontSize:18}}>{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LISTINGS */}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'48px 24px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10}}>
          <div style={{fontSize:15, fontWeight:600, color:'#1A1A1A'}}>{filtered.length} listings near you</div>
          <select style={{height:38, padding:'0 14px', border:'1.5px solid #E8E8E8', borderRadius:8, fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#fff'}}>
            <option>Recommended</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Highest rated</option>
          </select>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(272px,1fr))', gap:20}}>
          {filtered.map(l => (
            <div key={l.id} style={{background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #E8E8E8', cursor:'pointer', transition:'all 0.18s'}}>
              <div style={{height:180, display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, background:'#FFF0F8', position:'relative'}}>
                {l.emoji}
                <div style={{position:'absolute', top:10, right:10, width:32, height:32, background:'rgba(255,255,255,0.93)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14}}>🤍</div>
              </div>
              <div style={{padding:'14px 16px'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:3}}>{l.name}</div>
                <div style={{fontSize:12, color:'#8C8C8C', marginBottom:9}}>{l.cook}</div>
                <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:10}}>
                  {l.tags.map(t => (
                    <span key={t} style={{background:t==='Halal'?'#E4F6EA':t==='Vegan'?'#EBF2FD':'#FFE8F4', color:t==='Halal'?'#2DA84E':t==='Vegan'?'#1A6ECC':'#C8006A', padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700}}>{t}</span>
                  ))}
                </div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid #F0F0F0'}}>
                  <div>
                    <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#1A1A1A'}}>£{l.price.toFixed(2)}</div>
                    <div style={{fontSize:11, color:'#8C8C8C'}}>📍 {l.loc}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#1A1A1A'}}><span style={{color:'#C8006A'}}>★</span> {l.rat} ({l.rev})</div>
                    <button style={{marginTop:5, height:28, padding:'0 14px', background:'#C8006A', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer'}}>Order</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{background:'#1A1A1A', padding:'48px 0 24px'}}>
        <div style={{maxWidth:1200, margin:'0 auto', padding:'0 24px'}}>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:32}}>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <div style={{width:30, height:30, background:'#C8006A', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15}}>🏠</div>
                <span style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A'}}>Eat Home</span>
              </div>
              <p style={{fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.7, maxWidth:260, marginBottom:16}}>The UK home cook food marketplace. Authentic meals from verified home cooks across London and Essex.</p>
              <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#E4F6EA', color:'#2DA84E', border:'1px solid rgba(45,168,78,0.25)', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700}}>✓ FSA registered platform</span>
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
          <div style={{borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:20, display:'flex', justifyContent:'space-between', fontSize:12, color:'rgba(255,255,255,0.35)', flexWrap:'wrap', gap:8}}>
            <span>© 2026 Eat Home Ltd. Registered in England & Wales.</span>
            <span>Barking, East London · hello@eathome.co.uk</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
`)
console.log('page.tsx done')
console.log('ALL DONE')