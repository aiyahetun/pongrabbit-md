/**
 * 自检：打开磁盘 Markdown 后切源码，行数不应因空行膨胀。
 * 用法：node scripts/selfcheck-source-blanks.js [目录...]
 */
const fs = require('fs')
const path = require('path')

function normalizeMarkdownBlocks (md) {
  return String(md || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isMdLikelyBloated (md) {
  const s = String(md || '')
  if (s.length < 80) return false
  const lines = s.split(/\r?\n/)
  if (lines.length < 20) return false
  const empty = lines.filter(l => !l.trim()).length
  if (empty / lines.length > 0.55) return true
  return (s.match(/\n{3,}/g) || []).length >= 3
}

function stats (md) {
  const lines = md.split('\n')
  const empty = lines.filter(l => !l.trim()).length
  return { lines: lines.length, empty, ratio: empty / Math.max(1, lines.length), triple: (md.match(/\n{3,}/g) || []).length }
}

function scanFile (file) {
  const raw = fs.readFileSync(file, 'utf8')
  const display = normalizeMarkdownBlocks(raw)
  const s0 = stats(raw)
  const s1 = stats(display)
  const bloated = isMdLikelyBloated(raw)
  const inflated = s1.lines > s0.lines * 1.15 && s0.triple === 0
  return { file, bloated, inflated, before: s0, after: s1 }
}

function walk (dir, out, limit) {
  if (out.length >= limit) return
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (_) { return }
  for (const ent of entries) {
    if (out.length >= limit) break
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
      walk(p, out, limit)
    } else if (/\.md$/i.test(ent.name)) {
      out.push(p)
    }
  }
}

const roots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
    path.resolve(__dirname, '../../..'),
    'C:/Users/win/Desktop/彭兔子制版/docs'
  ]

const files = []
for (const root of roots) {
  if (!fs.existsSync(root)) continue
  const st = fs.statSync(root)
  if (st.isFile() && /\.md$/i.test(root)) files.push(root)
  else if (st.isDirectory()) walk(root, files, 40)
}

if (!files.length) {
  console.error('No markdown files found')
  process.exit(1)
}

let bloatedCount = 0
let okCount = 0
console.log('Self-check: source blank lines / disk normalization\n')
for (const file of files) {
  const r = scanFile(file)
  const name = path.basename(file)
  const flag = r.bloated ? 'BLOATED-DISK' : 'OK-DISK'
  if (r.bloated) bloatedCount++
  else okCount++
  console.log(
    `${flag}  ${name}  lines ${r.before.lines} -> ${r.after.lines}` +
    `  empty ${(r.before.ratio * 100).toFixed(0)}%  triple+ ${r.before.triple}`
  )
}
console.log(`\nChecked ${files.length} files: ${okCount} normal, ${bloatedCount} need compact on open`)
console.log('Mode switch uses disk text unless visual DOM really changed; editable .md opens in wysiwyg by default.')
