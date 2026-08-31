# pongrabbit-MD v1.0.13 发布说明

**日期**：2026-08-30

## 导出分页 P1 补齐

### 新增拆分粒度
- `ul` / `ol`：按 `li` 分页，跨页合并为完整列表
- ` ```text ` 围栏：按 `.xhs-export-fence-line` 分行
- ` ```js ` 等多行 pre：导出前拆为 `.xhs-export-pre-plain` 行盒（跨页无语法色）
- `blockquote`：按直接子元素拆段

### 长图 / 短图
- 长图使用 `xhsRenderPageChunkWithOverflow`，组装超高时自动续排
- 单块仍超一页高度时抛出 `xhs-page-overflow` 并弹窗，不再静默裁切底部

### 安装包
`mobimark_source/mobimark/dist-1.0.13/pongrabbit-MD Setup 1.0.13.exe`
