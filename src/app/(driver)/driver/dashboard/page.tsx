'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import ProfileCompletionCard from '@/components/ProfileCompletionCard'
import { calculateProfileCompletion } from '@/lib/profileCompletion'
import { playDoubleBeep, requestNotificationPermission, showPushNotification } from '@/lib/notifications'
import NavAvatar from '@/components/NavAvatar'
import { haversineDistance, lookupPostcode, isValidUKPostcode } from '@/lib/pricing'
import type { Profile, Order, WithdrawalRequest } from '@/lib/types'

const NAV = [
  { l:'Dashboard', h:'/driver/dashboard' },
  { l:'My earnings', h:'/driver/earnings' },
  { l:'History', h:'/driver/history' },
]

// Rows returned by get_available_delivery_jobs — kept flat by the RPC.
// 8-digit codes (100M combinations) — matches the DB varchar(8) column type
// and the generate_secure_code() PL/pgSQL function. Keep this in sync with
// the schema — changing to 6 here without an ALTER TABLE would break verify.
const CODE_LEN = 8

interface AvailableJob {
  order_id: string
  listing_name: string
  seller_name: string
  seller_address: string | null
  seller_postcode: string | null
  delivery_address: string | null
  buyer_postcode: string | null
  total_amount: string
  delivery_fee: string
  created_at: string
}

interface ActiveDelivery extends AvailableJob {
  status: string
  pickup_code: string | null
  delivery_code: string | null
}

// Driver keeps 80% of the delivery fee; the platform keeps 20%. Kept here
// (not just in the DB) so the "You earn" figures on job cards and active
// deliveries can be shown before the row is persisted with the split.
const driverShare = (deliveryFee: string | number | null | undefined): number => {
  const fee = typeof deliveryFee === 'number' ? deliveryFee : parseFloat(deliveryFee || '0')
  return Math.round(fee * 0.8 * 100) / 100
}

