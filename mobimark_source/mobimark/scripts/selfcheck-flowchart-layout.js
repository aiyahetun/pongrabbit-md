'use strict'

const path = require('path')
const layout = require(path.join(__dirname, '../src/renderer/flowchart-layout.js'))

let failed = 0
function check (n, c) {
  if (c) console.log('  ✓ ' + n)
  else { failed++; console.error('  ✗ ' + n) }
}

console.log('Self-check: flowchart layout\n')

const src = 'flowchart LR\n  A --> B'
const withLine = layout.injectLayoutLine(src, { nodes: { 'flowchart-A-0': { dx: 3, dy: -2 } } })
check('inject layout line', /%%\s*prabbit:layout\s+v1/.test(withLine))
const parsed = layout.parseLayout(withLine)
check('parse layout nodes', parsed.nodes && parsed.nodes['flowchart-A-0'].dx === 3)
const stripped = layout.stripLayoutLine(withLine)
check('strip layout', !/prabbit:layout/.test(stripped) && /A --> B/.test(stripped))

if (failed) process.exit(1)
console.log('\nFlowchart layout checks passed')
