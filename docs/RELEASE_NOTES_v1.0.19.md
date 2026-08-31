# pongrabbit-MD v1.0.19 发布说明

**日期**：2026-08-30  
**类型**：热修复（P0 回归）

## 修复

### XHS-018 启动即显示导出进度条并卡死

- **问题**：v1.0.18 首次打开应用即弹出「正在导出图片 · 准备中… · 0%」，界面无法操作。
- **原因**：`.xhs-export-progress-dialog { display:flex !important }` 覆盖了 HTML 内联 `display:none`。
- **修复**：
  - 默认 `#xhs-export-progress { display:none !important }`
  - 仅导出中 `body.xhs-export-busy` 时显示进度条
  - `init()` 重置导出会话与 busy 状态

## 自检加强

- `selfcheck-xhs-pagination.js` 新增 [8] Export UI regression guards
- `selfcheck-xhs-export-audit.js` 新增 `startup-progress-dialog` 风险项
- Bug 记录见 [XHS_EXPORT_BUGS.md](./XHS_EXPORT_BUGS.md) XHS-018 / XHS-019

## 安装包

`mobimark_source/mobimark/dist-1.0.19/pongrabbit-MD Setup 1.0.19.exe`

## 验收要点

1. **冷启动**：无进度条、无遮罩
2. 导出短图：进度条正常出现并关闭
3. 复测 `制版工具视频指导文案`：无孤标题页
