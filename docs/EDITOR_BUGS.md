# 编辑器与桌面集成 Bug 记录

| 字段 | 内容 |
|------|------|
| 维护 | 产品与开发 |
| 关联 PRD | [UI_OPTIMIZATION_PRD.md](./UI_OPTIMIZATION_PRD.md) |
| 关联代码 | `mobimark_source/mobimark/src/renderer/app.js`、`src/main/main.js` |

本文档记录 pongrabbit-MD **编辑体验、模式切换、超链与系统关联打开**相关 Bug（含回归），含根因、修复版本与验收状态。

**当前稳定版**：1.0.34

---

## 状态图例

| 状态 | 含义 |
|------|------|
| **已验收** | 用户确认修复有效 |
| **已修复** | 已合入代码，待用户验收 |
| **回归** | 已修复功能在新版本再次出问题 |

---

## Bug 总表

| ID | 严重度 | 标题 | 发现版本 | 修复版本 | 状态 |
|----|--------|------|----------|----------|------|
| ED-001 | P1 | 可视化 / 源码 / 预览切换明显卡顿 | ≤1.0.28 | 1.0.29 | **已验收** |
| ED-002 | P1 | 文内超链（含 blockquote 内本地路径）点击无反应 | ≤1.0.28 | 1.0.29 | **已验收** |
| ED-003 | P1 | Windows 资源管理器双击 `.md` 无反应 | ≤1.0.27 | 1.0.28 | **已验收** |
| ED-004 | P1 | 表格可视化编辑后切换源码再回可视化，内容错行/重复 | ≤1.0.33 | 1.0.34 | **已验收** |
| ED-005 | P1 | 可视化 ↔ 源码切换或撤销（Ctrl+Z）长时间卡顿 | ≤1.0.33 | 1.0.34 | **已验收** |
| ED-006 | P2 | 状态栏字数 / 字符统计规则不清晰 | ≤1.0.33 | 1.0.34 | **已验收** |

---

## 详细记录

### ED-001 模式切换卡顿

- **现象**：在「可视化」「源码」「预览」之间来回切换时，界面明显迟滞，标签已点但内容区迟迟不切换。
- **根因**：
  1. `setMode('preview')` 每次进入预览前调用 `syncEditorsFromMd()`，对**已隐藏**的富文本区做完整 `md2html`；
  2. 内容未改时仍重复 `renderPreview()`（marked + 全篇代码高亮）；
  3. 面板显隐放在同步逻辑**之后**，用户感知为「先卡后切」；
  4. 每次切换同步 `refreshOutline()` 解析全文标题。
- **修复**（v1.0.29）：
  - 先切换面板与 Tab，再执行必要同步；
  - 引入 `_richSyncedMd` / `_previewRenderedMd` / `_outlineMdSource` 缓存，未改动时跳过重渲染；
  - 预览模式不再 `syncEditorsFromMd`；
  - 目录刷新改为 `scheduleOutlineRefresh()` 延迟执行。
- **验收**：用户确认 v1.0.29 **验收通过**（2026-09-21）。

---

### ED-002 超链无法打开

- **现象**：可视化模式下 blockquote 等区域内的 Markdown 超链（如 `视觉稿设计/publishkit/DESIGN.md`）样式正常，点击仅移动光标，无法打开目标文件或外链；预览模式亦偶发无效。
- **根因**：
  1. `#rich-editor` 为 `contenteditable`，浏览器将 `<a>` 视为可编辑文本，默认不触发导航；
  2. 链接点击在冒泡阶段处理，易被编辑器焦点逻辑覆盖；
  3. 部分 `href` 含 URL 编码，主进程解析本地路径前未 `decodeURIComponent`。
- **修复**（v1.0.29）：
  - `prepareRichLinksForEditing()`：同步后为链接设 `contenteditable="false"`；
  - `setupLinkClickHandlers` 改为捕获阶段拦截；
  - 渲染器与主进程统一 `normalizeLinkHref` / 路径解码；
  - CSS 为 `#rich-editor a`、`#preview-content a` 显式 `pointer-events: auto`。
