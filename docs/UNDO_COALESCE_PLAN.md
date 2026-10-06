# 编辑器撤销合并（Undo Coalescing）整体改动方案

| 字段 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-10-06 |
| 状态 | **已实现（阶段 1+2，v1.0.34+）** |
| 关联代码 | `mobimark_source/mobimark/src/renderer/app.js`（`recordRichHistory` / `recordMdHistory` / `EDITOR_HIST_MAX`） |
| 相关台账 | [EDITOR_BUGS.md](./EDITOR_BUGS.md)（ED-005 已优化撤销**性能**，未改**步进粒度**） |
| 触发原因 | 用户反馈：连续打字约一字一步，80 步上限很快用尽 |

---

## 1. 背景与问题

### 1.1 当前实现（v1.0.34）

| 项目 | 行为 |
|------|------|
| 存储 | 可视化：**整段 `innerHTML` + 纯文本光标偏移**；源码：**全文 `value` + selection** |
| 记步时机 | `richEditor` / `mdEditor` 的 **`input` 事件**，内容变化即 `record*History()` |
| 栈深上限 | `EDITOR_HIST_MAX = 80`，超出丢弃最旧条目 |
| 合并 | **无**（仅当新快照与栈顶 html/value 与光标完全一致时跳过） |
| 双栏 | 可视化与源码 **两条独立栈**；`Ctrl+Z` 只作用于 **当前有焦点** 的一侧 |
| 重做 | 新编辑会 `slice` 掉 redo 分支（标准行为） |
| 重置 | 新建/打开文件 → `resetEditorHistory()` |

### 1.2 用户体感

- 连续输入时，**一次撤销往往只回退一个字符**（或浏览器合并后的极短片段）。
- **80 步 ≈ 几十到百余字符** 的可撤销范围，长文写作很快「顶满」，误以为撤销损坏。
- v1.0.34 已把 **单次撤销/恢复的耗时** 降下来（ED-005），**未**改变「一步有多细」。

### 1.3 与内存的关系

每步保存 **全量 HTML 或全文**，栈深 × 文档越大，内存越高。单纯把 `EDITOR_HIST_MAX` 提到 500 **不解决体感**，还会加重内存与 ED-005 类风险。应先 **合并输入步**，再酌情提高事件数上限。

---

## 2. 目标与非目标

### 2.1 目标

| 目标 | 成功标准（验收） |
|------|------------------|
| **连续打字一步撤销** | 同一位置连续输入一整句（中间无结构性操作），**一次 Ctrl+Z** 回到输入前 |
| **停顿后分段** | 两次输入间隔 **≥ 合并窗口**（建议 500ms）后，撤销分两段回退 |
| **结构性操作独立一步** | 插表、粘贴、工具栏格式、插链接/图等，**单独**占 undo 栈一步 |
| **保留栈深上限** | 合并后 `EDITOR_HIST_MAX` 表示 **用户级操作数**；建议调至 **120～200**（实现后压测再定） |
| **双栏行为可解释** | 文档与（可选）设置说明：双栏两侧撤销栈独立，不强行合并 |

### 2.2 非目标（本方案不做）

- 引入 ProseMirror / Lexical / CodeMirror 6 **整体替换**可视化或源码编辑器（列为长期选项，见 §6）。
- 可视化与源码 **共享一条撤销时间线**（成本高，产品可接受「焦点侧撤销」）。
- 无限撤销或仅按内存不设步数（仍保留上限，避免大文档 OOM）。
- 协同编辑、跨设备撤销。

---

## 3. 行业对标摘要

主流编辑器区分 **Undo 事件（group）** 与 **栈深度**：用户按一次 Ctrl+Z 回退 **一整段连续输入**，而不是每个按键。

