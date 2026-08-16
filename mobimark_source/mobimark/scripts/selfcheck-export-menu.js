/**
 * 自检：顶栏导出菜单不被 overflow 裁切；导出风格对话框不被层叠规则压住
 * 用法：node scripts/selfcheck-export-menu.js
 */
const fs = require('fs')
const path = require('path')

const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/app.js'), 'utf8')
const cssSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/style.css'), 'utf8')
const htmlSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8')

let failed = 0
function check (name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
  else {
    failed++
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

console.log('Self-check: export menu visibility\n')

check('export trigger exists', /id="btn-export-menu"/.test(htmlSrc))
check('export menu exists', /id="export-menu"/.test(htmlSrc))
check('xhs style dialog exists', /id="xhs-style-dialog"[\s\S]*class="dialog"/.test(htmlSrc))

check('export menu is position:fixed', /\.export-menu\{[^}]*position:fixed/.test(cssSrc.replace(/\s+/g, '')))
check('export menu z-index >= 180', /\.export-menu\{[^}]*z-index:180/.test(cssSrc.replace(/\s+/g, '')))
check('export menu is not position:absolute under trigger', !/\.export-menu\{[^}]*position:absolute/.test(cssSrc.replace(/\s+/g, '')))

const liftRe = /body\.theme-light > \*:not\([^)]+\)/
const lift = (cssSrc.match(/body\.theme-light > \*:[^\n{]+/) || [''])[0]
check('layer-lift excludes .dialog', lift.includes(':not(.dialog)'), lift)
check('layer-lift excludes #export-menu', lift.includes(':not(#export-menu)'), lift)
check('layer-lift still excludes overlay chrome',
  lift.includes('#bg-layer') && lift.includes('#glass-overlay') && lift.includes('#panel-mask'))

check('setupExportMenu portals to body', /document\.body\.appendChild\(menu\)/.test(appSrc))
check('setupExportMenu positions from trigger rect', /getBoundingClientRect\(\)/.test(appSrc) && /r\.bottom/.test(appSrc))
check('exportHtml refreshes preview first', /async function exportHtml\(\)\{[\s\S]*?await renderPreview\(\)/.test(appSrc))
check('exportPdf refreshes preview first', /async function exportPdf\(\)\{[\s\S]*?await renderPreview\(\)/.test(appSrc))

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll export-menu checks passed')
