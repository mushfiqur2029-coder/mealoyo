'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Listing, Profile } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/seller/dashboard' },
  { l:'My listings', h:'/seller/listings' },
  { l:'Orders', h:'/seller/orders' },
  { l:'Earnings', h:'/seller/earnings' },
  { l:'Profile', h:'/seller/profile' },
]

const FILTERS = ['all', 'live', 'pending', 'suspended']

export default function SellerListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const statusColor = (s: string) => s === 'live' ? '#2DA84E' : s === 'pending' ? '#B8730A' : '#C0392B'
  const statusBg = (s: string) => s === 'live' ? '#E4F6EA' : s === 'pending' ? '#FFF4E0' : '#FDECEA'

  const counts = {
    all: listings.length,
    live: listings.filter(l => l.status === 'live').length,
    pending: listings.filter(l => l.status === 'pending').length,
    suspended: listings.filter(l => l.status === 'suspended').length,
  }
  const filtered = filter === 'all' ? listings : listings.filter(l => l.status === filter)

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
      ::-webkit-scrollbar { width: 0; height: 0; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
      a { text-decoration: none; color: inherit; }
      button { font-family: Inter, system-ui, sans-serif; }
      .skel { background: linear-gradient(90deg, #F3E6EE 0%, #FBF1F7 50%, #F3E6EE 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .filter-pill { transition: all 0.16s cubic-bezier(0.34,1.2,0.64,1); }
      .filter-pill:hover { border-color: #C8006A !important; }
      .add-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .add-btn:hover { background: #A00055 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(200,0,106,0.36) !important; }
      .listing-card { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
      .listing-card:hover { transform: translateY(-4px); box-shadow: 0 16px 44px rgba(200,0,106,0.14) !important; }
      .edit-btn:hover { background: #FFE8F4 !important; border-color: #C8006A !important; color: #C8006A !important; }
      .del-btn:hover { background: #FDECEA !important; border-color: #C0392B !important; }
      .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      @media (max-width: 768px) {
        .nav-links { display: none !important; }
        .listings-grid { grid-template-columns: 1fr !important; }
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
        <button onClick={signOut} className="nav-link" style={{marginLeft:'auto', height:36, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:8, background:'#fff', fontSize:13, fontWeight:600, color:'#1A1A1A', cursor:'pointer', flexShrink:0}}>Sign out</button>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:200, borderRadius:8, marginBottom:10}}/>
        <div className="skel" style={{height:34, width:300, borderRadius:100, marginBottom:24}}/>
        <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:18}}>
          {Array.from({length:6}).map((_, i) => (
            <div key={i} style={{background:'#fff', borderRadius:20, overflow:'hidden', border:'1.5px solid rgba(200,0,106,0.07)'}}>
              <div className="skel" style={{height:120}}/>
              <div style={{padding:18}}>
                <div className="skel" style={{height:16, width:'70%', borderRadius:6, marginBottom:10}}/>
                <div className="skel" style={{height:12, width:'100%', borderRadius:6, marginBottom:6}}/>
                <div className="skel" style={{height:12, width:'80%', borderRadius:6, marginBottom:16}}/>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <div className="skel" style={{height:24, width:70, borderRadius:6}}/>
                  <div className="skel" style={{height:34, width:120, borderRadius:8}}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL ──
  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:480, margin:'0 auto', padding:'56px 20px'}}>
        <div className="fade-up" style={{background:'#fff', borderRadius:24, padding:'48px 36px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
          <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>Awaiting approval</h2>
          <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You&apos;ll be able to add and manage listings within 24–48 hours.</p>
          <button onClick={signOut} className="add-btn" style={{height:46, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8F0F4', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Header */}
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:20}}>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Seller workspace</div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,32px)', fontWeight:700, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:12}}>My listings</h1>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {[
                { l:'Total', v:counts.all, c:'#1A1A1A', bg:'#F0E4EC' },
                { l:'Live', v:counts.live, c:'#2DA84E', bg:'#E4F6EA' },
                { l:'Pending', v:counts.pending, c:'#B8730A', bg:'#FFF4E0' },
              ].map((s, i) => (
                <div key={i} style={{display:'inline-flex', alignItems:'center', gap:7, background:s.bg, borderRadius:100, padding:'7px 14px'}}>
                  <span style={{fontSize:15, fontWeight:800, color:s.c, fontFamily:'Georgia,serif'}}>{s.v}</span>
                  <span style={{fontSize:12, fontWeight:700, color:s.c}}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/seller/listings/new" className="add-btn" style={{height:48, padding:'0 22px', display:'flex', alignItems:'center', gap:8, background:'#C8006A', borderRadius:12, fontSize:14, fontWeight:700, color:'#fff', boxShadow:'0 4px 16px rgba(200,0,106,0.3)', flexShrink:0}}>
            <span style={{fontSize:18}}>＋</span> Add new dish
          </Link>
        </div>

        {/* Filter pills */}
        {listings.length > 0 && (
          <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:24}}>
            {FILTERS.map(f => {
              const on = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} className="filter-pill" style={{flexShrink:0, display:'flex', alignItems:'center', gap:7, height:40, padding:'0 16px', borderRadius:100, border:on ? '2px solid #C8006A' : '1.5px solid #E0E0E0', background:on ? '#FFE8F4' : '#fff', color:on ? '#C8006A' : '#1A1A1A', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'capitalize'}}>
                  {f}
                  <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:20, height:20, padding:'0 6px', borderRadius:100, background:on ? '#C8006A' : '#F0E4EC', color:on ? '#fff' : '#1A1A1A', fontSize:11, fontWeight:700}}>{counts[f as keyof typeof counts]}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {listings.length === 0 ? (
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'72px 32px', textAlign:'center', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{width:96, height:96, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:46, margin:'0 auto 22px'}}>🍽️</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1A1A', marginBottom:10}}>No dishes yet</h2>
            <p style={{fontSize:14, color:'#1A1A1A', lineHeight:1.65, maxWidth:380, margin:'0 auto 26px'}}>Add your first dish and start earning. Listings go live once our team verifies your account.</p>
            <Link href="/seller/listings/new" className="add-btn" style={{display:'inline-flex', alignItems:'center', gap:8, height:50, padding:'0 30px', background:'#C8006A', borderRadius:12, fontSize:15, fontWeight:700, color:'#fff', boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>Add your first dish →</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fade-up" style={{background:'#fff', borderRadius:20, padding:'56px 32px', textAlign:'center', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:40, marginBottom:14}}>🔍</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1A1A1A', marginBottom:8}}>No {filter} dishes</h2>
            <p style={{fontSize:14, color:'#1A1A1A'}}>Try a different filter to see more of your listings.</p>
          </div>
        ) : (
          <div className="listings-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:18}}>
            {filtered.map(l => {
              const allergenCount = l.allergens?.length || 0
              const dietary = [l.halal && '🟢 Halal', l.vegan && '🌿 Vegan', l.vegetarian && '🥦 Veg', l.spicy && '🌶️ Spicy'].filter(Boolean) as string[]
              return (
                <div key={l.id} className="listing-card fade-up" style={{background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid rgba(200,0,106,0.07)', display:'flex', flexDirection:'column'}}>

                  {/* Gradient emoji header */}
                  <div style={{height:128, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:58, position:'relative'}}>
                    {cuisineEmoji[l.cuisine] || '🍽️'}
                    <span style={{position:'absolute', top:12, right:12, background:statusBg(l.status), color:statusColor(l.status), padding:'4px 11px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'capitalize', boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>{l.status}</span>
                    {l.featured && <span style={{position:'absolute', top:12, left:12, background:'#C8006A', color:'#fff', padding:'4px 11px', borderRadius:100, fontSize:11, fontWeight:700, boxShadow:'0 2px 8px rgba(200,0,106,0.3)'}}>★ Featured</span>}
                  </div>

                  {/* Body */}
                  <div style={{padding:'18px', display:'flex', flexDirection:'column', flex:1}}>
                    <h3 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#1A1A1A', lineHeight:1.25, marginBottom:6}}>{l.name}</h3>
                    <p className="clamp2" style={{fontSize:13, color:'#1A1A1A', opacity:0.85, lineHeight:1.5, marginBottom:14, minHeight:38}}>{l.description || 'No description provided.'}</p>

                    {/* Info row: serves + prep */}
                    <div style={{display:'flex', gap:14, marginBottom:12, fontSize:12, color:'#1A1A1A', fontWeight:600}}>
                      <span style={{display:'inline-flex', alignItems:'center', gap:5}}>👥 Serves {l.serves || 1}</span>
                      {l.prep_time && <span style={{display:'inline-flex', alignItems:'center', gap:5}}>⏱️ {l.prep_time}</span>}
                    </div>

                    {/* Tags row */}
                    <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:14}}>
                      <span style={{background:'#F8F0F4', color:'#C8006A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>{l.cuisine}</span>
                      {dietary.slice(0, 2).map((d, i) => (
                        <span key={i} style={{background:'#F8F0F4', color:'#1A1A1A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:600}}>{d}</span>
                      ))}
                      {allergenCount > 0 && (
                        <span style={{background:'#FFF4E0', color:'#B8730A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>⚠️ {allergenCount} allergen{allergenCount === 1 ? '' : 's'}</span>
                      )}
                    </div>

                    {/* Footer: price + actions */}
                    <div style={{marginTop:'auto', paddingTop:14, borderTop:'1px solid #F5F0F3', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em'}}>£{parseFloat(l.price || '0').toFixed(2)}</div>
                      <div style={{display:'flex', gap:8}}>
                        <Link href={`/seller/listings/${l.id}/edit`} className="edit-btn" style={{height:40, padding:'0 16px', display:'inline-flex', alignItems:'center', border:'1.5px solid #E0E0E0', borderRadius:10, fontSize:13, fontWeight:700, color:'#1A1A1A', background:'#fff', transition:'all 0.14s'}}>Edit</Link>
                        <button onClick={() => deleteListing(l.id)} className="del-btn" style={{height:40, padding:'0 16px', border:'1.5px solid #E0E0E0', borderRadius:10, fontSize:13, fontWeight:700, color:'#C0392B', background:'#fff', cursor:'pointer', transition:'all 0.14s'}}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