| 参考 | 合并思路 | 典型参数 |
|------|----------|----------|
| **VS Code** | 连续编辑追加到当前 stack element（`canAppend`），非每键新元素 | 偏 **内存上限**，非固定步数 |
| **ProseMirror**（`prosemirror-history`） | 时间 `newGroupDelay` + 变更在文档上 **相邻**（`isAdjacentTo`） | 默认 **500ms**；`closeHistory()` 强制新步 |
| **Lexical** `@lexical/history` | 连续打字合并为一个 history entry | 默认 merge **300ms**（可配） |
| **Loro** | `mergeInterval`；`groupStart` / `groupEnd` 显式批处理 | 毫秒级可配 |
| **karet-text** 等 | 单字符插入 + 光标连续 + 时间窗 → 同一 `group` | **200ms** 常见 |

**共识（何时新开一步）**

- 超过 **300～500ms** 无输入（可配置）。
- **粘贴**、**回车**、**大块删除**、**工具栏/对话框** 操作。
- **光标跳变**（点选别处、大范围选区后编辑）。
- **切换文件 / 重置历史**。

**共识（何时合并）**

- 连续 **打字**、同一编辑点 **连退格**（可选：连按 Delete 单独一类合并）。

可选进阶：**空格/标点** 后开新组（「按词撤销」），本方案 **阶段 A 不强制**，可在阶段 B 对源码模式试点。

---

## 4. 技术方案总览

采用 **三阶段**，优先 **阶段 A** 上线即可明显改善体感。

```
阶段 A  合并窗口 + 覆盖栈顶快照 + discrete 操作表     ← 本迭代必做
阶段 B  源码相邻光标校验 + inputType 细分            ← 可选增强
阶段 C  架构级（增量 undo / 编辑器框架）             ← 长期
```

### 4.1 核心概念：Undo 事件 vs 快照

- **Undo 事件**：用户一次 Ctrl+Z 所回退的单元。
- **实现**：栈中每一项仍可为 **全量快照**（与现架构一致），但 **连续输入** 时 **不 push 新项**，而是 **覆盖 `_richHist[_richHistIdx]` / `_mdHist[_mdHistIdx]`**。
- **离散操作**：始终 `push` 新项，并 **结束** 当前合并会话（清空 redo 分支逻辑保持不变）。

### 4.2 合并状态机（建议模块内私有变量）

```text
_histCoalesce = {
  active: boolean,           // 当前是否处于可合并会话
  deadline: number,          // Date.now() + COALESCE_MS 内可继续覆盖栈顶
  lastMdCaret: number,       // 源码：上次记步后的 selectionStart（阶段 B）
  lastRichCaret: number,     // 可视化：上次记步后的 plain offset（阶段 B）
  lastInputKind: string,     // 'type' | 'delete' | 'other'（阶段 B，可选）
}
```

常量建议（可进 `config` 或顶部常量，首版写死即可）：

| 常量 | 建议值 | 说明 |
|------|--------|------|
| `UNDO_COALESCE_MS` | **500** | 与 ProseMirror 默认一致；Lexical 约 300ms；勿用 2s（易整段撤销） |
| **标点/空白** | `histInputClosesCoalesceGroup` | 输入以 `。，！？、；…` 或空格等结尾时，当前步结束后 **新开** undo 步（v1.0.36+） |
| `EDITOR_HIST_MAX` | **150**（合并后） | 表示「事件数」；实现后对大文档试 120/150/200 |

**合并条件（阶段 A，简化版）**

1. `record*History({ discrete: false })` 被调用；
2. `_histApplying === false`；
3. 栈非空且 `_histIdx > 0`（或允许在 idx=0 时覆盖「初始态」后的第一项，实现时与 redo 一致）；
4. `Date.now() <= _histCoalesce.deadline`；
5. （阶段 B）光标与上次记步相比 **相邻**（源码：index 差 ≤ 1 或同向编辑；可视化：plain offset 连续）。

满足则：**覆盖当前索引快照**，**不** `push`，**不** 增加栈长。

