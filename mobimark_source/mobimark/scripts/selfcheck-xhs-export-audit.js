/**
 * 导出分页深度审计：在单元测试通过之外，静态检查已知风险点是否已有缓解代码。
 * 用法：node scripts/selfcheck-xhs-export-audit.js
 */
const fs = require('fs')
const path = require('path')

const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/app.js'), 'utf8')
const cssSrc = fs.readFileSync(path.resolve(__dirname, '../src/renderer/style.css'), 'utf8')

const RISKS = [
  {
    id: 'table-rows',
    name: '表格按 tr 拆分',
    severity: 'P0',
    mitigated: /kind:\s*'table-row'/.test(appSrc) && /xhsBuildTableFromRows/.test(appSrc),
    note: 'v1.0.12+ 已修复；整表作为单块分页会切半行'
  },
  {
    id: 'short-overflow-retry',
    name: '短图单页超高后尾部重排',
    severity: 'P0',
    mitigated: /function xhsRenderPageChunkWithOverflow/.test(appSrc) && /overflow:\s*units\.slice/.test(appSrc),
    note: '组装后超高时把尾部单元移到下一页'
  },
  {
    id: 'no-blind-slice',
    name: '短图不再固定像素盲切',
    severity: 'P0',
    mitigated: !/async function exportXhsShort[\s\S]*?sliceCanvasToFixedPages/.test(appSrc),
    note: '旧版 sliceCanvasToFixedPages 会直接切半行'
  },
  {
    id: 'list-items',
    name: '无序/有序列表按 li 拆分',
    severity: 'P1',
    mitigated: /kind:\s*'list-item'/.test(appSrc) && /xhsBuildListFromItems/.test(appSrc),
    note: '未缓解时：长列表整段作为一块，跨页仍会裁切末项'
  },
  {
    id: 'fence-lines',
    name: '正文围栏代码按行拆分',
    severity: 'P1',
    mitigated: /kind === 'fence-line'/.test(appSrc) && /xhs-export-fenced-plain/.test(appSrc),
    note: '未缓解时：xhs-export-fenced-plain 整块超高会裁切'
  },
  {
    id: 'pre-blocks',
    name: '语法高亮 pre 代码块按行拆分',
    severity: 'P1',
    mitigated: /kind === 'pre-line'/.test(appSrc) && /xhsExplodeRealPreForPagination/.test(appSrc),
    note: '多行 pre 导出前拆为 xhs-export-pre-plain 行盒；跨页无语法色'
  },
  {
    id: 'long-overflow-retry',
    name: '长图续页组装后超高重排',
    severity: 'P1',
    mitigated: /async function exportXhsLong[\s\S]*?xhsRenderPageChunkWithOverflow/.test(appSrc),
    note: '未缓解时：长图仅依赖预估分页，组装偏差可能触顶报错'
  },
  {
    id: 'single-unit-clip',
    name: '单块超高自动拆分/降级，不弹错',
    severity: 'P1',
    mitigated: /pixel-slice fallback/.test(appSrc) &&
      !/throw new Error\('xhs-page-overflow'\)/.test(appSrc) &&
      /async function xhsEnsureListItemUnitsFit/.test(appSrc),
    note: '离屏实测递归拆分 + 像素续页兜底，不向用户报错'
  },
  {
    id: 'blockquote-split',
    name: '引用块内按子段落拆分',
    severity: 'P2',
    mitigated: /kind:\s*'blockquote-part'/.test(appSrc),
    note: '长引用按 blockquote 直接子元素拆段'
  },
  {
    id: 'measured-table-cell',
    name: '表格单元格离屏实测后拆分',
    severity: 'P1',
    mitigated: /async function xhsFlattenPaginationUnitsAsync/.test(appSrc) &&
      /async function xhsMeasureIsolatedUnitHeight/.test(appSrc),
    note: '按真实 scrollHeight 迭代缩小单元格片段，避免估算偏差'
  },
  {
    id: 'tall-table-cell',
    name: '超高表格单元格按行/字数拆分',
    severity: 'P1',
    mitigated: /function xhsExpandTableRowUnits/.test(appSrc),
    note: '单行 tr 过高时拆成多行合成 tr'
  },
  {
    id: 'tall-image',
    name: '超高图片缩放适配',
    severity: 'P2',
    mitigated: /maxHeight = Math\.floor\(maxLayoutH \* 0\.92\)/.test(appSrc),
    note: '单图块渲染前约束 max-height，仍超高则像素续页'
  },
  {
    id: 'page-fill-balance',
    name: '稀疏页前填 / 实测高度装箱',
    severity: 'P1',
    mitigated: /function xhsRebalanceSparsePages/.test(appSrc) &&
      /xhsSumUnitHeights/.test(appSrc),
    note: '对齐 CardDown fill-threshold / Smart RED overflow-fill，减少拆页后大面积留白'
  },
  {
    id: 'assembled-page-refine',
    name: '全局组装高度装箱',
    severity: 'P0',
    mitigated: /xhsPackUnitsByAssembledHeight/.test(appSrc) && /xhsProbeAssembledPageHeight/.test(appSrc),
    note: 'v1.0.24 跨页合并；v1.0.23 仅页内 refine 无效'
  },
  {
    id: 'capture-host-visible',
    name: 'html2canvas onclone 确保可绘制',
    severity: 'P0',
    mitigated: /onclone:\s*\(/.test(appSrc) && /xhsPrepareExportHostForCapture/.test(appSrc),
    note: 'v1.0.22+ 离屏 host 隐藏时靠 onclone 绘制'
  },
  {
    id: 'measure-only-pagination',
    name: '分页分析快速测量（measureOnly）',
    severity: 'P0',
    mitigated: /measureOnly:\s*true/.test(appSrc) && /xhsWarmMeasureFonts/.test(appSrc),
    note: 'v1.0.21 修复 XHS-021；分页分析不得每次走完整 mount 等待'
  },
  {
    id: 'progress-after-confirm',
    name: '进度条在设置确认后才显示',
    severity: 'P0',
    mitigated: (() => {
      const start = appSrc.indexOf('async function exportXhsShort')
      const fn = appSrc.slice(start, start + 4000)
      return fn.includes('openXhsStylePicker') &&
        fn.indexOf('openXhsStylePicker') < fn.indexOf('xhsBeginExportSession')
    })(),
    note: 'v1.0.20 修复 XHS-020；不得在 openXhsStylePicker 之前 begin session'
  },
  {
    id: 'startup-progress-dialog',
    name: '启动时进度条默认隐藏',
    severity: 'P0',
    mitigated: /#xhs-export-progress\s*\{[^}]*display\s*:\s*none\s*!important/.test(cssSrc) &&
      !/\.xhs-export-progress-dialog\s*\{[^}]*display\s*:\s*flex\s*!important/i.test(cssSrc),
    note: 'v1.0.19 修复 XHS-018；CSS 不得让 .xhs-export-progress-dialog 常显'
  },
  {
    id: 'manual-page-break',
    name: 'Markdown --- 手动分页',
    severity: 'P2',
    mitigated: /kind:\s*'page-break'/.test(appSrc) && /child\.tagName === 'HR'/.test(appSrc),
    note: '独立行 --- 渲染为 hr，强制换页'
  }
]

let openP0 = 0
let openP1 = 0
let openP2 = 0

console.log('XHS export risk audit\n')
console.log('ID                      Sev   Status      Note')
console.log('─'.repeat(72))

for (const r of RISKS) {
  const status = r.mitigated ? 'MITIGATED' : 'OPEN     '
  if (!r.mitigated) {
    if (r.severity === 'P0') openP0++
    else if (r.severity === 'P1') openP1++
    else openP2++
  }
  console.log(`${r.id.padEnd(22)}  ${r.severity}   ${status}   ${r.note}`)
}

console.log('\n' + '─'.repeat(72))
console.log(`Open: P0=${openP0}  P1=${openP1}  P2=${openP2}`)

if (openP0 > 0) {
  console.error('\nAudit FAILED: open P0 risks remain')
  process.exit(1)
}
console.log('\nAudit passed (no open P0); review P1/P2 notes above for remaining edge cases')
process.exit(0)
