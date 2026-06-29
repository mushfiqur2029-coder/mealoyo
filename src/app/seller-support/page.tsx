import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = { title: 'Seller support · meaLoyo' }

const faqs = [
  { q: 'How do I start selling on meaLoyo?', a: 'Create an account and choose the “Sell & cater” role. You’ll be asked to upload your Level 2 Food Hygiene certificate and a photo ID. Once our team approves you (usually within 1–2 working days), you can publish your first dish.' },
  { q: 'What do I need to get approved?', a: 'A valid Level 2 Food Hygiene certificate, photo ID, and registration of your food business with your local authority. We verify every cook before they can take orders — this keeps buyers safe and your listings trusted.' },
  { q: 'How much commission does meaLoyo take?', a: 'A flat 12% per order — far below the 25–30% charged by the big delivery apps. You keep 88% of every sale. There are no monthly fees or listing charges.' },
  { q: 'When and how do I get paid?', a: 'Payments are processed securely through Stripe. Your earnings for completed orders are paid out to your linked bank account on a regular schedule — you can track everything from the Earnings tab in your seller dashboard.' },
  { q: 'How does delivery work?', a: 'You can offer free collection, community delivery via local drivers, or deliver yourself for catering orders. You set your delivery radius and which options each dish supports when you create a listing.' },
  { q: 'Do I have to list allergens?', a: 'Yes — allergen declarations are mandatory for every dish. When creating a listing you select all of the 14 major allergens that apply. Accurate allergen info protects your buyers and is a legal requirement.' },
  { q: 'Can I run catering or office orders?', a: 'Absolutely. Set a higher “serves” number (10+) on your dish and it will appear under the Office catering and Party & events filters on the homepage. You handle delivery for large catering orders directly.' },
  { q: 'How do I edit or pause a listing?', a: 'Go to My listings in your seller dashboard, open any dish, and edit its details, photo or price. You can also change its status to take it offline temporarily without deleting it.' },
]

export default function SellerSupport() {
  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} a{text-decoration:none;color:inherit;}
        details{border:1.5px solid #EEE;border-radius:14px;overflow:hidden;transition:border-color 0.15s;}
        details[open]{border-color:rgba(200,0,106,0.3);}
        summary{list-style:none;cursor:pointer;padding:18px 20px;font-size:15px;font-weight:700;color:#1A1A1A;display:flex;align-items:center;justify-content:space-between;gap:14px;}
        summary::-webkit-details-marker{display:none;}
        summary::after{content:'+';font-size:22px;font-weight:400;color:#C8006A;flex-shrink:0;line-height:1;}
        details[open] summary::after{content:'−';}
        details[open] summary{color:#C8006A;}
      `}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:760,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
        </div>
      </nav>

      <div style={{maxWidth:760,margin:'0 auto',padding:'44px 20px 72px'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Seller support</div>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(26px,4vw,38px)',fontWeight:700,color:'#1A1A1A',marginBottom:10,letterSpacing:'-0.02em'}}>Help for home cooks</h1>
        <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.7,marginBottom:30}}>Everything you need to know about selling on meaLoyo. Still stuck? Email us at <a href="mailto:hello@mealoyo.com" style={{color:'#C8006A',fontWeight:700}}>hello@mealoyo.com</a>.</p>

        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:36}}>
          {faqs.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div style={{padding:'0 20px 20px',fontSize:14.5,color:'#1A1A1A',lineHeight:1.8}}>{f.a}</div>
            </details>
          ))}
        </div>

        <div style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)',border:'1.5px solid rgba(200,0,106,0.12)',borderRadius:18,padding:'26px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:19,fontWeight:700,color:'#1A1A1A',marginBottom:4}}>Ready to start cooking?</div>
            <div style={{fontSize:14,color:'#1A1A1A'}}>Set up your kitchen and publish your first dish today.</div>
          </div>
          <Link href="/register" style={{height:48,padding:'0 26px',display:'flex',alignItems:'center',background:'#C8006A',color:'#fff',borderRadius:11,fontSize:14.5,fontWeight:700,boxShadow:'0 6px 18px rgba(200,0,106,0.3)',flexShrink:0}}>Start selling →</Link>
        </div>
      </div>
    </div>
  )
}