**结束合并 / 强制新步**

- 任何 `record*History({ discrete: true })`；
- `undo` / `redo` 应用后（`apply*HistoryIndex` 内重置 coalesce）；
- `resetEditorHistory()`；
- 打开对话框前（可选，避免对话框关闭后误合并到对话框前的栈顶）；
- 阶段 B：`inputType` 为 `insertFromPaste`、`insertParagraph` 等。

### 4.3 API 改动

```javascript
// 由 boolean 扩展为 options，默认 discrete: false
function recordRichHistory (opts = {}) {
  const discrete = !!opts.discrete
  // ...
}

function recordMdHistory (opts = {}) {
  const discrete = !!opts.discrete
  // ...
}
```

**`input` 监听器**：保持调用 `recordRichHistory()` / `recordMdHistory()` **无 discrete**（走合并）。

**必须 `discrete: true` 的入口（清单，实现时逐项核对 grep）**

| 类别 | 函数/场景 |
|------|-----------|
| 表格 | `insertRichTable`、`extendRichTable`、表右键 `richTableInsert*` / `*Delete*`、`insertMdTable`、`extendMdTable`、MD 表操作 |
| 链接 | 链接对话框确认 |
| 图片 | `insertMarkdownImageAtCursor` |
| 工具栏 | 加粗/斜体/标题/列表/引用等 **非纯 input** 的 `execCommand` / 包裹 MD 后 `record*` |
| 粘贴 | 可视化 `paste` 已 `preventDefault` + `insertText`：若仍产生单次 input，可在 paste 处理器末尾 **`discrete: true` 单独记一步**（或 paste 后 `endCoalesce()`） |
| 撤销/重做 | `applyRichHistoryIndex` / `applyMdHistoryIndex` 内不调用 record，但 **reset coalesce** |
| 模式同步 | `_editorSyncing` 期间不记步（已有） |

**不应 discrete、走合并的**

- 普通 `input` 打字、退格（同一合并窗内覆盖栈顶）。

### 4.4 可视化模式注意点

- `contenteditable` 的 `input` 在 **IME 组字** 时可能多次触发；合并 **覆盖栈顶** 反而更符合「一次确认 = 一步」。
- 全量 HTML 快照在合并后 **栈项数减少**，但 **单项体积仍大**；长文 + 150 步需观察内存（与 ED-005 同场景回归）。
- `applyRichHistoryIndex` 会 `innerHTML` 全量替换：合并 **不** 改变该路径，仅减少次数。

### 4.5 源码模式注意点

- `textarea` 每次 `input` 一条快照 → 合并后收益最大。
- 阶段 B：比较 `selectionStart` 与 `_histCoalesce.lastMdCaret`，若用户 **点击远处** 再打字，应 **新开一步**（即使仍在 500ms 内）。

### 4.6 双栏与 `syncEditorsFrom*`

- 合并 **不改变** 现有规则：可视化 `input` 仍可能触发 `syncEditorsFromWysiwyg()`，与 undo 栈独立。
- 不在本方案中统一两侧栈；README/帮助可加一句说明。

### 4.7 与 redo 的交互

- **覆盖栈顶** 时：若当前不在栈尾（用户 undo 后又输入），现有 `slice(0, _idx + 1)` 逻辑 **保持不变**。
- 覆盖栈顶 **不增加** `_idx`，redo 分支仍被清空（与现在 push 前 slice 行为一致）。

---

## 5. 实现步骤（阶段 A 任务拆解）

