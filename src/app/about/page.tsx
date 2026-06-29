import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = { title: 'About us · meaLoyo' }

export default function About() {
  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} a{text-decoration:none;color:inherit;}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:820,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)',padding:'56px 20px',textAlign:'center'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>
          <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>Our story</div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(28px,4.5vw,46px)',fontWeight:700,color:'#fff',lineHeight:1.12,letterSpacing:'-0.02em',marginBottom:16}}>Real food from real home kitchens.</h1>
          <p style={{fontSize:'clamp(15px,1.6vw,18px)',color:'rgba(255,255,255,0.85)',lineHeight:1.7,maxWidth:560,margin:'0 auto'}}>meaLoyo connects you to verified home cooks across the UK — authentic meals made with care, not mass-produced in a restaurant kitchen.</p>
        </div>
      </section>

      <div style={{maxWidth:760,margin:'0 auto',padding:'52px 20px 72px'}}>

        <div style={{marginBottom:36}}>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1A1A',marginBottom:12,letterSpacing:'-0.01em'}}>Why we started meaLoyo</h2>
          <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.85,marginBottom:14}}>Some of the best food in Britain never makes it onto a menu. It is cooked at home — Bangladeshi, Pakistani, Indian, Caribbean, Middle Eastern, West African and more — by talented cooks who have never had a simple, trusted way to share it with their neighbours.</p>
          <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.85}}>meaLoyo gives those cooks a storefront, handles payments and delivery, and gives buyers a safe, verified way to order the real thing. Every cook is ID checked and food-hygiene certified before they can sell.</p>
        </div>

        <div style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)',border:'1.5px solid rgba(200,0,106,0.12)',borderRadius:20,padding:'30px 26px',marginBottom:36}}>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1A1A1A',marginBottom:10}}>Our mission</h2>
          <p style={{fontSize:15.5,color:'#1A1A1A',lineHeight:1.8}}>To make authentic home cooked food accessible to everyone — while paying the people who make it fairly. We want home cooking to be a real livelihood, not an afterthought.</p>
        </div>

        {/* 12% commission USP */}
        <div style={{marginBottom:36}}>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1A1A',marginBottom:16,letterSpacing:'-0.01em'}}>The fairest deal for cooks</h2>
          <div style={{display:'flex',alignItems:'center',gap:20,background:'#fff',border:'1.5px solid rgba(200,0,106,0.14)',borderRadius:18,padding:'24px 26px',boxShadow:'0 4px 18px rgba(200,0,106,0.07)',flexWrap:'wrap'}}>
            <div style={{flexShrink:0}}>
              <div style={{fontFamily:'Georgia,serif',fontSize:54,fontWeight:700,color:'#C8006A',lineHeight:1}}>12%</div>
              <div style={{fontSize:11,fontWeight:700,color:'#1A1A1A',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>flat commission</div>
            </div>
            <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.8,flex:1,minWidth:220}}>While the big delivery apps take up to 30% from every order, meaLoyo charges a flat <strong>12% commission</strong>. Cooks keep <strong>88%</strong> of what they sell — so more of your money goes to the person who actually cooked your meal.</p>
          </div>
        </div>

        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <Link href="/register" style={{height:50,padding:'0 28px',display:'flex',alignItems:'center',background:'#C8006A',color:'#fff',borderRadius:12,fontSize:15,fontWeight:700,boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>Start selling your food</Link>
          <Link href="/" style={{height:50,padding:'0 28px',display:'flex',alignItems:'center',border:'1.5px solid #E0E0E0',borderRadius:12,fontSize:15,fontWeight:600,color:'#1A1A1A'}}>Browse food →</Link>
        </div>

      </div>
    </div>
  )
}
