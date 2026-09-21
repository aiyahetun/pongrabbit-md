# pongrabbit-MD v1.0.29 发布说明

**日期**：2026-09-21  
**类型**：体验修复 + Windows 关联打开（含 v1.0.28）

## 修复

### ED-001 可视化 / 源码 / 预览切换卡顿

- **问题**：切换编辑模式时界面迟滞，标签已切换但内容区更新慢。
- **原因**：预览模式前重复 `md2html`、未改动时仍全量 `renderPreview`、面板切换排在同步之后。
- **修复**：面板优先切换；富文本 / 预览 / 目录缓存；预览模式跳过 hidden 富文本 resync。

### ED-002 文内超链无法打开

- **问题**：可视化 blockquote 等区域内超链点击无反应。
- **原因**：`contenteditable` 吞掉链接点击；路径未解码。
- **修复**：链接 `contenteditable="false"`；捕获阶段打开；主进程 / 渲染器统一解码 `href`。

### ED-003 资源管理器双击 .md 无反应（v1.0.28）

- **问题**：Windows 关联打开失败。
- **修复**：`AppUserModelId`、命令行路径规范化、`shell-open-file` IPC。

## 自检

- `node scripts/selfcheck-recent-fixes.js` → **39/39 通过**
- 详见 [EDITOR_BUGS.md](./EDITOR_BUGS.md)

## 安装包（本地构建）

| 类型 | 路径 |
|------|------|
| NSIS 安装版 | `mobimark_source/mobimark/dist-1.0.29/pongrabbit-MD Setup 1.0.29.exe` |
| 便携版 | `mobimark_source/mobimark/dist-1.0.29/pongrabbit-MD 1.0.29.exe` |

> 安装包不随 git 提交；上传 GitHub Release 见 [RELEASES.md](./RELEASES.md)。

## 验收要点

1. 可视化 ↔ 源码 ↔ 预览快速切换，无明显卡顿
2. 点击文内本地 `.md` 超链可打开目标文档
3. 点击 `https://` 超链可用系统浏览器打开
4. Windows 资源管理器双击 `.md` 可唤起并打开文件

**验收状态**：用户于 2026-09-21 确认通过。
