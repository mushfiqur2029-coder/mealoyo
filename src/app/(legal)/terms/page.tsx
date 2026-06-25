import Link from 'next/link'

export default function Terms() {
  const sections = [
    { h: '1. Who we are', b: 'meaLoyo Ltd ("meaLoyo", "we", "us") operates a marketplace connecting home cooks ("sellers"), buyers and delivery drivers across the UK. These Terms govern your use of the meaLoyo platform.' },
    { h: '2. Accounts', b: 'You must provide accurate information when registering. Seller and driver accounts require approval before going live. You are responsible for keeping your login credentials secure.' },
    { h: '3. Orders and payments', b: 'Prices are set by sellers. meaLoyo charges a platform commission on each order, deducted from the seller payout. Payments are processed securely by Stripe. All orders are subject to seller acceptance.' },
    { h: '4. Food safety and allergens', b: 'Sellers must hold a valid Level 2 Food Hygiene Certificate, be registered with their local authority as a food business, and accurately declare all allergens present in each dish. meaLoyo does not independently verify the preparation of food.' },
    { h: '5. Cancellations and refunds', b: 'Buyers may cancel an order before it is accepted by the seller. Once a seller has begun preparing an order, cancellations are at the seller’s discretion. Refunds for undelivered or incorrect orders are handled case by case.' },
    { h: '6. Delivery', b: 'Community delivery is carried out by independent drivers using the platform, not meaLoyo employees. Collection orders are the buyer’s responsibility to collect within the agreed window.' },
    { h: '7. Account suspension', b: 'meaLoyo may suspend or terminate accounts that violate these Terms, provide false information, or pose a risk to other users.' },
    { h: '8. Liability', b: 'meaLoyo provides the marketplace platform only. We are not liable for the quality, safety or accuracy of food listings beyond what is reasonably expected of a marketplace operator.' },
    { h: '9. Changes', b: 'We may update these Terms from time to time. Continued use of meaLoyo after changes constitutes acceptance of the updated Terms.' },
    { h: '10. Contact', b: 'Questions about these Terms can be sent to hello@mealoyo.com.' },
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
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(26px,4vw,38px)',fontWeight:700,color:'#1A1A1A',marginBottom:8}}>Terms of Service</h1>
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
