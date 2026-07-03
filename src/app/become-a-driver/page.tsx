'use client'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import HeroVideoBg from '@/components/HeroVideoBg'

const AVG_DELIVERY = 4.5 // estimated earnings per delivery (£)

const steps = [
  { n: '01', icon: '📝', title: 'Register', desc: 'Sign up for free and choose the driver role — it only takes a couple of minutes.' },
  { n: '02', icon: '📄', title: 'Upload documents', desc: 'Add your right to work, driving licence and insurance. Snap a photo and you’re done.' },
  { n: '03', icon: '✅', title: 'Get approved', desc: 'We review your documents and approve you, usually within 24–48 hours.' },
  { n: '04', icon: '🛵', title: 'Start delivering', desc: 'Go online, accept deliveries near you, and get paid the same day.' },
]

const requirements = [
  { title: 'Right to work in the UK', desc: 'A passport, visa or share code that confirms you can work here.', optional: false },
  { title: 'Valid UK driving licence', desc: 'A full licence for the vehicle you’ll deliver with.', optional: false },
  { title: 'Vehicle insurance', desc: 'Valid insurance covering your delivery vehicle.', optional: false },
  { title: 'DBS check', desc: 'A background check — optional, but it can unlock more deliveries.', optional: true },
]

const benefits = [
  { icon: '🕒', title: 'Flexible hours', desc: 'Work when it suits you — mornings, evenings or weekends. No fixed shifts.' },
  { icon: '⚡', title: 'Same day pay', desc: 'Get your earnings the same day. No waiting weeks to be paid.' },
  { icon: '📍', title: 'Choose your area', desc: 'Deliver close to home or wherever you want to be. You pick your patch.' },
  { icon: '🎯', title: 'No targets', desc: 'No quotas, no penalties. Take the deliveries you want, ignore the rest.' },
]

const faqs = [
  { q: 'How much can I earn?', a: 'Earnings depend on how many deliveries you complete, distance and tips. Many drivers use it as flexible top-up income — use the calculator above for a quick estimate.' },
  { q: 'When do I get paid?', a: 'Payouts are processed the same day through our secure payments partner, straight to your bank account.' },
  { q: 'What vehicle can I use?', a: 'Bike, scooter, motorbike or car — as long as it’s roadworthy, insured and you hold the right licence for it.' },
  { q: 'Do I have to work fixed shifts?', a: 'No. You go online whenever you like and stop whenever you like. There are no fixed shifts and no minimum hours.' },
  { q: 'How long does approval take?', a: 'Most drivers are reviewed and approved within 24–48 hours once all documents are uploaded.' },
  { q: 'Is the DBS check mandatory?', a: 'No, a DBS check is optional. It’s not required to start, but having one can make you eligible for more deliveries.' },
]

