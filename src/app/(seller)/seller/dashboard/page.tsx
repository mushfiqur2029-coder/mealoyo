'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import NavAvatar from '@/components/NavAvatar'
import ProfileCompletionCard from '@/components/ProfileCompletionCard'
import { calculateProfileCompletion } from '@/lib/profileCompletion'
import { playDoubleBeep, requestNotificationPermission, showPushNotification } from '@/lib/notifications'
import type { Profile, Listing, Order, Review, WithdrawalRequest } from '@/lib/types'

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'accepted', label: 'Accept' },
  accepted: { next: 'cooking', label: 'Cook' },
  cooking: { next: 'ready', label: 'Ready' },
  ready: { next: 'picked_up', label: 'Picked up' },
  picked_up: { next: 'delivered', label: 'Delivered' },
  delivered: null,
  cancelled: null,
}

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
]

export default function SellerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  // Sourced from get_my_profile_full because postcode + bank aren't in the
  // base RPC. Powers the "please add your postcode" warning below AND the
  // profile completion card.
  const [sellerPostcode, setSellerPostcode] = useState<string | null>(null)
  const [fullProfileRow, setFullProfileRow] = useState<Profile | null>(null)
  // Persistent "new orders arrived" counter — increments per realtime hit,
  // dismissed by the seller (not per-session sticky).
  const [newOrderBanner, setNewOrderBanner] = useState(0)
  const [listings, setListings] = useState<Listing[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCount, setOrderCount] = useState(0)
  const [monthCount, setMonthCount] = useState(0)
  const [deliveredOrders, setDeliveredOrders] = useState<Pick<Order, 'seller_payout'>[]>([])
  const [pendingOrders, setPendingOrders] = useState<Pick<Order, 'seller_payout'>[]>([])
  // Withdrawal requests feed the "available balance" calc — everything
  // that's not 'rejected' is money already spoken for.
  const [withdrawals, setWithdrawals] = useState<Pick<WithdrawalRequest, 'amount' | 'status'>[]>([])
  // Set true while a background re-fetch is running so the wallet card can
  // show a subtle pulsing tick.
  const [balanceReloading, setBalanceReloading] = useState(false)
  const [reviews, setReviews] = useState<Pick<Review, 'rating'>[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      // Full row via definer RPC — one call covers avatar_url + postcode +
      // completion scoring, and avoids the direct .select() on profiles that
      // was throwing "permission denied for table profiles" when the base
      // column grant wasn't in place.
      const { data: fullProfile } = await supabase.rpc('get_my_profile_full')
      setAvatarUrl(fullProfile?.avatar_url || null)
      setSellerPostcode(fullProfile?.postcode || null)
      setFullProfileRow(fullProfile as Profile | null)
      const { data: listings } = await supabase.from('listings').select('*').eq('seller_id', user.id)
      setListings(listings || [])
      const { data: orders } = await supabase.from('orders').select('*, listings(name,cuisine), profiles:buyer_id(full_name)').eq('seller_id', user.id).neq('status', 'pending_payment').order('created_at', { ascending: false }).limit(5)
      setOrders(orders || [])
      const { count: total } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).neq('status', 'pending_payment')
      setOrderCount(total ?? 0)
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
      const { count: month } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).neq('status', 'pending_payment').gte('created_at', startOfMonth.toISOString())
      setMonthCount(month ?? 0)
      const { data: delivered } = await supabase.from('orders').select('seller_payout').eq('seller_id', user.id).eq('status', 'delivered')
      setDeliveredOrders(delivered || [])
      const { data: pending } = await supabase.from('orders').select('seller_payout').eq('seller_id', user.id).in('status', ['pending', 'accepted', 'cooking', 'ready', 'picked_up'])
      setPendingOrders(pending || [])
      const { data: wdRows } = await supabase.from('withdrawal_requests').select('amount, status').eq('user_id', user.id)
      setWithdrawals(wdRows || [])
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('seller_id', user.id)
      setReviews(reviews || [])
      setLoading(false)
    }
    getData()
  }, [router])

  // Balance recalculator — only re-fetches the two rows the wallet card
  // depends on (delivered orders + withdrawal_requests), not the whole
  // dashboard. Triggered by realtime events on either table so a driver
  // paying out or an admin marking a withdrawal paid flips the number
  // instantly.
  useEffect(() => {
    if (!userId) return
    const recompute = async () => {
      setBalanceReloading(true)
      const [{ data: delivered }, { data: wdRows }] = await Promise.all([
        supabase.from('orders').select('seller_payout').eq('seller_id', userId).eq('status', 'delivered'),
        supabase.from('withdrawal_requests').select('amount, status').eq('user_id', userId),
      ])
      setDeliveredOrders(delivered || [])
      setWithdrawals(wdRows || [])
      setBalanceReloading(false)
    }
    const channel = supabase
      .channel(`seller-balance-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` }, () => { void recompute() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests', filter: `user_id=eq.${userId}` }, () => { void recompute() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  // ── DESKTOP PUSH NOTIFICATIONS: alert the seller the moment a paid order lands ──
  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // Ask for permission exactly once, and remember the choice so we never nag.
    void requestNotificationPermission()

    const notify = async (listingId: string | undefined, amount: string | undefined) => {
      // Double beep (880 → 1100 Hz) — attention-grabbing two-tone signal
      // that the seller learns as "new order landed". The banner still bumps
      // even without notification permission so the visual state stays in
      // sync with the sound.
      playDoubleBeep()
      setNewOrderBanner(n => n + 1)
      let dish = 'A new dish'
      if (listingId) {
        const { data } = await supabase.from('listings').select('name').eq('id', listingId).maybeSingle()
        if (data?.name) dish = data.name
      }
      const money = amount ? ` — £${parseFloat(amount).toFixed(2)}` : ''
      showPushNotification('New order! 🍽️', `${dish}${money}`)
    }

    const channel = supabase
      .channel(`seller-dash-notify-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Order
          // Skip unpaid Stripe checkouts — they notify on the paid UPDATE below.
          if (row.status === 'pending_payment') return
          notify(row.listing_id, row.total_amount)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` },
        (payload) => {
          const oldRow = payload.old as Partial<Order>
          const row = payload.new as Order
          // Fire only on the pending_payment → paid transition (a real new order).
          if (oldRow.status === 'pending_payment' && row.status !== 'pending_payment') {
            notify(row.listing_id, row.total_amount)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const advanceStatus = async (order: Order) => {
    const step = STATUS_FLOW[order.status]
    if (!step) return
    setUpdatingId(order.id)
    const { error } = await supabase.from('orders').update({ status: step.next }).eq('id', order.id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: step.next } : o))
      // Award loyalty points on delivery. Idempotent DB-side; no-ops until the
      // loyalty SQL has been run.
      if (step.next === 'delivered') await supabase.rpc('award_loyalty_points', { p_order_id: order.id })
    }
    setUpdatingId(null)
  }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#B8730A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'

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
      .skel { background: linear-gradient(90deg, rgba(200,0,106,0.06) 0%, rgba(200,0,106,0.13) 50%, rgba(200,0,106,0.06) 100%); background-size: 960px 100%; animation: shimmer 1.4s ease-in-out infinite; }
      .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
      .nav-link:hover { color: #C8006A !important; }
      .stat-card { transition: transform 0.18s; }
      .stat-card:hover { transform: translateY(-2px); }
      .orow:hover { background: rgba(200,0,106,0.06) !important; }
      .lrow:hover { background: rgba(200,0,106,0.06) !important; }
      .advance-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .advance-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .qa-row:hover { background: rgba(200,0,106,0.06) !important; transform: translateX(2px); }
      .ghost-btn:hover { background: rgba(255,255,255,0.28) !important; }
      .signout:hover { background: rgba(200,0,106,0.12) !important; color: #C8006A !important; }
      @media (max-width: 900px) {
        .nav-links { display: none !important; }
        .two-col { grid-template-columns: minmax(0,1fr) !important; }
        .col-right { position: static !important; order: -1; }
      }
      @media (max-width: 600px) {
        .dash-grid { grid-template-columns: 1fr 1fr !important; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-card)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/dashboard'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : 'var(--text-primary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center'}}>
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || 'S'} href="/seller/profile"/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'var(--bg-card)', cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:280, borderRadius:8, marginBottom:8}}/>
        <div className="skel" style={{height:15, width:200, borderRadius:6, marginBottom:28}}/>
        <div className="dash-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:108, borderRadius:18}}/>)}
        </div>
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20}}>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:300, borderRadius:20}}/>
            <div className="skel" style={{height:220, borderRadius:20}}/>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <div className="skel" style={{height:200, borderRadius:20}}/>
            <div className="skel" style={{height:240, borderRadius:20}}/>
          </div>
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL ──
  if (profile?.status === 'pending') {
    const steps = [
      { t:'Application submitted', d:'We received your seller details.', done:true },
      { t:'Identity & hygiene review', d:'Our team is verifying your information.', done:false, active:true },
      { t:'Approval & go live', d:'Start listing dishes and taking orders.', done:false },
    ]
    return (
      <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
        {pageStyles}
        {nav}
        <div style={{maxWidth:560, margin:'0 auto', padding:'48px 20px'}}>
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:24, padding:'40px 32px', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid var(--border)', marginBottom:20}}>
            <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>You&apos;re almost ready, {profile?.full_name?.split(' ')[0] || 'Chef'}</h1>
            <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.7, maxWidth:400, margin:'0 auto'}}>Your seller account is being reviewed. Approval usually takes <strong style={{color:'#C8006A'}}>24–48 hours</strong>. We&apos;ll email you the moment you&apos;re live.</p>
          </div>
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'24px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid var(--border)', marginBottom:20}}>
            <h3 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:18}}>What happens next</h3>
            {steps.map((s, i) => (
              <div key={i} style={{display:'flex', gap:14, paddingBottom:i < steps.length - 1 ? 18 : 0, position:'relative'}}>
                {i < steps.length - 1 && <div style={{position:'absolute', left:15, top:32, bottom:6, width:2, background:'var(--border)'}}/>}
                <div style={{width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, zIndex:1, background:s.done ? '#2DA84E' : s.active ? '#C8006A' : 'var(--border)', color:s.done || s.active ? '#fff' : 'var(--text-primary)'}}>{s.done ? '✓' : i + 1}</div>
                <div style={{flex:1, paddingTop:4}}>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8}}>{s.t}{s.active && <span style={{background:'#FFE8F4', color:'#C8006A', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.04em'}}>In progress</span>}</div>
                  <div style={{fontSize:13, color:'var(--text-primary)', opacity:0.8, marginTop:2, lineHeight:1.5}}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center'}}>
            <button onClick={signOut} className="signout" style={{height:44, padding:'0 24px', background:'var(--bg-card)', color:'var(--text-primary)', border:'1.5px solid var(--border)', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.12s'}}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  // ── DERIVED ──
  const liveListings = listings.filter(l => l.status === 'live')
  const totalEarnings = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  const pendingOrderAmount = pendingOrders.reduce((sum, o) => sum + parseFloat(o.seller_payout || '0'), 0)
  // Every non-rejected withdrawal (pending / approved / paid) reduces the
  // available balance. Split out so the wallet card can show both.
  const totalWithdrawn = withdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending' || w.status === 'approved').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const availableBalance = Math.max(0, totalEarnings - totalWithdrawn)
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null
  const firstName = profile?.full_name?.split(' ')[0] || 'Chef'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const stars = (r: number) => (
    <span style={{display:'inline-flex', gap:1, letterSpacing:1}}>
      {[1,2,3,4,5].map(i => <span key={i} style={{color:i <= Math.round(r) ? '#E8930A' : '#EBD7BE', fontSize:14}}>★</span>)}
    </span>
  )

  const quickActions = [
    { l:'Add new listing', s:'List another dish', i:'➕', h:'/seller/listings/new' },
    { l:'View all orders', s:'Manage every order', i:'📦', h:'/seller/orders' },
    { l:'View earnings', s:'Payouts & history', i:'💷', h:'/seller/earnings' },
    { l:'Edit profile', s:'Update your details', i:'⚙️', h:'/seller/profile' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-secondary)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Welcome header */}
        <div className="fade-up" style={{marginBottom:26}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,34px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>{greeting}, {firstName} 👋</h1>
          <p style={{fontSize:14, color:'var(--text-primary)', opacity:0.85}}>{today}</p>
        </div>

        {/* Persistent "new order" banner — stays until dismissed. Bumps every
            time a paid order lands via realtime. */}
        {newOrderBanner > 0 && (
          <div role="alert" className="fade-up" style={{display:'flex', alignItems:'center', gap:14, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF4FA 100%)', border:'2px solid #C8006A', borderRadius:16, padding:'14px 18px', marginBottom:20, boxShadow:'0 8px 24px rgba(200,0,106,0.18)'}}>
            <span style={{fontSize:26, display:'inline-flex', width:44, height:44, borderRadius:'50%', background:'#fff', alignItems:'center', justifyContent:'center', flexShrink:0}}>🔔</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#C8006A'}}>{newOrderBanner === 1 ? '1 new order received' : `${newOrderBanner} new orders received`}</div>
              <div style={{fontSize:13, color:'var(--text-primary)', marginTop:2}}>Jump into Orders to accept them before the buyer changes their mind.</div>
            </div>
            <Link href="/seller/orders" style={{flexShrink:0, height:40, padding:'0 16px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center'}}>Open orders →</Link>
            <button onClick={() => setNewOrderBanner(0)} aria-label="Dismiss" style={{flexShrink:0, width:30, height:30, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.06)', color:'#1A1A1A', fontSize:14, cursor:'pointer'}}>✕</button>
          </div>
        )}

        {/* Profile completion nag — dismissible per-session, hides at >=80%. */}
        {fullProfileRow && (
          <ProfileCompletionCard
            role="seller"
            variant="compact"
            storageKey="pcc-dismiss-seller"
            result={calculateProfileCompletion(fullProfileRow, 'seller', { hasListing: liveListings.length > 0 })}
          />
        )}

        {/* Missing-postcode nag — persistent link to profile so distance quotes
            actually work for buyers. */}
        {sellerPostcode !== null && !sellerPostcode && (
          <Link href="/seller/profile" className="fade-up" style={{display:'flex', alignItems:'flex-start', gap:14, background:'#FFF4E0', border:'2px solid #F5A623', borderRadius:16, padding:'16px 18px', marginBottom:22, boxShadow:'0 4px 14px rgba(245,166,35,0.16)', textDecoration:'none'}}>
            <span style={{fontSize:22, flexShrink:0}}>⚠️</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:800, color:'#8C5500', marginBottom:2}}>Please add your postcode so buyers can calculate delivery distance</div>
              <div style={{fontSize:13, color:'#8C5500', opacity:0.85, lineHeight:1.5}}>Without it, buyers see a flat &quot;fee at dispatch&quot; and you may lose orders. Tap to add it now →</div>
            </div>
          </Link>
        )}

        {/* Top stats */}
        <div className="dash-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {/* Total earned — magenta gradient */}
          <div className="stat-card" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:18, padding:'20px', boxShadow:'0 8px 24px rgba(200,0,106,0.25)'}}>
            <div style={{fontSize:20, marginBottom:10}}>💰</div>
            <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1}}>£{totalEarnings.toFixed(2)}</div>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>Total earned</div>
          </div>
          {[
            { icon:'📦', value:String(monthCount), label:'Orders this month' },
            { icon:'🍽️', value:String(liveListings.length), label:'Live listings' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid var(--border)'}}>
              <div style={{fontSize:20, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
          {/* Average rating with stars */}
          <div className="stat-card" style={{background:'var(--bg-card)', borderRadius:18, padding:'20px', boxShadow:'0 2px 14px rgba(200,0,106,0.06)', border:'1.5px solid var(--border)'}}>
            <div style={{fontSize:20, marginBottom:10}}>⭐</div>
            <div style={{display:'flex', alignItems:'baseline', gap:6}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1}}>{avgRating ? avgRating.toFixed(1) : '—'}</div>
              {avgRating != null && stars(avgRating)}
            </div>
            <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{reviews.length ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</div>
          </div>
        </div>

        {/* Two-column */}
        <div className="two-col" style={{display:'grid', gridTemplateColumns:'minmax(0,1.6fr) minmax(0,340px)', gap:20, alignItems:'start'}}>

          {/* LEFT */}
          <div style={{display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Recent orders */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Recent orders <span style={{fontSize:13, color:'#C8006A', fontFamily:'Inter'}}>· {orderCount} total</span></h3>
                <Link href="/seller/orders" className="nav-link" style={{fontSize:13, fontWeight:700, color:'#C8006A'}}>View all →</Link>
              </div>
              {orders.length === 0 ? (
                <div style={{padding:'40px 32px', textAlign:'center'}}>
                  <div style={{fontSize:36, marginBottom:10}}>📦</div>
                  <p style={{fontSize:14, color:'var(--text-primary)', marginBottom:16, lineHeight:1.6}}>No orders yet — they&apos;ll appear here as buyers order your dishes.</p>
                  <Link href="/seller/listings/new" style={{display:'inline-flex', alignItems:'center', height:42, padding:'0 20px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:13, fontWeight:700, boxShadow:'0 4px 14px rgba(200,0,106,0.28)'}}>Add your first dish →</Link>
                </div>
              ) : orders.map((o, i) => {
                const step = STATUS_FLOW[o.status]
                const buyerFirst = (o.profiles?.full_name || 'Buyer').trim().split(/\s+/)[0]
                return (
                  <div key={o.id} className="orow" style={{display:'flex', alignItems:'center', gap:12, padding:'14px 22px', borderBottom:i < orders.length - 1 ? '1px solid var(--border)' : 'none', transition:'background 0.12s'}}>
                    <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0}}>{cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                      <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginTop:1}}>👤 {buyerFirst}</div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      <div style={{fontFamily:'Georgia,serif', fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                      <span style={{background:statusBg(o.status), color:statusColor(o.status), padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
                    </div>
                    {step ? (
                      <button onClick={() => advanceStatus(o)} disabled={updatingId === o.id} className="advance-btn" style={{flexShrink:0, height:40, padding:'0 14px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:updatingId === o.id ? 'not-allowed' : 'pointer', opacity:updatingId === o.id ? 0.7 : 1, whiteSpace:'nowrap'}}>{updatingId === o.id ? '…' : step.label}</button>
                    ) : (
                      <span style={{flexShrink:0, width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10, background:o.status === 'cancelled' ? '#FDECEA' : '#E4F6EA', color:o.status === 'cancelled' ? '#C0392B' : '#2DA84E', fontSize:16, fontWeight:700}}>{o.status === 'cancelled' ? '✕' : '✓'}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* My listings */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>My listings <span style={{fontSize:13, color:'#C8006A', fontFamily:'Inter'}}>· {liveListings.length} live</span></h3>
                <Link href="/seller/listings/new" className="advance-btn" style={{display:'inline-flex', alignItems:'center', height:36, padding:'0 14px', background:'#C8006A', color:'#fff', borderRadius:10, fontSize:12, fontWeight:700, boxShadow:'0 4px 12px rgba(200,0,106,0.25)'}}>＋ Add new dish</Link>
              </div>
              {liveListings.length === 0 ? (
                <div style={{padding:'40px 32px', textAlign:'center'}}>
                  <div style={{fontSize:36, marginBottom:10}}>🍽️</div>
                  <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.6}}>No live dishes yet. Add your first dish to start receiving orders.</p>
                </div>
              ) : liveListings.slice(0, 5).map((l, i) => (
                <Link key={l.id} href={`/dish/${l.id}`} className="lrow" style={{display:'flex', alignItems:'center', gap:12, padding:'14px 22px', borderBottom:i < Math.min(liveListings.length, 5) - 1 ? '1px solid var(--border)' : 'none', transition:'background 0.12s'}}>
                  <div style={{width:42, height:42, borderRadius:11, background:'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0, overflow:'hidden'}}>
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image_url} alt={l.name} loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    ) : (cuisineEmoji[l.cuisine] || '🍽️')}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{l.name}</div>
                    <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.8, marginTop:1}}>{l.cuisine}</div>
                  </div>
                  <div style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'var(--text-primary)', flexShrink:0}}>£{parseFloat(l.price || '0').toFixed(2)}</div>
                  <span style={{flexShrink:0, background:'#E4F6EA', color:'#2DA84E', padding:'3px 9px', borderRadius:100, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.03em'}}>Live</span>
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT (sticky) */}
          <div className="col-right" style={{position:'sticky', top:84, display:'flex', flexDirection:'column', gap:20, minWidth:0}}>

            {/* Wallet */}
            <div className="fade-up" style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', borderRadius:20, padding:'24px', boxShadow:'0 10px 30px rgba(200,0,106,0.3)'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.08em'}}>Available balance</div>
                {balanceReloading && <span aria-label="Recalculating" style={{width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.9)', animation:'balPulse 1.1s ease-in-out infinite'}}/>}
                <style>{`@keyframes balPulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
              </div>
              <div style={{fontFamily:'Georgia,serif', fontSize:38, fontWeight:700, color:'#fff', letterSpacing:'-0.03em', lineHeight:1, marginBottom:6}}>£{availableBalance.toFixed(2)}</div>
              <div style={{fontSize:11.5, color:'rgba(255,255,255,0.75)', fontWeight:500, marginBottom:14}}>
                £{totalEarnings.toFixed(2)} earned · £{totalWithdrawn.toFixed(2)} withdrawn
              </div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 14px', marginBottom:8}}>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:500}}>Pending withdrawals</span>
                <span style={{fontSize:15, color:'#fff', fontWeight:700, fontFamily:'Georgia,serif'}}>£{pendingWithdrawals.toFixed(2)}</span>
              </div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 14px', marginBottom:18}}>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:500}}>Pending orders</span>
                <span style={{fontSize:15, color:'#fff', fontWeight:700, fontFamily:'Georgia,serif'}}>£{pendingOrderAmount.toFixed(2)}</span>
              </div>
              <button onClick={() => router.push('/seller/earnings')} className="ghost-btn" style={{width:'100%', height:46, background:'var(--bg-card)', color:'#C8006A', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:10, transition:'all 0.16s'}}>Withdraw funds</button>
              <Link href="/seller/earnings" style={{display:'block', textAlign:'center', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)'}}>Transaction history →</Link>
            </div>

            {/* Quick actions */}
            <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border)'}}>
              <div style={{padding:'18px 22px 12px'}}>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Quick actions</h3>
              </div>
              {quickActions.map((a, i) => (
                <Link key={i} href={a.h} className="qa-row" style={{display:'flex', alignItems:'center', gap:13, padding:'13px 22px', borderTop:'1px solid var(--border)', transition:'all 0.14s'}}>
                  <div style={{width:38, height:38, borderRadius:10, background:'#FFE8F4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0}}>{a.i}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{a.l}</div>
                    <div style={{fontSize:12, color:'var(--text-primary)', opacity:0.75, marginTop:1}}>{a.s}</div>
                  </div>
                  <span style={{fontSize:16, color:'#C8006A', flexShrink:0}}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
