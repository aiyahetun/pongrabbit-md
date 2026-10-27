# pongrabbit-MD v1.0.37 发布说明

**日期**：2026-10-27 · **用户验收**：2026-10-27（见 [MERMAID_ACCEPTANCE.md](./MERMAID_ACCEPTANCE.md)）

## 亮点：Mermaid 图表与块级编辑

- **预览 / 可视化 / PDF / 小红书短图**：` ```mermaid ` 围栏渲染为矢量图，不再显示为高亮代码。
- **图表块**：工具栏与右键可插入图表；可视化内图块工具条（编辑源码、刷新、复制、mermaid.live、实验画布）。
- **图片块**：可视化中 `figure.image-block`，与图表块一致的块级体验。
- **导出 HTML**：内联 Mermaid SVG + 本地相对路径图片转 data URL，断网打开仍可看全文。
- **设置**：可选允许在 mermaid.live 打开；可选流程图画布编辑（布局写入 `%% prabbit:layout v1 … %%` 注释）。
- **放大查看**：复杂图全屏缩放、拖拽平移（可视化双击 / 预览点击 / 工具栏「放大查看」）。

## 回归与质量

发版前在 `mobimark_source/mobimark` 执行：

```bash
npm run selfcheck-mermaid
npm run smoke-mermaid
node scripts/selfcheck-xhs-export-audit.js
```

可选：设置 `XCIV_REF` 指向产品文档目录后执行 `node scripts/sync-xciv-diagram-fixtures.js`。

## 已知限制

- 序列图 / 状态图等暂无画布编辑，请改围栏源码或 mermaid.live。
- 画布仅保存节点偏移注释，不自动改写连线语法。
- 单张内嵌图片超过约 12MB 时 HTML 导出仍可能无法离线显示该图。

## 方案文档

详见 [MERMAID_BLOCK_EDITOR_PLAN.md](./MERMAID_BLOCK_EDITOR_PLAN.md)。