export default function BecomeADriver() {
  const [deliveries, setDeliveries] = useState(12)
  const daily = deliveries * AVG_DELIVERY
  const weekly = daily * 5

  return (
    <div style={{ background: 'var(--bg-page)', fontFamily: 'Inter,system-ui,sans-serif', color: 'var(--text-primary)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; color: inherit; }
        button { font-family: Inter, system-ui, sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(0.34,1.1,0.64,1) both; }
        .lift { transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.18s; }
        .lift:hover { transform: translateY(-5px); box-shadow: 0 18px 44px rgba(200,0,106,0.13); }
        .cta:hover { background: #A00055 !important; transform: translateY(-1px); }
        .cta { transition: all 0.16s; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 100px; background: #F0D9E7; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #C8006A; cursor: pointer; box-shadow: 0 4px 12px rgba(200,0,106,0.4); border: 3px solid #fff; }
        input[type=range]::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #C8006A; cursor: pointer; border: 3px solid #fff; }
        details { border: 1.5px solid var(--border-subtle); border-radius: 14px; overflow: hidden; transition: border-color 0.15s; }
        details[open] { border-color: rgba(200,0,106,0.3); }
        summary { list-style: none; cursor: pointer; padding: 18px 20px; font-size: 15px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: '+'; font-size: 22px; font-weight: 400; color: #C8006A; flex-shrink: 0; line-height: 1; }
        details[open] summary::after { content: '−'; }
        details[open] summary { color: #C8006A; }
        .h-section { font-family: Georgia, serif; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); }
        @media (max-width: 860px) {
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .calc-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: 'var(--bg-nav)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 100, height: 64 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ flexShrink: 0 }}><Logo height={34} /></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Sign in</Link>
            <Link href="/register?role=driver" className="cta" style={{ height: 42, padding: '0 20px', display: 'flex', alignItems: 'center', background: '#C8006A', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(200,0,106,0.3)' }}>Start delivering</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', position: 'relative', overflow: 'hidden', minHeight: '78vh', display: 'flex', alignItems: 'center' }}>
        <HeroVideoBg src="/videos/hero-driver.mp4" mobileSrc="/videos/hero-driver-mobile.mp4" poster="/videos/hero-driver-poster.jpg" />
        <div className="fade-up" style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '88px 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 100, padding: '6px 16px', marginBottom: 22 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>🛵 For drivers</span>
          </div>
          <h1 className="h-section" style={{ fontSize: 'clamp(32px,5.2vw,60px)', color: '#fff', lineHeight: 1.07, marginBottom: 18 }}>Deliver on your schedule, earn what you’re worth</h1>
          <p style={{ fontSize: 'clamp(16px,1.7vw,20px)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto 32px' }}>Flexible hours. Instant pay. Be your own boss.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?role=driver" className="cta" style={{ height: 54, padding: '0 32px', display: 'flex', alignItems: 'center', background: 'var(--bg-card)', color: '#C8006A', borderRadius: 13, fontSize: 16, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>Start delivering today →</Link>
            <a href="#calculator" style={{ height: 54, padding: '0 28px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 13, fontSize: 16, fontWeight: 600 }}>See what you could earn</a>
          </div>
        </div>
      </section>

      {/* EARNINGS CALCULATOR */}
      <section id="calculator" style={{ padding: '80px 0', background: 'var(--bg-card)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Earnings calculator</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)', marginBottom: 12 }}>See what you could earn</h2>
            <p style={{ fontSize: 16, color: 'var(--text-primary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>Based on roughly £{AVG_DELIVERY.toFixed(2)} per delivery across a 5-day week.</p>
          </div>
          <div className="calc-grid lift" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 6px 28px var(--shadow-card)' }}>
            <div style={{ padding: '36px 32px' }}>
              <label htmlFor="deliveries" style={{ display: 'block', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>How many deliveries per day?</label>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 48, fontWeight: 700, color: '#C8006A', marginBottom: 18, letterSpacing: '-0.02em' }}>{deliveries}</div>
              <input id="deliveries" type="range" min={1} max={40} value={deliveries} onChange={e => setDeliveries(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 8, opacity: 0.7 }}><span>1</span><span>40+</span></div>
            </div>
            <div style={{ padding: '36px 32px', background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Estimated daily</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 700, lineHeight: 1 }}>£{daily.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Estimated weekly</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 700, lineHeight: 1 }}>£{weekly.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-primary)', textAlign: 'center', marginTop: 16, opacity: 0.7 }}>Estimates only. Actual earnings vary with distance, demand and tips.</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 0', background: 'var(--bg-page)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>How it works</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>On the road in four steps</h2>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {steps.map(s => (
              <div key={s.n} className="lift" style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '28px 24px', border: '1.5px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{s.icon}</div>
                  <span style={{ fontFamily: 'Georgia,serif', fontSize: 30, fontWeight: 700, color: '#F0D9E7' }}>{s.n}</span>
                </div>
                <h3 className="h-section" style={{ fontSize: 18, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section style={{ padding: '80px 0', background: 'var(--bg-card)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Why drive with us</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Built around your life</h2>
          </div>
          <div className="benefits-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {benefits.map(b => (
              <div key={b.title} className="lift" style={{ background: 'var(--bg-page)', borderRadius: 20, padding: '30px 24px', border: '1.5px solid var(--border-subtle)', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 16px' }}>{b.icon}</div>
                <h3 className="h-section" style={{ fontSize: 17, marginBottom: 8 }}>{b.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, opacity: 0.85 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section style={{ padding: '80px 0', background: 'var(--bg-page)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>What you’ll need</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Requirements to start</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {requirements.map(r => (
              <div key={r.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'var(--bg-card)', borderRadius: 16, padding: '20px 22px', border: '1.5px solid var(--border-subtle)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.optional ? '#FFE8F4' : '#2DA84E', color: r.optional ? '#C8006A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{r.optional ? '○' : '✓'}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{r.title}{r.optional && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: '#FFE8F4', color: '#C8006A', padding: '2px 8px', borderRadius: 100 }}>OPTIONAL</span>}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, opacity: 0.85 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 0', background: 'var(--bg-card)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>FAQ</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Driver questions, answered</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div style={{ padding: '0 20px 20px', fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.8 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '88px 20px', background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 className="h-section" style={{ fontSize: 'clamp(28px,4vw,46px)', color: '#fff', marginBottom: 14 }}>Ready to hit the road?</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, marginBottom: 30 }}>Sign up today and start earning on your own schedule.</p>
          <Link href="/register?role=driver" className="cta" style={{ display: 'inline-flex', alignItems: 'center', height: 56, padding: '0 36px', background: 'var(--bg-card)', color: '#C8006A', borderRadius: 14, fontSize: 17, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>Start delivering today →</Link>
        </div>
      </section>

      {/* SLIM FOOTER */}
      <footer style={{ background: '#1A1A1A', padding: '28px 20px', textAlign: 'center' }}>
        <Link href="/"><Logo height={28} white /></Link>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 12 }}>© 2026 meaLoyo · <Link href="/" style={{ color: 'rgba(255,255,255,0.75)' }}>Home</Link> · <Link href="/become-a-seller" style={{ color: 'rgba(255,255,255,0.75)' }}>Become a seller</Link></p>
      </footer>
    </div>
  )
}
