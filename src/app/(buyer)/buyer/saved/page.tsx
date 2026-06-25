'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BuyerSaved() {
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('saved_listings')
        .select('id, listing_id, listings(*, profiles:seller_id(full_name))')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
      setSaved(data || [])
      setLoading(false)
    }
    getData()
  }, [])

  const unsave = async (savedId: string) => {
    await supabase.from('saved_listings').delete().eq('id', savedId)
    setSaved(prev => prev.filter(s => s.id !== savedId))
  }

  const cuisineEmoji: Record<string,string> = {'Bangladeshi':'🍛','Pakistani':'🫕','Indian':'🥘','Caribbean':'🍗','Middle Eastern':'🧆','West African':'🫘','Other':'🍽️'}

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading saved dishes...</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        .lcard:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(200,0,106,0.12)!important;}
        .unsave-btn:hover{transform:scale(1.15);}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/buyer/dashboard" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><img src="/Color_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
          <span style={{fontSize:14,color:'#1A1A1A',fontWeight:500}}>Saved dishes</span>
          <div style={{display:'flex',gap:16,marginLeft:'auto'}}>
            <Link href="/buyer/orders" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Orders</Link>
            <Link href="/buyer/profile" style={{fontSize:13,fontWeight:600,color:'#1A1A1A'}}>Profile</Link>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Saved dishes</h1>
          <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>{saved.length} {saved.length===1?'dish':'dishes'} saved for later.</p>
        </div>

        {saved.length === 0 ? (
          <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:48,marginBottom:16}}>🤍</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No saved dishes yet</h2>
            <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24,lineHeight:1.65}}>Tap the heart on any dish to save it here for later.</p>
            <Link href="/" style={{display:'inline-flex',alignItems:'center',height:46,padding:'0 28px',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
              Browse food →
            </Link>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}}>
            {saved.map(s => {
              const l = s.listings
              if (!l) return null
              return (
                <Link key={s.id} href={`/dish/${l.id}`} className="lcard" style={{background:'#fff',borderRadius:20,overflow:'hidden',boxShadow:'0 2px 16px rgba(200,0,106,0.07)',border:'1.5px solid rgba(200,0,106,0.07)',display:'block',transition:'all 0.2s'}}>
                  <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center',fontSize:56,background:'linear-gradient(135deg,#FFE8F4 0%,#FFF0F8 100%)',position:'relative'}}>
                    {cuisineEmoji[l.cuisine]||'🍽️'}
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();unsave(s.id)}} className="unsave-btn" style={{position:'absolute',top:12,right:12,width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.95)',border:'1.5px solid rgba(200,0,106,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',transition:'transform 0.14s'}}>❤️</button>
                  </div>
                  <div style={{padding:'15px 16px'}}>
                    <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A',marginBottom:4,lineHeight:1.3}}>{l.name}</div>
                    <div style={{fontSize:12,color:'#1A1A1A',marginBottom:10,fontWeight:500}}>{l.profiles?.full_name||'Home cook'} <span style={{color:'#C8006A',fontWeight:600}}>· {l.cuisine}</span></div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:11,borderTop:'1px solid #F5F0F3'}}>
                      <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.02em'}}>£{parseFloat(l.price).toFixed(2)}</div>
                      <span style={{height:32,padding:'0 14px',background:'#C8006A',color:'#fff',borderRadius:9,fontSize:12,fontWeight:700,display:'flex',alignItems:'center'}}>Order now</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
