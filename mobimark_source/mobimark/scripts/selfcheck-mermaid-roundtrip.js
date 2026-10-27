/**
 * fence-blocks 逻辑自检
 * 用法：node scripts/selfcheck-mermaid-roundtrip.js
 */
'use strict'

const path = require('path')
const FB = require(path.join(__dirname, '../src/renderer/fence-blocks.js'))

let failed = 0
function check (name, cond) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

console.log('Self-check: mermaid fence-blocks\n')

const md = '```mermaid\nflowchart LR\n  A --> B\n```\n\n```js\nx()\n```'
const fences = FB.extractFences(md)
check('extractFences count', fences.length === 2)
check('mermaid lang', fences[0].lang === 'mermaid')
check('js lang', fences[1].lang === 'js')

const md2 = '```mermaid\nstateDiagram-v2\n  [*] --> S\n```'
check('fencesEquivalent identity', FB.fencesEquivalent(FB.extractFences(md2), FB.extractFences(md2)))

if (failed) process.exit(1)
console.log('\nAll fence-blocks checks passed')
