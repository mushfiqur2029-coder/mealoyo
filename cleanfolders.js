const fs = require('fs')
const path = require('path')

// Remove the conflicting empty dashboard folders
const toRemove = [
  'src/app/(admin)/dashboard',
  'src/app/(seller)/dashboard',
  'src/app/(driver)/dashboard',
]

toRemove.forEach(folder => {
  try {
    // Remove page.tsx inside if exists
    const pageFile = path.join(folder, 'page.tsx')
    if (fs.existsSync(pageFile)) {
      fs.unlinkSync(pageFile)
      console.log('Removed file:', pageFile)
    }
    // Remove the folder itself
    fs.rmdirSync(folder)
    console.log('Removed folder:', folder)
  } catch(e) {
    console.log('Could not remove:', folder, e.message)
  }
})

// Verify structure is clean
console.log('\nFinal structure check:')
const walk = (dir, indent = '') => {
  try {
    const items = fs.readdirSync(dir)
    items.forEach(item => {
      const full = path.join(dir, item)
      const stat = fs.statSync(full)
      console.log(indent + (stat.isDirectory() ? '📁 ' : '📄 ') + item)
      if (stat.isDirectory()) walk(full, indent + '  ')
    })
  } catch(e) {}
}
walk('src/app')
console.log('\nDone — run npm run dev now')