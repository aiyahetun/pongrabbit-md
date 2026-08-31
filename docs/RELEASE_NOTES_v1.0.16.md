# pongrabbit-MD v1.0.16 发布说明

## 永不报错 · 全类型自动拆分

### 修复

- **XHS-008 / XHS-011**：删除短图「单块内容超过一页高度」报错弹窗；任意文档均可导出成功。
- **列表项 / 段落 / 标题**：与表格单元格相同，离屏实测高度后递归按字数拆分。
- **引用段、代码行**：超高时自动拆分为多段。
- **超大竖图**：渲染前约束 `max-height`；仍超高则像素续页兜底。
- **手动分页**：Markdown 独立行 `---` 强制换页（不渲染分割线到图中）。

### 行为变化

- 导出成功提示可能附带：「其中 N 处内容已自动拆分。」
- 极少数无法结构拆分的块会使用像素续页（与 v1.0.10 盲切不同，仅作最后兜底）。

### 文档

- 完整方案：[XHS_EXPORT_AUTO_SPLIT_PLAN.md](./XHS_EXPORT_AUTO_SPLIT_PLAN.md)
- Bug 台账：[XHS_EXPORT_BUGS.md](./XHS_EXPORT_BUGS.md)

### 安装包

`mobimark_source/mobimark/dist-1.0.16/pongrabbit-MD Setup 1.0.16.exe`

### 验收建议

1. `SEO-站外外链与提交方案.md` — 短图导出，无报错
2. `PublishKit-营销视觉AI描述词.md` — 短图导出，无报错
3. 确认版本 **v1.0.16**
