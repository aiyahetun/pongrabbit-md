'use strict'
const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

/** 必须先注册 IPC 桥接；若在之前抛错会导致 window.mobiAPI 不存在 → 初始化失败 */
contextBridge.exposeInMainWorld('pengPlatform', process.platform)

contextBridge.exposeInMainWorld('mobiAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (a) => ipcRenderer.invoke('save-file', a),
  saveFileAs: (a) => ipcRenderer.invoke('save-file-as', a),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  newFile: (a) => ipcRenderer.invoke('new-file', a),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  exportHtml: (a) => ipcRenderer.invoke('export-html', a),
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
  winClose: () => ipcRenderer.send('win-close'),
  onWinState: (cb) => ipcRenderer.on('win-state', (_, s) => cb(s)),
  onOpenFilePath: (cb) => ipcRenderer.on('open-file-path', (_, p) => cb(p)),
  openFileByPath: (p) => ipcRenderer.invoke('open-file-by-path', p),
  consumeInitialFile: () => ipcRenderer.invoke('consume-initial-file'),
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
      'menu-find', 'menu-toggle-preview', 'menu-focus-mode', 'menu-theme']
      .forEach(e => ipcRenderer.on(e, (_, ...args) => cb(e, ...args)))
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
