'use strict'

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { pathToFileURL, fileURLToPath } = require('url')

const ALLOW_EXT = ['.md', '.markdown', '.txt']
/** 以只读方式打开的代码/配置文件（与 renderer/app.js 中 READONLY_CODE_EXTS 保持同步） */
const CODE_DOC_READONLY_EXT = new Set([
  '.json', '.jsonc', '.json5',
  '.yaml', '.yml',
  '.xml', '.xsl', '.xslt',
  '.html', '.htm', '.xhtml',
  '.css', '.scss', '.sass', '.less',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue',
  '.mdx',
  '.py', '.pyw', '.pyi', '.rb', '.php', '.phtml',
  '.java', '.kt', '.kts', '.gradle',
  '.c', '.h', '.cpp', '.cxx', '.cc', '.hpp', '.hh', '.hxx',
  '.cs', '.fs', '.fsx', '.vb',
  '.go', '.rs', '.swift', '.dart', '.lua', '.r',
  '.sql',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.toml', '.ini', '.cfg', '.conf', '.config', '.properties',
  '.env', '.editorconfig', '.gitattributes', '.gitmodules',
  '.svg', '.plist', '.log'
])
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'])
const IMAGE_EXT_IMPORT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'])

let mainWindow = null
/** Windows 无边框透明窗口下 isMaximized() 不可靠，用手动铺满工作区实现最大化切换 */
let winCustomMaximized = false
let winRestoreBounds = null
let pendingInitialPath = null
let config = defaultConfig()

function cfgPath () {
  return path.join(app.getPath('userData'), 'config.json')
}

function defaultConfig () {
  return {
    theme: 'light',
    fontFamily: 'system',
    fontSize: 15,
    lineHeight: 1.8,
    wordWrap: true,
    recentFiles: [],
    windowBounds: { width: 1100, height: 720 },
    pendingContent: '',
    bgImagePath: '',
    glassBlur: 28,
    glassOverlay: 2,
    /** 有自定义壁纸时：auto 根据图估算 | dark_on_wp 浅色毛玻璃（深色字）| light_on_wp 深色毛玻璃（浅色字） */
    glassTextContrast: 'auto',
    musicFolder: '',
    musicVolume: 0.6,
    workspaceRoot: '',
    sidebarCollapsed: false,
    /** 小红书短图/长图导出配色风格 id */
    xhsExportStyle: 'slate-blue-frost',
    /** 导出正文字体：noto-serif-sc | noto-sans-sc | smiley-sans | ibm-plex */
    xhsExportFont: 'noto-sans-sc',
    /** 导出图手机阅读字号：standard | comfort | large（仅导出层，不影响编辑器） */
    xhsExportReadability: 'standard'
  }
}

function loadConfig () {
  try {
    const raw = fs.readFileSync(cfgPath(), 'utf8')
    config = { ...defaultConfig(), ...JSON.parse(raw) }
    if (!Array.isArray(config.recentFiles)) config.recentFiles = []
  } catch (_) {
    config = defaultConfig()
  }
}

function saveConfigDisk (partial) {
  Object.assign(config, partial)
  try {
    fs.mkdirSync(path.dirname(cfgPath()), { recursive: true })
    fs.writeFileSync(cfgPath(), JSON.stringify(config, null, 2), 'utf8')
  } catch (e) {
    console.error(e)
  }
}

/** 毛玻璃主题下是否配置了自定义壁纸路径（用于关闭 macOS under-window vibrancy，否则系统磨砂会盖住 WebView 里的 #bg-layer） */
function hasGlassCustomBg () {
  const p = config.bgImagePath
  return typeof p === 'string' && p.trim().length > 0
}

function allowedExt (filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  return ALLOW_EXT.includes(ext)
}

function isReadOnlyCodeDoc (filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  return CODE_DOC_READONLY_EXT.has(ext)
}

function allowedOpenExt (filePath) {
  return allowedExt(filePath) || isReadOnlyCodeDoc(filePath)
}

function addRecent (filePath) {
  if (!filePath) return
  const list = config.recentFiles.filter(f => f !== filePath)
  list.unshift(filePath)
  config.recentFiles = list.slice(0, 20)
  saveConfigDisk({ recentFiles: config.recentFiles })
}

function workspaceRootResolved () {
  const r = config.workspaceRoot
  if (!r || typeof r !== 'string') return null
  try {
    const abs = path.resolve(r)
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return abs
  } catch (_) {}
  return null
}

