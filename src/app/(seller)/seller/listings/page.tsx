
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SellerListings() {
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
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
  }, [])

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const statusColor = (s: string) => s==='live'?'#2DA84E':s==='pending'?'#E8930A':'#C0392B'
  const statusBg = (s: string) => s==='live'?'#E4F6EA':s==='pending'?'#FFF4E0':'#FDECEA'

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:'4px solid #FFE8F4',borderTop:'4px solid #C8006A',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#C8006A',fontWeight:600}}>Loading listings...</p>
      </div>
    </div>
  )

  if (profile?.status === 'pending') return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,system-ui,sans-serif',padding:24}}>
      <div style={{background:'#fff',borderRadius:24,padding:'48px 36px',maxWidth:480,width:'100%',textAlign:'center',boxShadow:'0 4px 24px rgba(200,0,106,0.1)'}}>
        <div style={{fontSize:56,marginBottom:16}}>⏳</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1A1A',marginBottom:10}}>Awaiting approval</h2>
        <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.7,marginBottom:24}}>Your seller account is being reviewed. You will be notified within 24–48 hours.</p>
        <button onClick={signOut} style={{height:44,padding:'0 24px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F8F0F4',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:0;}*{scrollbar-width:none;}
        a{text-decoration:none;color:inherit;}
        .lrow:hover{background:#FFF5FA !important;}
        .nav-link:hover{color:#C8006A !important;}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center'}}>
          <Link href="/" style={{marginRight:28,flexShrink:0}}>
            <img src="/Color_Logo.png" alt="meaLoyo" style={{height:34,width:'auto'}}/>
          </Link>
          <div style={{display:'flex',gap:0,flex:1}}>
            {[
              {l:'Dashboard',h:'/seller/dashboard',a:false},
              {l:'My listings',h:'/seller/listings',a:true},
              {l:'Orders',h:'/seller/orders',a:false},
              {l:'Earnings',h:'/seller/earnings',a:false},
              {l:'Profile',h:'/seller/profile',a:false}
            ].map((t,i)=>(
              <Link key={i} href={t.h} className="nav-link" style={{height:62,padding:'0 14px',display:'flex',alignItems:'center',fontSize:13,fontWeight:t.a?700:500,color:t.a?'#C8006A':'#1A1A1A',borderBottom:t.a?'2.5px solid #C8006A':'2.5px solid transparent',transition:'color 0.12s'}}>{t.l}</Link>
            ))}
          </div>
          <Link href="/seller/listings/new" style={{height:36,padding:'0 18px',display:'flex',alignItems:'center',background:'#C8006A',borderRadius:8,fontSize:13,fontWeight:700,color:'#fff',boxShadow:'0 4px 12px rgba(200,0,106,0.3)',marginLeft:'auto'}}>
            + Add listing
          </Link>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(20px,2.5vw,28px)',fontWeight:700,color:'#1A1A1A',marginBottom:4}}>My listings</h1>
            <p style={{fontSize:14,color:'#1A1A1A',fontWeight:400}}>{listings.length} {listings.length===1?'dish':'dishes'} listed</p>
          </div>
          <Link href="/seller/listings/new" style={{height:42,padding:'0 20px',display:'flex',alignItems:'center',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
            + Add new dish
          </Link>
        </div>

        {listings.length === 0 ? (
          <div style={{background:'#fff',borderRadius:20,padding:'64px 32px',textAlign:'center',boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)'}}>
            <div style={{fontSize:48,marginBottom:16}}>🍽️</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>No listings yet</h2>
            <p style={{fontSize:14,color:'#1A1A1A',marginBottom:24,maxWidth:360,margin:'0 auto 24px',lineHeight:1.65}}>Add your first dish and start earning. Listings go live once our team verifies your account.</p>
            <Link href="/seller/listings/new" style={{display:'inline-flex',alignItems:'center',height:46,padding:'0 28px',background:'#C8006A',borderRadius:10,fontSize:14,fontWeight:700,color:'#fff',boxShadow:'0 4px 14px rgba(200,0,106,0.3)'}}>
              Add your first dish →
            </Link>
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 2px 10px rgba(200,0,106,0.06)',border:'1.5px solid rgba(200,0,106,0.07)',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',padding:'10px 20px',background:'#F8F0F4',borderBottom:'1px solid rgba(200,0,106,0.08)'}}>
              {['Dish','Cuisine','Price','Status','Actions'].map(h=>(
                <div key={h} style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>
              ))}
            </div>
            {listings.map((l,i)=>(
              <div key={l.id} className="lrow" style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',padding:'14px 20px',borderBottom:i<listings.length-1?'1px solid #F5F0F3':'none',alignItems:'center',transition:'background 0.12s'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:2}}>{l.name}</div>
                  <div style={{fontSize:12,color:'#1A1A1A',fontWeight:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:280}}>{l.description}</div>
                </div>
                <div style={{fontSize:13,color:'#1A1A1A',fontWeight:500}}>{l.cuisine}</div>
                <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'#1A1A1A'}}>£{parseFloat(l.price).toFixed(2)}</div>
                <div>
                  <span style={{background:statusBg(l.status),color:statusColor(l.status),padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,textTransform:'capitalize'}}>{l.status}</span>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>deleteListing(l.id)} style={{height:30,padding:'0 12px',border:'1.5px solid #E0E0E0',borderRadius:7,fontSize:12,fontWeight:600,color:'#C0392B',background:'#fff',cursor:'pointer'}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
