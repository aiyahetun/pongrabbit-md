/**
 * HTML 导出须内联 Mermaid SVG（策略 A）
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const app = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8')
const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8')
const exp = fs.readFileSync(path.join(root, 'src/renderer/export-preview-html.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')

let failed = 0
function check (n, c) {
  if (c) console.log('  ✓ ' + n)
  else { failed++; console.error('  ✗ ' + n) }
}

console.log('Self-check: export HTML mermaid inline\n')

check('export-preview-html loaded', /export-preview-html\.js/.test(html))
check('inlineMermaidSvgs', /function inlineMermaidSvgs/.test(exp))
check('mermaid-inline-export class', /mermaid-inline-export/.test(exp))
check('exportHtml waits mermaid', /exportHtml[\s\S]*?waitForMermaidIdle/.test(app))
check('exportHtml uses async export builder', /buildExportBodyHtmlAsync/.test(app))
check('markdownImageDataUrl preload', /markdownImageDataUrl/.test(fs.readFileSync(path.join(root, 'src/main/preload.js'), 'utf8')))
check('main accepts headExtra', /headExtra/.test(main))

if (failed) process.exit(1)
console.log('\nExport HTML mermaid checks passed')
