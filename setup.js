const fs = require('fs')
const path = require('path')

// globals.css
fs.writeFileSync('src/app/globals.css', `
@import 'tailwindcss';
:root {
  --brand: #C8006A;
  --brand-dark: #A00055;
  --brand-light: #FFE8F4;
  --brand-hero: #0D0006;
  --ink: #1A1A1A;
  --mid: #575757;
  --muted: #8C8C8C;
  --rule: #E8E8E8;
  --bg: #F8F8F6;
  --success: #2DA84E;
  --info: #1A6ECC;
  --warning: #E8930A;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, system-ui, sans-serif; background: var(--bg); color: var(--ink); }
`)
console.log('globals.css done')

// tailwind config
fs.writeFileSync('tailwind.config.ts', `
import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#C8006A',
          dark: '#A00055',
          light: '#FFE8F4',
          hero: '#0D0006',
        },
        ink: '#1A1A1A',
        mid: '#575757',
        muted: '#8C8C8C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.06)',
        modal: '0 8px 32px rgba(0,0,0,0.16)',
      },
    },
  },
  plugins: [],
}
export default config
`)
console.log('tailwind.config.ts done')

// env.local
fs.writeFileSync('.env.local', `
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
`)
console.log('env.local done')

console.log('ALL FILES CREATED SUCCESSFULLY')