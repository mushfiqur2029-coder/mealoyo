'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/lib/types'

const cuisineEmoji: Record<string, string> = {
  'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗',
  'Middle Eastern':'🧆','West African':'🫘','Turkish':'🥙','Sri Lankan':'🍚',
  'Afghan':'🥟','East African':'🍲','Chinese':'🥡','Other':'🍽️',
}

type Status = 'live' | 'pending' | 'suspended'

interface Props {
  listing: Listing | null
  sellerName?: string
  sellerEmail?: string
  sellerPhone?: string | null
  sellerPostcode?: string | null
  onClose: () => void
  // Notify the parent list so its row updates in place after an action.
  onStatusChange: (id: string, status: Status, adminNote: string | null) => void
}

const statusColor = (s: string) => s === 'live' ? '#34D399' : s === 'pending' ? '#FBBF24' : '#FF8A8A'
const statusBg = (s: string) => s === 'live' ? 'rgba(52,211,153,0.14)' : s === 'pending' ? 'rgba(251,191,36,0.14)' : 'rgba(255,138,138,0.14)'

// Full admin view of a single listing — replaces sending admins to /dish/[id]
// (which renders the buyer order form). Portal into document.body so it escapes
// any transformed .fade-up ancestor, same rationale as AdminDeleteModal.
// Initial local state derives straight from the listing prop; the parent passes
// `key={listing.id}` so a fresh listing remounts this component and re-seeds the
// state — no prop→state syncing effect (which React flags as a cascading render).
export default function ListingDetailModal({ listing, sellerName, sellerEmail, sellerPhone, sellerPostcode, onClose, onStatusChange }: Props) {
  const [status, setStatus] = useState<string>(listing?.status ?? 'pending')
  const [adminNote, setAdminNote] = useState<string | null>(listing?.admin_note ?? null)
  const [reviewedAt, setReviewedAt] = useState<string | null>(listing?.admin_reviewed_at ?? null)
  const [busy, setBusy] = useState<Status | ''>('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [success, setSuccess] = useState('')

  if (!listing || typeof document === 'undefined') return null

  const act = async (newStatus: Status, note?: string) => {
    setBusy(newStatus); setSuccess('')
    const { error } = await supabase.rpc('admin_update_listing_status', {
      p_id: listing.id, p_status: newStatus, p_note: note ?? null,
    })
    setBusy('')
    if (error) { alert('Could not update: ' + error.message); return }
    const appliedNote = newStatus === 'pending' ? (note ?? null) : null
    setStatus(newStatus); setAdminNote(appliedNote); setReviewedAt(new Date().toISOString())
    setNoteOpen(false); setNoteText('')
    setSuccess(newStatus === 'live' ? '✓ Listing set live' : newStatus === 'suspended' ? '✓ Listing suspended' : '✓ Changes requested — seller notified')
    onStatusChange(listing.id, newStatus, appliedNote)
  }

  const l = listing
  const allergens = l.allergens || []
  const dietary = [l.halal && '🟢 Halal', l.vegan && '🌿 Vegan', l.vegetarian && '🥦 Vegetarian', l.spicy && '🌶️ Spicy'].filter(Boolean) as string[]
  const deliveryOptions = Array.isArray(l.delivery_options)
    ? l.delivery_options
    : typeof l.delivery_options === 'string' && l.delivery_options
      ? l.delivery_options.split(',').map(s => s.trim()).filter(Boolean)
      : []

  const infoRow = (label: string, value: string | number) => (
    <div style={{display:'flex', justifyContent:'space-between', gap:14, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13}}>
      <span style={{color:'var(--text-secondary)', fontWeight:600, flexShrink:0}}>{label}</span>
      <span style={{color:'var(--text-primary)', fontWeight:600, textAlign:'right', minWidth:0, wordBreak:'break-word'}}>{value}</span>
    </div>
  )

  return createPortal(
    <div onClick={() => { if (!busy) onClose() }} style={{
      position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)',
      backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      animation:'ldmFade 0.15s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:20,
        width:'100%', maxWidth:560, maxHeight:'88vh', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.3)', animation:'ldmSlide 0.2s ease',
      }}>
        {/* Photo banner */}
        <div style={{position:'relative', height:180, background:'linear-gradient(135deg,rgba(200,0,106,0.2) 0%,var(--bg-page) 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:72, flexShrink:0}}>
          {l.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.image_url} alt={l.name} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}} />
          ) : (cuisineEmoji[l.cuisine] || '🍽️')}
          <span style={{position:'absolute', top:14, left:14, background:statusBg(status), color:statusColor(status), padding:'5px 13px', borderRadius:100, fontSize:12, fontWeight:700, textTransform:'capitalize', backdropFilter:'blur(6px)'}}>{status}</span>
          <button onClick={() => { if (!busy) onClose() }} aria-label="Close" style={{position:'absolute', top:12, right:12, width:34, height:34, borderRadius:8, border:'none', background:'rgba(0,0,0,0.45)', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1}}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{overflowY:'auto', padding:'20px 24px'}}>
          <h2 style={{fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:14}}>{l.name}</h2>

          {/* Seller */}
          <div style={{background:'var(--bg-page)', borderRadius:12, padding:'12px 14px', marginBottom:16}}>
            <div style={{fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:7}}>Seller</div>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4}}>{sellerName || 'Unknown'}</div>
            <div style={{fontSize:12.5, color:'var(--text-secondary)', lineHeight:1.7, wordBreak:'break-word'}}>
              {sellerEmail && <div>✉️ {sellerEmail}</div>}
              {sellerPhone && <div>📞 {sellerPhone}</div>}
              {sellerPostcode && <div>📍 {sellerPostcode}</div>}
            </div>
          </div>

          {/* Key facts */}
          <div style={{marginBottom:16}}>
            {infoRow('Price', `£${parseFloat(l.price || '0').toFixed(2)}`)}
            {infoRow('Cuisine', l.cuisine)}
            {infoRow('Serves', l.serves || 1)}
            {l.prep_time && infoRow('Prep time', l.prep_time)}
            {deliveryOptions.length > 0 && infoRow('Delivery', deliveryOptions.join(', '))}
          </div>

          {/* Description */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>Description</div>
            <p style={{fontSize:13.5, color:'var(--text-primary)', lineHeight:1.6}}>{l.description || 'No description provided.'}</p>
          </div>

          {/* Dietary */}
          {dietary.length > 0 && (
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
              {dietary.map((d, i) => <span key={i} style={{background:'var(--bg-page)', color:'var(--text-primary)', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:600}}>{d}</span>)}
            </div>
          )}

          {/* Allergens */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>Allergens</div>
            {allergens.length > 0 ? (
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {allergens.map((a, i) => <span key={i} style={{background:'rgba(251,191,36,0.14)', color:'#FBBF24', padding:'5px 11px', borderRadius:100, fontSize:12, fontWeight:700}}>⚠️ {a}</span>)}
              </div>
            ) : <span style={{fontSize:13, color:'var(--text-secondary)'}}>None declared.</span>}
          </div>

          {/* Stats */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
            {[
              { v:String(l.order_count || 0), lb:'Orders' },
              { v:l.rating ? Number(l.rating).toFixed(1) : '—', lb:'Rating' },
              { v:String(l.reviews_count || 0), lb:'Reviews' },
            ].map((s, i) => (
              <div key={i} style={{background:'var(--bg-page)', borderRadius:12, padding:'12px', textAlign:'center'}}>
                <div style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'var(--text-primary)'}}>{s.v}</div>
                <div style={{fontSize:10, color:'var(--text-secondary)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginTop:3}}>{s.lb}</div>
              </div>
            ))}
          </div>

          {/* Admin note */}
          {adminNote && (
            <div style={{background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:12, padding:'12px 14px', marginBottom:6}}>
              <div style={{fontSize:10, fontWeight:700, color:'#FBBF24', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5}}>Changes requested</div>
              <p style={{fontSize:13, color:'var(--text-primary)', lineHeight:1.5}}>{adminNote}</p>
            </div>
          )}
          {reviewedAt && (
            <div style={{fontSize:11.5, color:'var(--text-secondary)', marginTop:8}}>Last reviewed {new Date(reviewedAt).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{borderTop:'1px solid var(--border-subtle)', padding:'14px 24px', flexShrink:0}}>
          {success && <div style={{fontSize:12.5, fontWeight:700, color:'#34D399', marginBottom:10}}>{success}</div>}

          {noteOpen && (
            <div style={{marginBottom:12}}>
              <label style={{display:'block', fontSize:12.5, fontWeight:700, color:'var(--text-primary)', marginBottom:6}}>What needs to be changed?</label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                autoFocus
                rows={3}
                placeholder="e.g. Please add a clearer photo and list the allergens."
                style={{width:'100%', padding:'10px 12px', border:'1px solid var(--border-subtle)', borderRadius:10, fontSize:13, color:'var(--text-primary)', background:'var(--bg-page)', outline:'none', resize:'vertical', lineHeight:1.5, fontFamily:'Inter,system-ui,sans-serif'}}
              />
              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button onClick={() => act('pending', noteText.trim())} disabled={!noteText.trim() || busy === 'pending'} style={{height:38, padding:'0 16px', background:'#F59E0B', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:!noteText.trim() || busy === 'pending' ? 'not-allowed' : 'pointer', opacity:!noteText.trim() || busy === 'pending' ? 0.55 : 1}}>{busy === 'pending' ? 'Sending…' : 'Send request'}</button>
                <button onClick={() => { setNoteOpen(false); setNoteText('') }} disabled={busy === 'pending'} style={{height:38, padding:'0 14px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          )}

          <div className="ldm-actions" style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {status !== 'live' && (
              <button onClick={() => act('live')} disabled={!!busy} style={{flex:'1 1 auto', height:40, padding:'0 14px', background:'#2DA84E', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:busy ? 'wait' : 'pointer', opacity:busy && busy !== 'live' ? 0.6 : 1}}>{busy === 'live' ? 'Setting live…' : 'Set Live'}</button>
            )}
            {!noteOpen && (
              <button onClick={() => { setNoteOpen(true); setNoteText(adminNote || '') }} disabled={!!busy} style={{flex:'1 1 auto', height:40, padding:'0 14px', background:'#F59E0B', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:busy ? 'wait' : 'pointer', opacity:busy ? 0.6 : 1}}>Request changes</button>
            )}
            {status !== 'suspended' && (
              <button onClick={() => act('suspended')} disabled={!!busy} style={{flex:'1 1 auto', height:40, padding:'0 14px', background:'#DC2626', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor:busy ? 'wait' : 'pointer', opacity:busy && busy !== 'suspended' ? 0.6 : 1}}>{busy === 'suspended' ? 'Suspending…' : 'Suspend'}</button>
            )}
            <button onClick={() => { if (!busy) onClose() }} disabled={!!busy} style={{flex:'1 1 auto', height:40, padding:'0 14px', background:'transparent', color:'var(--text-primary)', border:'1px solid var(--border-subtle)', borderRadius:9, fontSize:13, fontWeight:700, cursor:busy ? 'not-allowed' : 'pointer'}}>Close</button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ldmFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ldmSlide { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @media (max-width: 480px) { .ldm-actions > button { flex: 1 1 100% !important; } }
      `}</style>
    </div>,
    document.body
  )
}
