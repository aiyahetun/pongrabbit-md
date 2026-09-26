# pongrabbit-MD v1.0.30 发布说明

**日期**：2026-09-26  
**类型**：买断授权与试用、中英界面、安装与稳定性

## 重要（买家）

- **14 天试用**：首次启动起算；到期后可打开、复制旧稿，继续编辑 / 保存 / 导出需激活。
- **激活**：设置 → 授权，粘贴授权码（爱发电 / Lemon 购买后邮件发放）。
- **安装包**：本 Release 为带授权校验的版本；请勿混用更早的无锁旧包。

## 变更摘要

- 离线 Ed25519 授权校验与国内 ¥58 / 海外 $8.80 商店配置（链接需在 `stores.json` 填写后重打包才生效）。
- 界面中英切换（`zh` / `en`）与购买渠道提示。
- 修复部分环境下白屏、安装程序 EULA 乱码（NSIS 使用 GBK 许可文本）。
- 延续 v1.0.29：模式切换流畅、文内超链可打开、Windows 双击 `.md` 关联打开。

## 下载

| 平台 | 文件 |
|------|------|
| Windows（推荐） | `pongrabbit-MD Setup 1.0.30.exe` |
| Windows（便携） | `pongrabbit-MD 1.0.30.exe` |
| macOS（Intel） | `pongrabbit-MD-1.0.30.dmg` 或 `.zip` |

macOS 未公证：首次被拦请 **访达 → 右键应用 → 打开**。  
Windows SmartScreen：选「更多信息」→「仍要运行」。

仓库：<https://github.com/aiyahetun/pongrabbit-md>