- **验收**：用户确认 v1.0.29 **验收通过**（2026-09-21）。

---

### ED-003 资源管理器双击 .md 无反应

- **现象**：Windows 下将 `.md` 关联到 pongrabbit-MD 后，资源管理器双击文件，应用无响应或未打开该文档。
- **根因**：
  1. 未设置 `AppUserModelId`，Windows 任务栏 / 关联打开行为异常；
  2. 命令行路径带引号、`file://` 或中文时 `fileFromArgv` 解析失败；
  3. 渲染进程未就绪时，主进程传入的路径丢失（无 IPC 投递）。
- **修复**（v1.0.28）：
  - `app.setAppUserModelId('com.pongrabbit.md')`；
  - `normalizeShellFileArg` / `dispatchShellOpenFile`；
  - preload `onShellOpenFile` + renderer `setupShellOpenFileListener`。
- **验收**：随 v1.0.29 整包重装后一并确认（2026-09-21）。

---

## 自检覆盖

| 脚本 | 覆盖项 |
|------|--------|
| `scripts/selfcheck-recent-fixes.js` | 模式缓存、预览跳过 resync、超链 capture、富文本 link 准备、Shell 打开 IPC |
| `scripts/selfcheck-source-blanks.js` | 打开时空行整理、默认可视化 |

---

## 项目进度（编辑体验线）

| 日期 | 里程碑 |
|------|--------|
| 2026-08-30 | v1.0.10 修复预览/可视化链接（历史，v1.0.28 前仍有 contenteditable 回归） |
| 2026-08-31 | v1.0.28 Windows 关联打开修复 |
| 2026-09-21 | v1.0.29 模式切换性能 + 超链可点击，**用户验收通过** |
| 2026-09-21 | Windows 安装包 `dist-1.0.29/pongrabbit-MD Setup 1.0.29.exe` 已本地构建 |
| 2026-10-03 | v1.0.34 表格往返、切换/撤销性能、字数统计，**用户验收通过**；GitHub Actions 发布 Win + Mac 通用包 |

---

### ED-004 表格切换错行

- **现象**：可视化表格内输入后切换源码再回可视化，原内容下方出现新行并重复填入。
- **根因**：单元格内换行写入 GFM 表格行，破坏 `| ... |` 结构，往返解析错位。
- **修复**（v1.0.34）：`tableCellMdText` 压平换行；`thead`/`tbody`/`tr` 避免重复导出。
- **验收**：用户确认 v1.0.34 **验收通过**（2026-10-03）。

### ED-005 模式切换与撤销卡顿

- **现象**：长文下可视化 ↔ 源码切换或 Ctrl+Z 可达数分钟无响应。
- **根因**：`setRichCaretOffset` 全字符 O(n²) 探测；`plainOffsetToMdIndex` 反复 `marked.parse` 切片。
- **修复**（v1.0.34）：线性 `accumulateRichPlainUntil` / `forEachRichPlainCaret`；大文档比例映射源码光标。
- **验收**：用户确认 v1.0.34 **验收通过**（2026-10-03）。

### ED-006 字数统计

- **现象**：需要底部明确的中英文字数 / 字符规则。
- **修复**（v1.0.34）：`computeEditorStats` — 字数 = 汉字 + 英文词；字符 = 汉字 + 英数字（不计空白）。
- **验收**：用户确认 v1.0.34 **验收通过**（2026-10-03）。

---

## 变更日志索引

- [CHANGELOG.md](../CHANGELOG.md)
- [RELEASE_NOTES_v1.0.34.md](./RELEASE_NOTES_v1.0.34.md)
- [RELEASE_NOTES_v1.0.29.md](./RELEASE_NOTES_v1.0.29.md)
