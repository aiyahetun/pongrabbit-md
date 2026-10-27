/**
 * Mermaid 冒烟：Node 下用 jsdom + mermaid 包渲染最小图。
 * SKIP_MERMAID_SMOKE=1 时跳过。
 */
'use strict'

if (process.env.SKIP_MERMAID_SMOKE === '1') {
  console.log('SKIP_MERMAID_SMOKE=1 — skipped')
  process.exit(0)
}

const { JSDOM } = require('jsdom')
const path = require('path')

async function main () {
  const mermaid = await import('mermaid')
  mermaid.default.initialize({ startOnLoad: false, securityLevel: 'strict' })
  const dom = new JSDOM('<!DOCTYPE html><body><div class="mermaid">flowchart LR\n  A-->B</div></body></html>')
  global.document = dom.window.document
  global.window = dom.window
  const node = dom.window.document.querySelector('.mermaid')
  await mermaid.default.run({ nodes: [node], suppressErrors: true })
  if (!node.querySelector('svg')) {
    console.error('smoke: no svg rendered')
    process.exit(1)
  }
  console.log('smoke-mermaid-render: ok')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
