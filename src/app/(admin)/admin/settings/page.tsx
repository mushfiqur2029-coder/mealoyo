'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import type { Profile } from '@/lib/types'

const COMMISSION_RATE = 0.12

type RevenueOrder = { status: string; platform_commission: string }

type DeletionRow = {
  id: string
  deleted_by: string | null
  entity_type: string
  entity_id: string
  entity_name: string | null
  metadata: Record<string, unknown> | null
  deleted_at: string
}

type RoleProfile = { id: string; full_name: string | null; email: string | null }

const NAV = [
  { l:'Dashboard', h:'/admin/dashboard' },
  { l:'Sellers', h:'/admin/sellers' },
  { l:'Drivers', h:'/admin/drivers' },
  { l:'Orders', h:'/admin/orders' },
  { l:'Settings', h:'/admin/settings' },
]

const dark = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes shimmerD { 0% { background-position: -480px 0; } 100% { background-position: 480px 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; } * { scrollbar-width: none; -ms-overflow-style: none; }
  a { text-decoration: none; color: inherit; }
  button { font-family: Inter, system-ui, sans-serif; }
  .skelD { background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%); background-size: 960px 100%; animation: shimmerD 1.4s ease-in-out infinite; }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both; }
  .nav-link:hover { color: #fff !important; }
  .promote-btn:hover { background: #A00055 !important; }
  .stat-card { transition: transform 0.18s, border-color 0.18s; }
  .stat-card:hover { transform: translateY(-2px); border-color: rgba(200,0,106,0.4) !important; }
  .signout:hover { background: rgba(200,0,106,0.15) !important; color: #fff !important; border-color: rgba(200,0,106,0.4) !important; }
  input::placeholder { color: rgba(255,255,255,0.35); }
  input:focus { border-color: #C8006A !important; }
  @media (max-width: 900px) { .nav-links { display: none !important; } }
  @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr 1fr !important; } .config-grid { grid-template-columns: 1fr !important; } }
`

export default function AdminSettings() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState({ sellers: 0, buyers: 0, drivers: 0, orders: 0, revenue: 0 })
  const [deletions, setDeletions] = useState<DeletionRow[]>([])
  const [deleterNames, setDeleterNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteMsg, setPromoteMsg] = useState('')
  const [promoteError, setPromoteError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.rpc('get_my_profile')
      if ((profile as Profile | null)?.role !== 'admin') { router.push('/'); return }
      setProfile(profile)

      const [{ data: sellers }, { data: buyers }, { data: drivers }, { data: orders }] = await Promise.all([
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'seller' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'buyer' }),
        supabase.rpc('admin_get_profiles_by_role', { p_role: 'driver' }),
        supabase.rpc('admin_get_all_orders'),
      ])
      const revenue = (orders || [])
        .filter((o: RevenueOrder) => o.status === 'delivered')
        .reduce((sum: number, o: RevenueOrder) => sum + parseFloat(o.platform_commission || '0'), 0)

      setStats({
        sellers: sellers?.length || 0,
        buyers: buyers?.length || 0,
        drivers: drivers?.length || 0,
        orders: orders?.length || 0,
        revenue,
      })

      // Map profile id → display name so the deletion log can show who deleted.
      const nameMap: Record<string, string> = {}
      for (const p of [...(sellers || []), ...(buyers || []), ...(drivers || [])] as RoleProfile[]) {
        nameMap[p.id] = p.full_name || p.email || 'Unknown'
      }
      setDeleterNames(nameMap)

      // Best-effort — no-ops (empty) until the deletion_log SQL has been run.
      const { data: delRows } = await supabase
        .from('deletion_log')
        .select('*')
        .order('deleted_at', { ascending: false })
        .limit(50)
      setDeletions((delRows || []) as DeletionRow[])

      setLoading(false)
    }
    getData()
  }, [router])

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteEmail.trim()) return
    setPromoting(true)
    setPromoteMsg('')
    setPromoteError('')
    const { error } = await supabase.rpc('admin_promote_to_admin', { p_email: promoteEmail.trim() })
    if (error) { setPromoteError(error.message); setPromoting(false); return }
    setPromoteMsg(`${promoteEmail.trim()} is now an admin.`)
    setPromoteEmail('')
    setPromoting(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  const nav = (
    <nav style={{background:'rgba(13,13,13,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:100, height:64}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center'}}>
        <Link href="/admin/dashboard" style={{display:'flex', alignItems:'center', gap:10, marginRight:28, flexShrink:0}}>
          <Logo height={26} white/>
          <span style={{fontFamily:'Georgia,serif', fontSize:15, fontWeight:700, color:'#C8006A'}}>Admin</span>
        </Link>
        <div className="nav-links" style={{display:'flex', flex:1}}>
          {NAV.map(t => {
            const active = t.h === '/admin/settings'
            return <Link key={t.h} href={t.h} className="nav-link" style={{height:64, padding:'0 13px', display:'flex', alignItems:'center', fontSize:13, fontWeight:active ? 700 : 500, color:active ? '#fff' : 'rgba(255,255,255,0.5)', borderBottom:active ? '2.5px solid #C8006A' : '2.5px solid transparent', transition:'color 0.12s'}}>{t.l}</Link>
          })}
        </div>
        <div style={{display:'flex', gap:10, marginLeft:'auto', alignItems:'center', flexShrink:0}}>
          <span style={{fontSize:12, color:'rgba(255,255,255,0.4)'}}>{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="signout" style={{height:34, padding:'0 14px', border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.6)', background:'transparent', cursor:'pointer', transition:'all 0.14s'}}>Sign out</button>
      </div>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px'}}>
        <div className="skelD" style={{height:28, width:140, borderRadius:8, marginBottom:8}}/>
        <div className="skelD" style={{height:15, width:240, borderRadius:6, marginBottom:28}}/>
        <div className="stats-grid" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:32}}>{Array.from({length:5}).map((_, i) => <div key={i} className="skelD" style={{height:88, borderRadius:16}}/>)}</div>
        <div className="config-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>{Array.from({length:2}).map((_, i) => <div key={i} className="skelD" style={{height:200, borderRadius:18}}/>)}</div>
      </div>
    </div>
  )

  const statCards = [
    { n:String(stats.sellers), l:'Sellers', color:'#C8006A' },
    { n:String(stats.buyers), l:'Buyers', color:'#5B9DF0' },
    { n:String(stats.drivers), l:'Drivers', color:'#34D399' },
    { n:String(stats.orders), l:'Total orders', color:'#FBBF24' },
    { n:`£${stats.revenue.toFixed(2)}`, l:'Revenue', color:'#34D399' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{dark}</style>{nav}
      <div style={{maxWidth:1200, margin:'0 auto', padding:'32px 20px 56px'}}>
        <div className="fade-up" style={{marginBottom:26}}>
          <h1 style={{fontFamily:'Georgia,serif', fontSize:'clamp(22px,2.5vw,30px)', fontWeight:700, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>Settings</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>Platform configuration and stats.</p>
        </div>

        <h2 className="fade-up" style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#fff', marginBottom:14}}>Platform stats</h2>
        <div className="stats-grid fade-up" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:32}}>
          {statCards.map((s, i) => (
            <div key={i} className="stat-card" style={{background:'rgba(255,255,255,0.05)', borderRadius:16, padding:'18px', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center'}}>
              <div style={{fontFamily:'Georgia,serif', fontSize:'clamp(20px,2.2vw,26px)', fontWeight:700, color:s.color, letterSpacing:'-0.02em', lineHeight:1, marginBottom:6}}>{s.n}</div>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="config-grid fade-up" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, padding:'24px', border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <div style={{width:38, height:38, borderRadius:10, background:'rgba(200,0,106,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>💰</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>Commission rate</h2>
            </div>
            <p style={{fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:16, lineHeight:1.6}}>Platform commission taken from every delivered order. Set in code, not yet editable here.</p>
            <div style={{fontFamily:'Georgia,serif', fontSize:42, fontWeight:700, color:'#C8006A', letterSpacing:'-0.02em'}}>{Math.round(COMMISSION_RATE * 100)}%</div>
          </div>

          <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, padding:'24px', border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              <div style={{width:38, height:38, borderRadius:10, background:'rgba(200,0,106,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>🛡️</div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>Add an admin</h2>
            </div>
            <p style={{fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:16, lineHeight:1.6}}>Promotes an existing registered meaLoyo user to admin by email. They must already have an account.</p>
            {promoteMsg && <div style={{background:'rgba(52,211,153,0.14)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#86EFAC', fontWeight:600}}>✅ {promoteMsg}</div>}
            {promoteError && <div style={{background:'rgba(255,138,138,0.14)', border:'1px solid rgba(255,138,138,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#FF8A8A', fontWeight:600}}>{promoteError}</div>}
            <form onSubmit={handlePromote} style={{display:'flex', gap:8}}>
              <input type="email" value={promoteEmail} onChange={e => setPromoteEmail(e.target.value)} placeholder="user@example.com" required style={{flex:1, height:44, border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, padding:'0 14px', fontSize:13, color:'#fff', background:'rgba(255,255,255,0.05)', outline:'none', transition:'border-color 0.14s'}}/>
              <button type="submit" disabled={promoting} className="promote-btn" style={{height:44, padding:'0 18px', background:'#C8006A', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:promoting ? 'not-allowed' : 'pointer', opacity:promoting ? 0.7 : 1, whiteSpace:'nowrap', transition:'background 0.14s'}}>{promoting ? 'Adding…' : 'Add admin'}</button>
            </form>
          </div>
        </div>

        {/* Appearance */}
        <div className="fade-up" style={{marginTop:24, background:'rgba(255,255,255,0.03)', borderRadius:18, padding:'22px 24px', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:38, height:38, borderRadius:10, background:'rgba(200,0,106,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>🎨</div>
            <div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:16, fontWeight:700, color:'#fff'}}>Appearance</h2>
              <p style={{fontSize:12.5, color:'rgba(255,255,255,0.5)'}}>Light, dark, or match your device.</p>
            </div>
          </div>
          <ThemeToggle/>
        </div>

        {/* Deletion history / audit log */}
        <div className="fade-up" style={{marginTop:32}}>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:17, fontWeight:700, color:'#fff', marginBottom:6}}>Deletion history</h2>
          <p style={{fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:14}}>Recent deletions across the platform — who removed what, and when.</p>
          <div style={{background:'rgba(255,255,255,0.03)', borderRadius:18, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden'}}>
            {deletions.length === 0 ? (
              <div style={{padding:'40px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:14}}>No deletions recorded yet.</div>
            ) : deletions.map((d, i) => (
              <div key={d.id} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 22px', borderBottom:i < deletions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'}}>
                <div style={{width:36, height:36, borderRadius:9, background:'rgba(255,138,138,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0}}>🗑️</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {d.entity_name || '(unnamed)'}
                    <span style={{fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.04em', marginLeft:8, background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:20}}>{d.entity_type}</span>
                  </div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    by {d.deleted_by ? (deleterNames[d.deleted_by] || `${d.deleted_by.slice(0, 8)}…`) : 'Unknown'}
                  </div>
                </div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', flexShrink:0, textAlign:'right', whiteSpace:'nowrap'}}>
                  {new Date(d.deleted_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                  <span style={{opacity:0.7}}> · {new Date(d.deleted_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
