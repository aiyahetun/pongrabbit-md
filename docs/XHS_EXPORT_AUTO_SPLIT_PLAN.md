# 小红书导出「永不报错 · 自动拆分」完整方案

| 字段 | 内容 |
|------|------|
| 版本 | v1.0.16 |
| 日期 | 2026-08-30 |
| 状态 | 已实现（v1.0.16） |
| 前置 PRD | [XHS_EXPORT_PAGINATION_PRD.md](./XHS_EXPORT_PAGINATION_PRD.md) |
| Bug 台账 | [XHS_EXPORT_BUGS.md](./XHS_EXPORT_BUGS.md) |
| 关联代码 | `mobimark_source/mobimark/src/renderer/app.js` |

---

## 1. 背景

v1.0.11–v1.0.15 已完成 DOM 智能分页、表格行级拆分、表格单元格离屏实测。但用户验收中仍出现：

```
导出短图失败：单块内容（如大图或超长段落）超过一页高度…
```

涉及文档示例：

- `SEO-站外外链与提交方案.md`（超长表格单元格，`海外品类` 查询词列表）
- `PublishKit-营销视觉AI描述词.md`（长列表项 / 大字号段落）

**产品原则（对齐行业）**：同类工具（CardDown、markdown2card、RedBookCards、章鱼排版）均 **自动拆分 + 降级出图**，不向用户弹「导出失败」。详见方案第 3 节。

---

## 2. 目标

| 目标 | 成功标准 |
|------|----------|
| **永不因分页弹错** | 短图/长图导出任意 Markdown 均产出 PNG；最差降级裁切/缩放，不 `alert` 失败 |
| **全单元实测闭环** | 表格行、列表项、段落/标题、引用段、代码行均走「离屏实测 → 递归拆分」 |
| **手动分页符** | Markdown `---`（渲染为 `<hr>`）强制换页 |
| **导出反馈** | 完成后若有自动拆分/降级，在成功提示中附带简要说明（非阻断） |
| **回归** | 上述两份验收文档短图导出成功；自检脚本全部通过 |

**非目标**：导出前可视化调页、AI 拆段、图片智能裁切 UI。

---

## 3. 行业对标摘要

