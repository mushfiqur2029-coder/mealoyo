const fs = require('fs')

let content = fs.readFileSync('src/app/(seller)/seller/listings/new/page.tsx', 'utf8')

// Fix the sel style — remove the problematic SVG arrow, use simple styling instead
content = content.replace(
  /const sel = \{\.\.\.inp,appearance:'none' as const,backgroundImage:.*?paddingRight:36\}/s,
  `const sel = {...inp, appearance:'none' as const, paddingRight:36}`
)

fs.writeFileSync('src/app/(seller)/seller/listings/new/page.tsx', content)
console.log('Fixed — refresh browser')