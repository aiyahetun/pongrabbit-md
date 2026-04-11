const { contextBridge, ipcRenderer } = require('electron')

/** win32 | darwin | linux — 渲染进程用于平台专属样式 */
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
  pickMusicFolder: () => ipcRenderer.invoke('pick-music-folder'),
  scanMusicFolder: (f) => ipcRenderer.invoke('scan-music-folder', f),
  getSoundsPath: () => ipcRenderer.invoke('get-sounds-path'),
  syncMacVibrancy: (theme) => ipcRenderer.invoke('sync-mac-vibrancy', theme),
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winClose: () => ipcRenderer.send('win-close'),
  onWinState: (cb) => ipcRenderer.on('win-state', (_, s) => cb(s)),
  onOpenFilePath: (cb) => ipcRenderer.on('open-file-path', (_, p) => cb(p)),
  openFileByPath: (p) => ipcRenderer.invoke('open-file-by-path', p),
  consumeInitialFile: () => ipcRenderer.invoke('consume-initial-file'),
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
