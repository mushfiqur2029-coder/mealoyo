import Link from 'next/link'
export default function Pending() {
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif', textAlign:'center' }}>
      <div style={{ background:'#fff', borderRadius:24, padding:'48px 36px', maxWidth:480, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1A1A', marginBottom:10 }}>Application received</h1>
        <p style={{ fontSize:15, color:'#555', lineHeight:1.7, marginBottom:24 }}>Your account is under review. You will receive an email within <strong>24–48 hours</strong> once approved.</p>
        <div style={{ background:'#FFE8F4', border:'1.5px solid rgba(200,0,106,0.2)', borderRadius:12, padding:16, marginBottom:24 }}>
          <p style={{ fontSize:13, color:'#C8006A', fontWeight:600, lineHeight:1.6 }}>Prepare your documents:<br/>Level 2 Food Hygiene Certificate · Council registration · Photo ID</p>
        </div>
        <Link href="/" style={{ display:'inline-block', height:48, padding:'0 32px', background:'#C8006A', color:'#fff', borderRadius:12, fontSize:15, fontWeight:700, lineHeight:'48px', boxShadow:'0 4px 16px rgba(200,0,106,0.3)' }}>Back to meaLoyo</Link>
      </div>
    </div>
  )
}