| 序号 | 任务 | 文件 | 说明 |
|------|------|------|------|
| 1 | 增加 `UNDO_COALESCE_MS`、`endHistCoalesce()`、`shouldCoalesceHistory()` | `app.js` | 私有辅助 |
| 2 | 改造 `recordRichHistory` / `recordMdHistory` | `app.js` | 覆盖栈顶 vs push；`discrete` 参数 |
| 3 | `apply*HistoryIndex`、`resetEditorHistory` 调用 `endHistCoalesce()` | `app.js` | |
| 4 | 表格/链接/图片/工具栏等 grep `recordRichHistory` / `recordMdHistory`，补 `discrete: true` | `app.js` | 见 §4.3 清单 |
| 5 | 粘贴路径：`paste` 监听末尾 `recordRichHistory({ discrete: true })` 或禁止合并一次 | `app.js` | 避免与后续 input 双记 |
| 6 | 调整 `EDITOR_HIST_MAX` → **150**（或保留 80 先验收集再调） | `app.js` | |
| 7 | 自检脚本（可选）`selfcheck-undo-coalesce.js` | `scripts/` | 纯函数测试合并逻辑（若抽离） |
| 8 | 文档 | `docs/EDITOR_BUGS.md` 或 `CHANGELOG` | 新条 ED-00x；Release Notes 一句 |

**建议 PR 粒度**：单 PR 完成阶段 A，避免与无关功能混交。

---

## 6. 阶段 B / C（后续）

### 6.1 阶段 B

- 使用 `InputEvent.inputType`（`insertText` / `deleteContentBackward` / …）区分 **打字 vs 删除**，删除链可与打字分组合并。
- 源码 **光标相邻** 检测；可视化 **plain offset** 相邻检测。
- 可选：**空格后新组**（`insertText` 为 `\u0020` 且上一字符非空格时 `discrete: true`）。

### 6.2 阶段 C（长期）

| 方向 | 优点 | 成本 |
|------|------|------|
| 源码改用 **CodeMirror 6** | 成熟 undo、合并、性能 | 双栏与可视化同步成本 |
| 可视化 **ProseMirror / Lexical** | 与 Markdown 结构、表格一致 | 重构量大 |
| **增量 undo**（只存 diff） | 内存与步数解耦 | 需为 rich↔md 往返设计 |

当前产品阶段 **不建议** 为 undo 单独上阶段 C，除非编辑内核整体升级。

---

## 7. 测试与验收

### 7.1 手工用例

| # | 操作 | 预期 |
|---|------|------|
| T1 | 可视化连续输入「你好世界」无停顿 | 1 次 Ctrl+Z 全部消失 |
| T2 | 输入「你好」→ 停 0.6s → 输入「世界」 | 2 次 Ctrl+Z 分别去掉「世界」「你好」 |
| T3 | 输入一段 → 插表（对话框）→ 再输入 | 撤销顺序：后文字 → 表 → 前文字 |
| T4 | 粘贴大段文字 | 1 次撤销去掉整块粘贴 |
| T5 | 源码模式 T1–T3 同逻辑 | 同预期 |
| T6 | 双栏：左侧打字 20 字，焦点在左，撤销 | 合并生效；焦点切到右侧撤销 **不** 影响左侧栈 |
| T7 | 长文（如 2 万字）合并后连续撤销 20 次 | 无明显卡顿（ED-005 回归） |
| T8 | IME 中文组字确认后撤销 | 整词/整句回退（允许 1～2 步，记录实际浏览器行为） |

### 7.2 回归

- 表格往返、模式切换、ED-005 场景文档。
- `readOnlyDoc` / 试用锁：仍不记新历史。

---

## 8. 产品文案建议（对外）

设置或帮助中可增加（实现后）：

> 撤销按 **编辑动作** 记录：连续打字会合成一步；插入表格、粘贴、格式按钮等单独一步。最多保留约 **150** 次可撤销操作。双栏模式下，撤销作用于当前正在编辑的一侧。

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 合并过猛，用户想「只删一个字」 | 行业惯例接受；阶段 B 可用较短窗或空格分词 |
| 大文档 HTML 快照 × 150 步内存 | 监控；未来阶段 C 增量；或略降 `EDITOR_HIST_MAX` |
| 漏标 `discrete` 导致插表与打字合成一步 | 代码审查 + grep 清单 §4.3 |
| 粘贴与 input 双记步 | paste 路径显式 `discrete` 或合并防抖 |

