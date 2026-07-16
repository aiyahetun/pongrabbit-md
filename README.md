# pongrabbit-MD

**把灵感写成作品——会呼吸的 Markdown 桌面创作空间。**

[![最新版本](https://img.shields.io/badge/最新-v1.0.3-5b8def?style=flat-square)](CHANGELOG.md)
[![多窗口](https://img.shields.io/badge/新功能-多窗口打开-7c9cff?style=flat-square)](docs/MULTI_WINDOW_PRD.md)

pongrabbit-MD 不只是编辑器，更是一张**沉浸式写作桌**：多模式编辑、通透毛玻璃、环境音效与工作区管理融于一体。专为中文写作者打磨界面与节奏，在 **Windows** 与 **macOS** 上共享同一套精致体验，又各自贴合系统原生窗口与磨砂质感。

### 最新 · v1.0.3 多窗口，多灵感

- **右键即开，一稿一窗**：资源管理器选中 `.md`，每个文件独立窗口，对照改稿不再来回切文档。
- **智能聚焦**：同一文件已打开？自动跳到原窗口，避免重复编辑。
- **新建随你选**：`Ctrl+N` 可选「新窗口」或「当前窗口」，灵感来了就新开一桌。

[查看完整更新日志 →](CHANGELOG.md) · [本版发布说明 →](docs/RELEASE_NOTES_v1.0.3.md)

---

## 下载安装（正式包）

- **发布页（推荐）**：<https://github.com/aiyahetun/pongrabbit-md/releases>  
  选择最新版本的 **`.dmg` / `.zip`（Mac）** 或 **`.exe`（Windows）** 下载。  
- **说明文档**：[docs/RELEASES.md](docs/RELEASES.md)（各文件含义、签名说明、维护者如何打包与上传）。  
- 若 Releases 中暂时没有 Windows 安装包，可在 **Windows 电脑** 上克隆仓库后进入 `mobimark_source/mobimark` 执行 `npm install && npm run build` 自行生成（详见 `docs/RELEASES.md`）。

---

## 一眼心动

- **开箱即美**：浅色 / 深色 / 毛玻璃三套主题，灰蓝品牌色系，控件与动效统一，像在用一款「成品产品」而非工具拼凑。
- **写得进状态**：雨声、海浪、森林、城市、篝火、咖啡馆——内置白噪音一键切换；亦可接入本地音乐文件夹，边听边写，专注不掉线。
- **透见桌面**：毛玻璃主题在 macOS 与 Windows 11 上分别调用系统级磨砂 / Acrylic，自定义壁纸时自动切换合成策略，壁纸与模糊滑块始终「看得见、调得动」。
- **项目级写作**：侧栏工作区——选择根文件夹、浏览树形结构、**新建文件夹与 Markdown 文件**，把笔记与长篇留在同一条目录里完成。
- **多窗口并行**（v1.0.3+）：右键用本应用打开，一稿一窗；同一文件智能聚焦，新建可选独立窗口。
- **导出即交付**：PDF、HTML 一键导出；**小红书 3:4**（1080×1440）支持 **短图分页**（按标题建文件夹）与 **长图** 整篇导出，预览样式、图片与链接一并入图。

---

## 核心能力一览

| 能力 | 你能得到什么 |
|------|----------------|
| **四模式编辑** | 可视化、Markdown 源码、只读预览、分栏对照——一个窗口切场景，少装几个 App。 |
| **工作区侧栏** | 选定磁盘上的文件夹为根，树状浏览；支持新建目录与 `.md` 文件，写作与文件结构同步成长。 |
| **毛玻璃 + 壁纸** | 无壁纸时透桌面系统磨砂；有壁纸时 Web 层叠化模糊与遮罩，滑块实时调节氛围浓度。 |
| **音效中心** | 白噪音预设 + 本地曲库扫描 + 音量与播放模式，状态栏式胶囊入口，不打断心流。 |
| **macOS / Windows 磨砂** | 毛玻璃主题下 macOS 使用系统 Vibrancy，Windows 11 使用 Acrylic；开发与打包共用同一套透明窗口策略。 |
| **跨平台一致** | 同一仓库、同一界面逻辑；Windows 右侧窗口按钮，macOS 左侧交通灯，各取所长。 |
| **多窗口创作** | 外部打开、工作区、最近文件均支持智能去重；多文档对照写作，配置全局共享。 |

---

## 适合谁

- 需要 **长期写笔记、文档、博客稿** 的知识工作者与创作者；
- 重视 **视觉氛围与专注感**，不想在「找主题、装插件」上浪费时间的人；
- 希望在 **Win / Mac 两台机器** 上切换时，操作习惯不必重新学习。

---

## 快速开始（开发）

```bash
git clone https://github.com/aiyahetun/pongrabbit-md.git
cd pongrabbit-md/mobimark_source/mobimark
npm install
npm start
```

| 目标 | 命令（均在 `mobimark_source/mobimark` 下） |
|------|---------------------------------------------|
| Windows 安装包 / 便携版 | `npm run build` / `npm run build-portable` |
| macOS 应用 | `npm run build-mac` 或 `npm run build-mac-universal` |

也可使用仓库根目录 **`windows/install_and_run.bat`**、**`mac/install_and_run.command`**（详见 `工程位置说明.txt`）。

### 常用快捷键

- **Mac 用 ⌘ Command，Windows / Linux 用 Ctrl**（下文写作 **⌘/Ctrl**）。
- **全选**：**⌘/Ctrl + A**（可视化 / Markdown 编辑区）。
- **文件**：新建 ⌘/Ctrl+N，打开 ⌘/Ctrl+O，保存 ⌘/Ctrl+S，另存为 ⌘/Ctrl+Shift+S（另存为也可在编辑区失焦时用全局快捷键）。
- **编辑菜单**：撤销、重做、剪切、复制、粘贴、**全选**（与系统一致）。
- **查找**：⌘/Ctrl+F。
- **视图**：⌘/Ctrl+Shift+V 切换预览相关逻辑，⌘/Ctrl+Shift+F 专注模式，F11 切换专注（见应用内说明）。
- **可视化模式**：⌘/Ctrl+B/I/U 粗体/斜体/下划线；⌘/Ctrl+Z / ⌘/Ctrl+Y 撤销/重做。
- **Markdown 模式**：⌘/Ctrl+B/I 加粗/斜体（包裹符号）。

### 右键菜单

- **编辑区**：撤销/重做、剪切/复制/粘贴、查找；选区加粗/斜体/链接；**表格内**插入或删除行列；图片/链接/代码块快捷操作；空白处「插入」子菜单。
- **工作区侧栏**：打开、新建笔记/文件夹、重命名、删除、在文件夹中显示、复制路径；未选工作区时可「选择工作区」。
- 规划说明见 [`docs/CONTEXT_MENU_PLAN.md`](docs/CONTEXT_MENU_PLAN.md)。

---

## 仓库结构（摘要）

```
pongrabbit-md/
├── mobimark_source/mobimark/   # Electron 主应用（主进程 + 渲染进程 + sounds）
├── docs/                       # PRD、发布说明、CHANGELOG
├── CHANGELOG.md                # 版本更新日志（营销向完整演进）
├── mac/ / windows/             # 各平台便捷脚本
├── MAC浅色版效果/ 等           # 设计参考稿
└── README.md
```

---

## 喜欢这个项目？

如果 pongrabbit-MD 用得顺手，可以**请我喝杯奶茶**——用微信扫下面二维码即可（**完全自愿**，不影响任何功能）。

<img src="docs/assets/wechat-sponsor.png" alt="微信支付 — 赞赏支持" width="160" />

> 说明：这是个人收款码，与 GitHub Sponsors 等平台无关；金额随意，心意到就好。

---

## 许可证

MIT（见 `mobimark_source/mobimark/package.json`）。

---

**现在就克隆仓库，打开 pongrabbit-MD，让下一篇文字从一块顺手的桌面开始。**
