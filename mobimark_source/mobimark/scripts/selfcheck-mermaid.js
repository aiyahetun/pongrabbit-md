/**
 * Mermaid M1 静态自检
 * 用法：node scripts/selfcheck-mermaid.js
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const appSrc = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8')
const htmlSrc = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
const cssSrc = fs.readFileSync(path.join(root, 'src/renderer/style.css'), 'utf8')
const runtimeSrc = fs.readFileSync(path.join(root, 'src/renderer/mermaid-runtime.js'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

let failed = 0
function check (name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
  else {
    failed++
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

console.log('Self-check: mermaid (static)\n')

check('package.json depends on mermaid', !!(pkg.dependencies && pkg.dependencies.mermaid))
check('mermaid.bundle.js exists', fs.existsSync(path.join(root, 'src/renderer/vendor/mermaid.bundle.js')))
check('index loads mermaid bundle', /vendor\/mermaid\.bundle\.js/.test(htmlSrc))
check('fence-blocks before mermaid bundle in html', htmlSrc.indexOf('fence-blocks.js') < htmlSrc.indexOf('mermaid.bundle.js'))
check('mermaid bundle before app.js', htmlSrc.indexOf('mermaid.bundle.js') < htmlSrc.indexOf('app.js'))
check('index loads fence-blocks', /fence-blocks\.js/.test(htmlSrc))
check('index loads mermaid-runtime', /mermaid-runtime\.js/.test(htmlSrc))
check('renderMermaidIn defined', /function renderMermaidIn/.test(runtimeSrc))
check('applyMarkedHtmlPipeline in app.js', /async function applyMarkedHtmlPipeline/.test(appSrc))
check('renderPreview uses pipeline', /applyMarkedHtmlPipeline\(previewEl/.test(appSrc))
check('mdFragmentToExportableHtml uses pipeline', /applyMarkedHtmlPipeline\(wrap/.test(appSrc))
const pipelineBlock = appSrc.match(/async function applyMarkedHtmlPipeline[\s\S]*?return !isPreviewRenderStale/)
check('promote before hljs in pipeline',
  pipelineBlock &&
  pipelineBlock[0].indexOf('promoteMermaidFencesInElement') < pipelineBlock[0].indexOf('hljsAPI'))
check('securityLevel strict', /securityLevel:\s*['"]strict['"]/.test(runtimeSrc))
check('nodeToMd preserves fence lang', /case 'pre':\{[\s\S]*language-\(\[\\w-\]\+\)/.test(appSrc))
check('beginPreviewRender / isPreviewRenderStale', /function beginPreviewRender/.test(appSrc) && /function isPreviewRenderStale/.test(appSrc))
check('exportPdf waits mermaid idle', /waitForMermaidIdle/.test(appSrc))
check('print css for mermaid', /@media print[\s\S]*\.mermaid/.test(cssSrc))
check('attachCodeBlockCopyButtons skips mermaid', /mermaid'\) return/.test(appSrc))
check('exportHtml inline mermaid helper', /buildExportBodyHtml|inlineMermaidSvgs/.test(fs.readFileSync(path.join(root, 'src/renderer/export-preview-html.js'), 'utf8')))
check('exportHtml waits mermaid idle', /async function exportHtml\(\)[\s\S]*?waitForMermaidIdle/.test(appSrc))
check('release runs selfcheck-mermaid', /selfcheck-mermaid\.js/.test(fs.readFileSync(path.join(root, 'scripts/release.js'), 'utf8')))

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll mermaid static checks passed')