/** 工作区内相对路径（POSIX）；含 .. 或绝对段则返回 null */
function normalizeWorkspaceRel (relPath) {
  const raw = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!raw) return ''
  const segments = raw.split('/')
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return null
  }
  return segments.join('/')
}

function absInWorkspace (relPath) {
  const root = workspaceRootResolved()
  if (!root) return null
  const safe = normalizeWorkspaceRel(relPath)
  if (safe === null) return null
  const full = safe ? path.join(root, ...safe.split('/')) : root
  const resolved = path.resolve(full)
  const relToRoot = path.relative(root, resolved)
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return null
  return resolved
}

function sanitizeTreeName (name) {
  const n = String(name || '').trim()
  if (!n || n === '.' || n === '..') return null
  if (/[\\/]/.test(n)) return null
  return n
}

function fileFromArgv (argv) {
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (!a || a.startsWith('-')) continue
    try {
      if (fs.existsSync(a) && fs.statSync(a).isFile() && allowedOpenExt(a)) return path.resolve(a)
    } catch (_) {}
  }
  return null
}

function soundsDir () {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sounds')
  }
  return path.join(__dirname, '../../sounds')
}

/** 环境音文件名（与 sounds 目录下资源一致）；按序尝试 */
const AMBIENT_FILES = {
  rain: ['雨声.mp3', 'rain.mp3'],
  forest: ['森林.mp3', 'forest.mp3'],
  ocean: ['海洋.wav', 'ocean.wav'],
  wind: ['城市.mp3', 'city.mp3', 'wind.mp3'],
  fire: ['篝火.mp3', 'fire.mp3'],
  cafe: ['咖啡馆.mp3', 'cafe.mp3']
}

function resolveAmbientPath (type) {
  const names = AMBIENT_FILES[type]
  if (!names) return null
  const dir = soundsDir()
  for (const name of names) {
    const full = path.join(dir, name)
    if (fs.existsSync(full)) return full
  }
  return null
}

async function saveAsDialog (content, opts = {}) {
  const title = opts.title || '保存'
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '文本', extensions: ['txt'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  })
  if (canceled || !filePath) return { error: 'cancelled' }
  fs.writeFileSync(filePath, content, 'utf8')
  addRecent(filePath)
  return filePath
}

function windowIconPath () {
  const png = path.join(__dirname, '../../build/icon.png')
  const ico = path.join(__dirname, '../../build/icon.ico')
  if (fs.existsSync(png)) return png
  if (fs.existsSync(ico)) return ico
  return undefined
}

/** asar 解包后 preload 在 app.asar.unpacked 下，需解析真实路径 */
function preloadScriptPath () {
  const p = path.join(__dirname, 'preload.js')
  if (fs.existsSync(p)) return p
  const u = p.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1')
  return u !== p && fs.existsSync(u) ? u : p
}

/** macOS Dock / 程序坞图标（与 .app 内 icon.icns 一致，避免仅显示默认 Electron 图标） */
function setMacDockIcon () {
  if (process.platform !== 'darwin') return
  try {
    const icns = path.join(process.resourcesPath, 'icon.icns')
    const png = path.join(__dirname, '../../build/icon.png')
    if (app.isPackaged && fs.existsSync(icns)) {
      app.dock.setIcon(icns)
    } else if (fs.existsSync(png)) {
      app.dock.setIcon(png)
    }
  } catch (e) {
    console.warn('[dock icon]', e.message)
  }
}

/** 毛玻璃：透明底以便 WebView 与系统磨砂；非毛玻璃用白底 */
function syncGlassWindowBackground (theme) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.setBackgroundColor(theme === 'glass' ? '#00000000' : '#FFFFFFFF')
  } catch (e) {
    console.warn('[window background]', e.message)
  }
}

/** macOS 毛玻璃：无自定义壁纸时用 under-window，与开发/打包一致 */
function syncMacVibrancy (theme) {
  syncGlassWindowBackground(theme)
  if (process.platform !== 'darwin' || !mainWindow || mainWindow.isDestroyed()) return
  try {
    const useUnderWindow = theme === 'glass' && !hasGlassCustomBg()
    if (useUnderWindow) {
      mainWindow.setVibrancy('under-window')
    } else {
      mainWindow.setVibrancy(null)
    }
  } catch (e) {
    console.warn('[mac vibrancy]', e.message)
  }
}

