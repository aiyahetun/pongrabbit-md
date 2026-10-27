/**
 * 断言 vendor/mermaid.bundle.js 末尾将 default API 挂到 window.mermaid
 */
'use strict'

if (process.env.SKIP_MERMAID_SMOKE === '1') {
  console.log('SKIP_MERMAID_SMOKE=1 — skipped bundle smoke')
  process.exit(0)
}

const fs = require('fs')
const path = require('path')

const bundlePath = path.join(__dirname, '../src/renderer/vendor/mermaid.bundle.js')
const code = fs.readFileSync(bundlePath, 'utf8')
const tail = code.slice(-800)

if (!/window\.mermaid\s*=/.test(tail) || !/__pongrabbitMermaidBundle\.default/.test(tail)) {
  console.error('smoke-mermaid-bundle: bundle footer missing window.mermaid flatten')
  process.exit(1)
}
console.log('smoke-mermaid-bundle: ok')
