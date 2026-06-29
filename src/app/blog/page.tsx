import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = { title: 'Blog · meaLoyo' }

export default function Blog() {
  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'Inter,system-ui,sans-serif',display:'flex',flexDirection:'column'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} a{text-decoration:none;color:inherit;}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:760,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
        </div>
      </nav>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center'}}>
        <div style={{maxWidth:440}}>
          <div style={{fontSize:52,marginBottom:18}}>📖</div>
          <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>The meaLoyo blog</div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(28px,4.5vw,40px)',fontWeight:700,color:'#1A1A1A',marginBottom:14,letterSpacing:'-0.02em'}}>Coming soon</h1>
          <p style={{fontSize:15.5,color:'#1A1A1A',lineHeight:1.75,marginBottom:28}}>Recipes, cook stories and tips for buying and selling home cooked food are on their way. Check back soon.</p>
          <Link href="/" style={{height:50,padding:'0 28px',display:'inline-flex',alignItems:'center',background:'#C8006A',color:'#fff',borderRadius:12,fontSize:15,fontWeight:700,boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>Browse food →</Link>
        </div>
      </div>
    </div>
  )
}
