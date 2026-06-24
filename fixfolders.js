const fs = require('fs')
const path = require('path')

// Create all missing directories
const dirs = [
  'src/app/(seller)/seller/listings',
  'src/app/(seller)/seller/listings/new',
  'src/app/(buyer)/buyer/dashboard',
  'src/app/(seller)/seller/dashboard',
  'src/app/(driver)/driver/dashboard',
  'src/app/(admin)/admin/dashboard',
  'src/app/(admin)/admin/login',
  'src/app/pending',
]

dirs.forEach(d => {
  fs.mkdirSync(d, { recursive: true })
  console.log('Created:', d)
})

// Check what exists
console.log('\nChecking src/app structure:')
const walk = (dir, indent = '') => {
  try {
    const items = fs.readdirSync(dir)
    items.forEach(item => {
      const full = path.join(dir, item)
      const stat = fs.statSync(full)
      console.log(indent + (stat.isDirectory() ? '📁 ' : '📄 ') + item)
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walk(full, indent + '  ')
      }
    })
  } catch(e) {}
}
walk('src/app')
console.log('\nDone')