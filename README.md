# pongrabbit-MD

> **写得顺手，看得舒服——自带氛围的 Markdown 桌面创作台。**

pongrabbit-MD 是一款基于 Electron 的跨平台 Markdown 编辑器。同一套界面与功能在 **Windows** 与 **macOS** 上保持一致；针对两套系统分别做了原生窗口体验（标题栏、毛玻璃策略），让你在自己熟悉的操作系统里，获得同样专注的写作流。

---

## 为什么选择它

| 亮点 | 说明 |
|------|------|
| **多模式一体** | 可视化编辑、Markdown 源码、只读预览、分栏对照——按场景切换，不必来回换软件。 |
| **专业导出** | 一键导出 **PDF** 与 **HTML**，方便分享、归档与发布。 |
| **三套主题气质** | 浅色清爽、深色沉浸、毛玻璃通透；macOS 下毛玻璃可与系统质感协同。 |
| **音效与专注** | 内置白噪音预设与本地音乐文件夹播放，侧边「音效与音乐」面板，写作时可调音量与播放模式。 |
| **界面为中文场景优化** | 中文界面与排版习惯友好；灰蓝品牌色体系统一，细节控件（如主题切换、音乐控制）精致耐看。 |
| **平台原生感** | Windows 使用右侧传统窗口按钮；macOS 采用左侧交通灯与对应交互习惯，并区分毛玻璃实现策略。 |

---

## 两种安装 / 构建版本说明

本仓库**同一套源代码**，通过不同命令产出 **Windows 安装包** 与 **macOS 应用**。请在你需要使用的操作系统上完成依赖安装与打包（或在对应系统的 CI 上构建）。

| 版本 | 适用系统 | 典型产物 | 构建命令（在项目 `mobimark_source/mobimark` 目录） |
|------|-----------|-----------|---------------------------------------------------|
| **Windows 版** | Windows 10/11（x64） | NSIS 安装包、便携版等 | `npm run build` / `npm run build-portable` |
| **macOS 版** | macOS（Intel / Apple Silicon，视配置而定） | `.dmg`、`.zip` 等 | `npm run build-mac` 或 `npm run build-mac-universal` |

**说明：**

- Windows 上生成的 `.exe` 安装包**不能**直接在 Mac 上安装；Mac 需使用在 **macOS 上执行** `build-mac` 得到的 `.app` / `.dmg`（或从 Releases 下载已构建的 Mac 产物）。
- 日常开发：在 `mobimark_source/mobimark` 执行 `npm install` 后使用 `npm start` 启动 Electron 即可，与平台无关。

---

## 快速开始（开发）

```bash
cd mobimark_source/mobimark
npm install
npm start
```

打包请参考上表，在对应平台执行 `npm run build` 或 `npm run build-mac`。

---

## 仓库结构（摘要）

```
彭兔子MD/
├── mobimark_source/mobimark/   # 主应用（Electron + 渲染进程）
├── 音效与音乐按钮效果/          # UI 参考稿（设计对照）
└── README.md                   # 本说明
```

---

## 许可证

以应用目录内 `package.json` 所载为准（当前为 **MIT**）。

---

## 与 GitHub 同步

若尚未关联远程仓库，在本地提交后可执行：

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

将 `<你的用户名>`、`<仓库名>` 换成你在 GitHub 上创建的空仓库信息；首次推送需完成 GitHub 登录或 Personal Access Token 配置。
