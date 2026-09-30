# pongrabbit-MD v1.0.33 发布说明

**日期**：2026-09-30

## 变更

- **定时自动保存**：设置 →「定时自动保存」开关（默认开启）；已保存路径的文稿约每 2 分钟写回磁盘，未命名稿暂存本地草稿（`pendingContent`）。可在 `%APPDATA%\pongrabbit-md\config.json` 调整 `autoSaveIntervalSec`（最短 30 秒）。
- **关闭未保存提醒**：关闭窗口（含 macOS 红绿灯）时，若有未保存修改，弹出「保存 / 不保存 / 取消」。
- **贴边半屏**：拖动标题栏贴近屏幕左/右边缘可吸附为半屏，便于与浏览器等并排协作；Windows 无边框窗口启用 `thickFrame` 以更好参与系统贴靠。

## 下载

| 平台 | 文件 |
|------|------|
| Windows（推荐） | `pongrabbit-MD Setup 1.0.33.exe` |
| Windows（便携） | `pongrabbit-MD 1.0.33.exe` |
| macOS（Intel / M 系列） | `pongrabbit-MD-1.0.33.dmg` 或 `.zip` |

Windows SmartScreen：选「更多信息」→「仍要运行」。

macOS 未做苹果公证：首次被系统拦截时，请在访达中对应用 **右键 → 打开**。

仓库：<https://github.com/aiyahetun/pongrabbit-md>
