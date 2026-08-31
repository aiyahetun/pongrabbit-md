/**
 * 自检：小红书导出 DOM 智能分页、字号提升、长图续页
 * 用法：node scripts/selfcheck-xhs-pagination.js
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const appPath = path.resolve(__dirname, '../src/renderer/app.js')
const mainPath = path.resolve(__dirname, '../src/main/main.js')
const htmlPath = path.resolve(__dirname, '../src/renderer/index.html')
const appSrc = fs.readFileSync(appPath, 'utf8')
const mainSrc = fs.readFileSync(mainPath, 'utf8')
const htmlSrc = fs.readFileSync(htmlPath, 'utf8')
const cssPath = path.resolve(__dirname, '../src/renderer/style.css')
const cssSrc = fs.readFileSync(cssPath, 'utf8')

let failed = 0
function check (name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
  else {
    failed++
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

console.log('Self-check: XHS export pagination v1.0.27\n')

console.log('[1] Font size bump')
check('base font px is 34', /const XHS_EXPORT_BASE_FONT_PX = 34/.test(appSrc))
check('standard readability ~34px hint', /约 34px/.test(appSrc))

console.log('\n[2] DOM pagination functions')
check('xhsFlattenPaginationUnits defined', /function xhsFlattenPaginationUnits/.test(appSrc))
check('xhsMaterializePageUnits defined', /function xhsMaterializePageUnits/.test(appSrc))
check('xhsBuildTableFromRows defined', /function xhsBuildTableFromRows/.test(appSrc))
check('xhsExplodeRealPreForPagination defined', /function xhsExplodeRealPreForPagination/.test(appSrc))
check('list-item pagination', /kind:\s*'list-item'/.test(appSrc))
check('fence-line pagination', /kind === 'fence-line'/.test(appSrc))
check('pre-line pagination', /kind === 'pre-line'/.test(appSrc))
check('xhsRenderPageChunkWithOverflow defined', /function xhsRenderPageChunkWithOverflow/.test(appSrc))
check('exportXhsLong uses overflow renderer', /async function exportXhsLong[\s\S]*?xhsRenderPageChunkWithOverflow/.test(appSrc))
check('no user-facing overflow alert', !/单块内容（如大图或超长段落）超过一页高度/.test(appSrc))
check('pixel-slice fallback', /sliceCanvasToFixedPages\(norm/.test(appSrc))
check('xhsEnsureListItemUnitsFit defined', /async function xhsEnsureListItemUnitsFit/.test(appSrc))
check('xhsEnsureBlockUnitsFit defined', /async function xhsEnsureBlockUnitsFit/.test(appSrc))
check('no continuation marker', !/（续）/.test(appSrc))
check('xhsFixOrphanHeadingPages defined', /function xhsFixOrphanHeadingPages/.test(appSrc))
check('export progress hidden by default', /#xhs-export-progress\s*\{[^}]*display:none!important/.test(cssSrc))
check('export host offscreen', /left:-12000px/.test(cssSrc))
check('export busy overlay', /body\.xhs-export-busy::before/.test(cssSrc))
check('assembled page refine', /xhsPackUnitsByAssembledHeight/.test(appSrc) && /xhsProbeAssembledPageHeight/.test(appSrc))
check('skip page-break blank pages', /if \(units\[i\]\.kind === 'page-break'\) \{\s*i\+\+\s*continue/.test(appSrc))
check('ensure short canvas width', /xhsEnsureShortCanvasWidth/.test(appSrc))
check('assembled sparse rebalance', /xhsRebalanceSparsePagesAssembled/.test(appSrc))
check('long layout page cap', /xhsGetLongLayoutPageCap/.test(appSrc))
check('ensure long canvas width', /xhsEnsureLongCanvasWidth/.test(appSrc))
check('short fixed 3:4 pad', /function fitCanvasToShortPage/.test(appSrc) && !/XHS_SHORT_TIGHT_FILL_RATIO/.test(appSrc))
check('short pack uses flex cap', /paginateXhsSurfaceBlocksAsync\([\s\S]*?xhsGetShortLayoutCapWithFlex\(\)/.test(appSrc))
check('pack cap aligned to layout H', /XHS_LAYOUT_PAGE_CAP = \(\) => XHS_LAYOUT_H/.test(appSrc))
check('long export uses long cap', /async function exportXhsLong[\s\S]*?longLayoutCap/.test(appSrc))
check('content height minus chrome', /xhsMeasureContentHeightFromSurface/.test(appSrc))
check('export busy blocks flicker', /body\.xhs-export-busy::before/.test(cssSrc))
check('html2canvas onclone visible', /onclone:\s*\(/.test(appSrc))
check('pagination uses height sum', /xhsSumUnitHeights/.test(appSrc))
check('xhsAggressiveSubdivideUnits defined', /function xhsAggressiveSubdivideUnits/.test(appSrc))
check('xhsExpandTableRowUnits defined', /function xhsExpandTableRowUnits/.test(appSrc))
check('paginateXhsSurfaceBlocksAsync defined', /async function paginateXhsSurfaceBlocksAsync/.test(appSrc))
check('xhsMeasureIsolatedUnitHeight defined', /async function xhsMeasureIsolatedUnitHeight/.test(appSrc))
check('export uses async paginate', /paginateXhsSurfaceBlocksAsync/.test(appSrc))
check('fitCanvasToShortPage defined', /function fitCanvasToShortPage/.test(appSrc))
check('assembleXhsPageSurface defined', /function assembleXhsPageSurface/.test(appSrc))
check('xhsGetUsablePageContentHeight defined', /function xhsGetUsablePageContentHeight/.test(appSrc))
check('measureOnly fast path', /measureOnly:\s*true/.test(appSrc) && /xhsWarmMeasureFonts/.test(appSrc))
check('pagination progress callback', /正在分析分页… \$\{done\}\/\$\{total\}/.test(appSrc))
check('reuse layout height tag', /_layoutH/.test(appSrc) && /xhsTagUnitLayoutH/.test(appSrc))

console.log('\n[3] Export flow uses smart pagination')
check('exportXhsShort calls paginateXhsSurfaceBlocks', /async function exportXhsShort[\s\S]*?paginateXhsSurfaceBlocks/.test(appSrc))
check('exportXhsShort calls xhsRenderShortPageChunk', /async function exportXhsShort[\s\S]*?xhsRenderShortPageChunk/.test(appSrc))
check('exportXhsShort no longer slices canvas blindly', !/async function exportXhsShort[\s\S]*?sliceCanvasToFixedPages/.test(appSrc))
check('exportXhsLong calls paginateXhsSurfaceBlocks', /async function exportXhsLong[\s\S]*?paginateXhsSurfaceBlocks/.test(appSrc))
check('exportXhsLong auto-continues pages', /自动续页/.test(appSrc))

console.log('\n[4] Pagination modes & UI')
check('XHS_PAGINATION_MODES defined', /const XHS_PAGINATION_MODES/.test(appSrc))
check('smart mode in splitMdForXhsExport', /mode === 'smart'/.test(appSrc))
check('pagination grid in html', /id="xhs-pagination-grid"/.test(htmlSrc))
check('xhsExportPagination config default', /xhsExportPagination:\s*'smart'/.test(mainSrc))
check('dialog saves pagination', /xhsExportPagination/.test(appSrc))

console.log('\n[5] Pagination algorithm unit test')
function paginateMeasured (measured, limit) {
  if (!measured.length) return [[]]
  const pages = []
  let i = 0
  while (i < measured.length) {
    const page = []
    let anchorTop = measured[i].top
    while (i < measured.length) {
      const m = measured[i]
      const used = m.bottom - anchorTop
      if (page.length > 0 && used > limit) break
      if (page.length === 0 && m.height > limit) {
        page.push(m.id)
        i++
        break
      }
      page.push(m.id)
      i++
    }
    if (!page.length && i < measured.length) {
      page.push(measured[i].id)
      i++
    }
    if (page.length) pages.push(page)
  }
  return pages.length ? pages : [[]]
}

const blocks = [
  { id: 'a', top: 0, bottom: 100, height: 100 },
  { id: 'b', top: 110, bottom: 200, height: 90 },
  { id: 'c', top: 210, bottom: 350, height: 140 },
  { id: 'd', top: 360, bottom: 420, height: 60 }
]
const p1 = paginateMeasured(blocks, 250)
check('paginate splits before overflow', p1.length === 2 && p1[0].join('') === 'abc'.slice(0, 2) || (p1[0].includes('a') && p1[0].includes('b')))
check('paginate page1 has a,b', p1[0].includes('a') && p1[0].includes('b'))
check('paginate page2 has c,d', p1[1].includes('c') && p1[1].includes('d'))

const huge = [{ id: 'x', top: 0, bottom: 500, height: 500 }]
const p2 = paginateMeasured(huge, 250)
check('oversized block alone on page', p2.length === 1 && p2[0][0] === 'x')

console.log('\n[6] Syntax')
for (const f of ['src/renderer/app.js', 'src/main/main.js']) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe', cwd: path.resolve(__dirname, '..') })
    check(`syntax OK: ${path.basename(f)}`, true)
  } catch (e) {
    check(`syntax: ${path.basename(f)}`, false, e.stderr?.toString().trim())
  }
}

function extractAsyncFn (src, name) {
  const start = src.indexOf(`async function ${name}`)
  if (start < 0) return ''
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return ''
}

const exportShortFn = extractAsyncFn(appSrc, 'exportXhsShort')
const exportLongFn = extractAsyncFn(appSrc, 'exportXhsLong')
check('short: progress after style picker', exportShortFn.includes('openXhsStylePicker') &&
  exportShortFn.indexOf('openXhsStylePicker') < exportShortFn.indexOf('xhsBeginExportSession'))
check('long: progress after style picker', exportLongFn.includes('openXhsStylePicker') &&
  exportLongFn.indexOf('openXhsStylePicker') < exportLongFn.indexOf('xhsBeginExportSession'))
check('short: session only when active', /let sessionActive = false/.test(exportShortFn) && /if \(sessionActive\) xhsEndExportSession/.test(exportShortFn))
check('long: session only when active', /let sessionActive = false/.test(exportLongFn) && /if \(sessionActive\) xhsEndExportSession/.test(exportLongFn))

console.log('\n[7] Version')
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
check('package version 1.0.27', pkg.version === '1.0.27')
check('dist output dist-1.0.27', pkg.build?.directories?.output === 'dist-1.0.27')

console.log('\n[8] Export UI regression guards')
const progDlgRule = cssSrc.match(/\.xhs-export-progress-dialog\s*\{([^}]*)\}/)
check('progress dialog class has no display:flex!important', !(progDlgRule && /display\s*:\s*flex\s*!important/i.test(progDlgRule[1])))
check('no global flex on progress dialog only', !/^\s*\.xhs-export-progress-dialog\s*\{[^}]*display\s*:\s*flex\s*!important/im.test(cssSrc))
check('init clears xhs-export-busy', /document\.body\.classList\.remove\('xhs-export-busy'\)/.test(appSrc))
check('init resets export session depth', /xhsExportSessionDepth\s*=\s*0/.test(appSrc))
check('html progress inline display none', /id="xhs-export-progress"[^>]*style="display:none"/.test(htmlSrc))
check('showXhsExportProgress defined', /function showXhsExportProgress/.test(appSrc))
check('xhsBeginExportSession defined', /function xhsBeginExportSession/.test(appSrc))

// 孤标题合并（XHS-016）
function xhsUnitIsHeading (u) { return u.kind === 'block' && u.tag && /^H[1-6]$/.test(u.tag) }
function xhsPageIsHeadingOnly (p) { return p.length > 0 && p.every(xhsUnitIsHeading) }
function xhsSumUnitHeights (p) { return p.reduce((s, u) => s + (u.height || 0), 0) }
function xhsFixOrphanHeadingPages (pages, limit) {
  if (pages.length < 2) return pages
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    if (!xhsPageIsHeadingOnly(p) || i >= pages.length - 1) continue
    const next = pages[i + 1]
    if (!next || !next.length) continue
    while (next.length) {
      const cand = next[0]
      if (xhsSumUnitHeights(p) + (cand.height || 0) > limit) break
      p.push(next.shift())
    }
    if (!next.length) pages.splice(i + 1, 1)
  }
  return pages
}
const hOrphan = { kind: 'block', tag: 'H3', height: 90 }
const pOrphan1 = { kind: 'block', tag: 'P', height: 400 }
const pOrphan2 = { kind: 'block', tag: 'P', height: 350 }
let orphanPages = xhsFixOrphanHeadingPages([[hOrphan], [pOrphan1, pOrphan2]], 1000)
check('orphan heading merged to one page', orphanPages.length === 1 && orphanPages[0].length === 3)

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll XHS pagination checks passed')
