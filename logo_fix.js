const fs = require('fs')

let content = fs.readFileSync('src/app/page.tsx', 'utf8')

// Replace LogoMark component usage in hero badge with just the logo image
content = content.replace(
  `<LogoMark size={22}/>`,
  `<img src="/Color_Logo.png" alt="meaLoyo" style={{height:22, width:'auto'}}/>`
)

// Replace Logo component in nav
content = content.replace(
  `<Logo size={38}/>`,
  `<img src="/Color_Logo.png" alt="meaLoyo" style={{height:38, width:'auto'}}/>`
)

// Replace Logo in CTA section
content = content.replace(
  `<Logo size={48}/>`,
  `<img src="/White_Logo.png" alt="meaLoyo" style={{height:48, width:'auto'}}/>`
)

// Replace Logo in footer
content = content.replace(
  `<Logo size={34}/>`,
  `<img src="/White_Logo.png" alt="meaLoyo" style={{height:34, width:'auto'}}/>`
)

// Remove old Logo and LogoMark component definitions entirely
content = content.replace(
  /\/\/ meaLoyo SVG logo mark[\s\S]*?\/\/ Full inline logo with wordmark\nconst Logo[\s\S]*?\)\n\nexport default/,
  'export default'
)

// Also remove just the Logo const if above pattern didnt match
content = content.replace(
  /\/\/ ── REAL PNG LOGOS ──\nconst Logo[\s\S]*?\}\)\n/,
  ''
)

// Remove any remaining LogoMark usage
content = content.replace(/<LogoMark[^\/]*\/>/g, '')

fs.writeFileSync('src/app/page.tsx', content)
console.log('DONE — all logo references fixed')