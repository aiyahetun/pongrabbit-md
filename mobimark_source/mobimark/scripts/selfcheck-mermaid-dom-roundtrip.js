/**
 * Markdown → marked → promote → 围栏收集 往返
 * 用法：node scripts/selfcheck-mermaid-dom-roundtrip.js
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const fixturesDir = path.join(root, 'fixtures/diagrams')
const RT = require(path.join(root, 'src/renderer/rich-md-roundtrip.js'))

let failed = 0
function check (name, cond) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

console.log('Self-check: mermaid DOM roundtrip\n')

const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.md'))
for (const file of files) {
  const md = fs.readFileSync(path.join(fixturesDir, file), 'utf8')
  const { ok, fencesIn, fencesOut } = RT.roundtripFencesFromMarkdown(md)
  check(file, ok)
  if (!ok) {
    console.error('    in:', JSON.stringify(fencesIn))
    console.error('    out:', JSON.stringify(fencesOut))
  }
}

if (failed) process.exit(1)
console.log('\nAll DOM roundtrip checks passed')
