# Mermaid 图表功能 · 验收记录

| 字段 | 内容 |
|------|------|
| 验收日期 | 2026-10-27 |
| 验收人 | 产品方（用户确认「验收通过」） |
| 安装包基线 | `mobimark` **v1.0.36**（含 Mermaid 全套与放大查看，未单独升 package 版本号） |
| 方案文档 | [MERMAID_BLOCK_EDITOR_PLAN.md](./MERMAID_BLOCK_EDITOR_PLAN.md) |
| 发布说明 | [RELEASE_NOTES_v1.0.37.md](./RELEASE_NOTES_v1.0.37.md) |

## 验收场景

- 文档：`xciv参考重构/10_产品逻辑分层图.md`（多段 flowchart、文首 PNG）
- 预览：Mermaid 渲染为矢量图（非代码块）
- 可视化：图表块工具栏、复杂图 **放大查看**（缩放/平移）
- Windows 安装包：`npm run release` 自检通过后本地重装验证

## 阶段范围（已交付）

| 阶段 | 内容 | 状态 |
|------|------|------|
| A | 预览 / PDF / HTML / 小红书 Mermaid 渲染与围栏往返 | 通过 |
| B | 图表块、图片块、工具栏与右键 | 通过 |
| C2 | mermaid.live、设置项 | 通过 |
| C1 | 流程图画布布局注释（实验） | 通过（实验） |
| — | HTML 导出内联 SVG + 本地图 data URL | 通过 |
| — | 放大查看 lightbox | 通过 |

## 残余观测

- [EDITOR_BUGS.md](./EDITOR_BUGS.md) **ED-007**：快速切换主题/模式时偶发旧图闪回（有代际 API 缓解，继续观测）

## 发版自检命令

```bash
cd mobimark_source/mobimark
npm run selfcheck-mermaid
npm run smoke-mermaid
npm run release
```
