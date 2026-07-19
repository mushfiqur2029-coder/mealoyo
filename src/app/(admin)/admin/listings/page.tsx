'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import ListingDetailModal from '@/components/ListingDetailModal'
import AdminNotificationBell from '@/components/AdminNotificationBell'
import type { Profile, Listing } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Buyers', h:'/admin/buyers' },
  { l:'Listings', h:'/admin/listings' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Withdrawals', h:'/admin/withdrawals' },
  { l:'Settings', h:'/admin/settings' },
]

const TABS = [
  { k:'all', l:'All' },
  { k:'live', l:'Live' },
  { k:'pending', l:'Pending' },
  { k:'suspended', l:'Suspended' },
]

type SortKey = 'newest' | 'price' | 'orders' | 'rating'
const SORTS: { k: SortKey; l: string }[] = [
  { k:'newest', l:'Newest' },
  { k:'price', l:'Price high–low' },
  { k:'orders', l:'Most ordered' },
  { k:'rating', l:'Highest rated' },
]

const dark = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmerD { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  textarea { font-family: Inter, system-ui, sans-serif; }
  .skelD { background: linear-gradient(90deg, var(--bg-card) 0%, var(--border-subtle) 50%, var(--bg-card) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: var(--text-primary) !important; }
  .approve:hover { background: #009836 !important; }
  .changes:hover { background: #D97706 !important; }
  .suspend:hover { background: #B91C1C !important; }
  .view-btn:hover { background: rgba(37,99,235,0.12) !important; }
  .lcard { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), border-color 0.18s; }
  .lcard:hover { transform: translateY(-3px); border-color: rgba(200,0,106,0.4) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .tab:hover { color: var(--text-primary) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  input::placeholder, textarea::placeholder { color: var(--text-secondary); }
  input:focus, textarea:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 640px) { .lstats { grid-template-columns: 1fr 1fr !important; } .search { width: 100% !important; } .lgrid { grid-template-columns: 1fr !important; } }
`

type SellerInfo = { name: string; email: string; phone: string | null; postcode: string | null }

export default function AdminListings() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({})
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [changeTarget, setChangeTarget] = useState<Listing | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [detailTarget, setDetailTarget] = useState<Listing | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: prof } = await supabase.rpc('get_my_profile')
      if ((prof as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(prof)

      const { data: listingRows } = await supabase.rpc('admin_get_all_listings')
      setListings((listingRows || []) as Listing[])

      const { data: sellerRows } = await supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' })
      const map: Record<string, SellerInfo> = {}
      for (const s of (sellerRows || []) as Profile[]) map[s.id] = { name: s.full_name || 'Unknown', email: s.email || '', phone: s.phone, postcode: s.postcode }
      setSellers(map)

      setLoading(false)
    }
    getData()
  }, [router])

  // Approve / suspend flip through the guarded RPC and patch the row in place.
  const setStatus = async (id: string, status: 'live' | 'suspended') => {
    setBusyId(id)
    const { error } = await supabase.rpc('admin_update_listing_status', { p_id: id, p_status: status })
    if (error) { alert('Could not update: ' + error.message); setBusyId(null); return }
    setListings(prev => prev.map(l => l.id === id ? { ...l, status, admin_note: null } : l))
    setBusyId(null)
  }

  // "Request changes": send the listing back to pending with a note the seller reads.
  const submitChanges = async () => {
    if (!changeTarget || !changeNote.trim()) return
    setSubmitting(true)
    const note = changeNote.trim()
    const { error } = await supabase.rpc('admin_update_listing_status', { p_id: changeTarget.id, p_status: 'pending', p_note: note })
    if (error) { alert('Could not update: ' + error.message); setSubmitting(false); return }
    setListings(prev => prev.map(l => l.id === changeTarget.id ? { ...l, status: 'pending', admin_note: note } : l))
    setSubmitting(false)
    setChangeTarget(null)
    setChangeNote('')
  }

  // Patch a row in place after the detail modal runs an action (the modal owns
  // the RPC call and its own busy/success state).
  const applyStatusChange = (id: string, status: string, adminNote: string | null) => {
    setListings(prev => prev.map(l => l.id === id ? { ...l, status, admin_note: adminNote } : l))
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const statusColor = (s: string) => s === 'live' ? '#34D399' : s === 'pending' ? '#FBBF24' : '#FF8A8A'
  const statusBg = (s: string) => s === 'live' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : 'rgba(255,138,138,0.14)'

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} themed/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/listings'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:12, color:'var(--text-secondary)'}}>{profile?.full_name || profile?.email}</span>
          <AdminNotificationBell/>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:12, fontWeight:600, color:'var(--text-primary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:160, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:200, borderRadius:6, marginBottom:24}}/>
        <div className="lstats" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:92, borderRadius:16}}/>)}</div>
        <div className="lgrid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:18}}>{Array.from({length:6}).map((_, i) => <div key={i} className="skelD" style={{height:320, borderRadius:18}}/>)}</div>
      </div>
    </div>
  )

  const liveCount = listings.filter(l => l.status === 'live').length
  const pendingCount = listings.filter(l => l.status === 'pending').length
  const suspendedCount = listings.filter(l => l.status === 'suspended').length

  const stats = [
    { value:String(listings.length), label:'Total listings', color:'var(--text-primary)' },
    { value:String(liveCount), label:'Live', color:'#34D399' },
    { value:String(pendingCount), label:'Pending review', color:'#FBBF24' },
    { value:String(suspendedCount), label:'Suspended', color:'#FF8A8A' },
  ]

  const tabCount = (k: string) => k === 'all' ? listings.length : k === 'live' ? liveCount : k === 'pending' ? pendingCount : suspendedCount

  const q = search.trim().toLowerCase()
  const filtered = listings
    .filter(l => tab === 'all' || l.status === tab)
    .filter(l => {
      if (!q) return true
      const seller = sellers[l.seller_id]
      return l.name?.toLowerCase().includes(q) || seller?.name.toLowerCase().includes(q) || seller?.email.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'price') return parseFloat(b.price || '0') - parseFloat(a.price || '0')
      if (sort === 'orders') return (b.order_count || 0) - (a.order_count || 0)
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:14, marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Listings</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>{listings.length} {listings.length === 1 ? 'listing' : 'listings'} across all cooks.</p>
          </div>
          <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by dish or seller…" style={{height:42, padding:'0 16px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13, color:'var(--text-primary)', background:'var(--bg-card)', width:300, outline:'none', transition:'border-color 0.14s'}}/>
        </div>

        {/* Stats */}
        <div className="lstats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.6vw,28px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:7}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="fade-up" style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:14}}>
          {TABS.map(t => {
            const on = tab === t.k
            return <button key={t.k} onClick={() => setTab(t.k)} className="tab" style={{flexShrink:0, height:36, padding:'0 16px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid var(--border-subtle)', background:on ? 'rgba(200,0,106,0.15)' : 'var(--bg-card)', color:on ? '#C8006A' : 'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{t.l} <span style={{opacity:0.6, marginLeft:2}}>{tabCount(t.k)}</span></button>
          })}
        </div>

        {/* Sort */}
        <div className="fade-up" style={{display:'flex', gap:8, alignItems:'center', marginBottom:18, flexWrap:'wrap'}}>
          <span style={{fontSize:12, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>Sort</span>
          {SORTS.map(s => {
            const on = sort === s.k
            return <button key={s.k} onClick={() => setSort(s.k)} className="tab" style={{height:32, padding:'0 13px', borderRadius:100, border:on ? '1.5px solid #C8006A' : '1px solid var(--border-subtle)', background:on ? 'rgba(200,0,106,0.15)' : 'transparent', color:on ? '#C8006A' : 'var(--text-secondary)', fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.14s'}}>{s.l}</button>
          })}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', padding:'56px 32px', textAlign:'center'}}>
            <div style={{fontSize:42, marginBottom:14}}>{tab === 'pending' ? '✅' : '🍽️'}</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>
              {q ? 'No matching listings' : tab === 'all' ? 'No listings yet' : `No ${tab} listings`}
            </h2>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>
              {q ? 'Try a different search term.' : tab === 'pending' ? 'Nothing is waiting for review right now.' : 'Listings will appear here as cooks add them.'}
            </p>
          </div>
        ) : (
          <div className="lgrid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:18}}>
            {filtered.map(l => {
              const seller = sellers[l.seller_id]
              const allergenCount = l.allergens?.length || 0
              return (
                <div key={l.id} className="lcard fade-up" style={{background:'var(--bg-card)', borderRadius:18, overflow:'hidden', border:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column'}}>
                  {/* Photo / emoji fallback */}
                  <div style={{height:130, background:'linear-gradient(135deg,rgba(200,0,106,0.18) 0%,var(--bg-page) 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:56, position:'relative', overflow:'hidden'}}>
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image_url} alt={l.name} loading="lazy" style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />
                    ) : (cuisineEmoji[l.cuisine] || '🍽️')}
                    <span style={{position:'absolute', top:12, right:12, background:statusBg(l.status), color:statusColor(l.status), padding:'4px 11px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'capitalize', backdropFilter:'blur(6px)'}}>{l.status}</span>
                  </div>

                  {/* Body */}
                  <div style={{padding:'16px 18px', display:'flex', flexDirection:'column', flex:1}}>
                    <h3 style={{fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', lineHeight:1.25, marginBottom:5}}>{l.name}</h3>
                    <div style={{fontSize:12.5, color:'var(--text-secondary)', marginBottom:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {seller ? <>{seller.name} · {seller.email}</> : 'Unknown seller'}
                    </div>

                    {/* Tags */}
                    <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
                      <span style={{background:'var(--bg-page)', color:'#C8006A', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>{l.cuisine}</span>
                      <span style={{background:'var(--bg-page)', color:'var(--text-primary)', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:600}}>£{parseFloat(l.price || '0').toFixed(2)}</span>
                      <span style={{background:'var(--bg-page)', color:'var(--text-primary)', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:600}}>👥 Serves {l.serves || 1}</span>
                      {allergenCount > 0 && (
                        <span style={{background:'rgba(251,191,36,0.14)', color:'#FBBF24', padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700}}>⚠️ {allergenCount} allergen{allergenCount === 1 ? '' : 's'}</span>
                      )}
                    </div>

                    {/* Stats: orders + rating */}
                    <div style={{display:'flex', gap:18, marginBottom:14, fontSize:12.5, color:'var(--text-secondary)', fontWeight:600}}>
                      <span>📦 {l.order_count || 0} order{(l.order_count || 0) === 1 ? '' : 's'}</span>
                      <span>⭐ {l.rating ? Number(l.rating).toFixed(1) : '—'}{l.reviews_count ? ` (${l.reviews_count})` : ''}</span>
                    </div>

                    {/* Existing change request note (visible to admin too) */}
                    {l.status === 'pending' && l.admin_note && (
                      <div style={{background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:10, padding:'8px 11px', marginBottom:14}}>
                        <div style={{fontSize:10, fontWeight:700, color:'#FBBF24', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3}}>Changes requested</div>
                        <div className="clamp2" style={{fontSize:12, color:'var(--text-primary)', lineHeight:1.45}}>{l.admin_note}</div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{marginTop:'auto', paddingTop:14, borderTop:'1px solid var(--border-subtle)', display:'flex', gap:8, flexWrap:'wrap'}}>
                      {l.status !== 'live' && (
                        <button className="approve" disabled={busyId === l.id} onClick={() => setStatus(l.id, 'live')} style={{height:34, padding:'0 14px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === l.id ? 0.6 : 1}}>Set Live</button>
                      )}
                      <button className="changes" disabled={busyId === l.id} onClick={() => { setChangeTarget(l); setChangeNote(l.admin_note || '') }} style={{height:34, padding:'0 14px', background:'#F59E0B', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === l.id ? 0.6 : 1}}>Request changes</button>
                      {l.status !== 'suspended' && (
                        <button className="suspend" disabled={busyId === l.id} onClick={() => setStatus(l.id, 'suspended')} style={{height:34, padding:'0 14px', background:'#DC2626', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'background 0.12s', opacity:busyId === l.id ? 0.6 : 1}}>Suspend</button>
                      )}
                      <button className="view-btn" onClick={() => setDetailTarget(l)} style={{height:34, padding:'0 14px', display:'inline-flex', alignItems:'center', background:'transparent', color:'#2563EB', border:'1px solid rgba(37,99,235,0.5)', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>View</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Request-changes modal */}
      {changeTarget && (
        <div onClick={() => { if (!submitting) { setChangeTarget(null); setChangeNote('') } }} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:18, width:'100%', maxWidth:480, overflow:'hidden'}}>
            <div style={{padding:'20px 24px', borderBottom:'1px solid var(--border-subtle)'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:19, fontWeight:700, color:'var(--text-primary)'}}>Request changes from seller</h2>
              <p style={{fontSize:12.5, color:'var(--text-secondary)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>&ldquo;{changeTarget.name}&rdquo; will go back to pending until updated.</p>
            </div>
            <div style={{padding:'20px 24px'}}>
              <label style={{display:'block', fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>What needs to be changed?</label>
              <textarea
                value={changeNote}
                onChange={e => setChangeNote(e.target.value)}
                autoFocus
                rows={5}
                placeholder="e.g. Please add a clearer photo and list the allergens for this dish."
                style={{width:'100%', padding:'12px 14px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13.5, color:'var(--text-primary)', background:'var(--bg-page)', outline:'none', resize:'vertical', lineHeight:1.5, transition:'border-color 0.14s'}}
              />
            </div>
            <div style={{padding:'0 24px 22px', display:'flex', gap:10, justifyContent:'flex-end'}}>
              <button onClick={() => { if (!submitting) { setChangeTarget(null); setChangeNote('') } }} disabled={submitting} style={{height:42, padding:'0 18px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer'}}>Cancel</button>
              <button className="changes" onClick={submitChanges} disabled={submitting || !changeNote.trim()} style={{height:42, padding:'0 20px', background:'#F59E0B', color:'#fff', border:'none', borderRadius:10, fontSize:13.5, fontWeight:700, cursor:submitting || !changeNote.trim() ? 'not-allowed' : 'pointer', opacity:submitting || !changeNote.trim() ? 0.55 : 1, transition:'background 0.12s'}}>{submitting ? 'Sending…' : 'Send request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Full listing detail (replaces sending admins to /dish/[id]) */}
      <ListingDetailModal
        key={detailTarget?.id ?? 'none'}
        listing={detailTarget}
        sellerName={detailTarget ? sellers[detailTarget.seller_id]?.name : undefined}
        sellerEmail={detailTarget ? sellers[detailTarget.seller_id]?.email : undefined}
        sellerPhone={detailTarget ? sellers[detailTarget.seller_id]?.phone : undefined}
        sellerPostcode={detailTarget ? sellers[detailTarget.seller_id]?.postcode : undefined}
        onClose={() => setDetailTarget(null)}
        onStatusChange={applyStatusChange}
      />
    </div>
  )
}