const dark = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmerD { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulseG { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); } 70% { box-shadow: 0 0 0 7px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .map-bg { background-color: var(--bg-page); background-image:
    linear-gradient(rgba(200,0,106,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200,0,106,0.05) 1px, transparent 1px),
    radial-gradient(circle at 78% 8%, rgba(200,0,106,0.16), transparent 42%);
    background-size: 44px 44px, 44px 44px, 100% 100%; }
  .skelD { background: linear-gradient(90deg, var(--bg-card) 0%, var(--border-subtle) 50%, var(--bg-card) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: var(--text-primary) !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .job { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), border-color 0.18s, background 0.18s; }
  .job:hover { border-color: rgba(200,0,106,0.5) !important; }
  .accept:hover { background: #2DA84E !important; transform: translateY(-1px); }
  .prim:hover { background: #A00055 !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: var(--text-primary) !important; border-color: rgba(200,0,106,0.4) !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } .two-col { grid-template-columns: 1fr !important; } .col-right { position: static !important; } }
  @media (max-width: 640px) {
    .dstats { display: flex !important; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12px; padding-bottom: 4px; }
    .dstats > * { flex: 0 0 42%; scroll-snap-align: start; }
    .hero-figs { gap: 14px !important; }
  }
`

export default function DriverDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  // Full profile row (address + bank + vehicle_type) for the completion card.
  const [fullProfileRow, setFullProfileRow] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  // Withdrawal requests feed the "available balance" calc on the earnings
  // hero — every non-rejected withdrawal (pending / approved / paid) has
  // already been earmarked and should be subtracted from what's available.
  const [withdrawals, setWithdrawals] = useState<Pick<WithdrawalRequest, 'amount' | 'status'>[]>([])
  const [balanceReloading, setBalanceReloading] = useState(false)
  const [jobs, setJobs] = useState<AvailableJob[]>([])
  const [active, setActive] = useState<ActiveDelivery[]>([])
  // Ref shadow of `active` so imperative handlers (openDeliver) can look up
  // the current status without stale-closure headaches.
  const mineActiveRef = useRef<ActiveDelivery[]>([])
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState('')
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  // Refresh telemetry — powers the "last updated Xs ago" label.
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState<number | null>(null)
  // Tracks which job ids we've already announced (played a beep for) so a fresh
  // poll or realtime event on the same job doesn't beep again.
  const seenJobIds = useRef<Set<string>>(new Set())
  // Client-side per-job hide timeouts. After 20s a job disappears from THIS
  // driver's view only; it stays available for other drivers in the DB.
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set())
  // Persistent first-seen timestamp per order_id. Sits in a ref (not state) so
  // a re-render or a JobCard remount can't reset the countdown. Populated when
  // a job first appears in `jobs` and pruned when it disappears. Keyed by
  // order_id which matches the JobCard React key.
  const jobFirstSeenRef = useRef<Map<string, number>>(new Map())
  // ── Pull-to-refresh ─────────────────────────────────────────────────
  // Native-feeling downward drag when at the top of the page. Only fires on
  // touch pointers; desktop mice use the Refresh button.
  const [pullY, setPullY] = useState(0)
  const pullStartYRef = useRef<number | null>(null)
  const pullActiveRef = useRef(false)
  const PULL_THRESHOLD = 64
  const PULL_MAX = 110
  // Handshake modals
  const [pickupOrderId, setPickupOrderId] = useState<string | null>(null)
  const [pickupDigits, setPickupDigits] = useState<string[]>(new Array(CODE_LEN).fill('') as string[])
  const [pickupVerifying, setPickupVerifying] = useState(false)
  const [pickupError, setPickupError] = useState('')
  const [deliverOrderId, setDeliverOrderId] = useState<string | null>(null)
  const [deliverCode, setDeliverCode] = useState<string>('')
  const [deliverDigits, setDeliverDigits] = useState<string[]>(new Array(CODE_LEN).fill('') as string[])
  const [deliverGenerating, setDeliverGenerating] = useState(false)
  const [deliverVerifying, setDeliverVerifying] = useState(false)
  const [deliverError, setDeliverError] = useState('')
  const pickupRefs = useRef<Array<HTMLInputElement | null>>([])
  const deliverRefs = useRef<Array<HTMLInputElement | null>>([])
  const router = useRouter()

  // Stable ref-setters so React's rules-of-refs don't complain about creating
  // callback refs during render.
  const pickupRefSetters = useMemo(
    () => Array.from({ length: CODE_LEN }, (_, i) => (el: HTMLInputElement | null) => { pickupRefs.current[i] = el }),
    [],
  )
  const deliverRefSetters = useMemo(
    () => Array.from({ length: CODE_LEN }, (_, i) => (el: HTMLInputElement | null) => { deliverRefs.current[i] = el }),
    [],
  )

  // Announce a new delivery job — double beep + browser push. The double
  // beep (880 → 1100 Hz) is the same signature the seller side uses for a
  // new order, which is deliberate: drivers recognise it as "attention now".
  // The push notification body carries the driver's actual earn (80% of the
  // delivery fee) so it's actionable straight from the OS notification tray.
  const announceNewJob = useCallback((deliveryFee?: string) => {
    playDoubleBeep()
    const feeNum = deliveryFee ? parseFloat(deliveryFee) : 0
    const earn = feeNum > 0 ? feeNum * 0.8 : 0
    const body = earn > 0
      ? `£${earn.toFixed(2)} available — tap to accept.`
      : 'Tap to accept.'
    showPushNotification('New delivery job! 🚴', body)
  }, [])

  // Request notification permission once per session so the permission
  // dialog isn't triggered in an unexpected spot.
  useEffect(() => {
    void requestNotificationPermission()
  }, [])

  // Fetch order + job feeds. Extracted so a poll / realtime / refresh button can
  // reuse it without duplicating query logic. Announces newly-seen jobs.
  const loadFeeds = useCallback(async () => {
    const [{ data: available }, { data: mine }] = await Promise.all([
      supabase.rpc('get_available_delivery_jobs'),
      supabase.rpc('get_my_active_deliveries'),
    ])
    const list = (available as AvailableJob[] | null) || []
    setJobs(list)
    const mineList = ((mine as ActiveDelivery[] | null) || [])
    setActive(mineList)
    mineActiveRef.current = mineList
    setLastRefreshAt(Date.now())
    // Beep + browser notification for any job we hadn't seen before this
    // refresh; then record it so we don't re-fire on the next poll. Skip
    // the very first refresh — everything is "new" then, and we don't want
    // a beep the moment the page loads.
    const firstRun = seenJobIds.current.size === 0
    let firstNewFee: string | undefined
    for (const j of list) {
      if (!seenJobIds.current.has(j.order_id)) {
        seenJobIds.current.add(j.order_id)
        if (!firstRun && firstNewFee === undefined) firstNewFee = j.delivery_fee
      }
    }
    if (firstNewFee !== undefined) announceNewJob(firstNewFee)
  }, [announceNewJob])

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      setProfile(profile)
      // Full row for completion scoring (address/bank/vehicle aren't in the base RPC).
      const { data: fullRow } = await supabase.rpc('get_my_profile_full')
      setFullProfileRow(fullRow as Profile | null)
      // Avatar comes from the same definer RPC — no direct .select() on
      // profiles anywhere on this page, so the fragile base-table grant
      // never trips a "permission denied for table profiles" on load.
      setAvatarUrl(fullRow?.avatar_url || null)
      const { data } = await supabase.from('orders').select('*, listings(name,cuisine)').eq('driver_id', user.id).eq('status', 'delivered').order('created_at', { ascending: false })
      setHistoryOrders(data || [])
      const { data: wdRows } = await supabase.from('withdrawal_requests').select('amount, status').eq('user_id', user.id)
      setWithdrawals(wdRows || [])
      await loadFeeds()
      setLoading(false)
    }
    getData()
  }, [router, loadFeeds])

  // Balance recalculator — fires when the driver's own orders or their
  // withdrawal_requests change, so the "All time / Available" figure on
  // the earnings hero stays live without a page refresh.
  useEffect(() => {
    if (!profile?.id) return
    const uid = profile.id
    const recompute = async () => {
      setBalanceReloading(true)
      const [{ data: delivered }, { data: wdRows }] = await Promise.all([
        supabase.from('orders').select('*, listings(name,cuisine)').eq('driver_id', uid).eq('status', 'delivered').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('amount, status').eq('user_id', uid),
      ])
      setHistoryOrders(delivered || [])
      setWithdrawals(wdRows || [])
      setBalanceReloading(false)
    }
    const channel = supabase
      .channel(`driver-balance-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${uid}` }, () => { void recompute() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests', filter: `user_id=eq.${uid}` }, () => { void recompute() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.id])

  // 10-second poll for new jobs while online. Cheap: RPC returns just the
  // available/active rows, filtered server-side.
  useEffect(() => {
    if (!online) return
    const t = setInterval(loadFeeds, 10000)
    return () => clearInterval(t)
  }, [online, loadFeeds])

  // 1-second tick to keep the "last updated Xs ago" label live. Kept off the
  // render path (no Date.now in render) per React 19's rules-of-purity.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNowTick(Date.now()))
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => { cancelAnimationFrame(raf); clearInterval(t) }
  }, [])

  // Realtime: any change to a ready-delivery order that isn't yet assigned
  // could be a new job for us. Broad filter (INSERT+UPDATE), and we just
  // re-fetch — the RPC's `where` clauses do the real filtering.
  useEffect(() => {
    const channel = supabase
      .channel('driver-dispatch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadFeeds() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadFeeds])

  // Best-effort browser geolocation → distance estimates on job cards. Fire
  // once on mount; ignore denial.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
    )
  }, [])

  const refreshJobs = async () => { setRefreshing(true); await loadFeeds(); setRefreshing(false) }

  // Track first-seen time for every job order_id. On every `jobs` change:
  //   • any brand-new id gets a Date.now() stamp;
  //   • any id no longer in the list (accepted / taken / expired server-side)
  //     is pruned so the map doesn't grow forever.
  useEffect(() => {
    const map = jobFirstSeenRef.current
    const now = Date.now()
    for (const j of jobs) if (!map.has(j.order_id)) map.set(j.order_id, now)
    const live = new Set(jobs.map(j => j.order_id))
    for (const id of map.keys()) if (!live.has(id)) map.delete(id)
  }, [jobs])

  // ── Pull-to-refresh gesture handlers ──────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (typeof window === 'undefined') return
    // Only arm the gesture when the page is genuinely at the top — otherwise
    // a mid-page swipe would fight normal vertical scrolling.
    if (window.scrollY > 2) return
    pullStartYRef.current = e.touches[0].clientY
    pullActiveRef.current = false
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStartYRef.current === null) return
    const dy = e.touches[0].clientY - pullStartYRef.current
    if (dy <= 0) { setPullY(0); return }
    pullActiveRef.current = true
    // Rubber-band the drag so past the threshold it feels heavier.
    const damped = dy > PULL_MAX ? PULL_MAX + (dy - PULL_MAX) * 0.15 : dy
    setPullY(Math.min(damped, PULL_MAX + 20))
  }
  const onTouchEnd = async () => {
    const triggered = pullActiveRef.current && pullY >= PULL_THRESHOLD
    pullStartYRef.current = null
    pullActiveRef.current = false
    if (triggered) {
      // Snap the indicator up while the refresh runs so the user gets feedback.
      setPullY(0)
      await refreshJobs()
    } else {
      setPullY(0)
    }
  }

  const acceptJob = async (jobId: string) => {
    setAcceptingId(jobId); setAcceptError('')
    const { error } = await supabase.rpc('accept_delivery_job', { p_order_id: jobId })
    setAcceptingId(null)
    if (error) {
      setAcceptError(error.message.includes('no longer available') ? 'Job just taken by another driver' : (error.message.replace(/^.*?:\s*/, '') || 'Could not accept job'))
      await loadFeeds()
      return
    }
    await loadFeeds()
  }

  // ── PICKUP CODE ENTRY (driver keys in what seller shows) ──
  const openPickup = (orderId: string) => {
    setPickupOrderId(orderId); setPickupDigits(new Array(CODE_LEN).fill('') as string[]); setPickupError('')
    setTimeout(() => pickupRefs.current[0]?.focus(), 60)
  }
  const closePickup = () => { setPickupOrderId(null); setPickupDigits(new Array(CODE_LEN).fill('') as string[]); setPickupError('') }
  const setPickupDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setPickupDigits(p => { const n = [...p]; n[i] = d; return n })
    if (d && i < CODE_LEN - 1) pickupRefs.current[i + 1]?.focus()
  }
  const pickupKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pickupDigits[i] && i > 0) pickupRefs.current[i - 1]?.focus()
    else if (e.key === 'ArrowLeft' && i > 0) pickupRefs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < CODE_LEN - 1) pickupRefs.current[i + 1]?.focus()
  }
  const pickupPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LEN)
    if (!txt) return
    e.preventDefault()
    const next = new Array(CODE_LEN).fill('') as string[]
    for (let i = 0; i < txt.length; i++) next[i] = txt[i]
    setPickupDigits(next)
    pickupRefs.current[Math.min(txt.length, CODE_LEN - 1)]?.focus()
  }
  const submitPickup = async () => {
    if (!pickupOrderId) return
    const code = pickupDigits.join('')
    if (code.length !== CODE_LEN) { setPickupError(`Enter the full ${CODE_LEN}-digit code`); return }
    setPickupVerifying(true); setPickupError('')
    const { data, error } = await supabase.rpc('verify_pickup_code', { p_order_id: pickupOrderId, p_code: code })
    setPickupVerifying(false)
    if (error) { setPickupError(error.message.replace(/^.*?:\s*/, '') || 'Verification failed'); return }
    if (data === true) { await loadFeeds(); closePickup() }
    else {
      setPickupError('Incorrect code, please try again')
      setPickupDigits(new Array(CODE_LEN).fill('') as string[])
      pickupRefs.current[0]?.focus()
    }
  }

  // ── DELIVERY CODE (driver marks Reached → RPC flips status + generates code) ──
  const openDeliver = async (orderId: string) => {
    setDeliverOrderId(orderId); setDeliverDigits(new Array(CODE_LEN).fill('') as string[]); setDeliverError(''); setDeliverCode('')
    setDeliverGenerating(true)
    // First-time open: use mark_driver_reached which flips status='reached' AND
    // generates the delivery code atomically, so the buyer's realtime UPDATE
    // sees both together. Subsequent re-opens (order already at 'reached')
    // fall back to generate_delivery_code for a fresh code.
    const active = mineActiveRef.current.find(a => a.order_id === orderId)
    const rpcName = (active?.status === 'reached') ? 'generate_delivery_code' : 'mark_driver_reached'
    const { data, error } = await supabase.rpc(rpcName, { p_order_id: orderId })
    setDeliverGenerating(false)
    if (error) { setDeliverError(error.message.replace(/^.*?:\s*/, '') || 'Could not generate code'); return }
    setDeliverCode(typeof data === 'string' ? data : '')
    // Refresh the active list so the status pill updates from picked_up → reached.
    loadFeeds()
    setTimeout(() => deliverRefs.current[0]?.focus(), 60)
  }
  const closeDeliver = () => { setDeliverOrderId(null); setDeliverDigits(new Array(CODE_LEN).fill('') as string[]); setDeliverError(''); setDeliverCode('') }
  const setDeliverDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setDeliverDigits(p => { const n = [...p]; n[i] = d; return n })
    if (d && i < CODE_LEN - 1) deliverRefs.current[i + 1]?.focus()
  }
  const deliverKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !deliverDigits[i] && i > 0) deliverRefs.current[i - 1]?.focus()
    else if (e.key === 'ArrowLeft' && i > 0) deliverRefs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < CODE_LEN - 1) deliverRefs.current[i + 1]?.focus()
  }
  const deliverPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LEN)
    if (!txt) return
    e.preventDefault()
    const next = new Array(CODE_LEN).fill('') as string[]
    for (let i = 0; i < txt.length; i++) next[i] = txt[i]
    setDeliverDigits(next)
    deliverRefs.current[Math.min(txt.length, CODE_LEN - 1)]?.focus()
  }
  const submitDeliver = async () => {
    if (!deliverOrderId) return
    const code = deliverDigits.join('')
    if (code.length !== CODE_LEN) { setDeliverError(`Enter the full ${CODE_LEN}-digit code`); return }
    setDeliverVerifying(true); setDeliverError('')
    const { data, error } = await supabase.rpc('verify_delivery_code', { p_order_id: deliverOrderId, p_code: code })
    setDeliverVerifying(false)
    if (error) { setDeliverError(error.message.replace(/^.*?:\s*/, '') || 'Verification failed'); return }
    if (data === true) { await loadFeeds(); closeDeliver() }
    else {
      setDeliverError('Incorrect code, please try again')
      setDeliverDigits(new Array(CODE_LEN).fill('') as string[])
      deliverRefs.current[0]?.focus()
    }
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  // ── DERIVED (earnings summary uses delivered history) ──
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0)
  const todayOrders = historyOrders.filter(o => new Date(o.created_at) >= startOfToday)
  const weekOrders = historyOrders.filter(o => new Date(o.created_at) >= startOfWeek)
  // Historical rows may have driver_payout=0 (pre-commission-split); fall back
  // to the raw delivery_fee for those so old earnings don't vanish from the UI.
  const fee = (o: Order) => {
    const payout = parseFloat(o.driver_payout || '0')
    return payout > 0 ? payout : parseFloat(o.delivery_fee || '0')
  }
  const todayPay = todayOrders.reduce((s, o) => s + fee(o), 0)
  const weekPay = weekOrders.reduce((s, o) => s + fee(o), 0)
  const totalPay = historyOrders.reduce((s, o) => s + fee(o), 0)
  // Available balance = everything earned − everything that isn't rejected.
  // Split pending / paid so the hero can show both.
  const totalWithdrawn = withdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending' || w.status === 'approved').reduce((s, w) => s + parseFloat(w.amount || '0'), 0)
  const availableBalance = Math.max(0, totalPay - totalWithdrawn)
  const firstName = profile?.full_name?.split(' ')[0] || 'Driver'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { icon:'📦', value:String(active.length), label:'Active now' },
    { icon:'📅', value:String(todayOrders.length), label:'Drops today' },
    { icon:'🗓️', value:String(weekOrders.length), label:'This week' },
    { icon:'🟢', value:online ? 'Online' : 'Offline', label:'Status', color:online ? '#34D399' : 'var(--text-secondary)' },
  ]
  const heroFigs = [
    { label:"Today's pay", value:todayPay, hl:false },
    { label:'This week', value:weekPay, hl:false },
    { label:'Available', value:availableBalance, hl:true },
  ]

  const toggle = (
    <button onClick={() => setOnline(o => !o)} aria-label="Toggle availability" style={{display:'flex', alignItems:'center', gap:9, height:36, padding:'0 6px 0 12px', borderRadius:100, border:`1px solid ${online ? 'rgba(52,211,153,0.4)' : 'var(--border-subtle)'}`, background:online ? 'rgba(52,211,153,0.12)' : 'var(--bg-card)', cursor:'pointer', transition:'all 0.2s'}}>
      <span style={{fontSize:12, fontWeight:700, color:online ? '#34D399' : 'var(--text-secondary)'}}>{online ? 'Online' : 'Offline'}</span>
      <span style={{position:'relative', width:38, height:22, borderRadius:100, background:online ? '#2DA84E' : 'rgba(255,255,255,0.18)', transition:'background 0.2s', flexShrink:0}}>
        <span style={{position:'absolute', top:2, left:2, width:18, height:18, borderRadius:'50%', background:'#fff', transform:online ? 'translateX(16px)' : 'translateX(0)', transition:'transform 0.2s cubic-bezier(0.34,1.4,0.64,1)', animation:online ? 'pulseG 2s ease-out infinite' : 'none'}}/>
      </span>
    </button>
  )

  const nav = (
    <nav style={{background:'var(--bg-nav)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/" style={{marginRight:28, flexShrink:0}}><Logo height={30} themed/></Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map((t, i) => {
            const active = t.h === '/driver/dashboard'
            return <Link key={i} href={t.h} className="nav-link" style={{height:64, padding:'0 14px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? 'var(--text-primary)' : 'var(--text-secondary)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          {toggle}
          <NavAvatar url={avatarUrl} initial={profile?.full_name?.[0]?.toUpperCase() || 'D'} href="/driver/profile"/>
          <button onClick={signOut} className="signout" style={{height:36, padding:'0 14px', border:'1px solid var(--border-subtle)', borderRadius:8, fontSize:13, fontWeight:600, color:'var(--text-primary)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
        </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div className="map-bg" style={{minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:30, width:280, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:220, borderRadius:6, marginBottom:26}}/>
        <div className="skelD" style={{height:150, borderRadius:20, marginBottom:20}}/>
        <div className="dstats" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>{Array.from({length:4}).map((_, i) => <div key={i} className="skelD" style={{height:104, borderRadius:16}}/>)}</div>
        <div className="skelD" style={{height:340, borderRadius:18}}/>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div className="map-bg" style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', padding:24}}>
      <style>{dark}</style>
      <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', textAlign:'center', border:'1px solid rgba(200,0,106,0.25)'}}>
        <div style={{width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,rgba(200,0,106,0.25),rgba(200,0,106,0.08))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, margin:'0 auto 18px'}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.7, marginBottom:24}}>Your driver account is under review. We&apos;ll notify you within <strong style={{color:'#C8006A'}}>24–48 hours</strong>.</p>
        <button onClick={signOut} className="prim" style={{height:46, padding:'0 26px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', transition:'background 0.14s'}}>Sign out</button>
      </div>
    </div>
  )

  const pullTriggered = pullY >= PULL_THRESHOLD
  const pullOpacity = Math.min(1, pullY / PULL_THRESHOLD)

  return (
    <div
      className="map-bg"
      style={{minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif'}}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <style>{dark}</style>{nav}

      {/* ── Pull-to-refresh indicator ── */}
      {pullY > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', top: 64, left: 0, right: 0, zIndex: 90,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `translateY(${Math.min(pullY, PULL_MAX)}px)`,
            transition: pullStartYRef.current === null ? 'transform 0.24s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            fontSize: 12.5, fontWeight: 700,
            color: pullTriggered ? '#2DA84E' : 'var(--text-primary)',
            opacity: pullOpacity,
          }}>
            <span style={{
              display: 'inline-block',
              transform: `rotate(${pullTriggered ? 180 : 0}deg)`,
              transition: 'transform 0.2s',
            }}>↓</span>
            {pullTriggered ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'28px 20px 72px', transform: `translateY(${Math.min(pullY * 0.5, PULL_MAX * 0.5)}px)`, transition: pullStartYRef.current === null ? 'transform 0.24s cubic-bezier(0.34,1.2,0.64,1)' : 'none'}}>

        {/* Greeting + online pill */}
        <div className="fade-up" style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:22}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(24px,3vw,32px)', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', marginBottom:4}}>{greeting}, {firstName} 🚴</h1>
            <p style={{fontSize:14, color:'var(--text-secondary)'}}>
              {online
                ? active.length > 0
                  ? `${active.length} active ${active.length === 1 ? 'delivery' : 'deliveries'} · ${jobs.length} new ${jobs.length === 1 ? 'job' : 'jobs'} nearby`
                  : jobs.length > 0
                    ? `${jobs.length} delivery ${jobs.length === 1 ? 'job' : 'jobs'} available now`
                    : "You're online — new jobs will surface below."
                : "You're offline. Go online to start receiving jobs."}
            </p>
          </div>
          <button onClick={() => setOnline(o => !o)} style={{display:'flex', alignItems:'center', gap:12, height:52, padding:'0 10px 0 20px', borderRadius:100, border:`1.5px solid ${online ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.16)'}`, background:online ? 'rgba(52,211,153,0.14)' : 'var(--bg-card)', cursor:'pointer', transition:'all 0.2s'}}>
            <span style={{display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.15}}>
              <span style={{fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-secondary)'}}>You are</span>
              <span style={{fontSize:16, fontWeight:800, color:online ? '#34D399' : 'var(--text-secondary)'}}>{online ? 'Online' : 'Offline'}</span>
            </span>
            <span style={{position:'relative', width:52, height:30, borderRadius:100, background:online ? '#2DA84E' : 'rgba(255,255,255,0.18)', transition:'background 0.2s', flexShrink:0}}>
              <span style={{position:'absolute', top:3, left:3, width:24, height:24, borderRadius:'50%', background:'#fff', transform:online ? 'translateX(22px)' : 'translateX(0)', transition:'transform 0.22s cubic-bezier(0.34,1.4,0.64,1)', animation:online ? 'pulseG 2s ease-out infinite' : 'none'}}/>
            </span>
          </button>
        </div>

        {/* Profile completion nag — dismissible per-session, hides at >=80%. */}
        {fullProfileRow && (
          <ProfileCompletionCard
            role="driver"
            variant="compact"
            storageKey="pcc-dismiss-driver"
            result={calculateProfileCompletion(fullProfileRow, 'driver')}
          />
        )}

        {/* Earnings hero */}
        <div className="fade-up" style={{background:'linear-gradient(135deg,#C8006A 0%,#7A0042 100%)', borderRadius:22, padding:'26px 26px 24px', boxShadow:'0 16px 44px rgba(200,0,106,0.34)', marginBottom:20, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', top:-40, right:-30, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.08)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, position:'relative'}}>
            <div style={{fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.09em'}}>Your earnings</div>
            {balanceReloading && <span aria-label="Recalculating" style={{width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.9)', animation:'balPulse 1.1s ease-in-out infinite'}}/>}
            <style>{`@keyframes balPulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
          </div>
          <div className="hero-figs" style={{display:'flex', gap:28, flexWrap:'wrap', marginBottom:14, position:'relative'}}>
            {heroFigs.map(f => (
              <div key={f.label}>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.72)', fontWeight:600, marginBottom:4}}>{f.label}</div>
                <div style={{fontFamily:'Georgia,serif', fontSize:f.hl ? 'clamp(34px,6vw,46px)' : 'clamp(22px,4vw,28px)', fontWeight:700, color:'#fff', letterSpacing:'-0.03em', lineHeight:1}}>£{f.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11.5, color:'rgba(255,255,255,0.75)', fontWeight:500, marginBottom:16, position:'relative'}}>
            £{totalPay.toFixed(2)} earned · £{totalWithdrawn.toFixed(2)} withdrawn · £{pendingWithdrawals.toFixed(2)} pending
          </div>
          <div style={{display:'flex', gap:10, position:'relative', flexWrap:'wrap'}}>
            <button onClick={() => router.push('/driver/earnings')} style={{height:46, padding:'0 24px', background:'#fff', color:'#C8006A', border:'none', borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer'}}>Withdraw funds</button>
            <Link href="/driver/earnings" style={{height:46, padding:'0 20px', display:'inline-flex', alignItems:'center', background:'rgba(255,255,255,0.16)', color:'#fff', borderRadius:12, fontSize:14, fontWeight:700}}>Earnings history →</Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="dstats fade-up" style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24}}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'var(--bg-card)', borderRadius:16, padding:'18px', border:'1px solid var(--border-subtle)'}}>
              <div style={{fontSize:19, marginBottom:9}}>{s.icon}</div>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.4vw,25px)', fontWeight:700, color:s.color || 'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:11, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:6}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* My active deliveries (only if I have any) */}
        {active.length > 0 && (
          <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden', marginBottom:20}}>
            <div style={{padding:'18px 20px', borderBottom:'1px solid var(--bg-secondary)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>My active deliveries · <span style={{color:'#C8006A'}}>{active.length}</span></h2>
            </div>
            <div style={{padding:'12px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
              {active.map(a => {
                const atSeller = a.status === 'ready' // driver needs to collect from cook
                const atBuyer = a.status === 'picked_up' || a.status === 'reached' // driver either heading to or at buyer
                const alreadyReached = a.status === 'reached'
                return (
                  <div key={a.order_id} className="job" style={{background:'var(--bg-page)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:'16px 18px'}}>
                    <div style={{display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap'}}>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>{a.listing_name}</div>
                        <div style={{fontSize:12, color:'var(--text-secondary)', lineHeight:1.55}}>
                          <div>🍲 Pickup: <strong style={{color:'var(--text-primary)'}}>{a.seller_name}</strong> · {a.seller_address || '—'}{a.seller_postcode ? ` · ${a.seller_postcode}` : ''}</div>
                          <div>🏠 Drop-off: {a.delivery_address || '—'}</div>
                        </div>
                      </div>
                      <div style={{textAlign:'right', flexShrink:0}}>
                        <div style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#34D399', letterSpacing:'-0.02em', lineHeight:1}}>£{driverShare(a.delivery_fee).toFixed(2)}</div>
                        <div style={{fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:3, fontWeight:700}}>You earn</div>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:10, alignItems:'center', marginTop:14, flexWrap:'wrap'}}>
                      <span style={{background: atSeller ? 'rgba(24,110,204,0.16)' : alreadyReached ? 'rgba(52,211,153,0.16)' : 'rgba(122,63,176,0.16)', color: atSeller ? '#5AA3FA' : alreadyReached ? '#34D399' : '#B389E8', padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:700}}>
                        {atSeller ? '↳ Collect from cook' : alreadyReached ? '↳ At buyer — confirm delivery' : '↳ Deliver to buyer'}
                      </span>
                      {atSeller && (
                        <button onClick={() => openPickup(a.order_id)} className="accept" style={{marginLeft:'auto', height:40, padding:'0 18px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(200,0,106,0.28)'}}>
                          Enter pickup code
                        </button>
                      )}
                      {atBuyer && (
                        <button onClick={() => openDeliver(a.order_id)} className="accept" style={{marginLeft:'auto', height:40, padding:'0 18px', background:alreadyReached ? '#34D399' : '#C8006A', color:alreadyReached ? '#0A1F14' : '#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow: alreadyReached ? '0 4px 12px rgba(52,211,153,0.28)' : '0 4px 12px rgba(200,0,106,0.28)'}}>
                          {alreadyReached ? 'Confirm delivery' : '📍 Mark as Reached'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Available jobs */}
        <div className="fade-up" style={{background:'var(--bg-card)', borderRadius:18, border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
          <div style={{padding:'18px 20px', borderBottom:'1px solid var(--bg-secondary)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <div style={{display:'flex', alignItems:'center', gap:12, minWidth:0, flexWrap:'wrap'}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>Available jobs near you {jobs.length > 0 && <span style={{color:'#C8006A'}}>· {jobs.length}</span>}</h2>
              {online && (
                <span aria-label="Listening for jobs" style={{display:'inline-flex', alignItems:'center', gap:7, background:'rgba(52,211,153,0.14)', border:'1px solid rgba(52,211,153,0.35)', padding:'4px 10px 4px 8px', borderRadius:100, fontSize:11, fontWeight:700, color:'#34D399'}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background:'#34D399', animation:'pulseG 2s ease-out infinite'}}/>
                  Listening
                </span>
              )}
              {lastRefreshAt !== null && nowTick !== null && (() => {
                const secs = Math.max(0, Math.round((nowTick - lastRefreshAt) / 1000))
                return <span style={{fontSize:11.5, color:'var(--text-secondary)', fontWeight:600}}>Last updated {secs === 0 ? 'just now' : `${secs}s ago`}</span>
              })()}
            </div>
            <button onClick={refreshJobs} disabled={refreshing} className="accept" style={{height:32, padding:'0 14px', background:'rgba(200,0,106,0.16)', color:'var(--text-primary)', border:'1px solid rgba(200,0,106,0.35)', borderRadius:8, fontSize:12, fontWeight:700, cursor:refreshing ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:6, transition:'all 0.14s'}}>
              <span style={{display:'inline-block', animation:refreshing ? 'spin 0.8s linear infinite' : 'none'}}>↻</span>{refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {acceptError && (
            <div role="alert" style={{margin:'14px 20px 0', background:'rgba(200,0,106,0.14)', border:'1px solid rgba(200,0,106,0.4)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#FF8AC4', fontWeight:700}}>{acceptError}</div>
          )}

          {!online ? (
            <div style={{padding:'48px 24px', textAlign:'center'}}>
              <div style={{fontSize:40, marginBottom:12}}>🌙</div>
              <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6}}>You&apos;re offline. Flip the switch to see jobs.</p>
            </div>
          ) : (() => {
            const visibleJobs = jobs.filter(j => !hiddenJobIds.has(j.order_id))
            if (visibleJobs.length === 0) return (
              <div style={{padding:'44px 24px', textAlign:'center'}}>
                <div style={{fontSize:40, marginBottom:12}}>📭</div>
                <h3 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'var(--text-primary)', marginBottom:8}}>No delivery jobs available right now</h3>
                <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, maxWidth:360, margin:'0 auto'}}>You&apos;ll be notified the moment a nearby cook marks a delivery order ready.</p>
              </div>
            )
            return (
              <div style={{padding:'12px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
                {visibleJobs.map(j => (
                  <JobCard
                    key={j.order_id}
                    job={j}
                    firstSeenAt={jobFirstSeenRef.current.get(j.order_id) ?? Date.now()}
                    myLocation={myLocation}
                    onAccept={() => acceptJob(j.order_id)}
                    accepting={acceptingId === j.order_id}
                    onTimeout={() => setHiddenJobIds(prev => { const n = new Set(prev); n.add(j.order_id); return n })}
                  />
                ))}
              </div>
            )
          })()}
        </div>

      </div>

      {/* ── PICKUP CODE ENTRY MODAL ── */}
      {pickupOrderId && (
        <div role="dialog" aria-modal="true" onClick={closePickup} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, width:'100%', maxWidth:460, boxShadow:'0 24px 68px rgba(0,0,0,0.5)', padding:'28px 28px 26px', border:'1px solid var(--border-subtle)'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em'}}>Pickup code</h2>
              <button onClick={closePickup} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid var(--border-subtle)', background:'transparent', fontSize:15, color:'var(--text-primary)', cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:22}}>Ask the cook for their <strong style={{color:'#C8006A'}}>8-digit pickup code</strong> and enter it below.</p>
            <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:16}}>
              {pickupDigits.map((d, i) => (
                <input
                  key={i}
                  ref={pickupRefSetters[i]}
                  value={d}
                  onChange={e => setPickupDigit(i, e.target.value)}
                  onKeyDown={e => pickupKeyDown(i, e)}
                  onPaste={pickupPaste}
                  onFocus={e => e.currentTarget.select()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  disabled={pickupVerifying}
                  aria-label={`Digit ${i + 1}`}
                  style={{width:38, height:52, borderRadius:10, border:pickupError ? '2px solid #C0392B' : '2px solid rgba(200,0,106,0.35)', background:'var(--bg-page)', fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#C8006A', textAlign:'center', outline:'none', letterSpacing:'-0.02em', minWidth:0}}
                />
              ))}
            </div>
            {pickupError && <div role="alert" style={{background:'rgba(192,57,43,0.14)', border:'1px solid rgba(192,57,43,0.35)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'#FF8A8A', fontWeight:600, marginBottom:14, textAlign:'center'}}>{pickupError}</div>}
            <button onClick={submitPickup} disabled={pickupVerifying || pickupDigits.some(d => !d)} className="prim" style={{width:'100%', height:50, background:pickupVerifying || pickupDigits.some(d => !d) ? '#4A2A38' : '#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:pickupVerifying || pickupDigits.some(d => !d) ? 'not-allowed' : 'pointer'}}>
              {pickupVerifying ? 'Verifying…' : 'Confirm pickup'}
            </button>
          </div>
        </div>
      )}

      {/* ── DELIVERY CODE MODAL (generate then verify) ── */}
      {deliverOrderId && (
        <div role="dialog" aria-modal="true" onClick={closeDeliver} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{background:'var(--bg-card)', borderRadius:22, width:'100%', maxWidth:460, boxShadow:'0 24px 68px rgba(0,0,0,0.5)', padding:'28px 28px 26px', border:'1px solid var(--border-subtle)'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.01em'}}>Confirm delivery</h2>
              <button onClick={closeDeliver} aria-label="Close" style={{width:32, height:32, borderRadius:9, border:'1px solid var(--border-subtle)', background:'transparent', fontSize:15, color:'var(--text-primary)', cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:18}}>
              An <strong style={{color:'#C8006A'}}>8-digit code</strong> has been sent to the buyer&apos;s app. Ask them to read it out to you and enter it below.
            </p>
            {deliverGenerating && <div style={{fontSize:12, color:'var(--text-secondary)', textAlign:'center', marginBottom:14, fontWeight:600}}>Sending code to buyer…</div>}
            {deliverCode && (
              <div style={{fontSize:12, color:'var(--text-secondary)', textAlign:'center', marginBottom:14, fontWeight:600, opacity:0.7}}>(Buyer&apos;s copy — for your reference only: {deliverCode})</div>
            )}
            <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:16}}>
              {deliverDigits.map((d, i) => (
                <input
                  key={i}
                  ref={deliverRefSetters[i]}
                  value={d}
                  onChange={e => setDeliverDigit(i, e.target.value)}
                  onKeyDown={e => deliverKeyDown(i, e)}
                  onPaste={deliverPaste}
                  onFocus={e => e.currentTarget.select()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  disabled={deliverVerifying || deliverGenerating}
                  aria-label={`Digit ${i + 1}`}
                  style={{width:38, height:52, borderRadius:10, border:deliverError ? '2px solid #C0392B' : '2px solid rgba(52,211,153,0.4)', background:'var(--bg-page)', fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#34D399', textAlign:'center', outline:'none', letterSpacing:'-0.02em', minWidth:0}}
                />
              ))}
            </div>
            {deliverError && <div role="alert" style={{background:'rgba(192,57,43,0.14)', border:'1px solid rgba(192,57,43,0.35)', borderRadius:10, padding:'10px 12px', fontSize:13, color:'#FF8A8A', fontWeight:600, marginBottom:14, textAlign:'center'}}>{deliverError}</div>}
            <button onClick={submitDeliver} disabled={deliverVerifying || deliverGenerating || deliverDigits.some(d => !d)} className="accept" style={{width:'100%', height:50, background:deliverVerifying || deliverGenerating || deliverDigits.some(d => !d) ? '#264130' : '#34D399', color:'#0A1F14', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:deliverVerifying || deliverGenerating || deliverDigits.some(d => !d) ? 'not-allowed' : 'pointer'}}>
              {deliverVerifying ? 'Verifying…' : 'Confirm delivered'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Countdown window from when the card first appeared — after this many seconds
// the job disappears from THIS driver's view (still exists in the DB for
// other drivers to pick up).
const JOB_COUNTDOWN_SECS = 20
// At and below this many seconds remaining the ring flips to red and the card
// border pulses. Keep this in sync with the "urgent" state below.
const JOB_URGENT_AT_SECS = 5

// One job card. `firstSeenAt` comes from the parent's ref-Map keyed by
// order_id so the countdown survives re-renders and remounts — the timer is
// per-job, never restarted by React reconciliation quirks.
function JobCard({ job, firstSeenAt, myLocation, onAccept, accepting, onTimeout }: {
  job: AvailableJob
  firstSeenAt: number
  myLocation: { lat: number; lng: number } | null
  onAccept: () => void
  accepting: boolean
  onTimeout: () => void
}) {
  const [distance, setDistance] = useState<number | null>(null)
  // 1-second tick snapshot for the countdown. Ticks every second via
  // setInterval — the seconds display and ring progress both derive from this.
  // Never read Date.now() during render (React 19 rules-of-purity).
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // Kick a first tick on the next animation frame so the ring animates in.
    const raf = requestAnimationFrame(() => setNow(Date.now()))
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => { cancelAnimationFrame(raf); clearInterval(t) }
  }, [])
  // When the countdown hits zero, notify the parent to hide this card from
  // the driver's view. Fires exactly once per card lifetime.
  const timedOutRef = useRef(false)
  useEffect(() => {
    if (timedOutRef.current || now === null) return
    const remaining = JOB_COUNTDOWN_SECS - Math.floor((now - firstSeenAt) / 1000)
    if (remaining <= 0) { timedOutRef.current = true; onTimeout() }
  }, [now, firstSeenAt, onTimeout])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!myLocation || !job.seller_postcode || !isValidUKPostcode(job.seller_postcode)) return
      const sellerLoc = await lookupPostcode(job.seller_postcode)
      if (!alive || !sellerLoc) return
      setDistance(haversineDistance(myLocation.lat, myLocation.lng, sellerLoc.latitude, sellerLoc.longitude))
    })()
    return () => { alive = false }
  }, [myLocation, job.seller_postcode])

  // Countdown values — clamped so the ring renders sensibly before the first tick.
  const elapsed = now !== null ? Math.max(0, (now - firstSeenAt) / 1000) : 0
  const remaining = Math.max(0, JOB_COUNTDOWN_SECS - elapsed)
  const remainingRounded = Math.ceil(remaining)
  const urgent = remaining <= JOB_URGENT_AT_SECS && remaining > 0

  // Ring geometry: 48px circle, strokeWidth 4. r = 22 leaves 2px of padding.
  const RING_SIZE = 48
  const RING_R = 22
  const RING_CIRC = 2 * Math.PI * RING_R
  const RING_COLOR = urgent ? '#DC2626' : '#2DA84E'
  const OUTER_STROKE = 'var(--border-subtle)'

  // Fee that the driver actually pockets — 80% of the delivery fee.
  const driverFee = driverShare(job.delivery_fee)

  return (
    <div
      className="job"
      style={{
        background: 'var(--bg-card)',
        border: urgent ? '1.5px solid #DC2626' : '1px solid var(--border-subtle)',
        borderRadius: 16,
        padding: '16px 18px',
        position: 'relative',
        animation: urgent ? 'jobUrgent 0.9s ease-in-out infinite' : 'none',
        transition: 'border-color 0.2s',
      }}
    >
      <style>{`
        @keyframes jobUrgent { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
        @keyframes ringspin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header: dish name (left) + fee badge (right) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.listing_name}
        </div>
        <span style={{
          background: 'rgba(45,168,78,0.15)', color: '#2DA84E',
          fontSize: 12.5, fontWeight: 800, padding: '4px 11px', borderRadius: 100,
          flexShrink: 0,
        }}>£{driverFee.toFixed(2)}</span>
      </div>

      {/* ── Pickup + delivery rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <span style={{ flexShrink: 0 }}>📍</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong style={{ fontWeight: 700 }}>{job.seller_name}</strong>{' '}
            <span style={{ opacity: 0.75 }}>· {job.seller_address || 'address unavailable'}{job.seller_postcode ? ` · ${job.seller_postcode}` : ''}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <span style={{ flexShrink: 0 }}>🏠</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.75 }}>
            {job.delivery_address || 'delivery address unavailable'}
          </span>
        </div>
      </div>

      {/* ── Footer: distance chip · countdown ring ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {distance !== null ? (
          <span style={{ background: 'rgba(200,0,106,0.12)', color: '#C8006A', fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 100 }}>
            ~{distance.toFixed(1)} mi away
          </span>
        ) : (
          <span style={{ background: 'var(--border-subtle)', color: 'var(--text-primary)', opacity: 0.6, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100 }}>
            Distance…
          </span>
        )}

        <div style={{ marginLeft: 'auto', position: 'relative', width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
          <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
              stroke={OUTER_STROKE} strokeWidth={4} fill="none"
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
              stroke={RING_COLOR} strokeWidth={4} fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC * (1 - remaining / JOB_COUNTDOWN_SECS)}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700,
            color: RING_COLOR, letterSpacing: '-0.02em',
          }} aria-label={`${remainingRounded} seconds to accept`}>
            {remainingRounded}
          </div>
        </div>
      </div>

      {/* ── Accept button (full width, 48px) ── */}
      <button
        onClick={onAccept}
        disabled={accepting || remaining < 1}
        style={{
          width: '100%', height: 48,
          background: urgent ? '#DC2626' : '#2DA84E',
          color: '#fff',
          border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 800,
          cursor: accepting || remaining < 1 ? 'not-allowed' : 'pointer',
          boxShadow: urgent ? '0 6px 18px rgba(220,38,38,0.35)' : '0 6px 18px rgba(45,168,78,0.28)',
          opacity: accepting || remaining < 1 ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'background 0.2s, opacity 0.2s',
        }}
      >
        {accepting ? (
          <>
            <span style={{
              display: 'inline-block',
              width: 16, height: 16,
              border: '2.5px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'ringspin 0.7s linear infinite',
            }}/>
            Accepting…
          </>
        ) : remaining < 1 ? 'Expired' : urgent ? `Accept now (${remainingRounded}s)` : 'Accept job'}
      </button>
    </div>
  )
}
