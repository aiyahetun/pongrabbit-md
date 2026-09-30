'use strict'
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { t, localeFromOs, STORES } = require('../shared/i18n')
const pkg = require('../../package.json')

function userConfigPath () {
  const appFolder = (pkg && pkg.name) || 'pongrabbit-md'
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
    return path.join(roaming, appFolder, 'config.json')
  }
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library', 'Application Support', appFolder, 'config.json')
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config')
  return path.join(xdg, appFolder, 'config.json')
}

function readInitialI18n () {
  let locale
  let store
  let musicFolder = ''
  try {
    const raw = fs.readFileSync(userConfigPath(), 'utf8')
    const c = JSON.parse(raw)
    musicFolder = c.musicFolder || ''
    if (c.locale === 'zh' || c.locale === 'en') locale = c.locale
    if (c.store === 'cn' || c.store === 'intl') store = c.store
  } catch (_) {}
  if (!locale) locale = localeFromOs(typeof navigator !== 'undefined' ? navigator.language : 'zh-CN')
  if (!store) store = locale === 'zh' ? 'cn' : 'intl'
  return { locale, store, stores: STORES, musicFolder }
}

const i18nInitial = readInitialI18n()
let uiLocale = i18nInitial.locale

const shellOpenListeners = []
let pendingShellOpenPath = null
ipcRenderer.on('shell-open-file', (_, filePath) => {
  if (!filePath) return
  if (shellOpenListeners.length) {
    for (const cb of shellOpenListeners) cb(filePath)
  } else {
    pendingShellOpenPath = filePath
  }
})

/** 必须先注册 IPC 桥接；若在之前抛错会导致 window.mobiAPI 不存在 → 初始化失败 */
contextBridge.exposeInMainWorld('pengPlatform', process.platform)
contextBridge.exposeInMainWorld('appVersion', pkg.version || '')
contextBridge.exposeInMainWorld('i18nInitial', i18nInitial)

contextBridge.exposeInMainWorld('i18nAPI', {
  t: (key, vars) => t(uiLocale, key, vars),
  getState: () => ipcRenderer.invoke('i18n-state'),
  setLocale: async (locale) => {
    const state = await ipcRenderer.invoke('i18n-set-locale', locale)
    if (state && state.locale) uiLocale = state.locale
    return state
  },
  setStore: (store) => ipcRenderer.invoke('i18n-set-store', store),
  useLocale: (locale) => { uiLocale = locale === 'en' ? 'en' : 'zh' }
})