function createWindow () {
  const { width, height } = config.windowBounds || { width: 1100, height: 720 }
  const glassTheme = (config.theme || 'light') === 'glass'
  const winAcrylic = glassTheme && !hasGlassCustomBg()
  const winOpts = {
    width,
    height,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    /* 与 npm start 一致：Mac/Win 均用透明窗口，由 syncGlassWindowBackground 按主题再设底色 */
    transparent: true,
    /* transparent 时 Electron 默认 hasShadow=false，窗口贴桌面时缺少轮廓；显式打开系统阴影 */
    hasShadow: true,
    backgroundColor: '#00000000',
    backgroundMaterial: process.platform === 'win32' && winAcrylic ? 'acrylic' : 'none',
    icon: windowIconPath(),
    show: false,
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  }
  /* 无边框窗口下使用系统原生红绿灯；略加大留白贴近 HIG */
  if (process.platform === 'darwin') {
    winOpts.trafficLightPosition = { x: 20, y: 15 }
  }
  const win = new BrowserWindow(winOpts)
  try {
    win.setHasShadow(true)
  } catch (_) {}
  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(true)
  }
  let shown = false
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      shown = true
      win.show()
      sendWinState(win)
    }
  })
  /* 极少数环境 ready-to-show 不触发，避免窗口永远隐藏 */
  setTimeout(() => {
    if (!win.isDestroyed() && !shown && !win.isVisible()) {
      try {
        win.show()
      } catch (_) {}
    }
  }, 5000)
  win.webContents.on('did-fail-load', (event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    console.error('[did-fail-load]', code, desc, url)
    if (app.isPackaged) {
      try {
        dialog.showErrorBox('界面加载失败', `${desc}\n(代码 ${code})\n若从网络下载，请检查是否完整解压到「应用程序」后再打开。`)
      } catch (_) {}
    }
  })
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  win.on('resize', () => {
    if (process.platform === 'win32' && winCustomMaximized) {
      const area = screen.getDisplayMatching(win.getBounds()).workArea
      const b = win.getBounds()
      if (b.width !== area.width || b.height !== area.height || b.x !== area.x || b.y !== area.y) {
        winCustomMaximized = false
        winRestoreBounds = null
        sendWinState(win)
      }
    }
    const [w, h] = win.getSize()
    config.windowBounds = { width: w, height: h }
    saveConfigDisk({ windowBounds: config.windowBounds })
  })
  win.on('maximize', () => sendWinState(win))
  win.on('unmaximize', () => {
    winCustomMaximized = false
    winRestoreBounds = null
    sendWinState(win)
  })
  win.on('restore', () => {
    winCustomMaximized = false
    winRestoreBounds = null
    sendWinState(win)
  })
  win.on('closed', () => { mainWindow = null })
  mainWindow = win
  const th = config.theme || 'light'
  syncMacVibrancy(th)
  syncWinGlassMaterial(th)
}

function buildMenu () {
  const send = (ch, ...args) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(ch, ...args)
  }
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => send('menu-new') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => send('menu-open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('menu-save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu-save-as') },
        { type: 'separator' },
        { label: '导出 HTML…', click: () => send('menu-export-html') },
        { label: '导出短图（小红书 3:4）…', click: () => send('menu-export-xhs-short') },
        { label: '导出长图（小红书 3:4）…', click: () => send('menu-export-xhs-long') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : [])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: '查找…', accelerator: 'CmdOrCtrl+F', click: () => send('menu-find') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '切换预览', accelerator: 'CmdOrCtrl+Shift+V', click: () => send('menu-toggle-preview') },
        { label: '专注模式', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('menu-focus-mode') },
        { type: 'separator' },
        { label: '浅色主题', click: () => send('menu-theme', 'light') },
        { label: '深色主题', click: () => send('menu-theme', 'dark') },
        { label: '毛玻璃主题', click: () => send('menu-theme', 'glass') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const p = fileFromArgv(argv)
    if (mainWindow) {
      if (p) mainWindow.webContents.send('open-file-path', p)
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else {
      pendingInitialPath = p
    }
  })

  if (process.platform === 'darwin') {
    app.on('open-file', (event, filePath) => {
      event.preventDefault()
      if (!allowedOpenExt(filePath)) return
      const abs = path.resolve(filePath)
      if (mainWindow) mainWindow.webContents.send('open-file-path', abs)
      else pendingInitialPath = abs
    })
  }

  app.whenReady().then(() => {
    loadConfig()
    setMacDockIcon()
    pendingInitialPath = pendingInitialPath || fileFromArgv(process.argv)
    createWindow()
    buildMenu()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function sendWinState (win) {
  if (!win || win.isDestroyed()) return
  const maximized = process.platform === 'win32'
    ? winCustomMaximized
    : win.isMaximized()
  win.webContents.send('win-state', maximized ? 'maximized' : 'normal')
}

ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => {
  const win = mainWindow
  if (!win || win.isDestroyed()) return

  if (process.platform === 'win32') {
    if (winCustomMaximized) {
      if (winRestoreBounds) win.setBounds(winRestoreBounds)
      winCustomMaximized = false
      winRestoreBounds = null
      sendWinState(win)
      return
    }
    winRestoreBounds = win.getBounds()
    const area = screen.getDisplayMatching(winRestoreBounds).workArea
    win.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height })
    winCustomMaximized = true
    sendWinState(win)
    return
  }

  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  setImmediate(() => sendWinState(win))
})
ipcMain.handle('win-get-state', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return 'normal'
  if (process.platform === 'win32') return winCustomMaximized ? 'maximized' : 'normal'
  return mainWindow.isMaximized() ? 'maximized' : 'normal'
})
ipcMain.on('win-close', () => mainWindow?.close())
ipcMain.on('show-in-folder', (_, p) => {
  if (!p) return
  try {
    const st = fs.statSync(p)
    if (st.isDirectory()) shell.openPath(p)
    else shell.showItemInFolder(p)
  } catch (_) {
    try { shell.showItemInFolder(p) } catch (e2) { console.warn('[show-in-folder]', e2.message) }
  }
})

