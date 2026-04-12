# pongrabbit-MD

**把灵感写成作品——会呼吸的 Markdown 桌面创作空间。**

pongrabbit-MD 不只是编辑器，更是一张**沉浸式写作桌**：多模式编辑、通透毛玻璃、环境音效与工作区管理融于一体。专为中文写作者打磨界面与节奏，在 **Windows** 与 **macOS** 上共享同一套精致体验，又各自贴合系统原生窗口与磨砂质感。

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
- **导出即交付**：PDF、HTML 一键导出，预览即所得，分享与归档不折腾。

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

---

## 仓库结构（摘要）

```
pongrabbit-md/
├── mobimark_source/mobimark/   # Electron 主应用（主进程 + 渲染进程 + sounds）
├── mac/ / windows/             # 各平台便捷脚本
├── MAC浅色版效果/ 等           # 设计参考稿
└── README.md
```

---

## 喜欢这个项目？

如果 pongrabbit-MD 用得顺手，可以**请我喝杯奶茶**——用微信扫下面二维码即可（**完全自愿**，不影响任何功能）。

![微信支付 — 赞赏支持](docs/assets/wechat-sponsor.png)

> 说明：这是个人收款码，与 GitHub Sponsors 等平台无关；金额随意，心意到就好。

---

## 许可证

MIT（见 `mobimark_source/mobimark/package.json`）。

---

**现在就克隆仓库，打开 pongrabbit-MD，让下一篇文字从一块顺手的桌面开始。**