contextBridge.exposeInMainWorld('mobiAPI', {
  debugSessionLog: (entry) => ipcRenderer.invoke('debug-session-log', entry),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (a) => ipcRenderer.invoke('save-file', a),
  saveFileAs: (a) => ipcRenderer.invoke('save-file-as', a),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  newFile: (a) => ipcRenderer.invoke('new-file', a),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  exportHtml: (a) => ipcRenderer.invoke('export-html', a),
  xhsExportPickDir: () => ipcRenderer.invoke('xhs-export-pick-dir'),
  xhsExportSaveLongPath: (a) => ipcRenderer.invoke('xhs-export-save-long-path', a),
  xhsExportWriteOne: (a) => ipcRenderer.invoke('xhs-export-write-one', a),
  xhsExportWriteMany: (a) => ipcRenderer.invoke('xhs-export-write-many', a),
  licenseStatus: (opts) => ipcRenderer.invoke('license-status', opts),
  licenseActivate: (token) => ipcRenderer.invoke('license-activate', token),
  showInFolder: (p) => ipcRenderer.send('show-in-folder', p),
  pickBgImage: () => ipcRenderer.invoke('pick-bg-image'),
  loadBgImageDataUrl: (fp) => ipcRenderer.invoke('load-bg-image-data-url', fp),
  pickMusicFolder: () => ipcRenderer.invoke('pick-music-folder'),
  scanMusicFolder: (f) => ipcRenderer.invoke('scan-music-folder', f),
  getSoundsPath: () => ipcRenderer.invoke('get-sounds-path'),
  getAmbientAudioUrl: (type) => ipcRenderer.invoke('get-ambient-audio-url', type),
  syncMacVibrancy: (theme) => ipcRenderer.invoke('sync-mac-vibrancy', theme),
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winGetState: () => ipcRenderer.invoke('win-get-state'),
  winClose: () => ipcRenderer.send('win-close'),
  winCloseAllow: () => ipcRenderer.send('win-close-allow'),
  onWinCloseRequest: (cb) => {
    if (typeof cb !== 'function') return
    ipcRenderer.on('win-close-request', () => cb())
  },
  onWinState: (cb) => ipcRenderer.on('win-state', (_, s) => cb(s)),
  openFileByPath: (p) => ipcRenderer.invoke('open-file-by-path', p),
  consumeInitialFile: () => ipcRenderer.invoke('consume-initial-file'),
  reportDocumentPath: (p) => ipcRenderer.send('report-document-path', p),
  workspacePickRoot: () => ipcRenderer.invoke('workspace-pick-root'),
  workspaceGetRoot: () => ipcRenderer.invoke('workspace-get-root'),
  workspaceListDir: (rel) => ipcRenderer.invoke('workspace-list-dir', rel),
  workspaceMkdir: (relParent, name) => ipcRenderer.invoke('workspace-mkdir', relParent, name),
  workspaceCreateFile: (relParent, name) => ipcRenderer.invoke('workspace-create-file', relParent, name),
  workspaceDelete: (relPath, isDirectory) => ipcRenderer.invoke('workspace-delete', relPath, isDirectory),
  workspaceRename: (relPath, newName) => ipcRenderer.invoke('workspace-rename', relPath, newName),
  workspaceReadFile: (rel) => ipcRenderer.invoke('workspace-read-file', rel),
  importMarkdownImage: (opts) => ipcRenderer.invoke('import-markdown-image', opts),
  resolveMarkdownImage: (mdPath, src) => ipcRenderer.invoke('resolve-markdown-image', mdPath, src),
  resolveMarkdownLink: (mdPath, href) => ipcRenderer.invoke('resolve-markdown-link', mdPath, href),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openEula: () => ipcRenderer.invoke('open-eula'),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  /** 本地绝对路径 → file: URL（正确编码中文、空格、全角符号等，供 CSS background / img 使用） */
  pathToFileUrl: (fp) => {
    try {
      if (!fp || typeof fp !== 'string') return ''
      return pathToFileURL(path.normalize(fp)).href
    } catch (_) {
      return ''
    }
  },
  onMenu: (cb) => {
    ['menu-new', 'menu-open', 'menu-save', 'menu-save-as', 'menu-export-html',
      'menu-export-xhs-short', 'menu-export-xhs-long',
      'menu-find', 'menu-compact-blanks', 'menu-toggle-preview', 'menu-focus-mode', 'menu-theme']
      .forEach(e => ipcRenderer.on(e, (_, ...args) => cb(e, ...args)))
  },
  onShellOpenFile: (cb) => {
    if (typeof cb !== 'function') return
    shellOpenListeners.push(cb)
    if (pendingShellOpenPath) {
      const p = pendingShellOpenPath
      pendingShellOpenPath = null
      cb(p)
    }
  }
})

contextBridge.exposeInMainWorld('hljsAPI', {
  highlight: (code, lang) => ipcRenderer.invoke('hljs-highlight', code, lang)
})

contextBridge.exposeInMainWorld('mobiAPIPdf', {
  exportPdf: (a) => ipcRenderer.invoke('export-pdf', a)
})

/** 标题栏图标：单独 try，失败不影响 mobiAPI */
let appIconHref = ''
try {
  const path = require('path')
  const { pathToFileURL } = require('url')
  const abs = path.join(__dirname, '../renderer/icons/app-icon.png')
  appIconHref = pathToFileURL(abs).href
} catch (e) {
  console.error('[preload] appIconSrc', e)
}
contextBridge.exposeInMainWorld('appIconSrc', appIconHref)
