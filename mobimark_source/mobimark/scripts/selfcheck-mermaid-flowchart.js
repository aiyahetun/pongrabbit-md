/**
 * 阶段 C 静态自检（mermaid.live + 设置 + 画布占位模块）
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
const app = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8')
const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8')
const live = fs.readFileSync(path.join(root, 'src/renderer/mermaid-live.js'), 'utf8')
const flow = fs.readFileSync(path.join(root, 'src/renderer/flowchart-editor.js'), 'utf8')
const layout = fs.readFileSync(path.join(root, 'src/renderer/flowchart-layout.js'), 'utf8')
const widget = fs.readFileSync(path.join(root, 'src/renderer/diagram-widget.js'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/mermaid-i18n-manifest.json'), 'utf8'))

let failed = 0
function check (n, c) {
  if (c) console.log('  ✓ ' + n)
  else { failed++; console.error('  ✗ ' + n) }
}

console.log('Self-check: mermaid flowchart (C)\n')

check('mermaid-live.js loaded', /mermaid-live\.js/.test(html))
check('flowchart-editor.js loaded', /flowchart-editor\.js/.test(html))
check('MERMAID_LIVE_EDIT constant', /MERMAID_LIVE_EDIT\s*=\s*['"]https:\/\/mermaid\.live\/edit['"]/.test(live))
check('no api key in live module', !/api[_-]?key/i.test(live))
check('flowchart-layout loaded', /flowchart-layout\.js/.test(html))
check('prabbit layout marker', /prabbit:layout/.test(layout))
check('openFlowchartEditor export', /function openFlowchartEditor/.test(flow))
check('openFlowchartCanvas export', /function openFlowchartCanvas/.test(flow))
check('widget canvas action', /data-action="canvas"/.test(widget))
check('mermaid-runtime apply layout', /applyFlowchartLayoutsIn/.test(fs.readFileSync(path.join(root, 'src/renderer/mermaid-runtime.js'), 'utf8')))
check('diagram prefs getter', /pongrabbitDiagramPrefs/.test(app))
check('defaultConfig diagramOpenInLive', /diagramOpenInLive/.test(main))
check('defaultConfig diagramFlowchartWysiwyg', /diagramFlowchartWysiwyg/.test(main))
check('settings toggles in html', /diagram-open-in-live-toggle/.test(html) && /diagram-flowchart-wysiwyg-toggle/.test(html))
check('widget open-live action', /data-action="live"/.test(widget))

for (const key of manifest.requiredKeys || []) {
  if (!key.startsWith('settings.diagram.')) continue
  const inHtml =
    html.includes('data-i18n="' + key + '"') ||
    html.includes("data-i18n='" + key + "'")
  check('settings i18n in panel: ' + key, inHtml)
}

if (failed) process.exit(1)
console.log('\nAll mermaid flowchart checks passed')
