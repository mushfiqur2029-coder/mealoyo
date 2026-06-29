'use client'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

const SUPPORT_EMAIL = 'hello@mealoyo.com'

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // No backend yet — compose an email the visitor sends from their own client.
    const subject = `meaLoyo enquiry from ${name || 'a visitor'}`
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  const field: React.CSSProperties = { width:'100%', height:48, padding:'0 14px', border:'1.5px solid #E0E0E0', borderRadius:10, fontSize:14, fontWeight:500, color:'#1A1A1A', outline:'none', background:'#fff' }
  const label: React.CSSProperties = { display:'block', fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:7 }

  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;} a{text-decoration:none;color:inherit;} input:focus,textarea:focus{border-color:#C8006A !important;}`}</style>

      <nav style={{background:'#fff',borderBottom:'1px solid rgba(200,0,106,0.08)',position:'sticky',top:0,zIndex:100,height:62}}>
        <div style={{maxWidth:620,margin:'0 auto',padding:'0 20px',height:62,display:'flex',alignItems:'center',gap:14}}>
          <Link href="/" style={{width:34,height:34,border:'1.5px solid #E0E0E0',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>←</Link>
          <Link href="/"><Logo height={32}/></Link>
        </div>
      </nav>

      <div style={{maxWidth:620,margin:'0 auto',padding:'44px 20px 72px'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#C8006A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Get in touch</div>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(26px,4vw,38px)',fontWeight:700,color:'#1A1A1A',marginBottom:10,letterSpacing:'-0.02em'}}>Contact us</h1>
        <p style={{fontSize:15,color:'#1A1A1A',lineHeight:1.7,marginBottom:30}}>Questions, feedback or need a hand with an order? Send us a message and we&apos;ll reply to your email. You can also reach us directly at <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:'#C8006A',fontWeight:700}}>{SUPPORT_EMAIL}</a>.</p>

        {sent ? (
          <div style={{background:'linear-gradient(135deg,#FFF0F8 0%,#FFE8F4 100%)',border:'1.5px solid rgba(200,0,106,0.16)',borderRadius:18,padding:'32px 26px',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>✉️</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#1A1A1A',marginBottom:8}}>Your email is ready to send</h2>
            <p style={{fontSize:14,color:'#1A1A1A',lineHeight:1.7,marginBottom:18}}>We&apos;ve opened your email app with the message pre-filled. If nothing opened, email us directly at <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:'#C8006A',fontWeight:700}}>{SUPPORT_EMAIL}</a>.</p>
            <button type="button" onClick={() => setSent(false)} style={{height:44,padding:'0 22px',background:'#C8006A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>Write another message</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:18}}>
            <div>
              <label style={label} htmlFor="c-name">Your name</label>
              <input id="c-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Cook" style={field}/>
            </div>
            <div>
              <label style={label} htmlFor="c-email">Your email</label>
              <input id="c-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={field}/>
            </div>
            <div>
              <label style={label} htmlFor="c-msg">Message</label>
              <textarea id="c-msg" value={message} onChange={e => setMessage(e.target.value)} required rows={6} placeholder="How can we help?" style={{...field, height:'auto', padding:'12px 14px', lineHeight:1.6, resize:'vertical', fontFamily:'inherit'}}/>
            </div>
            <button type="submit" style={{height:52,background:'#C8006A',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 6px 20px rgba(200,0,106,0.3)'}}>Send message →</button>
          </form>
        )}
      </div>
    </div>
  )
}
