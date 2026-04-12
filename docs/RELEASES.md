# 发布与下载说明（GitHub Releases）

正式安装包通过 **[GitHub Releases](https://github.com/aiyahetun/pongrabbit-md/releases)** 分发，**不会**随 `git push` 自动上传（`dist/` 已在 `.gitignore` 中忽略）。

---

## 用户下载什么？

| 平台 | 推荐文件 | 说明 |
|------|-----------|------|
| **macOS（Intel）** | `pongrabbit-MD-1.0.0.dmg` | 双击挂载，将应用拖入「应用程序」。 |
| **macOS（Intel，备选）** | `pongrabbit-MD-1.0.0.zip` | 解压后将 `.app` 拖入「应用程序」。 |
| **Windows** | `pongrabbit-MD Setup 1.0.0.exe` | NSIS 安装向导，可选安装目录。 |
| **Windows（便携）** | `pongrabbit-MD 1.0.0.exe` | 单文件便携版，无需安装（若已提供）。 |

- **Apple Silicon（M 系列）**：当前默认构建为 **Intel (x64)**，可在 Rosetta 下运行；若需原生通用包，在 `mobimark_source/mobimark` 下执行 `npm run build-mac-universal`（需网络稳定以下载 arm64 Electron）。
- **未签名 / 未公证**：macOS 首次打开若被拦截，请对应用 **右键 → 打开**；Windows 可能出现 SmartScreen 提示，选「仍要运行」。

---

## 维护者：如何打出安装包？

在目录 **`mobimark_source/mobimark`** 下：

```bash
npm install
npm run build-mac          # 生成 .dmg / .zip（建议在 macOS 上执行）
npm run build              # 生成 Windows 安装包 + 便携版（建议在 Windows 上执行）
```

- **在 macOS 上打 Windows 包** 时，`electron-builder` 会从 GitHub 下载 NSIS 等工具；若遇 **超时 / EOF**，请换网络重试，或在一台 **Windows** 电脑上执行 `npm run build`。
- 产物位于 **`mobimark_source/mobimark/dist/`**。上传 Release 时**不必**附带 `*.blockmap`（用于自动更新）。

---

## 维护者：如何创建 Release 并上传附件？

### 方式 A：网页操作（最通用）

1. 打开仓库 **Releases** → **Draft a new release**。
2. **Choose a tag**：新建标签，例如 `v1.0.0`（与 `package.json` 的 `version` 一致）。
3. **Release title**：例如 `pongrabbit-MD 1.0.0`。
4. 将 **`docs/RELEASE_NOTES_v1.0.0.md`** 中正文复制到描述框（或按需修改）。
5. 将 `dist` 中的 **`.dmg`、`.zip`、`.exe`** 拖入 **Attach binaries**。
6. 发布 **Publish release**。

### 方式 B：命令行（需安装 GitHub CLI）

```bash
brew install gh
gh auth login
```

在项目根目录执行：

```bash
./scripts/create-github-release.sh
```

脚本会上传当前 `dist` 下已有的 Mac 包；若已在本机生成 Windows 的 `.exe`，也会一并附加（存在才上传）。

---

## 版本号约定

发布新档时建议同步：

1. `mobimark_source/mobimark/package.json` 的 **`version`**  
2. Git 标签 **`v x.y.z`**  
3. `docs/RELEASE_NOTES_vX.Y.Z.md`（可复制上一版改内容）
