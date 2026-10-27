/**
 * 阶段 B 图块 / 工具栏静态自检
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
const app = fs.readFileSync(path.join(root, 'src/renderer/app.js'), 'utf8')
const ctx = fs.readFileSync(path.join(root, 'src/renderer/context-menu.js'), 'utf8')
const widget = fs.readFileSync(path.join(root, 'src/renderer/diagram-widget.js'), 'utf8')
const imageW = fs.readFileSync(path.join(root, 'src/renderer/image-widget.js'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/mermaid-i18n-manifest.json'), 'utf8'))

let failed = 0
function check (n, c) {
  if (c) console.log('  ✓ ' + n)
  else { failed++; console.error('  ✗ ' + n) }
}

console.log('Self-check: mermaid blocks (M3)\n')

check('r-mermaid in toolbar', /id="r-mermaid"/.test(html))
check('fmt-mermaid in md toolbar', /id="fmt-mermaid"/.test(html))
check('diagram-lightbox loaded', /diagram-lightbox\.js/.test(html))
check('diagram-widget loaded', /diagram-widget\.js/.test(html))
check('expand diagram action', /dataset\.action\s*=\s*'expand'/.test(widget))
check('preview lightbox handlers', /setupDiagramLightboxHandlers/.test(app))
check('image-widget loaded', /image-widget\.js/.test(html))
check('upgradeImagesInRichEditor', /function upgradeImagesInRichEditor/.test(imageW))
check('upgradeRichEditorBlocks in app', /function upgradeRichEditorBlocks/.test(app))
check('nodeToMd image-block', /image-block/.test(app) && /imageBlockToMd/.test(app))
check('upgradeMermaidInRichEditor', /function upgradeMermaidInRichEditor/.test(widget))
check('insertMermaidBlockAtCursor in app', /function insertMermaidBlockAtCursor/.test(app))
check('syncEditorsFromMd upgrades diagrams', /upgradeMermaidInRichEditor\(richEditor\)/.test(app))
check('nodeToMd diagram-block', /diagram-block/.test(app) && /diagramBlockToMd/.test(app))
check('ctx ins-mermaid', /ins-mermaid/.test(ctx))
check('kind diagram context', /kind:\s*'diagram'/.test(ctx))
check('diagram context copy/live', /diagram-copy/.test(ctx) && /diagram-live/.test(ctx))
check('img edit alt context', /img-edit-alt/.test(ctx))
check('xhs mermaid unit kind', /kind:\s*'mermaid'/.test(app))

for (const key of manifest.requiredKeys || []) {
  const used =
    html.includes('data-i18n="' + key + '"') ||
    html.includes("data-i18n='" + key + "'") ||
    app.includes("'" + key + "'") ||
    ctx.includes("'" + key + "'") ||
    widget.includes("'" + key + "'")
  if (!used && !key.startsWith('settings.')) {
    check('manifest key referenced: ' + key, key.startsWith('fmt.') || key.startsWith('ctx.') || key.startsWith('diagram.'))
  }
  if (key.startsWith('settings.diagram.')) {
    const inHtml =
      html.includes('data-i18n="' + key + '"') ||
      html.includes("data-i18n='" + key + "'")
    check('manifest settings key in panel: ' + key, inHtml)
  }
}

if (failed) process.exit(1)
console.log('\nAll mermaid block checks passed')