/** Cursor 调试会话 NDJSON：写入仓库根 `debug-45714f.log`（渲染进程 ingest fetch 可能不落盘） */
function debugSessionLogFile () {
  try {
    return path.join(app.getAppPath(), '..', '..', 'debug-45714f.log')
  } catch (_) {
    return path.join(app.getPath('userData'), 'debug-45714f.log')
  }
}
ipcMain.handle('debug-session-log', (_, entry) => {
  try {
    const line = typeof entry === 'string' ? entry : JSON.stringify(entry)
    fs.appendFileSync(debugSessionLogFile(), line + '\n', 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e && e.message) }
  }
})

ipcMain.handle('get-config', () => ({ ...config }))
function syncWinGlassMaterial (theme) {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return
  try {
    const acrylic = theme === 'glass' && !hasGlassCustomBg()
    mainWindow.setBackgroundMaterial(acrylic ? 'acrylic' : 'none')
  } catch (e) {
    console.warn('[win material]', e.message)
  }
}

ipcMain.handle('save-config', (_, partial) => {
  saveConfigDisk(partial)
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'theme')) {
    syncMacVibrancy(partial.theme)
    syncWinGlassMaterial(partial.theme)
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'bgImagePath')) {
    syncMacVibrancy(config.theme)
    syncWinGlassMaterial(config.theme)
  }
  return { ok: true }
})

ipcMain.handle('sync-mac-vibrancy', (_, theme) => {
  syncMacVibrancy(theme)
  syncWinGlassMaterial(theme)
  return { ok: true }
})

ipcMain.handle('consume-initial-file', () => {
  const p = pendingInitialPath
  pendingInitialPath = null
  return p
})

ipcMain.handle('open-file-by-path', async (_, filePath) => {
  if (!filePath || !allowedOpenExt(filePath)) return { error: 'unsupported' }
  try {
    const abs = path.resolve(filePath)
    const content = fs.readFileSync(abs, 'utf8')
    addRecent(abs)
    return { content, filePath: abs, readOnly: isReadOnlyCodeDoc(abs) }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('open-file', async () => {
  const codeExts = [...CODE_DOC_READONLY_EXT].map(e => e.slice(1))
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 与文本', extensions: ['md', 'markdown', 'txt'] },
      { name: '代码与配置（只读打开）', extensions: codeExts }
    ]
  })
  if (canceled || !filePaths || !filePaths[0]) return null
  const filePath = filePaths[0]
  if (!allowedOpenExt(filePath)) return { error: 'unsupported' }
  const content = fs.readFileSync(filePath, 'utf8')
  addRecent(filePath)
  const abs = path.resolve(filePath)
  return { content, filePath: abs, readOnly: isReadOnlyCodeDoc(abs) }
})

ipcMain.handle('read-file', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return { content, filePath }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('save-file', async (_, { filePath, content }) => {
  if (filePath) {
    if (isReadOnlyCodeDoc(filePath)) return { error: 'read-only-doc' }
    try {
      fs.writeFileSync(filePath, content, 'utf8')
      addRecent(filePath)
      return filePath
    } catch (e) {
      return { error: String(e.message) }
    }
  }
  return saveAsDialog(content, { title: '保存' })
})

ipcMain.handle('save-file-as', async (_, { content }) => saveAsDialog(content, { title: '另存为' }))

ipcMain.handle('new-file', async (_, { hasChanges }) => {
  if (!hasChanges) return { action: 'discard' }
  const r = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['保存', '不保存', '取消'],
    defaultId: 0,
    cancelId: 2,
    message: '是否保存对当前文档的更改？'
  })
  if (r.response === 2) return { action: 'cancel' }
  if (r.response === 0) return { action: 'save' }
  return { action: 'discard' }
})

