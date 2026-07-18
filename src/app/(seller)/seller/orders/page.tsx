'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import type { Order, Profile } from '@/lib/types'

// 8-digit codes — matches the DB varchar(8) column type and the
// generate_secure_code() PL/pgSQL function.
const CODE_LEN = 8

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'cooking', label: 'Start cooking' },
  cooking: { next: 'ready', label: 'Mark ready' },
  ready: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'delivered', label: 'Mark delivered' },
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

const FILTERS = ['all', 'pending', 'accepted', 'cooking', 'ready', 'delivered', 'cancelled']

// An order is the seller's concern only once it's paid (or a legacy pre-Stripe
// order that predates payment tracking). Abandoned/failed/cancelled-before-pay
// checkouts are filtered out everywhere.
const paymentOk = (o: Order) => !o.payment_status || o.payment_status === 'paid'

export default function SellerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // Persistent "new order" banner — stays until dismissed. Separate from the
  // auto-dismissing toast because busy sellers may miss the transient one.
  const [newOrderBanner, setNewOrderBanner] = useState(0)
  const [collectionOrder, setCollectionOrder] = useState<Order | null>(null)
  const [collectionDigits, setCollectionDigits] = useState<string[]>(new Array(CODE_LEN).fill('') as string[])
  const [collectionGenerating, setCollectionGenerating] = useState(false)
  const [collectionVerifying, setCollectionVerifying] = useState(false)
  const [collectionError, setCollectionError] = useState('')
  // Pickup handshake — seller generates and SHOWS a code to the driver.
  const [pickupOrder, setPickupOrder] = useState<Order | null>(null)
  const [pickupCode, setPickupCode] = useState<string>('')
  const [pickupGenerating, setPickupGenerating] = useState(false)
  const [pickupError, setPickupError] = useState('')
  const digitRefs = useRef<Array<HTMLInputElement | null>>([])
  const router = useRouter()

  // Ask for browser notification permission once, so the realtime handlers below
  // can pop a system notification when a new order arrives while this tab is
  // backgrounded. Silent no-op on unsupported browsers.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default' && !localStorage.getItem('mealoyo_notif_asked')) {
      localStorage.setItem('mealoyo_notif_asked', '1')
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // A short 880Hz beep via the Web Audio API — no audio asset needed, and the
  // AudioContext is created on demand (browsers block it until a user gesture,
  // but the realtime event usually fires after the seller has already clicked
  // into the page).
  const playNewOrderBeep = () => {
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const AudioCtx = W.AudioContext || W.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.55)
      osc.onended = () => ctx.close().catch(() => {})
    } catch { /* ignore — audio is a nice-to-have */ }
  }

  // Fire everything that "new order arrived" should do: sound, system push,
  // toast, and bump the persistent banner counter.
  const announceNewOrder = () => {
    playNewOrderBeep()
    setToast('New order received')
    setNewOrderBanner(n => n + 1)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('New order received! 🍽️', { body: 'You have a new order. Tap to view.', icon: '/favicon.png' })
      } catch { /* browsers throw if not in a service worker on some platforms */ }
    }
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setSellerId(user.id)
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      const { data } = await supabase
        .from('orders')
        .select('*, listings(name,cuisine), profiles:buyer_id(full_name)')
        .eq('seller_id', user.id)
        .neq('status', 'pending_payment') // hide unpaid orders awaiting Stripe payment
        // Only paid orders (or legacy pre-Stripe orders with no payment_status)
        // are real. Abandoned/failed checkouts never become the seller's problem.
        .or('payment_status.is.null,payment_status.eq.paid')
        .order('created_at', { ascending: false })
      setOrders(data || [])
      setLoading(false)
    }
    getData()
  }, [router])

  // ── REALTIME: new orders appear instantly + live status sync ──
  useEffect(() => {
    if (!sellerId) return
    const ORDER_SELECT = '*, listings(name,cuisine), profiles:buyer_id(full_name)'
    const channel = supabase
      .channel(`seller-orders-${sellerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        async (payload) => {
          // The realtime payload has only the base row — re-fetch with the
          // listing/buyer joins so the new card renders fully.
          const newId = (payload.new as Order).id
          const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', newId).single()
          // Ignore unpaid orders — they only become real once Stripe confirms
          // payment (which arrives as an UPDATE flipping status out of
          // pending_payment), handled by the UPDATE subscription below.
          if (data && data.status !== 'pending_payment' && paymentOk(data)) {
            setOrders(prev => prev.some(o => o.id === data.id) ? prev : [data, ...prev])
            announceNewOrder()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
        async (payload) => {
          const updated = payload.new as Order
          // Still unpaid — ignore.
          if (updated.status === 'pending_payment') return
          // A just-paid order transitions pending_payment → pending via the
          // Stripe webhook; it was skipped on INSERT, so it won't be in the
          // list yet. Re-fetch with joins and add it (with a toast) the first
          // time we see it live.
          const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', updated.id).single()
          // Skip abandoned/failed checkouts that were cancelled without ever
          // being paid — they must never surface to the seller.
          if (!data || !paymentOk(data)) return
          setOrders(prev => {
            if (prev.some(o => o.id === data.id)) return prev.map(o => o.id === data.id ? { ...o, ...data } : o)
            queueMicrotask(() => announceNewOrder())
            return [data, ...prev]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sellerId])

  // Auto-dismiss the "new order" toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const advanceStatus = async (order: Order) => {
    const step = STATUS_FLOW[order.status]
    if (!step) return
    setUpdatingId(order.id)
    const { error } = await supabase.from('orders').update({ status: step.next }).eq('id', order.id)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: step.next } : o))
      // Award loyalty points the moment an order is marked delivered. The DB
      // function is idempotent, so a repeat call is harmless; it no-ops until
      // the loyalty SQL has been run.
      if (step.next === 'delivered') await supabase.rpc('award_loyalty_points', { p_order_id: order.id })
    }
    setUpdatingId(null)
  }

  // Stable ref-setters — one per input slot — so the JSX ref callback doesn't
  // rebuild on every render.
  const digitRefSetters = useMemo(
    () => Array.from({ length: CODE_LEN }, (_, i) => (el: HTMLInputElement | null) => { digitRefs.current[i] = el }),
    []
  )

  // Focus the first digit once the modal opens and the code has been generated.
  useEffect(() => {
    if (collectionOrder && !collectionGenerating) digitRefs.current[0]?.focus()
  }, [collectionOrder, collectionGenerating])

  // Collection code flow: for a ready + collection order, generate a code on
  // the DB (which the buyer sees live via realtime) then open the verify modal.
  const openCollection = async (order: Order) => {
    setCollectionOrder(order)
    setCollectionDigits(new Array(CODE_LEN).fill('') as string[])
    setCollectionError('')
    setCollectionGenerating(true)
    await supabase.rpc('generate_collection_code', { p_order_id: order.id })
    setCollectionGenerating(false)
  }

  const closeCollection = () => {
    setCollectionOrder(null)
    setCollectionDigits(new Array(CODE_LEN).fill('') as string[])
    setCollectionError('')
  }

  // Pickup code flow (seller side): for a ready + delivery order with a driver
  // assigned, generate the code the driver will key into their own app.
  const openPickup = async (order: Order) => {
    setPickupOrder(order)
    setPickupCode('')
    setPickupError('')
    setPickupGenerating(true)
    const { data, error } = await supabase.rpc('generate_pickup_code', { p_order_id: order.id })
    setPickupGenerating(false)
    if (error) { setPickupError(error.message.replace(/^.*?:\s*/, '') || 'Could not generate code'); return }
    setPickupCode(typeof data === 'string' ? data : '')
  }
  const closePickup = () => { setPickupOrder(null); setPickupCode(''); setPickupError('') }

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setCollectionDigits(prev => {
      const next = [...prev]
      next[i] = d
      return next
    })
    if (d && i < CODE_LEN - 1) digitRefs.current[i + 1]?.focus()
  }

  const digitKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !collectionDigits[i] && i > 0) {
      digitRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      digitRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < CODE_LEN - 1) {
      digitRefs.current[i + 1]?.focus()
    }
  }

  const digitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LEN)
    if (!txt) return
    e.preventDefault()
    const next = new Array(CODE_LEN).fill('') as string[]
    for (let i = 0; i < txt.length; i++) next[i] = txt[i]
    setCollectionDigits(next)
    const focusIdx = Math.min(txt.length, CODE_LEN - 1)
    digitRefs.current[focusIdx]?.focus()
  }

  const submitCollection = async () => {
    if (!collectionOrder) return
    const code = collectionDigits.join('')
    if (code.length !== CODE_LEN) { setCollectionError(`Enter the full ${CODE_LEN}-digit code`); return }
    setCollectionError('')
    setCollectionVerifying(true)
    const { data, error } = await supabase.rpc('verify_collection_code', { p_order_id: collectionOrder.id, p_code: code })
    setCollectionVerifying(false)
    if (error) { setCollectionError(error.message.replace(/^.*?:\s*/, '') || 'Verification failed'); return }
    if (data === true) {
      setOrders(prev => prev.map(o => o.id === collectionOrder.id ? { ...o, status: 'delivered', collection_code: null, collection_code_expires_at: null } : o))
      closeCollection()
    } else {
      setCollectionError('Incorrect code, please try again')
      setCollectionDigits(new Array(CODE_LEN).fill('') as string[])
      digitRefs.current[0]?.focus()
    }
  }

  const statusColor = (s: string) => s === 'delivered' ? '#2DA84E' : s === 'cooking' ? '#B8730A' : s === 'ready' ? '#C8006A' : s === 'cancelled' ? '#C0392B' : '#1A6ECC'
  const statusBg = (s: string) => s === 'delivered' ? '#E4F6EA' : s === 'cooking' ? '#FFF4E0' : s === 'ready' ? '#FFE8F4' : s === 'cancelled' ? '#FDECEA' : '#EBF2FD'

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const counts: Record<string, number> = { all: orders.length }
  for (const f of FILTERS) if (f !== 'all') counts[f] = orders.filter(o => o.status === f).length

  const revenue = orders.reduce((s, o) => s + parseFloat(o.total_amount || '0'), 0)
  const earnings = orders.reduce((s, o) => s + parseFloat(o.seller_payout || '0'), 0)
  const activeCount = orders.filter(o => STATUS_FLOW[o.status]).length

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes toastIn { from { opacity: 0; transform: translateX(20px) translateY(-4px); } to { opacity: 1; transform: translateX(0) translateY(0); } }
      @keyframes toastDot { 0% { box-shadow: 0 0 0 0 rgba(200,0,106,0.5); } 70% { box-shadow: 0 0 0 8px rgba(200,0,106,0); } 100% { box-shadow: 0 0 0 0 rgba(200,0,106,0); } }
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
      .advance-btn { transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); }
      .advance-btn:hover { background: #A00055 !important; transform: translateY(-1px); }
      .order-card { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
      .order-card:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(200,0,106,0.12) !important; }
      .stat-card { transition: transform 0.18s; }
      .stat-card:hover { transform: translateY(-2px); }
      @media (max-width: 768px) {
        .nav-links { display: none !important; }
        .orders-grid { grid-template-columns: 1fr !important; }
        .summary-grid { grid-template-columns: 1fr 1fr !important; }
        .card-footer { flex-direction: column; align-items: stretch !important; }
        .card-footer .advance-btn, .card-footer .done-pill { width: 100%; justify-content: center; }
      }
    `}</style>
  )

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderBottom:'1px solid rgba(200,0,106,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={34}/></Link>
        <div className="nav-links" style={{display:'flex', gap:0, flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/seller/orders'
            return (
              <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#C8006A' : 'var(--text-primary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
            )
          })}
        </div>
        <button onClick={signOut} className="nav-link" style={{marginLeft:'auto', height:36, padding:'0 14px', border:'1.5px solid var(--border-subtle)', borderRadius:8, background:'var(--bg-card)', fontSize:13, fontWeight:600, color:'var(--text-primary)', cursor:'pointer', flexShrink:0}}>Sign out</button>
      </div>
    </nav>
  )

  // ── LOADING SKELETON ──
  if (loading) return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skel" style={{height:30, width:160, borderRadius:8, marginBottom:20}}/>
        <div className="summary-grid" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {Array.from({length:4}).map((_, i) => <div key={i} className="skel" style={{height:92, borderRadius:18}}/>)}
        </div>
        <div style={{display:'flex', gap:8, marginBottom:24}}>
          {Array.from({length:5}).map((_, i) => <div key={i} className="skel" style={{height:38, width:90, borderRadius:100}}/>)}
        </div>
        <div className="orders-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:16}}>
          {Array.from({length:4}).map((_, i) => (
            <div key={i} style={{background:'var(--bg-card)', borderRadius:20, padding:20, border:'1.5px solid var(--border-subtle)'}}>
              <div style={{display:'flex', gap:14, marginBottom:16}}>
                <div className="skel" style={{width:52, height:52, borderRadius:14, flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div className="skel" style={{height:15, width:'60%', borderRadius:6, marginBottom:8}}/>
                  <div className="skel" style={{height:12, width:'40%', borderRadius:6}}/>
                </div>
              </div>
              <div className="skel" style={{height:44, borderRadius:12, marginBottom:16}}/>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <div className="skel" style={{height:30, width:90, borderRadius:6}}/>
                <div className="skel" style={{height:46, width:130, borderRadius:12}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── PENDING APPROVAL GATE ──
  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      {pageStyles}
      <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(200,0,106,0.1)', border:'1.5px solid rgba(200,0,106,0.08)'}}>
        <div style={{fontSize:56, marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.7, marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} className="advance-btn" style={{height:46, padding:'0 24px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)', fontFamily:'Inter,system-ui,sans-serif'}}>
      {pageStyles}
      {nav}

      {/* ── REALTIME TOAST: new order received ── */}
      {toast && (
        <div role="status" aria-live="polite" style={{position:'fixed', top:78, right:20, zIndex:300, display:'flex', alignItems:'center', gap:12, background:'var(--bg-card)', borderLeft:'4px solid #C8006A', borderRadius:14, padding:'14px 18px 14px 16px', boxShadow:'0 12px 36px rgba(200,0,106,0.22)', animation:'toastIn 0.32s cubic-bezier(0.34,1.3,0.64,1) both', maxWidth:'calc(100vw - 40px)'}}>
          <span style={{width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, animation:'toastDot 1.8s ease-out infinite'}}>🔔</span>
          <div>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.2}}>{toast}</div>
            <div style={{fontSize:12, color:'#C8006A', fontWeight:600, marginTop:2}}>It&apos;s ready for you to accept</div>
          </div>
          <button onClick={() => setToast(null)} aria-label="Dismiss" style={{marginLeft:6, width:26, height:26, border:'none', background:'var(--bg-page)', borderRadius:'50%', color:'var(--text-primary)', fontSize:14, cursor:'pointer', flexShrink:0, lineHeight:1}}>✕</button>
        </div>
      )}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>

        {/* Header */}
        <div className="fade-up" style={{marginBottom:22}}>
          <div style={{fontSize:11, fontWeight:700, color:'#C8006A', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Seller workspace</div>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.8vw,32px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>Orders</h1>
          <p style={{fontSize:14, color:'var(--text-primary)'}}>{orders.length} {orders.length === 1 ? 'order' : 'orders'} total · sorted newest first</p>
        </div>

        {/* Persistent "new order" banner — stays until dismissed */}
        {newOrderBanner > 0 && (
          <div role="alert" className="fade-up" style={{display:'flex', alignItems:'center', gap:14, background:'linear-gradient(135deg,#FFE8F4 0%,#FFF4FA 100%)', border:'2px solid #C8006A', borderRadius:16, padding:'14px 18px', marginBottom:18, boxShadow:'0 8px 24px rgba(200,0,106,0.18)'}}>
            <span style={{fontSize:26, animation:'toastDot 1.8s ease-out infinite', display:'inline-flex', width:44, height:44, borderRadius:'50%', background:'#fff', alignItems:'center', justifyContent:'center', flexShrink:0}}>🔔</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#C8006A'}}>New order received!</div>
              <div style={{fontSize:13, color:'var(--text-primary)', marginTop:2}}>{newOrderBanner === 1 ? "You've got a new order waiting — accept it below." : `${newOrderBanner} new orders arrived while you were on this page.`}</div>
            </div>
            <button onClick={() => setNewOrderBanner(0)} className="advance-btn" style={{flexShrink:0, height:40, padding:'0 16px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer'}}>Dismiss</button>
          </div>
        )}

        {/* Revenue summary cards */}
        <div className="summary-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:26}}>
          {[
            { label:'Total orders', value:String(orders.length), icon:'🧾', accent:false },
            { label:'Needs action', value:String(activeCount), icon:'⚡', accent:false },
            { label:'Gross revenue', value:`£${revenue.toFixed(2)}`, icon:'💷', accent:false },
            { label:'Your earnings', value:`£${earnings.toFixed(2)}`, icon:'💰', accent:true },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{background:s.accent ? 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)' : 'var(--bg-card)', borderRadius:18, padding:'18px 20px', boxShadow:s.accent ? '0 8px 24px rgba(200,0,106,0.25)' : '0 2px 10px var(--shadow-card)', border:s.accent ? 'none' : '1.5px solid var(--border-subtle)'}}>
              <div style={{fontSize:18, marginBottom:10}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700, color:s.accent ? '#fff' : 'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, fontWeight:700, color:s.accent ? 'rgba(255,255,255,0.8)' : '#C8006A', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter pills with counts */}
        <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:22}}>
          {FILTERS.map(f => {
            const on = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} className="filter-pill" style={{flexShrink:0, display:'flex', alignItems:'center', gap:7, height:40, padding:'0 16px', borderRadius:100, border:on ? '2px solid #C8006A' : '1.5px solid var(--border-subtle)', background:on ? '#FFE8F4' : 'var(--bg-card)', color:on ? '#C8006A' : 'var(--text-primary)', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'capitalize'}}>
                {f.replace('_', ' ')}
                <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:20, height:20, padding:'0 6px', borderRadius:100, background:on ? '#C8006A' : 'var(--border-subtle)', color:on ? '#fff' : 'var(--text-primary)', fontSize:11, fontWeight:700}}>{counts[f] ?? 0}</span>
              </button>
            )
          })}
        </div>

        {/* Orders */}
        {filtered.length === 0 ? (
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 10px var(--shadow-card)', border:'1.5px solid var(--border-subtle)'}}>
            <div style={{width:88, height:88, borderRadius:'50%', background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, margin:'0 auto 20px'}}>📦</div>
            <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>No orders {filter !== 'all' ? `in "${filter.replace('_', ' ')}"` : 'yet'}</h2>
            <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.65, maxWidth:380, margin:'0 auto'}}>{filter === 'all' ? 'Orders will appear here the moment buyers start ordering your dishes.' : 'Try a different filter to see more orders.'}</p>
          </div>
        ) : (
          <div className="orders-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:16}}>
            {filtered.map(o => {
              const step = STATUS_FLOW[o.status]
              const buyerFirst = (o.profiles?.full_name || 'Buyer').trim().split(/\s+/)[0]
              const dt = new Date(o.created_at)
              const isDelivery = o.delivery_type === 'delivery'
              return (
                <div key={o.id} className="order-card fade-up" style={{background:'var(--bg-card)', borderRadius:20, padding:'20px', boxShadow:'0 2px 16px rgba(200,0,106,0.07)', border:'1.5px solid var(--border-subtle)', display:'flex', flexDirection:'column'}}>

                  {/* Top: dish + status */}
                  <div style={{display:'flex', gap:14, marginBottom:16}}>
                    <div style={{width:54, height:54, borderRadius:14, background:'linear-gradient(135deg,#FFE8F4,var(--bg-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>
                      {cuisineEmoji[o.listings?.cuisine || 'Other'] || '🍽️'}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                        <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{o.listings?.name || 'Order'}</div>
                        <span style={{flexShrink:0, background:statusBg(o.status), color:statusColor(o.status), padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap'}}>{o.status.replace('_', ' ')}</span>
                      </div>
                      <div style={{fontSize:12, color:'var(--text-primary)', fontWeight:500, marginTop:3}}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                  </div>

                  {/* Meta pills */}
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:14}}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'var(--bg-page)', color:'var(--text-primary)', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>👤 {buyerFirst}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'var(--bg-page)', color:'var(--text-primary)', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>× {o.quantity}</span>
                    <span style={{display:'inline-flex', alignItems:'center', gap:5, background:'#FFE8F4', color:'#C8006A', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>{isDelivery ? '🚴 Delivery' : '📍 Collection'}</span>
                  </div>

                  {/* Date / time */}
                  <div style={{fontSize:12, color:'var(--text-primary)', fontWeight:500, marginBottom:14, opacity:0.85}}>
                    🕐 {dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} · {dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                  </div>

                  {/* Notes */}
                  {o.notes && (
                    <div style={{background:'var(--bg-page)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'var(--text-primary)', lineHeight:1.5, marginBottom:14}}>
                      <span style={{fontWeight:700, color:'#C8006A'}}>📝 Note</span> · {o.notes}
                    </div>
                  )}

                  {/* Footer: amounts + action */}
                  <div className="card-footer" style={{marginTop:'auto', paddingTop:14, borderTop:'1px solid var(--bg-secondary)', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12}}>
                    <div>
                      <div style={{display:'flex', gap:16}}>
                        <div>
                          <div style={{fontSize:10, color:'var(--text-primary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', opacity:0.7, marginBottom:2}}>Order total</div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em'}}>£{parseFloat(o.total_amount || '0').toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10, color:'#C8006A', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2}}>Your payout</div>
                          <div style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#C8006A', letterSpacing:'-0.01em'}}>£{parseFloat(o.seller_payout || '0').toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    {step ? (() => {
                      const isCollectionConfirm = o.status === 'ready' && o.delivery_type === 'collection'
                      // Ready + delivery: if a driver is assigned, seller shows a
                      // pickup code to them. If no driver yet, the button is idle
                      // (dispatch handles assignment).
                      const isDeliveryReady = o.status === 'ready' && o.delivery_type === 'delivery'
                      const isPickupHandoff = isDeliveryReady && !!o.driver_id
                      const waitingForDriver = isDeliveryReady && !o.driver_id
                      let label = step.label
                      let handler = () => advanceStatus(o)
                      if (isCollectionConfirm) { label = 'Confirm collection'; handler = () => openCollection(o) }
                      else if (isPickupHandoff) { label = 'Show pickup code'; handler = () => openPickup(o) }
                      // Delivery + status=picked_up: driver owns the drop, so
                      // seller has nothing to do — hide the advance button.
                      if (o.delivery_type === 'delivery' && o.status === 'picked_up') return (
                        <span className="done-pill" style={{flexShrink:0, height:46, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6, background:'#F2EAFA', color:'#7A3FB0', borderRadius:12, fontSize:13, fontWeight:700, whiteSpace:'nowrap'}}>
                          🚴 Driver has it
                        </span>
                      )
                      if (waitingForDriver) return (
                        <span className="done-pill" style={{flexShrink:0, height:46, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6, background:'#EBF2FD', color:'#1A6ECC', borderRadius:12, fontSize:13, fontWeight:700, whiteSpace:'nowrap'}}>
                          ⏳ Waiting for driver
                        </span>
                      )
                      return (
                        <button onClick={handler} disabled={updatingId === o.id} className="advance-btn" style={{flexShrink:0, height:46, padding:'0 18px', background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:updatingId === o.id ? 'not-allowed' : 'pointer', opacity:updatingId === o.id ? 0.7 : 1, boxShadow:'0 4px 14px rgba(200,0,106,0.28)', whiteSpace:'nowrap'}}>
                          {updatingId === o.id ? 'Updating...' : label}
                        </button>
                      )
                    })() : (
                      <span className="done-pill" style={{flexShrink:0, height:46, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6, background:o.status === 'cancelled' ? '#FDECEA' : '#E4F6EA', color:o.status === 'cancelled' ? '#C0392B' : '#2DA84E', borderRadius:12, fontSize:13, fontWeight:700, whiteSpace:'nowrap'}}>
                        {o.status === 'cancelled' ? '✕ Cancelled' : '✓ Completed'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── COLLECTION CODE MODAL ── */}
      {collectionOrder && (
        <div role="dialog" aria-modal="true" onClick={closeCollection} style={{position:'fixed', inset:0, background:'rgba(26,26,26,0.55)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, width:'100%', maxWidth:460, boxShadow:'0 24px 68px rgba(0,0,0,0.3)', padding:'28px 28px 26px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em'}}>Confirm collection</h2>
              <button onClick={closeCollection} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid var(--border-subtle)', background:'var(--bg-card)', fontSize:15, color:'var(--text-primary)', cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.6, marginBottom:22}}>Ask the buyer for their <strong style={{color:'#C8006A'}}>8-digit collection code</strong> and enter it below to confirm the handover.</p>

            <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:16}}>
              {collectionDigits.map((d, i) => (
                <input
                  key={i}
                  ref={digitRefSetters[i]}
                  value={d}
                  onChange={e => setDigit(i, e.target.value)}
                  onKeyDown={e => digitKeyDown(i, e)}
                  onPaste={digitPaste}
                  onFocus={e => e.currentTarget.select()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  disabled={collectionGenerating || collectionVerifying}
                  aria-label={`Digit ${i + 1}`}
                  style={{width:38, height:52, borderRadius:10, border:collectionError ? '2px solid #C0392B' : '2px solid rgba(200,0,106,0.28)', background:'var(--bg-card)', fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#C8006A', textAlign:'center', outline:'none', letterSpacing:'-0.02em', boxShadow:'0 2px 8px rgba(200,0,106,0.08)', minWidth:0}}
                />
              ))}
            </div>

            {collectionGenerating && (
              <div style={{textAlign:'center', fontSize:12.5, color:'var(--text-primary)', fontWeight:600, marginBottom:14, opacity:0.75}}>Generating code for the buyer…</div>
            )}
            {collectionError && (
              <div role="alert" style={{background:'#FDECEA', border:'1px solid rgba(192,57,43,0.24)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'#C0392B', fontWeight:600, marginBottom:14, textAlign:'center'}}>{collectionError}</div>
            )}

            <button onClick={submitCollection} disabled={collectionGenerating || collectionVerifying || collectionDigits.some(d => !d)} className="advance-btn" style={{width:'100%', height:50, background:collectionGenerating || collectionVerifying || collectionDigits.some(d => !d) ? '#E7D6E0' : '#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:collectionGenerating || collectionVerifying || collectionDigits.some(d => !d) ? 'not-allowed' : 'pointer', boxShadow:collectionGenerating || collectionVerifying || collectionDigits.some(d => !d) ? 'none' : '0 6px 18px rgba(200,0,106,0.28)'}}>
              {collectionVerifying ? 'Verifying…' : 'Confirm'}
            </button>

            <p style={{fontSize:11.5, color:'var(--text-primary)', textAlign:'center', marginTop:12, opacity:0.6, lineHeight:1.5}}>The code is shown on the buyer&apos;s order page and expires in 30 minutes.</p>
          </div>
        </div>
      )}

      {/* ── PICKUP CODE MODAL (delivery orders) ── */}
      {pickupOrder && (
        <div role="dialog" aria-modal="true" onClick={closePickup} style={{position:'fixed', inset:0, background:'rgba(26,26,26,0.55)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, width:'100%', maxWidth:460, boxShadow:'0 24px 68px rgba(0,0,0,0.3)', padding:'28px 28px 26px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em'}}>Pickup code</h2>
              <button onClick={closePickup} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid var(--border-subtle)', background:'var(--bg-card)', fontSize:15, color:'var(--text-primary)', cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:14, color:'var(--text-primary)', lineHeight:1.6, marginBottom:22}}>Show this code to the driver. They&apos;ll key it into their app to confirm they&apos;ve picked up the order.</p>

            {pickupError ? (
              <div role="alert" style={{background:'#FDECEA', border:'1px solid rgba(192,57,43,0.24)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'#C0392B', fontWeight:600, marginBottom:14, textAlign:'center'}}>{pickupError}</div>
            ) : pickupGenerating || !pickupCode ? (
              <div style={{textAlign:'center', padding:'26px 8px', fontSize:13, color:'var(--text-primary)', fontWeight:600, opacity:0.75}}>Generating code…</div>
            ) : (
              <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:16, flexWrap:'wrap'}}>
                {pickupCode.split('').map((d, i) => (
                  <span key={i} style={{width:38, height:54, borderRadius:10, background:'var(--bg-page)', border:'2px solid rgba(200,0,106,0.3)', boxShadow:'0 2px 10px rgba(200,0,106,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em', minWidth:0}}>{d}</span>
                ))}
              </div>
            )}

            <button onClick={closePickup} className="advance-btn" style={{width:'100%', height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 18px rgba(200,0,106,0.28)'}}>
              Done
            </button>
            <p style={{fontSize:11.5, color:'var(--text-primary)', textAlign:'center', marginTop:12, opacity:0.6, lineHeight:1.5}}>Code expires in 2 hours. Regenerate anytime by tapping “Show pickup code” again.</p>
          </div>
        </div>
      )}
    </div>
  )
}