| 产品 | 分页策略 | 超大单块处理 |
|------|----------|--------------|
| [CardDown](https://github.com/WiseZenn/CardDown) | DOM 实测 + 块级装箱 | 按块类型递归拆（表格/代码/段落） |
| [markdown2card](https://github.com/ghh-l-djl/markdown2card) | 实测卡片高度 | 竖图独占一页，不跨页切图 |
| [RedBookCards](https://github.com/pilipala5/RedBookCards) | 元素高度 + 排版规则 | `<!-- pagebreak -->` 手动分页 |
| [叮卡 DingCard](https://github.com/lottshin/DingCard) | 自动分页 + 预览 | 正文 `---` 作分页标记 |
| [Paged.js 社区](https://github.com/pagedjs/pagedjs/issues/274) | 防无限循环 | 超大元素仍渲染并继续，而非中止 |

**共识**：主路径 DOM 实测；单块超高则递归再拆；实在不行降级（独占页 / 缩放 / 像素续页），**不阻断导出**。

---

## 4. 技术方案

### 4.1 架构（三层）

```
Layer 1  块级展开     xhsFlattenPaginationUnits
Layer 2  实测递归拆分  xhsFlattenPaginationUnitsAsync  ← v1.0.16 补齐全类型
Layer 3  渲染降级兜底  xhsRenderPageChunkWithOverflow  ← 去掉 throw，像素续页
```

### 4.2 Layer 2：全类型「实测 → 递归拆分」

新增/统一函数（与现有 `xhsEnsureTableRowUnitsFit` 同模式）：

| 单元类型 | 拆分函数 | 实测递归函数 |
|----------|----------|--------------|
| `table-row` | `xhsExpandTableRowUnits` | `xhsEnsureTableRowUnitsFit`（已有） |
| `list-item` | `xhsExpandListItemUnits` | **`xhsEnsureListItemUnitsFit`（新增）** |
| `block` (p/h1–h6) | `xhsExpandBlockUnits` | **`xhsEnsureBlockUnitsFit`（新增）** |
| `blockquote-part` | 按子元素 | **`xhsEnsureBlockquotePartUnitsFit`（新增）** |
| `fence-line` / `pre-line` | 按行 / 按字数 | **`xhsEnsureLineUnitFits`（新增）** |

**递归逻辑（伪代码）**：

```text
ensureFit(unit):
  h = measureIsolated(unit)
  if h <= maxLayoutH: return [unit]
  parts = expand(unit, charBudget)
  if parts.length <= 1:
    charBudget *= 0.5; retry (max 14次, 最低 8 字)
  else:
    return flatMap(parts, ensureFit)
  // 仍失败：返回 [unit]，交给 Layer 3
```

**`xhsExpandBlockUnits` 扩展**：支持 `H5`、`H6`；对含单张 `img` 的块标记 `hasImage` 供 Layer 3 缩放。

### 4.3 Layer 3：渲染降级（去掉 `xhs-page-overflow` 弹窗）

`xhsRenderPageChunkWithOverflow` 改造：

1. **现有**：尾部单元回退（`tryCount--`）、`xhsSubdivideOversizedUnits` 紧急拆分  
2. **新增降级链**（单块仍超高时，按序尝试）：
   - **a.** 字数预算 28 → 14 → 8 → 4 多轮 `xhsSubdivideOversizedUnits`
   - **b.** **像素续页**：对该块单独渲染 canvas，调用已有 `sliceCanvasToFixedPages` 切成多张 3:4，依次写入 `files`（内容不丢）
   - **c.** 含大图块：渲染前将 `img` `max-height` 约束为 `usableH * 0.92` 再测
3. **删除**：`throw new Error('xhs-page-overflow')` 及 `exportXhsShort` 中对应 `alert`

返回值扩展：

```javascript
{ canvas, overflow, extraCanvases?: HTMLCanvasElement[] }
```

`exportXhsShort` 循环：先写 `canvas`，再写 `extraCanvases`，最后处理 `overflow` 单元。

### 4.4 手动分页符

- Markdown 独立行 `---` → HTML `<hr>`
- `xhsFlattenPaginationUnits` 识别 `HR`，推入 `{ kind: 'page-break' }`
- `paginateXhsUnitsOnly` 遇 `page-break` 强制结束当前页、开启新页（`hr` 本身不渲染到导出图）

### 4.5 导出完成提示

```javascript
let xhsExportAutoSplitCount = 0  // 模块级或 runOne 闭包
// Layer 2/3 拆分时 ++
alert(`已导出短图（${n} 张）…` + (xhsExportAutoSplitCount ? `\n其中 ${xhsExportAutoSplitCount} 处已自动拆分。` : ''))
```

### 4.6 长图导出

- 同步使用 Layer 2 全类型实测（已走 `paginateXhsSurfaceBlocksAsync`）
- 长图路径同样移除对 `xhs-page-overflow` 的依赖；超高单块用像素续页写入 `-02.png`、`-03.png`

---

## 5. 文件改动清单

| 文件 | 改动 |
|------|------|
| `src/renderer/app.js` | Layer 2/3 实现、`page-break`、去掉 overflow 弹窗、`extraCanvases` |
| `scripts/selfcheck-xhs-pagination.js` | 断言新函数、断言无用户-facing overflow alert |
| `scripts/selfcheck-xhs-export-audit.js` | `single-unit-clip` → MITIGATED；`no-export-failure-alert` 新增 |
| `package.json` | `1.0.16`，`dist-1.0.16` |
| `CHANGELOG.md` | v1.0.16 条目 |
| `docs/RELEASE_NOTES_v1.0.16.md` | 发布说明 |

---

## 6. 验收标准

### 6.1 自动化

```bash
node --check src/renderer/app.js
node scripts/selfcheck-xhs-pagination.js
node scripts/selfcheck-xhs-export-audit.js
```

全部通过。

### 6.2 人工（Windows v1.0.16）

| # | 文档 | 操作 | 预期 |
|---|------|------|------|
| 1 | `SEO-站外外链与提交方案.md` | 短图 · 标准 · 智能分页 | 成功导出多页；`海外品类` 行拆分；**无报错** |
| 2 | `PublishKit-营销视觉AI描述词.md` | 短图 · 标准/舒适 | 成功导出；长列表项自动拆页；**无报错** |
| 3 | 含 `---` 的测试稿 | 短图 | `---` 前后内容在不同页 |
| 4 | 含竖长图文档 | 短图 | 出图成功（缩放或独占页），无报错 |
| 5 | 版本号 | 关于/状态栏 | 显示 **v1.0.16** |

---

## 7. 方案自检清单

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 覆盖用户反馈的全部报错场景（表格单元格、列表项） | ✅ |
| 2 | 与 v1.0.11 PRD 目标不冲突（短图 3:4、DOM 分页保留） | ✅ |
| 3 | 降级链保证内容不丢（像素续页兜底） | ✅ |
| 4 | 改动范围集中在 `app.js`，不引入新依赖 | ✅ |
| 5 | 自检脚本可验证关键断言 | ✅ |
| 6 | 长图路径同步受益 | ✅ |

**自检结论：方案可进入开发。**

---

## 8. 风险与后续

| 风险 | 缓解 |
|------|------|
| 像素续页可能在极少场景切到行中间 | 优先 Layer 2 实测拆分；像素续页仅最后兜底 |
| 离屏实测增多，导出变慢 | 仅对 `measure > maxLayoutH` 的单元实测；可接受 |
| 大图缩放影响清晰度 | 仅当高度 > 页高时缩放；提示用户可改用长图 |

**P2 后续**：导出前分页预览、块级拖拽调页、Mermaid 超大图专属策略。
