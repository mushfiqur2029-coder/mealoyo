import Link from 'next/link'

export default function Privacy() {
  const sections = [
    { h: '1. What we collect', b: 'We collect the information you provide when registering (name, email, phone), order details, and, for sellers and drivers, the documents required for approval (food hygiene certificate, ID). We do not collect more than is needed to operate the marketplace.' },
    { h: '2. How we use your data', b: 'Your data is used to process orders, facilitate communication between buyers, sellers and drivers, verify seller and driver applications, and improve the meaLoyo service.' },
    { h: '3. Sharing your data', b: 'Sellers and drivers see the buyer name and delivery details needed to fulfil an order. We share data with Stripe to process payments. We do not sell your personal data to third parties.' },
    { h: '4. Data retention', b: 'We retain account and order data for as long as your account is active and as required for legal, accounting and food safety record-keeping purposes.' },
    { h: '5. Your rights', b: 'Under UK GDPR you can request access to, correction of, or deletion of your personal data. Contact hello@mealoyo.com to make a request.' },
    { h: '6. Cookies', b: 'meaLoyo uses essential cookies to keep you signed in and remember your preferences. We do not use third-party advertising trackers.' },
    { h: '7. Security', b: 'We use industry-standard measures, including row-level access controls and encrypted connections, to protect your data.' },
    { h: '8. Contact', b: 'Questions about this Privacy Policy can be sent to hello@mealoyo.com.' },
  ]
  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} a{text-decoration:none;color:inherit;}`}</style>
      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:760,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><img src="/Color_Logo.png" alt="meaLoyo" style={{height:32,width:'auto'}}/></Link>
        </div>
      </nav>
      <div style={{maxWidth:760,margin:'0 auto',padding:'40px 20px 64px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(26px,4vw,38px)',fontWeight:700,color:'#1A1A1A',marginBottom:8}}>Privacy Policy</h1>
        <p style={{fontSize:13,color:'#1A1A1A',marginBottom:32,fontWeight:500}}>Last updated: June 2026</p>
        {sections.map(s => (
          <div key={s.h} style={{marginBottom:24}}>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>{s.h}</h2>
            <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.75}}>{s.b}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
