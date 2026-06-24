const fs = require('fs')
const path = require('path')

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('✓', filePath)
}

// ── GLOBALS CSS ───────────────────────────────────────
write('src/app/globals.css', `@import 'tailwindcss';
:root {
  --brand: #C8006A;
  --brand-dark: #A00055;
  --brand-light: #FFE8F4;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
html { scroll-behavior: smooth; }
::-webkit-scrollbar { width: 0; height: 0; }
* { scrollbar-width: none; -ms-overflow-style: none; }
body { font-family: Inter, system-ui, sans-serif; background: #fff; color: #1A1A1A; }
a { text-decoration: none; color: inherit; }
button { font-family: Inter, system-ui, sans-serif; cursor: pointer; }
input, select, textarea { font-family: Inter, system-ui, sans-serif; }
`)

// ── LAYOUT ────────────────────────────────────────────
write('src/app/layout.tsx', `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'meaLoyo — Home cooked food, delivered',
  description: 'Order authentic home cooked food from verified home cooks across the UK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`)

// ── SUPABASE CLIENT ──────────────────────────────────
write('src/lib/supabase.ts', `import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
`)

// ── MIDDLEWARE ────────────────────────────────────────
write('middleware.ts', `import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const protectedRoutes = ['/buyer', '/seller/dashboard', '/seller/listings', '/seller/orders', '/seller/earnings', '/driver/dashboard', '/admin']
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  if (isProtected && !user) return NextResponse.redirect(new URL('/login', request.url))
  if (path.startsWith('/admin') && !path.startsWith('/admin/login') && !user) return NextResponse.redirect(new URL('/admin/login', request.url))
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
`)

// ── PENDING PAGE ──────────────────────────────────────
write('src/app/pending/page.tsx', `import Link from 'next/link'
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
`)

// ── ADMIN LOGIN ───────────────────────────────────────
write('src/app/(admin)/admin/login/page.tsx', `'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Invalid credentials'); setLoading(false); return }
    if (data.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      if (profile?.role !== 'admin') { await supabase.auth.signOut(); setError('Access denied. Admin only.'); setLoading(false); return }
      router.push('/admin/dashboard')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1A1A1A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{\`*{box-sizing:border-box;margin:0;padding:0;} input:focus{border-color:#C8006A !important;outline:none;}\`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
        <div style={{ width:40, height:40, background:'#C8006A', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔐</div>
        <span style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#C8006A' }}>meaLoyo Admin</span>
      </div>
      <div style={{ background:'#2A2A2A', borderRadius:20, padding:'36px', width:'100%', maxWidth:380, border:'1px solid rgba(200,0,106,0.2)' }}>
        <h1 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#fff', marginBottom:6 }}>Admin access</h1>
        <p style={{ fontSize:13, color:'#888', marginBottom:24 }}>Restricted to authorised administrators only</p>
        {error && <div style={{ background:'rgba(200,0,106,0.15)', border:'1px solid rgba(200,0,106,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#FF69B4', fontWeight:600 }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[{label:'Email',val:email,set:setEmail,type:'email',ph:'Admin email'},{label:'Password',val:password,set:setPassword,type:'password',ph:'Admin password'}].map(f => (
            <div key={f.label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required style={{ height:46, border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'0 14px', fontSize:14, color:'#fff', background:'rgba(255,255,255,0.06)', width:'100%' }}/>
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ height:50, background:'#C8006A', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', marginTop:6, opacity:loading?0.8:1 }}>
            {loading ? 'Verifying...' : 'Access admin panel →'}
          </button>
        </form>
      </div>
      <p style={{ marginTop:20, fontSize:12, color:'rgba(255,255,255,0.2)' }}>This page is not publicly accessible</p>
    </div>
  )
}
`)

console.log('\n✅ Part 1 done — core files created')