---

## 10. 方案自检（可行性 & 对标体感）

> 结论：**阶段 A 可行，能消除「一字一步 + 80 步秒满」的主痛点**；与 Typora / Obsidian / VS Code **在「连续打字」上可接近**，但 **不能宣称完全等同**。阶段 A 上线前须补 §10.3 的 **硬门槛**；阶段 B 建议作为同一里程碑的 **后半**（至少做回车 + 光标跳变），否则会有明显「不像专业编辑器」的边角。

### 10.1 总体判断

| 维度 | 评估 |
|------|------|
| **技术路线** | 在现有「全量快照 + 双栈」架构上，用 **覆盖栈顶 + 时间窗** 做 coalescing，与 ProseMirror/Lexical 的「事件」概念对齐，**无需重写编辑器**即可落地。 |
| **投入产出** | 改动集中在 `record*History` 与调用点标注 `discrete`，**1～2 个迭代日**量级（含 grep 清单与 T1–T8）。 |
| **风险可控性** | 主要风险是 **漏标 discrete**、**回车被合并**、**仅时间窗不校验光标**；均可通过 §10.3 + 阶段 B 局部规则缓解。 |
| **对标诚实度** | **源码模式**：合并后体感最接近 Obsidian 源码 / VS Code。**可视化**：连续输入接近 Typora；格式按钮、双栏、深度与内存仍弱于三者。 |

### 10.2 与 Typora / Obsidian / VS Code 的差距（实现后仍可能存在）

| 能力 | 三者常见行为 | 阶段 A 后我们 | 补齐方式 |
|------|----------------|---------------|----------|
| 连续打字一次撤销 | ✅ | ✅（预期） | — |
| 停顿后分段撤销 | ✅ ~0.5–2s | ✅ 500ms 窗 | 可配置 |
| **回车换段** 单独一步 | ✅ | ⚠️ 若只靠 `input` 合并，**可能与上一段合成一步** | **A 必做**：`insertParagraph` / Enter → `discrete` |
| 点击别处再打字（短时间内） | 新一步 | ⚠️ 仅时间窗会 **误合并** | **B 必做（建议与 A 同版）**：光标不相邻 → 新步 |
| 撤销深度 | 很大或按内存 | **~150 个事件** | 合并后 150 通常够用；非 VS Code 级「整文件很久」 |
| 撤销成本（长文） | 增量 / 文本树 | 仍 **整篇 HTML 替换** | ED-005 已优化；步数减少后更好，但非同等架构 |
| 双栏撤销 | 多数单编辑流 | **左右两栈** | 文档说明；Obsidian 源码/预览也不同步 undo |
| 工具栏加粗等 | 独立一步 | ⚠️ 部分只靠 `execCommand` **未必触发 `input`** | 见 §10.4 |
| 按词撤销 | 部分编辑器有 | ❌ 阶段 A 无 | 阶段 B 可选（空格新组） |

### 10.3 阶段 A 实现前必须补进方案（否则不达标）

以下从自检代码路径得出，原文 §4.3 需视为 **与表格同级** 的硬要求：

1. **回车 / 新段落**  
   - 在 `richEditor` / `mdEditor` 的 `beforeinput` 或 `input` 中识别 `inputType === 'insertParagraph'`（及等价换行），记步用 **`discrete: true`**，或先 `endHistCoalesce()` 再记一步。  
   - 验收增补 **T9**：输入一段 → Enter → 再输入一段 → 三次 Ctrl+Z 分别去掉第二段、换行、第一段。

2. **合并首键逻辑**  
   - 栈顶为 **打开文件时的基线**（`_histIdx === 0`）时，第一次编辑必须 **push 到 idx=1**，之后同 burst 才 **覆盖 idx=1**。  
   - 不可在 idx=0 上覆盖基线快照（方案 §4.2 已暗示 `_histIdx > 0`，实现时写清单测）。

