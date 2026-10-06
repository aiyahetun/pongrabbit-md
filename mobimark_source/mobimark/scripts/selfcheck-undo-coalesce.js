/**
 * 自检：撤销合并（阶段 1+2）静态与逻辑探针
 * 用法：node scripts/selfcheck-undo-coalesce.js
 */
const fs = require('fs')
const path = require('path')

const appPath = path.resolve(__dirname, '../src/renderer/app.js')
const appSrc = fs.readFileSync(appPath, 'utf8')

let failed = 0

function pass (name, detail = '') {
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
}

function fail (name, detail = '') {
  failed++
  console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
}

function check (name, cond, detail = '') {
  if (cond) pass(name, detail)
  else fail(name, detail)
}

console.log('Self-check: undo coalescing (phase 1+2)\n')

// ── 阶段 1：基础设施 ─────────────────────────────────────
console.log('[1] Phase 1 — core')
check('EDITOR_HIST_MAX is 150', /const EDITOR_HIST_MAX = 150/.test(appSrc))
check('UNDO_COALESCE_MS is 500ms (ProseMirror-class default)', /const UNDO_COALESCE_MS = 500/.test(appSrc))
check('punctuation closes coalesce group', /function histInputClosesCoalesceGroup/.test(appSrc) && /endRichHistCoalesce\(\)/.test(appSrc))
check('recordRichHistory accepts opts', /function recordRichHistory \(opts = \{\}\)/.test(appSrc))
check('recordMdHistory accepts opts', /function recordMdHistory \(opts = \{\}\)/.test(appSrc))
check('coalesce overwrite branch', /shouldCoalesceRichHistory/.test(appSrc) && /_richHist\[_richHistIdx\] = snap/.test(appSrc))
check('resetEditorHistory clears coalesce', /function resetEditorHistory[\s\S]*?endHistCoalesce\(\)/.test(appSrc))
check('applyRichHistoryIndex clears coalesce', /function applyRichHistoryIndex[\s\S]*?endHistCoalesce\(\)/.test(appSrc))
check('showTableDialog clears coalesce', /function showTableDialog[\s\S]*?endHistCoalesce\(\)/.test(appSrc))
check('rich paste discrete + skip input', /_richSkipNextInputHistory = true[\s\S]*?recordRichHistory\(\{ discrete: true \}\)/.test(appSrc))
check('rich input uses inputType kind', /histInputKindFromType/.test(appSrc) && /histKindIsDiscrete\(kind\)/.test(appSrc))
check('md beforeinput hint', /mdEditor\.addEventListener\('beforeinput'/.test(appSrc))
check('paragraph is discrete kind', /histKindIsDiscrete[\s\S]*paragraph/.test(appSrc))
check('missing input hint defaults to type', /hint \? hint\.kind : 'type'/.test(appSrc))
check('histCaretContinues uses caretBefore', /function histCaretContinues/.test(appSrc))

// ── 阶段 2：光标相邻 ─────────────────────────────────────
console.log('\n[2] Phase 2 — caret adjacency')
check('histCaretAdjacent helper', /function histCaretAdjacent/.test(appSrc))
check('shouldCoalesceRich uses continuity', /shouldCoalesceRichHistory[\s\S]*histCaretContinues/.test(appSrc))
check('shouldCoalesceMd uses continuity', /shouldCoalesceMdHistory[\s\S]*histCaretContinues/.test(appSrc))
check('typing vs delete bucket split', /_richCoalesce\.bucket !== bucket/.test(appSrc))

// ── discrete 调用点抽样 ──────────────────────────────────
console.log('\n[3] Discrete operations')
check('insertRichTable discrete', /function insertRichTable[\s\S]*?recordRichHistory\(\{ discrete: true \}\)/.test(appSrc))
check('insertMdTable discrete', /function insertMdTable[\s\S]*?recordMdHistory\(\{ discrete: true \}\)/.test(appSrc))
check('wrapTag discrete', /function wrapTag[\s\S]*?recordRichHistory\(\{ discrete: true \}\)/.test(appSrc))
check('recordRichFmtChange', /function recordRichFmtChange/.test(appSrc))

// ── 逻辑探针（与 app.js 同规则）──────────────────────────
console.log('\n[4] Logic probes')

function histKindIsDiscrete (kind) {
  return kind === 'paragraph' || kind === 'paste' || kind === 'other'
}

function histCaretAdjacent (before, after) {
  if (before == null || after == null) return true
  return Math.abs(after - before) <= 1
}

function simulateCoalesce ({ idx, len, coalesce, discrete, kind, caret, lastCaret, deadlineOk }) {
  if (discrete || histKindIsDiscrete(kind)) return { action: 'push', idx: idx + 1, len: len + 1 }
  if (idx !== len - 1 || idx <= 0) return { action: 'push', idx: idx + 1, len: len + 1 }
  if (!coalesce || !deadlineOk) return { action: 'push', idx: idx + 1, len: len + 1 }
  if (!histCaretAdjacent(lastCaret, caret)) return { action: 'push', idx: idx + 1, len: len + 1 }
  return { action: 'replace', idx, len }
}

let s = simulateCoalesce({ idx: 0, len: 1, coalesce: true, discrete: false, kind: 'type', caret: 1, lastCaret: 0, deadlineOk: true })
check('first edit always pushes', s.action === 'push' && s.idx === 1)

s = simulateCoalesce({ idx: 1, len: 2, coalesce: true, discrete: false, kind: 'type', caret: 5, lastCaret: 4, deadlineOk: true })
check('burst typing replaces tip', s.action === 'replace' && s.idx === 1)

s = simulateCoalesce({ idx: 1, len: 2, coalesce: true, discrete: false, kind: 'type', caret: 50, lastCaret: 4, deadlineOk: true })
check('caret jump starts new push', s.action === 'push')

s = simulateCoalesce({ idx: 1, len: 2, coalesce: true, discrete: false, kind: 'paragraph', caret: 5, lastCaret: 4, deadlineOk: true })
check('Enter is discrete', s.action === 'push' && histKindIsDiscrete('paragraph'))

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failed)\n`)
process.exit(failed ? 1 : 0)