ipcMain.handle('get-recent-files', () => [...(config.recentFiles || [])])

ipcMain.handle('export-html', async (_, { html, title }) => {
  const safeTitle = (title || 'export').replace(/[\\/:*?"<>|]/g, '_')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 HTML',
    defaultPath: `${safeTitle}.html`,
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }]
  })
  if (canceled || !filePath) return
  const doc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(String(title || ''))}</title></head><body>\n${html}\n</body></html>`
  fs.writeFileSync(filePath, doc, 'utf8')
})

/** mobimark 包根目录（含 node_modules），相对 `src/main` 的上两级 */
function mobimarkRootDir () {
  return path.join(__dirname, '..', '..')
}

/**
 * 与预览区一致的 PDF 文档：#preview-content + 字体 + style.css + hljs。
 * 使用 file:// 绝对路径引用资源；由调用方写入临时文件后以 loadFile 打开（data: 页无法稳定加载 file: 样式）。
 */
function buildPdfExportDocument ({ html, title, theme, fontFamily }) {
  const root = mobimarkRootDir()
  const relToHref = (rel) => pathToFileURL(path.join(root, rel)).href
  const styleHref = pathToFileURL(path.join(__dirname, '..', 'renderer', 'style.css')).href

  const fontRels = [
    'node_modules/@fontsource-variable/inter/index.css',
    'node_modules/@fontsource/noto-sans-sc/latin-400.css',
    'node_modules/@fontsource/noto-sans-sc/latin-500.css',
    'node_modules/@fontsource/noto-sans-sc/latin-600.css',
    'node_modules/@fontsource/noto-sans-sc/latin-700.css',
    'node_modules/@fontsource/noto-sans-sc/chinese-simplified-400.css',
    'node_modules/@fontsource/noto-sans-sc/chinese-simplified-500.css',
    'node_modules/@fontsource/noto-sans-sc/chinese-simplified-600.css',
    'node_modules/@fontsource/noto-sans-sc/chinese-simplified-700.css',
    'node_modules/@fontsource/jetbrains-mono/latin-400.css',
    'node_modules/@fontsource/jetbrains-mono/latin-500.css',
    'node_modules/@fontsource/jetbrains-mono/latin-600.css',
    'node_modules/@fontsource/jetbrains-mono/latin-700.css',
    'node_modules/@fontsource/noto-serif-sc/latin-400.css',
    'node_modules/@fontsource/noto-serif-sc/latin-500.css',
    'node_modules/@fontsource/noto-serif-sc/latin-600.css',
    'node_modules/@fontsource/noto-serif-sc/latin-700.css',
    'node_modules/@fontsource/noto-serif-sc/chinese-simplified-400.css',
    'node_modules/@fontsource/noto-serif-sc/chinese-simplified-500.css',
    'node_modules/@fontsource/noto-serif-sc/chinese-simplified-600.css',
    'node_modules/@fontsource/noto-serif-sc/chinese-simplified-700.css',
    'node_modules/@fontsource/ibm-plex-sans/latin-400.css',
    'node_modules/@fontsource/ibm-plex-sans/latin-500.css',
    'node_modules/@fontsource/ibm-plex-sans/latin-600.css',
    'node_modules/@fontsource/ibm-plex-sans/latin-700.css',
    'node_modules/font-smiley-sans/style.css'
  ]
  const fontLinks = fontRels.map((rel) => `<link rel="stylesheet" href="${relToHref(rel)}">`).join('\n')

  const th = theme === 'dark' ? 'dark' : theme === 'glass' ? 'glass' : 'light'
  const hljsFile = th === 'dark' ? 'github-dark.min.css' : 'github.min.css'
  const hljsHref = relToHref(`node_modules/highlight.js/styles/${hljsFile}`)

  const bodyClasses = ['theme-' + th]
  if (fontFamily && fontFamily !== 'system' && ['songti', 'kaiti', 'mono', 'sourcehan'].includes(fontFamily)) {
    bodyClasses.push('font-' + fontFamily)
  }

  const safeTitle = escapeHtml(String(title || ''))

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
${fontLinks}
<link rel="stylesheet" href="${styleHref}">
<link rel="stylesheet" href="${hljsHref}">
<style>
/* PDF 导出：去掉应用壳 html/body 的 overflow:hidden，避免长文档被裁切 */
html, body {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
}
body {
  margin: 0;
  padding: 24px;
  box-sizing: border-box;
  background: var(--bg-preview, #f7fafe);
  color: var(--t1, #2b343a);
}
</style>
</head>
<body class="${bodyClasses.join(' ')}">
<div id="preview-content">${html}</div>
</body>
</html>`
}