3. **撤销 / 重做之后**  
   - `apply*HistoryIndex` 必须 `endHistCoalesce()`；撤销后第一次输入 **push 新步**（勿覆盖历史栈中间项）。

4. **粘贴**  
   - `paste` → `insertText` 会再触发 `input`：要么 paste 路径 **`discrete` 且 input 合并窗内跳过重复记步**，要么 paste 后 `endHistCoalesce()` + 单次 discrete。避免「一步撤销只删掉粘贴的最后一个字」。

5. **`showTableDialog` 打开时**（建议）  
   - `endHistCoalesce()`，避免关对话框后的输入并入对话框打开前的栈顶。

### 10.4 现有代码与 `discrete` 清单缺口（实现时 grep）

| 路径 | 现状 | 合并方案要求 |
|------|------|----------------|
| `heading-select` | 已 `recordRichHistory()` | 改为 **`discrete: true`** |
| `wrapTag` / `insertCodeBlock` | 已 `recordRichHistory()` | **`discrete: true`** |
| `r-bold` / Ctrl+B 等 | 仅 `execCommand`，**无** `recordRichHistory` | 依赖 `input` 或 **补 discrete 记步**；实现后验收加粗单独撤销 |
| `r-task` / `r-hr` / 列表按钮 | 多数无显式 record | 同上，或 `input` 后勿与上一段打字合并（discrete 或 endCoalesce） |
| `insertRichTable` 等 | 有 record | **`discrete: true`** |
| 双栏 `syncEditorsFromWysiwyg` | 每次 rich `input` 同步 MD | **不改变**；与 undo 无关，但用户仍感觉「两侧内容不同步撤销」——产品说明即可 |

### 10.5 阶段 A / B 与「接近三者体感」的对应关系

```text
仅阶段 A（且含 §10.3）
  → 解决：字符级撤销、80 步过快耗尽、连续句撤销
  → 体感：打字 ≈ Typora/VS Code；换段/点选别处仍可能别扭

阶段 A + 阶段 B（光标相邻 + inputType 分删除链）
  → 推荐作为「对外可说接近主流编辑器」的最低发布标准
  → 仍弱于：无限深度、双栏统一 undo、增量性能

阶段 C
  → 才可能在对标表里与 Obsidian/VS Code **架构级** 对齐
```

### 10.6 自检结论（一句话）

**方案可行，值得做**；阶段 A 是正确第一步，但 **必须把回车 discrete、粘贴不双记、首键 push** 写进实现清单，并 **强烈建议同版本带上光标相邻（原阶段 B 核心）**，否则只能算「比现在好很多」，还不能诚实地说接近 Typora/Obsidian/VS Code 的完整撤销体验。

---

## 11. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-10-06 | 初稿：调研结论 + 阶段 A/B/C 与验收表 |
| 2026-10-06 | §10 方案自检：可行性、对标差距、A 必补项与代码缺口 |
| 2026-10-06 | 阶段 1+2 落地 `app.js`；`scripts/selfcheck-undo-coalesce.js` |
| 2026-10-06 | 时间窗改回 500ms；增加标点/空白结束合并链 |

### 行业时间窗参考（调研摘要）

| 产品/框架 | 默认合并间隔 | 备注 |
|-----------|--------------|------|
| **ProseMirror** | **500ms** `newGroupDelay` | 非相邻编辑必新开组 |
| **Lexical** `@lexical/history` | **300ms** `delay` | 可配置 |
| **karet-text** 等 | **200ms** | 单字符 + 光标连续 |
| **Google Docs**（社区观察） | 约 **1～2s** | 闭源，仅作上限参考 |
| **本应用（当前）** | **500ms** + **标点/空白断步** | 避免 2s 整段撤销；用户建议按标点分 |
