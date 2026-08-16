/**
 * 自检：默认可视化、保存防重入、源码↔可视化滚动映射
 * 用法：node scripts/selfcheck-recent-fixes.js
 */
const fs = require('fs')
const path = require('path')

const appPath = path.resolve(__dirname, '../src/renderer/app.js')
const mainPath = path.resolve(__dirname, '../src/main/main.js')
const appSrc = fs.readFileSync(appPath, 'utf8')
const mainSrc = fs.readFileSync(mainPath, 'utf8')

const results = []
let failed = 0

function pass (name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
}

function fail (name, detail = '') {
  results.push({ name, ok: false, detail })
  failed++
  console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
}

function check (name, cond, detail = '') {
  if (cond) pass(name, detail)
  else fail(name, detail)
}

console.log('Self-check: default mode / save dialog / scroll sync\n')

// ── 1. 默认打开可视化 ──────────────────────────────────────
console.log('[1] Default open mode')
check('init() defaults to wysiwyg', /setMode\('wysiwyg'\)/.test(appSrc))
check('applyOpenedDocument: non-readonly -> wysiwyg',
  /if \(readOnlyDoc\) \{[\s\S]*?setMode\('markdown'\)[\s\S]*?\} else \{[\s\S]*?setMode\('wysiwyg'\)/.test(appSrc))
check('shouldOpenInMarkdownMode removed', !appSrc.includes('shouldOpenInMarkdownMode'))
check('.md no longer forces markdown on open', !appSrc.includes('shouldOpenInMarkdownMode(content'))

function defaultModeForOpen (readOnlyDoc) {
  return readOnlyDoc ? 'markdown' : 'wysiwyg'
}
check('logic: .md editable -> wysiwyg', defaultModeForOpen(false) === 'wysiwyg')
check('logic: readonly -> markdown', defaultModeForOpen(true) === 'markdown')

// ── 2. 保存只弹一个对话框 ──────────────────────────────────
console.log('\n[2] Save dialog dedup')
check('_saveInFlight declared', appSrc.includes('let _saveInFlight = false'))
check('saveFile uses in-flight guard', /async function saveFile\(\)[\s\S]*?if \(_saveInFlight\) return/.test(appSrc))
check('saveFileAs uses in-flight guard', /async function saveFileAs\(\)[\s\S]*?if \(_saveInFlight\) return/.test(appSrc))
check('saveFile finally clears guard', /async function saveFile\(\)[\s\S]*?finally \{[\s\S]*?_saveInFlight = false/.test(appSrc))
check('rich editor Ctrl+S stopPropagation', /richEditor\.addEventListener\('keydown'[\s\S]*?case 's':e\.preventDefault\(\);e\.stopPropagation\(\)/.test(appSrc))
check('md editor Ctrl+S stopPropagation', /mdEditor\.addEventListener\('keydown'[\s\S]*?case 's':e\.preventDefault\(\);e\.stopPropagation\(\)/.test(appSrc))
check('main save-file IPC intact', mainSrc.includes("ipcMain.handle('save-file'"))

async function testSaveInFlightGuard () {
  let calls = 0
  let inFlight = false
  async function save () {
    if (inFlight) return 'skipped'
    inFlight = true
    try {
      await new Promise(r => setTimeout(r, 30))
      calls++
      return 'saved'
    } finally {
      inFlight = false
    }
  }
  const [a, b] = await Promise.all([save(), save()])
  check('concurrent save: only one executes', calls === 1)
  check('concurrent save: second skipped', (a === 'skipped' && b === 'saved') || (a === 'saved' && b === 'skipped'))
}

// ── 3. 滚动位置同步 ────────────────────────────────────────
console.log('\n[3] Scroll / plain-offset sync')
check('plainOffset uses innerText', appSrc.includes("box.innerText || box.textContent"))
check('md mirror helpers present', appSrc.includes('function getMdMirror') && appSrc.includes('function getMdIndexAtMirrorY'))
check('scrollMd uses mirror Y', appSrc.includes('getMdMirrorYAtIndex(mp)'))
check('setMode wysiwyg->markdown syncs rich', /mode === 'markdown'[\s\S]*?syncEditorsFromWysiwyg\(plainBefore\)/.test(appSrc))
check('setMode restores scroll after switch', appSrc.includes('restoreViewAtPlainOffset(plainBefore'))
check('triple rAF for layout', /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => requestAnimationFrame/.test(appSrc))

function plainOffsetFromRangeIn (root, range, document) {
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  const box = document.createElement('div')
  box.appendChild(pre.cloneContents())
  return (box.innerText || box.textContent || '').replace(/\r\n/g, '\n').length
}

function runDomTests () {
  let JSDOM
  try {
    JSDOM = require('jsdom').JSDOM
  } catch (_) {
    console.log('\n[3b] DOM tests — skipped (jsdom not installed)')
    return
  }
  console.log('\n[3b] DOM offset mapping (jsdom)')

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const { document } = dom.window
  const root = document.createElement('div')
  root.innerHTML = '<p>Hello</p><p>World</p>'
  document.body.appendChild(root)

  const range = document.createRange()
  const secondP = root.querySelectorAll('p')[1]
  const textNode = secondP.firstChild
  range.setStart(textNode, 2)
  range.collapse(true)

  const rangeStart = document.createRange()
  rangeStart.setStart(root.querySelector('p').firstChild, 0)
  rangeStart.collapse(true)

  const offset = plainOffsetFromRangeIn(root, range, document)
  const offsetStart = plainOffsetFromRangeIn(root, rangeStart, document)
  check('offset in second block past first paragraph', offset > 'Hello'.length, `got ${offset}`)
  check('offset at document start', offsetStart === 0)
  check('block boundary adds separator (innerText > concat)', offset >= 7, `got ${offset}`)
}

function plainOffsetToMdIndex (md, plainOffset, stripMdToPlain) {
  if (!md || plainOffset <= 0) return 0
  const fullLen = stripMdToPlain(md).length
  if (plainOffset >= fullLen) return md.length
  let lo = 0
  let hi = md.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const plainAtMid = stripMdToPlain(md.slice(0, mid)).length
    if (plainAtMid < plainOffset) lo = mid + 1
    else hi = mid
  }
  return lo
}

console.log('\n[3c] Markdown plain-offset roundtrip')
const sampleMd = 'Hello world'
check('plain text offset roundtrip', plainOffsetToMdIndex(sampleMd, 6, s => s) === 6)
check('plain text end offset', plainOffsetToMdIndex(sampleMd, 99, s => s) === sampleMd.length)

// ── 语法检查 ───────────────────────────────────────────────
console.log('\n[4] Syntax check')
function syntaxOk (file) {
  try {
    require('node:module').createRequire(file)(file)
    return true
  } catch (e) {
  }
  try {
    const { execSync } = require('child_process')
    execSync(`node --check "${file}"`, { stdio: 'pipe' })
    return true
  } catch (e) {
    fail(`syntax: ${path.basename(file)}`, e.stderr?.toString().trim() || e.message)
    return false
  }
}
const { execSync } = require('child_process')
for (const f of [appPath, mainPath, path.resolve(__dirname, 'selfcheck-source-blanks.js')]) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' })
    pass(`syntax OK: ${path.basename(f)}`)
  } catch (e) {
    fail(`syntax: ${path.basename(f)}`, e.stderr?.toString().trim())
  }
}

;(async () => {
  await testSaveInFlightGuard()
  runDomTests()

  console.log('\n' + '─'.repeat(48))
  const total = results.length
  const ok = total - failed
  console.log(`Result: ${ok}/${total} passed${failed ? `, ${failed} FAILED` : ''}`)
  process.exit(failed ? 1 : 0)
})()