ipcMain.handle('export-pdf', async (_, { html, title, theme, fontFamily }) => {
  const safeTitle = (title || 'export').replace(/[\\/:*?"<>|]/g, '_')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 PDF',
    defaultPath: `${safeTitle}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath || !mainWindow) return { error: 'cancelled' }
  const t = theme || config.theme || 'light'
  const ff = fontFamily !== undefined && fontFamily !== null ? fontFamily : (config.fontFamily || 'system')
  const wrapped = buildPdfExportDocument({ html, title, theme: t, fontFamily: ff })
  const tmpPath = path.join(app.getPath('temp'), `pongrabbit-pdf-${process.pid}-${Date.now()}.html`)
  const pdfWin = new BrowserWindow({ show: false })
  try {
    fs.writeFileSync(tmpPath, wrapped, 'utf8')
    await pdfWin.loadFile(tmpPath)
    await pdfWin.webContents.executeJavaScript('document.fonts.ready').catch(() => {})
    const data = await pdfWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' }
    })
    fs.writeFileSync(filePath, data)
    return { filePath }
  } catch (e) {
    return { error: String(e.message) }
  } finally {
    try {
      fs.unlinkSync(tmpPath)
    } catch (_) {}
    pdfWin.close()
  }
})

ipcMain.handle('xhs-export-pick-dir', async () => {
  if (!mainWindow) return { cancelled: true }
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: '选择保存位置（将在此创建以文档标题命名的文件夹并放入短图）',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || !filePaths || !filePaths[0]) return { cancelled: true }
  return { path: filePaths[0] }
})

ipcMain.handle('xhs-export-save-long-path', async (_, { defaultTitle }) => {
  if (!mainWindow) return { cancelled: true }
  const safeTitle = (defaultTitle || 'export').replace(/[\\/:*?"<>|]/g, '_')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '导出长图 PNG',
    defaultPath: `${safeTitle}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }]
  })
  if (canceled || !filePath) return { cancelled: true }
  return { filePath }
})

