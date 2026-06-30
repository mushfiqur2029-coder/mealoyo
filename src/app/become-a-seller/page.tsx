'use client'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import HeroVideoBg from '@/components/HeroVideoBg'

const AVG_ORDER = 12
const PAYOUT = 0.88

const steps = [
  { n: '01', icon: '📝', title: 'Register', desc: 'Create your free account and pick the seller role — it takes a couple of minutes.' },
  { n: '02', icon: '✅', title: 'Get verified', desc: 'Upload your food hygiene certificate and ID. We review and approve, usually within 24–48 hours.' },
  { n: '03', icon: '🍲', title: 'List your dishes', desc: 'Add photos, prices and portion sizes. Set your own collection and delivery options.' },
  { n: '04', icon: '💰', title: 'Start earning', desc: 'Accept orders, cook, and get paid. You keep 88% of every single order.' },
]

const platforms = [
  { name: 'meaLoyo', rate: '12%', highlight: true, note: 'Flat rate. No monthly fees.' },
  { name: 'Just Eat', rate: '14–28%', highlight: false, note: 'Plus joining & card fees.' },
  { name: 'Uber Eats', rate: '20–30%', highlight: false, note: 'Per-order commission.' },
  { name: 'Deliveroo', rate: '25–35%', highlight: false, note: 'Highest commission band.' },
]

const requirements = [
  { title: 'Level 2 Food Hygiene certificate', desc: 'A recognised food safety qualification — easy to complete online.' },
  { title: 'Council food business registration', desc: 'Free registration of your kitchen with your local authority.' },
  { title: 'Photo ID', desc: 'A passport or driving licence so we can verify who you are.' },
]

const faqs = [
  { q: 'How much does it cost to sell?', a: 'Nothing to join and no monthly fees. meaLoyo only takes a flat 12% commission when you make a sale, so you only ever pay when you earn.' },
  { q: 'When do I get paid?', a: 'Payments are processed securely through Stripe and paid out to your bank account on a regular schedule. You can track every payout from your Earnings dashboard.' },
  { q: 'Do I need a commercial kitchen?', a: 'No. You can sell from your home kitchen, provided you have your Level 2 Food Hygiene certificate and have registered your food business with your local council.' },
  { q: 'How long does approval take?', a: 'Most sellers are reviewed and approved within 24–48 hours of uploading their documents.' },
  { q: 'Can I set my own prices and hours?', a: 'Absolutely. You control your menu, prices, portion sizes, delivery radius and when you’re available to cook.' },
  { q: 'What about allergens and food safety?', a: 'You declare allergens on every dish — it’s required and protects your buyers. Keeping your hygiene certificate and council registration current keeps your kitchen compliant.' },
]

const testimonials = [
  { name: 'Ayesha R.', city: 'Birmingham', quote: 'I started selling my biryani at weekends and now it’s a proper second income. Keeping 88% makes a real difference.', emoji: '🍛' },
  { name: 'Marcus T.', city: 'London', quote: 'The commission is a fraction of what the big apps wanted. My Caribbean plates sell out most evenings.', emoji: '🍗' },
  { name: 'Fatima K.', city: 'Manchester', quote: 'Setup was simple and approval was quick. I love that I set my own hours around the kids.', emoji: '🧆' },
]

