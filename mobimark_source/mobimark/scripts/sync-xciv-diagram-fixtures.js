/**
 * 从仓外 xciv 参考文档抽取 ```mermaid 围栏写入 fixtures/diagrams/
 * 用法：set XCIV_REF=路径\to\xciv参考重构 && node scripts/sync-xciv-diagram-fixtures.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const refRoot = process.env.XCIV_REF
  ? path.resolve(process.env.XCIV_REF)
  : path.resolve(root, '..', '..', '..', '八字', 'xciv参考重构')

const sources = [
  { file: '10_产品逻辑分层图.md', out: 'flowchart-layers.md' },
  { file: '11_用户交互路径图.md', out: 'state-journey.md' }
]

const fixturesDir = path.join(root, 'fixtures/diagrams')

function extractMermaidFences (md) {
  const re = /```mermaid\r?\n([\s\S]*?)```/gi
  const blocks = []
  let m
  while ((m = re.exec(md))) blocks.push(m[1].replace(/\s+$/, ''))
  return blocks
}

function main () {
  if (!fs.existsSync(refRoot)) {
    console.error('XCIV_REF not found:', refRoot)
    process.exit(1)
  }
  fs.mkdirSync(fixturesDir, { recursive: true })
  let wrote = 0
  for (const { file, out } of sources) {
    const srcPath = path.join(refRoot, file)
    if (!fs.existsSync(srcPath)) {
      console.warn('skip missing', srcPath)
      continue
    }
    const md = fs.readFileSync(srcPath, 'utf8')
    const fences = extractMermaidFences(md)
    if (!fences.length) {
      console.warn('no mermaid in', file)
      continue
    }
    const body = fences.map(f => '```mermaid\n' + f + '\n```').join('\n\n')
    const header = '# synced from ' + file + '\n# SOURCE: ' + refRoot + '\n\n'
    fs.writeFileSync(path.join(fixturesDir, out), header + body + '\n', 'utf8')
    console.log('wrote', out, '(' + fences.length + ' block(s))')
    wrote++
  }
  if (!wrote) {
    console.error('nothing written')
    process.exit(1)
  }
  const r = spawnSync('node', ['scripts/selfcheck-mermaid-roundtrip.js'], { cwd: root, stdio: 'inherit' })
  process.exit(r.status || 0)
}

main()