ipcMain.handle('xhs-export-write-one', async (_, { filePath, data }) => {
  try {
    const raw = typeof data === 'string' && data.includes(',') ? data.split(',').pop() : data
    fs.writeFileSync(filePath, Buffer.from(raw, 'base64'))
    return { ok: true }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('xhs-export-write-many', async (_, { parentPath, folderName, files }) => {
  try {
    const safe = (folderName || 'export').replace(/[\\/:*?"<>|]/g, '_').trim() || 'export'
    const dir = path.join(parentPath, safe)
    fs.mkdirSync(dir, { recursive: true })
    for (const { name, data } of files) {
      const raw = typeof data === 'string' && data.includes(',') ? data.split(',').pop() : data
      const fn = String(name || 'page.png').replace(/[\\/]/g, '_')
      fs.writeFileSync(path.join(dir, fn), Buffer.from(raw, 'base64'))
    }
    return { ok: true, dir }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('pick-bg-image', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
  })
  if (canceled || !filePaths || !filePaths[0]) return null
  return filePaths[0]
})

const BG_IMAGE_MAX_BYTES = 30 * 1024 * 1024

ipcMain.handle('load-bg-image-data-url', async (_, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { error: 'no-path' }
  let abs
  try {
    abs = path.resolve(filePath.trim())
  } catch (e) {
    return { error: String(e.message) }
  }
  if (!fs.existsSync(abs)) return { error: 'not-found' }
  let st
  try {
    st = fs.statSync(abs)
  } catch (e) {
    return { error: String(e.message) }
  }
  if (!st.isFile()) return { error: 'not-file' }
  if (st.size > BG_IMAGE_MAX_BYTES) return { error: 'too-large' }
  const ext = path.extname(abs).toLowerCase()
  const mime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  }[ext]
  if (!mime) return { error: 'unsupported-type' }
  try {
    const buf = fs.readFileSync(abs)
    const b64 = buf.toString('base64')
    return { dataUrl: `data:${mime};base64,${b64}` }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('pick-music-folder', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (canceled || !filePaths || !filePaths[0]) return null
  return filePaths[0]
})

ipcMain.handle('scan-music-folder', async (_, folder) => {
  if (!folder || !fs.existsSync(folder)) return []
  const names = fs.readdirSync(folder)
  const tracks = []
  for (const name of names) {
    const ext = path.extname(name).toLowerCase()
    if (!AUDIO_EXT.has(ext)) continue
    const full = path.join(folder, name)
    try {
      if (fs.statSync(full).isFile()) tracks.push({ name, path: full })
    } catch (_) {}
  }
  tracks.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  return tracks
})

ipcMain.handle('get-sounds-path', () => soundsDir())

ipcMain.handle('get-ambient-audio-url', (_, type) => {
  const p = resolveAmbientPath(String(type || ''))
  if (!p) return null
  try {
    return pathToFileURL(p).href
  } catch (e) {
    console.warn('[ambient]', e.message)
    return null
  }
})

ipcMain.handle('workspace-pick-root', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: '选择工作区文件夹',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || !filePaths || !filePaths[0]) return { cancelled: true }
  const abs = path.resolve(filePaths[0])
  saveConfigDisk({ workspaceRoot: abs })
  return { root: abs }
})

ipcMain.handle('workspace-get-root', () => {
  const r = workspaceRootResolved()
  return { root: r || '', configured: !!(config.workspaceRoot && String(config.workspaceRoot).trim()) }
})

ipcMain.handle('workspace-list-dir', (_, relPath) => {
  const root = workspaceRootResolved()
  if (!root) return { error: 'no-workspace' }
  const safe = normalizeWorkspaceRel(relPath)
  if (safe === null) return { error: 'invalid-path' }
  const dir = safe ? path.join(root, ...safe.split('/')) : root
  const resolved = path.resolve(dir)
  const relToRoot = path.relative(root, resolved)
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return { error: 'invalid-path' }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return { error: 'not-dir' }
  let names
  try {
    names = fs.readdirSync(resolved)
  } catch (e) {
    return { error: String(e.message) }
  }
  const entries = []
  for (const name of names) {
    if (name === '.' || name === '..') continue
    const full = path.join(resolved, name)
    let st
    try {
      st = fs.statSync(full)
    } catch (_) {
      continue
    }
    const entryRel = safe ? `${safe}/${name}` : name
    if (st.isDirectory()) {
      entries.push({ name, relPath: entryRel.replace(/\\/g, '/'), isDirectory: true })
    } else if (st.isFile() && allowedOpenExt(full)) {
      entries.push({ name, relPath: entryRel.replace(/\\/g, '/'), isDirectory: false })
    }
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  return { entries }
})

ipcMain.handle('workspace-mkdir', (_, relParent, name) => {
  const root = workspaceRootResolved()
  if (!root) return { error: 'no-workspace' }
  const n = sanitizeTreeName(name)
  if (!n) return { error: 'bad-name' }
  const parentSafe = normalizeWorkspaceRel(relParent)
  if (parentSafe === null) return { error: 'invalid-path' }
  const parentAbs = parentSafe ? path.join(root, ...parentSafe.split('/')) : root
  const parentRes = path.resolve(parentAbs)
  const relToRoot = path.relative(root, parentRes)
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return { error: 'invalid-path' }
  if (!fs.existsSync(parentRes) || !fs.statSync(parentRes).isDirectory()) return { error: 'not-dir' }
  const dest = path.join(parentRes, n)
  if (fs.existsSync(dest)) return { error: 'exists' }
  try {
    fs.mkdirSync(dest, { recursive: false })
    const rel = parentSafe ? `${parentSafe}/${n}` : n
    return { relPath: rel.replace(/\\/g, '/') }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('workspace-create-file', (_, relParent, name) => {
  const root = workspaceRootResolved()
  if (!root) return { error: 'no-workspace' }
  let n = sanitizeTreeName(name)
  if (!n) return { error: 'bad-name' }
  const ext = path.extname(n).toLowerCase()
  if (!ext) {
    n += '.md'
  } else if (!ALLOW_EXT.includes(ext)) {
    return { error: 'bad-ext' }
  }
  const parentSafe = normalizeWorkspaceRel(relParent)
  if (parentSafe === null) return { error: 'invalid-path' }
  const parentAbs = parentSafe ? path.join(root, ...parentSafe.split('/')) : root
  const parentRes = path.resolve(parentAbs)
  const relToRoot = path.relative(root, parentRes)
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return { error: 'invalid-path' }
  if (!fs.existsSync(parentRes) || !fs.statSync(parentRes).isDirectory()) return { error: 'not-dir' }
  const dest = path.join(parentRes, n)
  if (fs.existsSync(dest)) return { error: 'exists' }
  try {
    fs.writeFileSync(dest, '', 'utf8')
    const rel = parentSafe ? `${parentSafe}/${n}` : n
    return { relPath: rel.replace(/\\/g, '/'), filePath: dest }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('workspace-delete', (_, relPath, isDirectory) => {
  const abs = absInWorkspace(relPath)
  if (!abs) return { error: 'invalid-path' }
  if (abs === workspaceRootResolved()) return { error: 'denied' }
  try {
    const st = fs.statSync(abs)
    if (isDirectory) {
      if (!st.isDirectory()) return { error: 'not-dir' }
      fs.rmSync(abs, { recursive: true, force: true })
    } else {
      if (!st.isFile()) return { error: 'not-file' }
      fs.unlinkSync(abs)
    }
    return { ok: true }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('workspace-rename', (_, relPath, newName) => {
  const abs = absInWorkspace(relPath)
  if (!abs) return { error: 'invalid-path' }
  const nn = sanitizeTreeName(newName)
  if (!nn) return { error: 'bad-name' }
  const dest = path.join(path.dirname(abs), nn)
  if (fs.existsSync(dest)) return { error: 'exists' }
  try {
    fs.renameSync(abs, dest)
    const newRel = path.relative(workspaceRootResolved(), dest).replace(/\\/g, '/')
    return { relPath: newRel, filePath: dest }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('workspace-read-file', (_, relPath) => {
  const abs = absInWorkspace(relPath)
  if (!abs) return { error: 'invalid-path' }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { error: 'not-file' }
  if (!allowedOpenExt(abs)) return { error: 'unsupported' }
  try {
    const content = fs.readFileSync(abs, 'utf8')
    addRecent(abs)
    return { content, filePath: abs, readOnly: isReadOnlyCodeDoc(abs) }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('import-markdown-image', async (_, { mdFilePath }) => {
  const root = workspaceRootResolved()
  let baseDir = null
  if (mdFilePath) {
    try {
      const dir = path.dirname(path.resolve(mdFilePath))
      if (fs.existsSync(dir)) baseDir = dir
    } catch (_) {}
  }
  if (!baseDir && root) baseDir = root
  if (!baseDir || !fs.existsSync(baseDir)) {
    return { error: '请先保存当前文档，或在侧栏选择工作区根文件夹。' }
  }
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: '插入图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
  })
  if (canceled || !filePaths || !filePaths[0]) return { cancelled: true }
  const srcPath = filePaths[0]
  const ext = path.extname(srcPath).toLowerCase()
  if (!IMAGE_EXT_IMPORT.has(ext)) return { error: '不支持的图片格式' }
  const assetsDir = path.join(baseDir, '.pongrabbit-assets')
  try {
    fs.mkdirSync(assetsDir, { recursive: true })
    const destName = crypto.randomUUID() + ext
    const destAbs = path.join(assetsDir, destName)
    fs.copyFileSync(srcPath, destAbs)
    const mdRel = '.pongrabbit-assets/' + destName.replace(/\\/g, '/')
    const fileUrl = pathToFileURL(destAbs).href
    return { fileUrl, mdRel }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('resolve-markdown-image', (_, mdFilePath, src) => {
  const s = String(src || '').trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('file:')) {
    try {
      const p = fileURLToPath(s)
      if (fs.existsSync(p)) return pathToFileURL(p).href
    } catch (_) {}
    return s
  }
  let base = null
  if (mdFilePath) {
    try {
      base = path.dirname(path.resolve(mdFilePath))
    } catch (_) {}
  }
  const wr = workspaceRootResolved()
  if (!base && wr) base = wr
  if (!base || !fs.existsSync(base)) return null
  const combined = path.isAbsolute(s) ? path.resolve(s) : path.resolve(base, s)
  try {
    if (!fs.existsSync(combined) || !fs.statSync(combined).isFile()) return null
    return pathToFileURL(combined).href
  } catch (_) {
    return null
  }
})

ipcMain.handle('hljs-highlight', async (_, code, lang) => {
  const hljs = require('highlight.js')
  const text = String(code ?? '')
  const l = String(lang || '').trim()
  try {
    if (l && hljs.getLanguage(l)) {
      return { value: hljs.highlight(text, { language: l }).value }
    }
    return { value: hljs.highlightAuto(text).value }
  } catch (e) {
    return { value: escapeHtml(text) }
  }
})

function escapeHtml (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
