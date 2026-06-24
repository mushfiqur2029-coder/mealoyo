const fs = require('fs')

const content = fs.readFileSync('src/app/page.tsx', 'utf8')

const newContent = content
  // Replace Logo component and LogoMark component with real PNG versions
  .replace(
    /\/\/ meaLoyo SVG logo mark[\s\S]*?\/\/ Full inline logo with wordmark\nconst Logo = \(\{size=36\}:\{size\?:number\}\) => \([\s\S]*?\)\n/,
    `
// ── REAL PNG LOGOS ──
const Logo = ({height=38, white=false}:{height?:number, white?:boolean}) => (
  <img
    src={white ? '/White_Logo.png' : '/Color_Logo.png'}
    alt="meaLoyo"
    style={{height, width:'auto', objectFit:'contain', display:'block'}}
  />
)
`
  )

fs.writeFileSync('src/app/page.tsx', newContent)
console.log('Logo updated — checking...')

// Verify
const check = fs.readFileSync('src/app/page.tsx', 'utf8')
if (check.includes('Color_Logo.png')) {
  console.log('SUCCESS — real PNG logos applied')
} else {
  console.log('Pattern not matched — applying manual replacement')
}