export default function BecomeASeller() {
  const [orders, setOrders] = useState(10)
  const weekly = orders * AVG_ORDER * PAYOUT
  const monthly = weekly * 52 / 12

  return (
    <div style={{ background: '#fff', fontFamily: 'Inter,system-ui,sans-serif', color: '#1A1A1A' }}>
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
        details { border: 1.5px solid #EEE; border-radius: 14px; overflow: hidden; transition: border-color 0.15s; }
        details[open] { border-color: rgba(200,0,106,0.3); }
        summary { list-style: none; cursor: pointer; padding: 18px 20px; font-size: 15px; font-weight: 700; color: #1A1A1A; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: '+'; font-size: 22px; font-weight: 400; color: #C8006A; flex-shrink: 0; line-height: 1; }
        details[open] summary::after { content: '−'; }
        details[open] summary { color: #C8006A; }
        .h-section { font-family: Georgia, serif; font-weight: 700; letter-spacing: -0.02em; color: #1A1A1A; }
        @media (max-width: 860px) {
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .calc-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr 1fr !important; }
          .test-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(200,0,106,0.08)', position: 'sticky', top: 0, zIndex: 100, height: 64 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ flexShrink: 0 }}><Logo height={34} /></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Sign in</Link>
            <Link href="/register?role=seller" className="cta" style={{ height: 42, padding: '0 20px', display: 'flex', alignItems: 'center', background: '#C8006A', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 4px 14px rgba(200,0,106,0.3)' }}>Start selling</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', position: 'relative', overflow: 'hidden', minHeight: '78vh', display: 'flex', alignItems: 'center' }}>
        <HeroVideoBg src="/videos/hero-seller.mp4" poster="/videos/hero-seller-poster.jpg" />
        <div className="fade-up" style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto', padding: '88px 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 100, padding: '6px 16px', marginBottom: 22 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>👩‍🍳 For home cooks</span>
          </div>
          <h1 className="h-section" style={{ fontSize: 'clamp(34px,5.5vw,62px)', color: '#fff', lineHeight: 1.06, marginBottom: 18 }}>Turn your cooking into income</h1>
          <p style={{ fontSize: 'clamp(16px,1.7vw,20px)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 32px' }}>Join meaLoyo and earn from your home kitchen. Keep <strong style={{ color: '#fff' }}>88% of every order</strong>.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?role=seller" className="cta" style={{ height: 54, padding: '0 32px', display: 'flex', alignItems: 'center', background: '#fff', color: '#C8006A', borderRadius: 13, fontSize: 16, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>Start selling today →</Link>
            <a href="#calculator" style={{ height: 54, padding: '0 28px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 13, fontSize: 16, fontWeight: 600 }}>See what you could earn</a>
          </div>
        </div>
      </section>

      {/* EARNINGS CALCULATOR */}
      <section id="calculator" style={{ padding: '80px 0', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Earnings calculator</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)', marginBottom: 12 }}>See what you could earn</h2>
            <p style={{ fontSize: 16, color: '#1A1A1A', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>Based on an average order of £{AVG_ORDER} and your 88% payout.</p>
          </div>
          <div className="calc-grid lift" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: '#fff', border: '1.5px solid rgba(200,0,106,0.14)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 6px 28px rgba(200,0,106,0.08)' }}>
            <div style={{ padding: '36px 32px' }}>
              <label htmlFor="orders" style={{ display: 'block', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>How many orders per week?</label>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 48, fontWeight: 700, color: '#C8006A', marginBottom: 18, letterSpacing: '-0.02em' }}>{orders}</div>
              <input id="orders" type="range" min={1} max={50} value={orders} onChange={e => setOrders(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#1A1A1A', fontWeight: 600, marginTop: 8, opacity: 0.7 }}><span>1</span><span>50+</span></div>
            </div>
            <div style={{ padding: '36px 32px', background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 100%)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Estimated weekly</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 700, lineHeight: 1 }}>£{weekly.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Estimated monthly</div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 700, lineHeight: 1 }}>£{monthly.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: '#1A1A1A', textAlign: 'center', marginTop: 16, opacity: 0.7 }}>Estimates only. Your actual earnings depend on your prices, menu and demand.</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 0', background: '#F8F0F4' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>How it works</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Selling in four simple steps</h2>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {steps.map(s => (
              <div key={s.n} className="lift" style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', border: '1.5px solid rgba(200,0,106,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{s.icon}</div>
                  <span style={{ fontFamily: 'Georgia,serif', fontSize: 30, fontWeight: 700, color: '#F0D9E7' }}>{s.n}</span>
                </div>
                <h3 className="h-section" style={{ fontSize: 18, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMISSION COMPARISON */}
      <section style={{ padding: '80px 0', background: '#fff' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>The fairest deal</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)', marginBottom: 12 }}>Keep more of what you earn</h2>
            <p style={{ fontSize: 16, color: '#1A1A1A', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>Commission rates compared to the major delivery apps.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {platforms.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16, background: p.highlight ? 'linear-gradient(135deg,#FFF0F8,#FFE8F4)' : '#fff', border: p.highlight ? '2px solid #C8006A' : '1.5px solid #EEE', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 130, fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 700, color: p.highlight ? '#C8006A' : '#1A1A1A' }}>{p.name}{p.highlight && <span style={{ marginLeft: 8, fontFamily: 'Inter', fontSize: 11, fontWeight: 700, background: '#C8006A', color: '#fff', padding: '2px 8px', borderRadius: 100, verticalAlign: 'middle' }}>BEST</span>}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ height: 12, borderRadius: 100, background: '#F0D9E7', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: p.highlight ? '24%' : p.name === 'Just Eat' ? '56%' : p.name === 'Uber Eats' ? '70%' : '90%', background: p.highlight ? 'linear-gradient(90deg,#C8006A,#8B0047)' : '#C9A3B8', borderRadius: 100 }} />
                  </div>
                </div>
                <div style={{ minWidth: 90, textAlign: 'right', fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: p.highlight ? '#C8006A' : '#1A1A1A' }}>{p.rate}</div>
                <div style={{ width: '100%', fontSize: 12.5, color: '#1A1A1A', opacity: 0.75 }}>{p.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section style={{ padding: '80px 0', background: '#F8F0F4' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>What you’ll need</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Requirements to start</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {requirements.map(r => (
              <div key={r.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1.5px solid rgba(200,0,106,0.08)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2DA84E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{r.title}</div>
                  <div style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6, opacity: 0.85 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '80px 0', background: '#fff' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Cook stories</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Loved by home cooks</h2>
          </div>
          <div className="test-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {testimonials.map(t => (
              <div key={t.name} className="lift" style={{ background: '#F8F0F4', borderRadius: 20, padding: '28px 26px', border: '1.5px solid rgba(200,0,106,0.08)' }}>
                <div style={{ fontSize: 22, color: '#C8006A', marginBottom: 12 }}>★★★★★</div>
                <p style={{ fontSize: 15, color: '#1A1A1A', lineHeight: 1.7, marginBottom: 20 }}>“{t.quote}”</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#FFE8F4,#FFF0F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{t.emoji}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: '#C8006A', fontWeight: 600 }}>{t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 0', background: '#F8F0F4' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8006A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>FAQ</div>
            <h2 className="h-section" style={{ fontSize: 'clamp(26px,3.4vw,42px)' }}>Seller questions, answered</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div style={{ padding: '0 20px 20px', fontSize: 14.5, color: '#1A1A1A', lineHeight: 1.8 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '88px 20px', background: 'linear-gradient(135deg,#C8006A 0%,#8B0047 55%,#5A002E 100%)', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 className="h-section" style={{ fontSize: 'clamp(28px,4vw,46px)', color: '#fff', marginBottom: 14 }}>Ready to start earning?</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, marginBottom: 30 }}>Set up your kitchen and publish your first dish today.</p>
          <Link href="/register?role=seller" className="cta" style={{ display: 'inline-flex', alignItems: 'center', height: 56, padding: '0 36px', background: '#fff', color: '#C8006A', borderRadius: 14, fontSize: 17, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>Start selling today →</Link>
        </div>
      </section>

      {/* SLIM FOOTER */}
      <footer style={{ background: '#1A1A1A', padding: '28px 20px', textAlign: 'center' }}>
        <Link href="/"><Logo height={28} white /></Link>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 12 }}>© 2026 meaLoyo · <Link href="/" style={{ color: 'rgba(255,255,255,0.75)' }}>Home</Link> · <Link href="/become-a-driver" style={{ color: 'rgba(255,255,255,0.75)' }}>Become a driver</Link> · <Link href="/seller-support" style={{ color: 'rgba(255,255,255,0.75)' }}>Seller support</Link></p>
      </footer>
    </div>
  )
}
