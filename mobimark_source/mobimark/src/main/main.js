'use strict'

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const ALLOW_EXT = ['.md', '.markdown', '.txt']
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'])

let mainWindow = null
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
    glassBlur: 20,
    glassOverlay: 15,
    musicFolder: '',
    musicVolume: 0.6
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

function allowedExt (filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  return ALLOW_EXT.includes(ext)
}

function addRecent (filePath) {
  if (!filePath) return
  const list = config.recentFiles.filter(f => f !== filePath)
  list.unshift(filePath)
  config.recentFiles = list.slice(0, 20)
  saveConfigDisk({ recentFiles: config.recentFiles })
}

function fileFromArgv (argv) {
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (!a || a.startsWith('-')) continue
    try {
      if (fs.existsSync(a) && fs.statSync(a).isFile() && allowedExt(a)) return path.resolve(a)
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

async function saveAsDialog (content) {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '保存',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '文本', extensions: ['txt'] }
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

/** macOS 毛玻璃：原生 vibrancy 材质（与参考 HTML 中 vibrancy-toolbar 一致，优于仅 CSS blur） */
function syncMacVibrancy (theme) {
  if (process.platform !== 'darwin' || !mainWindow || mainWindow.isDestroyed()) return
  try {
    if (theme === 'glass') {
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
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'none',
    icon: windowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  win.on('resize', () => {
    const [w, h] = win.getSize()
    config.windowBounds = { width: w, height: h }
    saveConfigDisk({ windowBounds: config.windowBounds })
  })
  win.on('maximize', () => win.webContents.send('win-state', 'maximized'))
  win.on('unmaximize', () => win.webContents.send('win-state', 'normal'))
  win.on('closed', () => { mainWindow = null })
  mainWindow = win
  syncMacVibrancy(config.theme || 'light')
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
      if (!allowedExt(filePath)) return
      const abs = path.resolve(filePath)
      if (mainWindow) mainWindow.webContents.send('open-file-path', abs)
      else pendingInitialPath = abs
    })
  }

  app.whenReady().then(() => {
    loadConfig()
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

ipcMain.on('win-minimize', () => mainWindow?.minimize())
ipcMain.on('win-maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('win-close', () => mainWindow?.close())
ipcMain.on('show-in-folder', (_, p) => { if (p) shell.showItemInFolder(p) })

ipcMain.handle('get-config', () => ({ ...config }))
ipcMain.handle('save-config', (_, partial) => {
  saveConfigDisk(partial)
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'theme')) {
    syncMacVibrancy(partial.theme)
  }
  return { ok: true }
})

ipcMain.handle('sync-mac-vibrancy', (_, theme) => {
  syncMacVibrancy(theme)
  return { ok: true }
})

ipcMain.handle('consume-initial-file', () => {
  const p = pendingInitialPath
  pendingInitialPath = null
  return p
})

ipcMain.handle('open-file-by-path', async (_, filePath) => {
  if (!filePath || !allowedExt(filePath)) return { error: 'unsupported' }
  try {
    const abs = path.resolve(filePath)
    const content = fs.readFileSync(abs, 'utf8')
    addRecent(abs)
    return { content, filePath: abs }
  } catch (e) {
    return { error: String(e.message) }
  }
})

ipcMain.handle('open-file', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }
    ]
  })
  if (canceled || !filePaths || !filePaths[0]) return null
  const filePath = filePaths[0]
  const content = fs.readFileSync(filePath, 'utf8')
  addRecent(filePath)
  return { content, filePath }
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
    try {
      fs.writeFileSync(filePath, content, 'utf8')
      addRecent(filePath)
      return filePath
    } catch (e) {
      return { error: String(e.message) }
    }
  }
  return saveAsDialog(content)
})

ipcMain.handle('save-file-as', async (_, { content }) => saveAsDialog(content))

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

ipcMain.handle('export-pdf', async (_, { html, title }) => {
  const safeTitle = (title || 'export').replace(/[\\/:*?"<>|]/g, '_')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 PDF',
    defaultPath: `${safeTitle}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath || !mainWindow) return { error: 'cancelled' }
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:24px;}</style></head><body>${html}</body></html>`
  const pdfWin = new BrowserWindow({ show: false })
  try {
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(wrapped))
    const data = await pdfWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' }
    })
    fs.writeFileSync(filePath, data)
    return { filePath }
  } catch (e) {
    return { error: String(e.message) }
  } finally {
    pdfWin.close()
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
