'use strict'
/* ════ pongrabbit-MD v5 ═════════════════════════════════════════ */

if (!window.mobiAPI) {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px"><div style="font-size:18px;font-weight:700">⚠ 初始化失败</div><div style="font-size:13px;opacity:.6">preload.js 未能加载，请重启</div><button type="button" onclick="location.reload()" style="padding:8px 20px;background:#356190;color:#fff;border:none;border-radius:6px;cursor:pointer">重新加载</button></div>'
  throw new Error('mobiAPI not available')
}

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const body       = $('app-body')
const richEditor = $('rich-editor')
const mdEditor   = $('md-editor')
const previewEl  = $('preview-content')
const mainArea   = $('main-area')
const wysiwygPane= $('wysiwyg-pane')
const mdPane     = $('md-pane')
const previewPane= $('preview-pane')
const resizerEl  = $('resizer')
const findBar    = $('find-bar')
const findInput  = $('find-input')
const replaceInput=$('replace-input')
const findCount  = $('find-count')

// ── State ────────────────────────────────────────────────────
let cfg={}, currentFile=null, isModified=false
/** 代码/配置类文档只读打开（与 main.js CODE_DOC_READONLY_EXT 保持同步） */
const READONLY_CODE_EXTS = new Set([
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
let readOnlyDoc = false
let editMode='wysiwyg'  // wysiwyg | markdown | preview | split
let _lastSrc='wysiwyg' // last edited source
let renderTimer=null
let findMatches=[], findIdx=0, isResizing=false
// Audio
let audioCtx=null,noiseNodes=null,noiseType=null
let musicTracks=[],musicIdx=0,musicAudio=null,musicNext=null
let musicPlaying=false,playMode='order',musicVolume=0.6
let treeExpanded=new Set()
let treeContextDir=''
/** 最近一次成功加载的壁纸 data URL，供「自动对比」切换选项时重新估算 */
let lastBgDataUrl = null

// ── Init ─────────────────────────────────────────────────────
function detectPlatform () {
  if (window.pengPlatform === 'darwin' || window.pengPlatform === 'win32' || window.pengPlatform === 'linux') {
    return window.pengPlatform
  }
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'darwin'
  if (/Windows/i.test(ua)) return 'win32'
  return 'linux'
}

async function init() {
  const plat = detectPlatform()
  if (plat === 'darwin') body.classList.add('platform-darwin')
  else if (plat === 'win32') body.classList.add('platform-win32')
  else body.classList.add('platform-linux')
  const appIconEl = $('app-icon')
  if (appIconEl && window.appIconSrc) appIconEl.src = window.appIconSrc
  if (window.mobiAPI.onOpenFilePath) {
    window.mobiAPI.onOpenFilePath(p => { openFileFromPath(p) })
  }
  cfg = await window.mobiAPI.getConfig()
  await applyConfig(cfg)
  setupModeTabs()
  setupRichEditor()
  setupMdToolbar()
  setupTopActions()
  setupStatusBar()
  setupFindBar()
  setupResizer()
  setupPanels()
  setupPromptDialog()
  setupXhsStyleDialog()
  setupWorkspaceSidebar()
  setupKeyboard()
  setupMenu()
  await syncWorkspaceHint()
  await refreshWorkspaceTree()
  await loadRecentFiles()
  setMode('wysiwyg')
  window.mobiAPI.onWinState(s=>$('btn-maximize').textContent=s==='maximized'?'❐':'□')
  // 恢复上次内容（如有）
  if (cfg.pendingContent) {
    mdEditor.value = cfg.pendingContent
    richEditor.innerHTML = md2html(cfg.pendingContent)
    window.mobiAPI.saveConfig({ pendingContent: '' })
    renderPreview()
  }
  const initialPath = await window.mobiAPI.consumeInitialFile()
  if (initialPath) await openFileFromPath(initialPath)
}

/** 系统关联打开 / 第二次实例传入的路径 */
async function openFileFromPath(filePath) {
  if (!filePath) return
  const r = await window.mobiAPI.openFileByPath(filePath)
  if (!r || r.error) return
  applyOpenedDocument(r)
  await loadRecentFiles()
  await refreshWorkspaceTree()
}

function fileExtLower (p) {
  const n = (p || '').replace(/\\/g, '/').split('/').pop() || ''
  const d = n.lastIndexOf('.')
  return d >= 0 ? n.slice(d).toLowerCase() : ''
}

function isReadOnlyCodePath (p) {
  return READONLY_CODE_EXTS.has(fileExtLower(p))
}

function inferReadOnlyFromOpen (r) {
  if (r && typeof r.readOnly === 'boolean') return r.readOnly
  return !!(r && r.filePath && isReadOnlyCodePath(r.filePath))
}

function syncReadOnlyUi () {
  body.classList.toggle('doc-readonly', readOnlyDoc)
  mdEditor.readOnly = readOnlyDoc
  richEditor.contentEditable = readOnlyDoc ? 'false' : 'true'
  const saveBtn = $('btn-save')
  if (saveBtn) saveBtn.disabled = readOnlyDoc
  ;['btn-export-pdf', 'btn-export-html', 'btn-export-xhs-short', 'btn-export-xhs-long'].forEach(id => {
    const el = $(id)
    if (el) el.disabled = readOnlyDoc
  })
  const rep1 = $('find-replace-one')
  const repA = $('find-replace-all')
  if (rep1) rep1.disabled = readOnlyDoc
  if (repA) repA.disabled = readOnlyDoc
  const roTag = $('status-readonly-tag')
  if (roTag) roTag.hidden = !readOnlyDoc
}

/** 载入磁盘文档（Markdown 或可只读打开的代码/配置） */
function applyOpenedDocument (r) {
  if (!r || !r.filePath) return
  mdEditor.value = r.content
  richEditor.innerHTML = md2html(r.content)
  currentFile = r.filePath
  readOnlyDoc = inferReadOnlyFromOpen(r)
  syncReadOnlyUi()
  setModified(false)
  setTitle(bn(r.filePath) + (readOnlyDoc ? ' · 只读' : ''))
  if (readOnlyDoc) {
    _lastSrc = 'md'
    setMode('markdown')
  } else {
    _lastSrc = 'wysiwyg'
    setMode('wysiwyg')
  }
  renderPreview()
  updateStatus()
}

// ── Config ───────────────────────────────────────────────────
function applySidebarCollapsedState (collapsed) {
  body.classList.toggle('sidebar-collapsed', !!collapsed)
  const rail = $('sidebar-rail')
  if (rail) rail.hidden = !collapsed
}

async function applyConfig(c) {
  applyTheme(c.theme||'light', false)
  setFont(c.fontFamily||'system')
  const fs=(c.fontSize||15)+'px', lh=c.lineHeight||1.8
  richEditor.style.fontSize=fs; richEditor.style.lineHeight=lh
  mdEditor.style.fontSize=fs;   mdEditor.style.lineHeight=lh
  await applyBgImage(c.bgImagePath || '')
  applyGlassBlur(c.glassBlur ?? 28)
  applyGlassOverlay(c.glassOverlay ?? 2)
  musicVolume=c.musicVolume!==undefined?c.musicVolume:0.6
  $('volume-slider').value=Math.round(musicVolume*100)
  $('volume-display').textContent=Math.round(musicVolume*100)+'%'
  syncVolumeSliderVar()
  syncUI(c)
  applySidebarCollapsedState(!!c.sidebarCollapsed)
  if(c.musicFolder){$('music-folder-display').textContent=c.musicFolder;loadMusicFolder(c.musicFolder)}
}

function syncUI(c){
  $('font-size-slider').value=c.fontSize||15
  $('font-size-display').textContent=(c.fontSize||15)+'px'
  $('line-height-slider').value=Math.round((c.lineHeight||1.8)*10)
  $('line-height-display').textContent=(c.lineHeight||1.8)
  $('font-family-select').value=c.fontFamily||'system'
  $('word-wrap-toggle').checked=c.wordWrap!==false
  $('blur-slider').value=c.glassBlur ?? 28
  $('blur-display').textContent=($('blur-slider').value)+'px'
  const ov=c.glassOverlay!==undefined?c.glassOverlay:2
  $('overlay-slider').value=ov
  $('overlay-display').textContent=Math.round(ov/60*100)+'%'
  const gtc = $('glass-text-contrast-select')
  if (gtc) gtc.value = c.glassTextContrast || 'auto'
  const bgd=$('bg-path-display')
  if(bgd)bgd.textContent=c.bgImagePath?c.bgImagePath:''
  const sw=$('settings-workspace-display')
  if(sw)sw.textContent=(c.workspaceRoot&&String(c.workspaceRoot).trim())?c.workspaceRoot:'未选择'
}

// ── Theme ────────────────────────────────────────────────────
function applyTheme(theme, save=true) {
  ;[...body.classList].filter(c => /^theme-/.test(c)).forEach(c => body.classList.remove(c))
  body.classList.add('theme-' + theme)
  cfg.theme = theme
  const hl=$('hljs-light'),hd=$('hljs-dark')
  if(hl&&hd){hl.disabled=theme==='dark';hd.disabled=theme!=='dark'}
  const gs=$('glass-settings')
  if(gs)gs.style.display=theme==='glass'?'':'none'
  ;['light','dark','glass'].forEach(t=>{
    const b=$('btn-theme-'+t)
    if(b){
      const on=t===theme
      b.classList.toggle('theme-seg-active',on)
      b.setAttribute('aria-pressed',on?'true':'false')
    }
  })
  if (window.mobiAPI.syncMacVibrancy) {
    window.mobiAPI.syncMacVibrancy(theme).catch(() => {})
  }
  if (theme !== 'glass') {
    body.classList.remove('glass-onwall-light-text')
  } else if (body.classList.contains('glass-has-bg')) {
    syncWallpaperTextContrast(lastBgDataUrl).catch(() => {})
  }
  refreshGlassEffects()
  syncGlassContrastSelectAvailability()
  if(save) save_cfg({theme})
}
async function setTheme(t){
  applyTheme(t)
  await window.mobiAPI.saveConfig({theme:t})
  // 无需重建窗口，CSS 变量切换即时生效
}

function setFont(f){
  body.classList.remove('font-songti','font-kaiti','font-mono','font-sourcehan')
  if(f!=='system')body.classList.add('font-'+f);cfg.fontFamily=f
}
function detectWallpaperIsDark (dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve(false)
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const w = 48, h = 48
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(false)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        let sum = 0
        let n = 0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 12) continue
          sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          n++
        }
        const luma = n ? sum / n : 0.5
        resolve(luma < 0.44)
      } catch (_) {
        resolve(false)
      }
    }
    img.onerror = () => resolve(false)
    img.src = dataUrl
  })
}

function syncGlassContrastSelectAvailability () {
  const gtc = $('glass-text-contrast-select')
  if (!gtc) return
  const glass = body.classList.contains('theme-glass')
  const hasBg = body.classList.contains('glass-has-bg')
  const hint = '自动会按背景图明暗切换文字颜色；也可手动指定'
  if (!glass) {
    gtc.disabled = false
    gtc.title = hint
    return
  }
  gtc.disabled = !hasBg
  gtc.title = hasBg ? hint : '无背景图时此项无效；请先选择背景图'
}

async function syncWallpaperTextContrast (dataUrlForAuto) {
  body.classList.remove('glass-onwall-light-text')
  if (!body.classList.contains('theme-glass') || !body.classList.contains('glass-has-bg')) return
  const mode = cfg.glassTextContrast || 'auto'
  if (mode === 'light_on_wp') {
    body.classList.add('glass-onwall-light-text')
    return
  }
  if (mode === 'dark_on_wp') return
  const url = dataUrlForAuto || lastBgDataUrl
  if (!url) return
  const isDark = await detectWallpaperIsDark(url)
  if (isDark) body.classList.add('glass-onwall-light-text')
}

async function applyBgImage(p){
  const layer=$('bg-layer')
  if(!p){
    if(layer)layer.style.backgroundImage=''
    body.classList.remove('glass-has-bg')
    lastBgDataUrl = null
    body.classList.remove('glass-onwall-light-text')
    refreshGlassEffects()
    syncGlassContrastSelectAvailability()
    return
  }
  if(!layer){
    syncGlassContrastSelectAvailability()
    return
  }
  if(typeof window.mobiAPI.loadBgImageDataUrl!=='function'){
    console.warn('[bg] loadBgImageDataUrl 不可用')
    body.classList.remove('glass-has-bg')
    lastBgDataUrl = null
    body.classList.remove('glass-onwall-light-text')
    refreshGlassEffects()
    syncGlassContrastSelectAvailability()
    return
  }
  const r=await window.mobiAPI.loadBgImageDataUrl(p)
  if(r&&r.dataUrl){
    const u=r.dataUrl.replace(/"/g,'\\"')
    layer.style.backgroundImage='url("'+u+'")'
    layer.style.backgroundSize='cover'
    layer.style.backgroundPosition='center'
    layer.style.backgroundRepeat='no-repeat'
    body.classList.add('glass-has-bg')
    lastBgDataUrl = r.dataUrl
    await syncWallpaperTextContrast(r.dataUrl)
  }else{
    layer.style.backgroundImage=''
    body.classList.remove('glass-has-bg')
    lastBgDataUrl = null
    body.classList.remove('glass-onwall-light-text')
    if(r&&r.error)console.warn('[bg]',p,r.error)
  }
  refreshGlassEffects()
  syncGlassContrastSelectAvailability()
}

/** 毛玻璃 + 自定义背景：全屏遮罩可模糊壁纸；无背景图时关闭（避免 blur 糊到 WebView 白底） */
function refreshGlassEffects(){
  applyGlassBlur(cfg.glassBlur ?? 28)
  applyGlassOverlay(cfg.glassOverlay !== undefined ? cfg.glassOverlay : 2)
}

function applyGlassBlur(v){
  const go = $('glass-overlay')
  if (!go) return
  const px = Math.min(Math.max(Number(v) || 0, 4), 48)
  const glassBg = body.classList.contains('theme-glass') && body.classList.contains('glass-has-bg')
  if (glassBg) {
    /* 须压过 stylesheet 里浅色/暗黑主题的 backdrop-filter:none !important（切主题后内联非 important 会不生效） */
    const val = `blur(${px}px) saturate(1.06)`
    go.style.setProperty('backdrop-filter', val, 'important')
    go.style.setProperty('-webkit-backdrop-filter', val, 'important')
    return
  }
  go.style.removeProperty('backdrop-filter')
  go.style.removeProperty('-webkit-backdrop-filter')
}

function applyGlassOverlay(v){
  const go = $('glass-overlay')
  if (!go) return
  const glassBg = body.classList.contains('theme-glass') && body.classList.contains('glass-has-bg')
  if (glassBg) {
    const raw = Math.min(60, Math.max(0, Number(v) || 0))
    const t = raw / 60
    /* 有壁纸时遮罩宜淡：深色系统下黑雾极易把整张图压暗，系数单独压低 */
    const alpha = t * 0.30
    const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    const bg = dark
      ? `rgba(0, 0, 0, ${alpha * 0.48})`
      : `rgba(255, 255, 255, ${alpha * 0.58})`
    go.style.setProperty('background', bg, 'important')
    return
  }
  go.style.removeProperty('background')
}

// ════ 编辑模式 ══════════════════════════════════════════════
function setupModeTabs(){
  $('tab-wysiwyg').onclick=()=>setMode('wysiwyg')
  $('tab-markdown').onclick=()=>setMode('markdown')
  $('tab-preview').onclick=()=>setMode('preview')
  $('tab-split').onclick=()=>setMode('split')
}

function show(el){if(el)el.style.display=''}
function hide(el){if(el)el.style.display='none'}
function showFlex(el){if(el)el.style.display='flex'}

function setMode(mode) {
  if (readOnlyDoc && mode !== 'markdown') mode = 'markdown'
  editMode=mode
  ;['wysiwyg','markdown','preview','split'].forEach(m=>
    $('tab-'+m).classList.toggle('active',m===mode)
  )
  // 同步内容：从 wysiwyg → md，从 md → wysiwyg
  if (mode==='markdown'&&_lastSrc==='wysiwyg') mdEditor.value=richToMd()
  if ((mode==='wysiwyg'||mode==='split'&&_lastSrc==='md')&&_lastSrc==='md') {
    richEditor.innerHTML=md2html(mdEditor.value)
  }

  // 工具栏
  $('rich-toolbar').style.display = mode==='wysiwyg'?'flex':'none'
  $('md-toolbar').style.display   = mode==='markdown'?'flex':'none'

  // 面板
  switch(mode) {
    case 'wysiwyg':
      showFlex(wysiwygPane); hide(mdPane); hide(previewPane); hide(resizerEl)
      wysiwygPane.style.flex='1'; wysiwygPane.style.width=''
      richEditor.focus(); break
    case 'markdown':
      hide(wysiwygPane); showFlex(mdPane); hide(previewPane); hide(resizerEl)
      mdPane.style.flex='1'; mdPane.style.width=''
      mdEditor.focus(); break
    case 'preview':
      hide(wysiwygPane); hide(mdPane); showFlex(previewPane); hide(resizerEl)
      previewPane.style.flex='1'; previewPane.style.width=''
      renderPreview(); break
    case 'split':
      // 左侧：最后活跃的编辑器；右侧：预览
      hide(wysiwygPane); hide(mdPane)
      if(_lastSrc==='md'){
        showFlex(mdPane); mdPane.style.flex='1'; mdPane.style.width=''
        mdEditor.focus()
      } else {
        showFlex(wysiwygPane); wysiwygPane.style.flex='1'; wysiwygPane.style.width=''
        richEditor.focus()
      }
      show(resizerEl)
      showFlex(previewPane); previewPane.style.flex='1'; previewPane.style.width=''
      renderPreview(); break
  }
  const names={wysiwyg:'可视化',markdown:'源码',preview:'预览',split:'分栏预览'}
  $('status-mode').textContent=names[mode]||mode
  updateStatus()
}

// ════ 富文本编辑器 ══════════════════════════════════════════
function setupRichEditor(){
  richEditor.addEventListener('input',()=>{_lastSrc='wysiwyg';setModified(true);scheduleRender();updateStatus()})
  richEditor.addEventListener('keydown',e=>{
    const acc=e.metaKey||e.ctrlKey
    if(acc&&e.key.toLowerCase()==='a'){e.preventDefault();document.execCommand('selectAll');return}
    if(acc){
      switch(e.key.toLowerCase()){
        case 'b':e.preventDefault();document.execCommand('bold');return
        case 'i':e.preventDefault();document.execCommand('italic');return
        case 'u':e.preventDefault();document.execCommand('underline');return
        case 's':e.preventDefault();e.shiftKey?saveFileAs():saveFile();return
        case 'z':if(!e.shiftKey){e.preventDefault();document.execCommand('undo')}return
        case 'y':e.preventDefault();document.execCommand('redo');return
        case 'f':e.preventDefault();showFindBar();return
        case 'n':e.preventDefault();newFile();return
        case 'o':e.preventDefault();openFile();return
      }
    }
    if(e.key==='Tab'){e.preventDefault();document.execCommand('insertHTML',false,'&nbsp;&nbsp;')}
  })
  richEditor.addEventListener('mouseup',updateFmtBtns)
  richEditor.addEventListener('keyup',()=>{_lastSrc='wysiwyg';updateStatus();updateFmtBtns()})

  $('r-bold').onclick=()=>{document.execCommand('bold');updateFmtBtns()}
  $('r-italic').onclick=()=>{document.execCommand('italic');updateFmtBtns()}
  $('r-underline').onclick=()=>{document.execCommand('underline');updateFmtBtns()}
  $('r-strike').onclick=()=>{document.execCommand('strikeThrough');updateFmtBtns()}
  $('r-align-left').onclick=()=>document.execCommand('justifyLeft')
  $('r-align-center').onclick=()=>document.execCommand('justifyCenter')
  $('r-align-right').onclick=()=>document.execCommand('justifyRight')
  $('r-ul').onclick=()=>document.execCommand('insertUnorderedList')
  $('r-ol').onclick=()=>document.execCommand('insertOrderedList')
  $('r-task').onclick=()=>{document.execCommand('insertHTML',false,'<ul><li><input type="checkbox"> 任务项</li></ul>');setModified(true)}
  $('r-quote').onclick=()=>wrapTag('blockquote')
  $('r-code').onclick=()=>wrapTag('code')
  $('r-codeblock').onclick=()=>insertCodeBlock()
  $('r-link').onclick=()=>showLinkDialog()
  $('r-image').onclick=()=>insertMarkdownImageAtCursor()
  $('r-table').onclick=()=>showTableDialog()
  $('r-hr').onclick=()=>document.execCommand('insertHorizontalRule')
  $('btn-find-r').onclick=()=>showFindBar()
  $('heading-select').onchange=function(){
    document.execCommand('formatBlock',false,this.value==='p'?'<p>':'<'+this.value+'>');richEditor.focus()
  }
}

function updateFmtBtns(){
  $('r-bold').classList.toggle('on',document.queryCommandState('bold'))
  $('r-italic').classList.toggle('on',document.queryCommandState('italic'))
  $('r-underline').classList.toggle('on',document.queryCommandState('underline'))
  $('r-strike').classList.toggle('on',document.queryCommandState('strikeThrough'))
  const blk=document.queryCommandValue('formatBlock').toLowerCase()
  const sel=$('heading-select')
  sel.value=['h1','h2','h3','h4'].includes(blk)?blk:'p'
}

function wrapTag(tag){
  const sel=window.getSelection()
  if(!sel.rangeCount)return
  const r=sel.getRangeAt(0),el=document.createElement(tag)
  try{r.surroundContents(el)}catch(e){el.appendChild(r.extractContents());r.insertNode(el)}
  setModified(true);scheduleRender()
}
function insertCodeBlock(){
  const sel=window.getSelection()
  const pre=document.createElement('pre'),code=document.createElement('code')
  code.textContent=sel.rangeCount&&!sel.isCollapsed?sel.getRangeAt(0).toString():'// 代码'
  if(sel.rangeCount&&!sel.isCollapsed)sel.getRangeAt(0).deleteContents()
  pre.appendChild(code)
  document.execCommand('insertHTML',false,pre.outerHTML)
  setModified(true);scheduleRender()
}

// ════ MD 工具栏 ══════════════════════════════════════════════
function setupMdToolbar(){
  mdEditor.addEventListener('input',()=>{_lastSrc='md';setModified(true);scheduleRender();updateStatus()})
  mdEditor.addEventListener('keydown',e=>{
    if(e.key==='Tab'){e.preventDefault();insertMd('  ');return}
    const acc=e.metaKey||e.ctrlKey
    if(acc&&e.key.toLowerCase()==='a'){e.preventDefault();mdEditor.select();return}
    if(acc){
      switch(e.key.toLowerCase()){
        case 'b':e.preventDefault();wrapMd('**','**');return
        case 'i':e.preventDefault();wrapMd('*','*');return
        case 's':e.preventDefault();e.shiftKey?saveFileAs():saveFile();return
        case 'f':e.preventDefault();showFindBar();return
        case 'n':e.preventDefault();newFile();return
        case 'o':e.preventDefault();openFile();return
      }
    }
    if(e.key==='Enter')handleMdEnter(e)
  })
  mdEditor.addEventListener('keyup',()=>{_lastSrc='md';updateStatus()})

  $('fmt-bold').onclick=()=>wrapMd('**','**')
  $('fmt-italic').onclick=()=>wrapMd('*','*')
  $('fmt-strike').onclick=()=>wrapMd('~~','~~')
  $('fmt-h1').onclick=()=>prefixMd('# ')
  $('fmt-h2').onclick=()=>prefixMd('## ')
  $('fmt-h3').onclick=()=>prefixMd('### ')
  $('fmt-quote').onclick=()=>prefixMd('> ')
  $('fmt-code').onclick=()=>wrapMd('`','`')
  $('fmt-codeblock').onclick=()=>wrapMd('\n```\n','\n```\n')
  $('fmt-link').onclick=()=>showLinkDialog()
  $('fmt-image').onclick=()=>insertMarkdownImageAtCursor()
  $('fmt-ul').onclick=()=>prefixMd('- ')
  $('fmt-ol').onclick=()=>prefixMd('1. ')
  $('fmt-task').onclick=()=>prefixMd('- [ ] ')
  $('fmt-table').onclick=()=>showTableDialog()
  $('fmt-hr').onclick=()=>insertMd('\n\n---\n\n')
  $('btn-find-md').onclick=()=>showFindBar()
}

function handleMdEnter(e){
  if(readOnlyDoc)return
  const pos=mdEditor.selectionStart,v=mdEditor.value
  const ls=v.lastIndexOf('\n',pos-1)+1,line=v.substring(ls,pos)
  const tM=line.match(/^(\s*[-*+] )\[[ xX]\] (.*)/)
  const uM=line.match(/^(\s*)([-*+] )(.*)/)
  const oM=line.match(/^(\s*)(\d+)\. (.*)/)
  const bM=line.match(/^(> )(.*)/)
  if(tM&&tM[2].trim()){e.preventDefault();insertMd('\n'+tM[1]+'[ ] ');return}
  if(uM&&uM[3].trim()){e.preventDefault();insertMd('\n'+uM[1]+uM[2]);return}
  if(oM&&oM[3].trim()){e.preventDefault();insertMd('\n'+oM[1]+(parseInt(oM[2])+1)+'. ');return}
  if(bM&&bM[2].trim()){e.preventDefault();insertMd('\n'+bM[1]);return}
}

// ════ 顶部按钮 ══════════════════════════════════════════════
function setupTopActions(){
  $('btn-new').onclick=newFile
  $('btn-open').onclick=openFile
  $('btn-save').onclick=saveFile
  const bsa = $('btn-save-as')
  if (bsa) bsa.onclick = () => { void saveFileAs() }
  $('btn-export-pdf').onclick=exportPdf
  $('btn-export-html').onclick=exportHtml
  $('btn-export-xhs-short').onclick=()=>{void exportXhsShort()}
  $('btn-export-xhs-long').onclick=()=>{void exportXhsLong()}
  $('btn-music').onclick=()=>togglePanel('music-panel')
  $('btn-settings').onclick=()=>togglePanel('settings-panel')
  $('btn-theme-light').onclick=()=>setTheme('light')
  $('btn-theme-dark').onclick=()=>setTheme('dark')
  $('btn-theme-glass').onclick=()=>setTheme('glass')
  $('btn-minimize').onclick=()=>window.mobiAPI.winMinimize()
  $('btn-maximize').onclick=()=>window.mobiAPI.winMaximize()
  $('btn-close').onclick=()=>window.mobiAPI.winClose()
}

function setupStatusBar () {
  const btn = $('btn-copy-doc-path')
  if (!btn) return
  btn.onclick = async () => {
    if (!currentFile) return
    const label = btn.textContent
    try {
      await navigator.clipboard.writeText(currentFile)
      btn.textContent = '已复制'
      setTimeout(() => { btn.textContent = label }, 1400)
    } catch (_) {
      try {
        const ta = document.createElement('textarea')
        ta.value = currentFile
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        btn.textContent = '已复制'
        setTimeout(() => { btn.textContent = label }, 1400)
      } catch (__) {}
    }
  }
}

// ════ 文件操作 ══════════════════════════════════════════════
function getCurrentMd(){
  if(_lastSrc==='md'||editMode==='markdown')return mdEditor.value
  return richToMd()
}
async function newFile(){
  const r=await window.mobiAPI.newFile({hasChanges:isModified})
  if(r.action==='save')await saveFile()
  if(r.action!=='cancel'){
    richEditor.innerHTML='';mdEditor.value='';currentFile=null;readOnlyDoc=false;syncReadOnlyUi()
    setModified(false);setTitle('无题文档');updateStatus()
  }
}
async function openFile(){
  const r=await window.mobiAPI.openFile()
  if(!r)return
  if(r.error){alert(r.error==='unsupported'?'不支持的文件类型。':'无法打开文件。');return}
  applyOpenedDocument(r)
  await loadRecentFiles();await refreshWorkspaceTree()
}
async function saveFile(){
  if(readOnlyDoc){
    alert('当前为只读代码/配置文件。请使用工具栏「另存为」保存到新位置（例如 .md）。')
    return
  }
  const r=await window.mobiAPI.saveFile({filePath:currentFile,content:getCurrentMd()})
  if(r&&r.error==='read-only-doc'){alert('无法覆盖保存该类型文件。请使用「另存为」。');return}
  if(r&&!r.error){currentFile=r;setModified(false);setTitle(bn(r));await loadRecentFiles();await refreshWorkspaceTree()}
}
async function saveFileAs(){
  const r=await window.mobiAPI.saveFileAs({content:getCurrentMd()})
  if(r&&!r.error){
    currentFile=r
    readOnlyDoc=isReadOnlyCodePath(r)
    syncReadOnlyUi()
    setModified(false)
    setTitle(bn(r)+(readOnlyDoc?' · 只读':''))
    if(readOnlyDoc){_lastSrc='md';setMode('markdown')}
    await loadRecentFiles();await refreshWorkspaceTree()
    updateStatus()
  }
}
async function exportHtml(){
  await window.mobiAPI.exportHtml({html:previewEl.innerHTML,title:currentFile?bn(currentFile).replace(/\.md$/i,''):'无题'})
}
async function exportPdf(){
  if(window.mobiAPIPdf) {
    await window.mobiAPIPdf.exportPdf({
      html: previewEl.innerHTML,
      title: currentFile ? bn(currentFile).replace(/\.md$/i, '') : '无题',
      theme: cfg.theme,
      fontFamily: cfg.fontFamily || 'system'
    })
  }
}

function setModified(v){
  if(readOnlyDoc&&v)return
  isModified=v;$('file-modified').style.display=v?'':'none'
}
function setTitle(n){$('file-name').textContent=n}
function bn(p){return p.replace(/\\/g,'/').split('/').pop()}
function updateStatus(){
  const text=editMode==='markdown'||_lastSrc==='md'?mdEditor.value:(richEditor.innerText||'')
  const cjk=(text.match(/[\u4e00-\u9fa5]/g)||[]).length
  const words=text.trim()===''?0:text.trim().split(/\s+/).length+cjk
  $('status-words').textContent='字数 '+words
  $('status-chars').textContent='字符 '+text.length
  $('status-lines').textContent='行 '+text.split('\n').length
  const pathEl=$('status-path'), wrap=$('status-path-wrap'), copyBtn=$('btn-copy-doc-path')
  if(pathEl){
    if(currentFile){
      pathEl.textContent=currentFile.replace(/\\/g,'/')
      if(wrap)wrap.title=currentFile
      if(copyBtn)copyBtn.disabled=false
    }else{
      pathEl.textContent='未保存文档'
      if(wrap)wrap.title=''
      if(copyBtn)copyBtn.disabled=true
    }
  }
}

// ════ 预览渲染 ══════════════════════════════════════════════
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(renderPreview,200)}
async function renderPreview(){
  if(!window.marked){previewEl.innerHTML='<div style="padding:40px;opacity:.4">正在渲染预览…</div>';return}
  try{
    window.marked.setOptions({breaks:true,gfm:true})
    const md=getCurrentMd()
    const src=md.replace(/^([ \t]*[-*+] )\[([ xX])\] /gm,(_,b,c)=>`${b}<input type="checkbox" ${c!=' '?'checked':''}> `)
    previewEl.innerHTML=window.marked.parse(src)
    if(window.hljsAPI){
      for(const blk of previewEl.querySelectorAll('pre code')){
        const lang=(blk.className.match(/language-([\w-]+)/)||[])[1]||''
        try{const r=await window.hljsAPI.highlight(blk.textContent,lang);blk.innerHTML=r.value;blk.classList.add('hljs')}catch(e){}
      }
    }
    for(const img of previewEl.querySelectorAll('img')){
      const s=img.getAttribute('src')
      if(!s||/^https?:\/\//i.test(s))continue
      try{
        const resolved=await window.mobiAPI.resolveMarkdownImage(currentFile||'',s)
        if(resolved)img.setAttribute('src',resolved)
      }catch(_){}
    }
    previewEl.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      cb.addEventListener('change',()=>{cb.checked=!cb.checked})
    })
  }catch(err){previewEl.innerHTML='<pre style="color:red;padding:20px">'+escHtml(String(err))+'</pre>'}
}

// ════ HTML ↔ Markdown ════════════════════════════════════════
function md2html(md){
  if(!window.marked)return '<p>'+md+'</p>'
  try{return window.marked.parse(md)}catch(e){return '<pre>'+escHtml(md)+'</pre>'}
}
function richToMd(){return nodeToMd(richEditor).trim()}
function nodeToMd(node){
  if(node.nodeType===3)return node.textContent
  if(node.nodeType!==1)return ''
  const tag=node.tagName.toLowerCase()
  const inn=()=>Array.from(node.childNodes).map(nodeToMd).join('')
  const blk=s=>'\n\n'+s.trim()+'\n\n'
  switch(tag){
    case 'h1':return blk('# '+inn())
    case 'h2':return blk('## '+inn())
    case 'h3':return blk('### '+inn())
    case 'h4':return blk('#### '+inn())
    case 'p': return blk(inn())
    case 'br':return '\n'
    case 'strong':case 'b':return '**'+inn()+'**'
    case 'em':case 'i':return '*'+inn()+'*'
    case 'u': return inn()
    case 's':case 'del':return '~~'+inn()+'~~'
    case 'code':return node.parentNode?.tagName?.toLowerCase()==='pre'?inn():'`'+inn()+'`'
    case 'pre': return blk('```\n'+node.textContent+'\n```')
    case 'blockquote':return blk(inn().trim().split('\n').map(l=>'> '+l).join('\n'))
    case 'hr':return blk('---')
    case 'a': return '['+inn()+']('+node.getAttribute('href')+')'
    case 'img':{
      const mdSrc=node.getAttribute('data-md-src')
      const href=mdSrc||(node.getAttribute('src')||'')
      const alt=node.getAttribute('alt')||''
      return '!['+alt+']('+href+')'
    }
    case 'ul':return '\n'+Array.from(node.children).map(li=>{
      const cb=li.querySelector('input[type="checkbox"]')
      const txt=(cb?li.innerText.replace(cb.outerHTML,''):li.innerText).trim()
      return cb?`- [${cb.checked?'x':' '}] ${txt}`:`- ${txt}`
    }).join('\n')+'\n'
    case 'ol':return '\n'+Array.from(node.children).map((li,i)=>`${i+1}. `+li.innerText.trim()).join('\n')+'\n'
    case 'li':return inn()
    case 'table':{
      const rows=Array.from(node.querySelectorAll('tr'));if(!rows.length)return ''
      let md='\n';rows.forEach((tr,ri)=>{
        const cells=Array.from(tr.querySelectorAll('th,td'))
        md+='| '+cells.map(c=>c.innerText.trim().replace(/\|/g,'\\|')).join(' | ')+' |\n'
        if(ri===0)md+='| '+cells.map(()=>':---').join(' | ')+' |\n'
      });return md+'\n'
    }
    default:return inn()
  }
}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

// ════ MD 格式辅助 ════════════════════════════════════════════
function insertMd(txt){
  if(readOnlyDoc)return
  const s=mdEditor.selectionStart,e2=mdEditor.selectionEnd
  mdEditor.value=mdEditor.value.substring(0,s)+txt+mdEditor.value.substring(e2)
  mdEditor.selectionStart=mdEditor.selectionEnd=s+txt.length
  mdEditor.focus();setModified(true);scheduleRender()
}
function wrapMd(b,a){
  if(readOnlyDoc)return
  const s=mdEditor.selectionStart,e2=mdEditor.selectionEnd,sel=mdEditor.value.substring(s,e2)
  mdEditor.value=mdEditor.value.substring(0,s)+b+sel+a+mdEditor.value.substring(e2)
  if(sel){mdEditor.selectionStart=s+b.length;mdEditor.selectionEnd=e2+b.length}
  else{mdEditor.selectionStart=mdEditor.selectionEnd=s+b.length}
  mdEditor.focus();setModified(true);scheduleRender()
}
function prefixMd(prefix){
  if(readOnlyDoc)return
  const pos=mdEditor.selectionStart,v=mdEditor.value
  const ls=v.lastIndexOf('\n',pos-1)+1,le=v.indexOf('\n',pos),end=le===-1?v.length:le
  const line=v.substring(ls,end)
  if(line.startsWith(prefix)){mdEditor.value=v.substring(0,ls)+line.substring(prefix.length)+v.substring(end);mdEditor.selectionStart=mdEditor.selectionEnd=Math.max(ls,pos-prefix.length)}
  else{mdEditor.value=v.substring(0,ls)+prefix+line+v.substring(end);mdEditor.selectionStart=mdEditor.selectionEnd=pos+prefix.length}
  mdEditor.focus();setModified(true);scheduleRender()
}

// ════ 对话框 ════════════════════════════════════════════════
// 保存打开对话框时的光标位置
let _savedRange = null
let _savedMdPos = {start:0, end:0}

function showTableDialog(){
  // 打开对话框前保存光标
  if(editMode==='wysiwyg'){
    const sel = window.getSelection()
    _savedRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null
  } else {
    _savedMdPos = {start: mdEditor.selectionStart, end: mdEditor.selectionEnd}
  }
  $('table-dialog').style.display='flex'
  $('table-rows').focus()
}
$('table-cancel').onclick=()=>$('table-dialog').style.display='none'
$('table-ok').onclick=()=>{
  const rows=parseInt($('table-rows').value)||3
  const cols=parseInt($('table-cols').value)||3
  const header=$('table-header').checked
  $('table-dialog').style.display='none'
  if(editMode==='wysiwyg') insertRichTable(rows,cols,header)
  else insertMdTable(rows,cols,header)
}
$('table-dialog').onclick=e=>{if(e.target===$('table-dialog'))$('table-dialog').style.display='none'}

function insertRichTable(rows,cols,header){
  // 构建表格 HTML 字符串，用 innerHTML 方式更可靠
  let html = '<table>'
  if(header){
    html += '<tr>'
    for(let c=0;c<cols;c++) html += `<th contenteditable="true">列 ${c+1}</th>`
    html += '</tr>'
  }
  for(let r=0;r<rows;r++){
    html += '<tr>'
    for(let c=0;c<cols;c++) html += '<td contenteditable="true">内容</td>'
    html += '</tr>'
  }
  html += '</table>'

  richEditor.focus()

  // 恢复保存的光标位置
  if(_savedRange){
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(_savedRange)
    // 折叠到末尾
    _savedRange.collapse(false)
    // 插入表格
    const frag = document.createDocumentFragment()
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    const tbl = tmp.firstChild
    frag.appendChild(tbl)
    const br = document.createElement('p')
    br.innerHTML = '<br>'
    frag.appendChild(br)
    _savedRange.insertNode(frag)
    // 移动光标到表格后的段落
    const newRange = document.createRange()
    newRange.setStart(br, 0)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
  } else {
    // 没有保存的光标，直接追加到编辑器末尾
    const tmp = document.createElement('div')
    tmp.innerHTML = html + '<p><br></p>'
    while(tmp.firstChild) richEditor.appendChild(tmp.firstChild)
  }

  setModified(true)
  scheduleRender()
  updateStatus()
}
function insertMdTable(rows,cols,header){
  let md='\n'
  md+='| '+Array.from({length:cols},(_,i)=>`列 ${i+1}`).join(' | ')+' |\n'
  md+='| '+Array(cols).fill(':---').join(' | ')+' |\n'
  for(let r=0;r<rows;r++)md+='| '+Array(cols).fill('内容').join(' | ')+' |\n'
  insertMd(md+'\n')
}

let _savedLinkRange = null
function showLinkDialog(){
  const sel=window.getSelection()
  if(editMode==='wysiwyg'){
    if(sel&&sel.rangeCount){
      _savedLinkRange=sel.getRangeAt(0).cloneRange()
      if(!sel.isCollapsed) $('link-text').value=sel.toString()
    }
  } else {
    _savedMdPos={start:mdEditor.selectionStart,end:mdEditor.selectionEnd}
  }
  $('link-url').value=''
  $('link-dialog').style.display='flex'
  $('link-url').focus()
}
$('link-cancel').onclick=()=>$('link-dialog').style.display='none'
$('link-ok').onclick=()=>{
  const txt=$('link-text').value,url=$('link-url').value
  if(!url){$('link-dialog').style.display='none';return}
  $('link-dialog').style.display='none'
  if(editMode==='wysiwyg'){
    richEditor.focus()
    if(_savedLinkRange){
      const sel=window.getSelection()
      sel.removeAllRanges()
      sel.addRange(_savedLinkRange)
    }
    document.execCommand('insertHTML',false,`<a href="${url}">${txt||url}</a>`)
  } else {
    insertMd(`[${txt||url}](${url})`)
  }
}
$('link-dialog').onclick=e=>{if(e.target===$('link-dialog'))$('link-dialog').style.display='none'}
$('link-url').addEventListener('keydown',e=>{if(e.key==='Enter')$('link-ok').click()})

// ════ 查找 ══════════════════════════════════════════════════
function setupFindBar(){
  $('find-close').onclick=hideFindBar
  $('find-prev').onclick=()=>findNav(-1)
  $('find-next').onclick=()=>findNav(1)
  $('find-replace-one').onclick=replaceOne
  $('find-replace-all').onclick=replaceAll
  findInput.addEventListener('input',doFind)
  findInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){findNav(e.shiftKey?-1:1);return}
    if(e.key==='Escape')hideFindBar()
  })
}
function showFindBar(){findBar.style.display='flex';findInput.focus();findInput.select();doFind()}
function hideFindBar(){findBar.style.display='none';findMatches=[];findCount.textContent='';if(editMode==='markdown')mdEditor.focus();else richEditor.focus()}
function doFind(){
  const q=findInput.value;findMatches=[]
  if(!q){findCount.textContent='';return}
  const v=mdEditor.value,re=new RegExp(escRe(q),'gi');let m
  while((m=re.exec(v))!==null)findMatches.push(m.index)
  findCount.textContent=findMatches.length?`${Math.min(findIdx+1,findMatches.length)}/${findMatches.length}`:'无结果'
  if(findMatches.length){findIdx=0;if(editMode==='markdown')mdEditor.setSelectionRange(findMatches[0],findMatches[0]+q.length)}
}
function findNav(d){
  if(!findMatches.length)return
  findIdx=(findIdx+d+findMatches.length)%findMatches.length
  findCount.textContent=`${findIdx+1}/${findMatches.length}`
  if(editMode==='markdown')mdEditor.setSelectionRange(findMatches[findIdx],findMatches[findIdx]+findInput.value.length)
}
function replaceOne(){
  if(readOnlyDoc)return
  if(!findMatches.length)return
  const i=findMatches[findIdx]
  mdEditor.value=mdEditor.value.substring(0,i)+replaceInput.value+mdEditor.value.substring(i+findInput.value.length)
  setModified(true);scheduleRender();doFind()
}
function replaceAll(){
  if(readOnlyDoc)return
  if(!findInput.value)return
  mdEditor.value=mdEditor.value.replace(new RegExp(escRe(findInput.value),'g'),replaceInput.value)
  setModified(true);scheduleRender();doFind()
}
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

// ════ 分隔条 ════════════════════════════════════════════════
function setupResizer(){
  let startX=0,startW=0
  resizerEl.addEventListener('mousedown',e=>{
    isResizing=true;startX=e.clientX
    const lp=editMode==='split'&&_lastSrc==='md'?mdPane:wysiwygPane
    startW=lp.getBoundingClientRect().width
    document.body.style.cursor='col-resize';document.body.style.userSelect='none'
  })
  document.addEventListener('mousemove',e=>{
    if(!isResizing)return
    const total=mainArea.getBoundingClientRect().width
    const newW=Math.max(200,Math.min(startW+(e.clientX-startX),total-200))
    const lp=editMode==='split'&&_lastSrc==='md'?mdPane:wysiwygPane
    lp.style.flex='none';lp.style.width=newW+'px'
    previewPane.style.flex='1';previewPane.style.width=''
  })
  document.addEventListener('mouseup',()=>{
    if(!isResizing)return;isResizing=false
    document.body.style.cursor='';document.body.style.userSelect=''
  })
}

// ════ 键盘 ══════════════════════════════════════════════════
function setupKeyboard(){
  document.addEventListener('keydown',e=>{
    const acc=e.metaKey||e.ctrlKey
    if(acc&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();saveFileAs();return}
    if(e.key==='Escape'){
      if(findBar.style.display!=='none'){hideFindBar();return}
      if($('table-dialog').style.display!=='none'){$('table-dialog').style.display='none';return}
      if($('link-dialog').style.display!=='none'){$('link-dialog').style.display='none';return}
      if($('prompt-dialog').style.display!=='none'){$('prompt-dialog-cancel').click();return}
      if($('xhs-style-dialog').style.display!=='none'){$('xhs-style-cancel').click();return}
      closeAllPanels()
    }
    if(e.key==='F11'){e.preventDefault();toggleFocus()}
  })
}
let focusMode=false,focusTimer=null
function toggleFocus(){
  focusMode=!focusMode
  if(focusMode){
    $('mode-bar').style.opacity='0';$('statusbar').style.opacity='0'
    document.addEventListener('mousemove',onFocusMove)
  }else{
    $('mode-bar').style.opacity='';$('statusbar').style.opacity=''
    document.removeEventListener('mousemove',onFocusMove)
  }
}
function onFocusMove(){
  $('mode-bar').style.opacity='1';$('statusbar').style.opacity='1'
  clearTimeout(focusTimer)
  focusTimer=setTimeout(()=>{if(focusMode){$('mode-bar').style.opacity='0';$('statusbar').style.opacity='0'}},2500)
}

// ════ 菜单 ══════════════════════════════════════════════════
function setupMenu(){
  window.mobiAPI.onMenu((ev,...args)=>{
    const map={'menu-new':newFile,'menu-open':openFile,'menu-save':saveFile,
      'menu-save-as':saveFileAs,'menu-export-html':exportHtml,
      'menu-export-xhs-short':()=>{void exportXhsShort()},
      'menu-export-xhs-long':()=>{void exportXhsLong()},
      'menu-find':showFindBar,'menu-theme':()=>setTheme(args[0])}
    if(map[ev])map[ev]()
  })
}

// ════ 最近文件 ══════════════════════════════════════════════
async function loadRecentFiles(){
  const files=await window.mobiAPI.getRecentFiles()
  const list=$('recent-list');list.innerHTML=''
  if(!files.length){list.innerHTML='<div class="recent-empty-hint">暂无最近打开的文档</div>';return}
  files.forEach(f=>{
    const el=document.createElement('div');el.className='recent-item';el.textContent=bn(f);el.title=f
    el.onclick=async()=>{
      if(isModified){
        const resp=await window.mobiAPI.newFile({hasChanges:true})
        if(resp.action==='cancel')return
        if(resp.action==='save')await saveFile()
      }
      const r=await window.mobiAPI.readFile(f);if(!r||r.error)return
      applyOpenedDocument({ content: r.content, filePath: r.filePath || f, readOnly: isReadOnlyCodePath(f) })
      await refreshWorkspaceTree()
    }
    list.appendChild(el)
  })
}

// ════ 工作区侧栏 ════════════════════════════════════════════
/** Electron 渲染进程里 window.prompt 常无效，用与表格/链接一致的内嵌框 */
let promptDialogResolve=null
function setupPromptDialog(){
  const dlg=$('prompt-dialog')
  const inp=$('prompt-dialog-input')
  const finish=v=>{
    dlg.style.display='none'
    const cb=promptDialogResolve
    promptDialogResolve=null
    if(cb)cb(v)
  }
  $('prompt-dialog-cancel').onclick=()=>finish(null)
  $('prompt-dialog-ok').onclick=()=>finish(inp.value)
  dlg.onclick=e=>{if(e.target===dlg)finish(null)}
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();finish(inp.value)}
  })
}
function openPromptDialog({title,label,defaultValue,placeholder}){
  return new Promise(resolve=>{
    promptDialogResolve=resolve
    const dlg=$('prompt-dialog')
    const inp=$('prompt-dialog-input')
    $('prompt-dialog-title').textContent=title
    $('prompt-dialog-label').textContent=label||'名称'
    inp.value=defaultValue!=null?String(defaultValue):''
    inp.placeholder=placeholder||''
    dlg.style.display='flex'
    requestAnimationFrame(()=>{inp.focus();inp.select()})
  })
}

/** 六种高级感配色（与项目目录「六种高级感配色 / code.html」卡片一致） */
const XHS_EXPORT_STYLES = [
  { id: 'misty-rose', name: '晨雾玫瑰', sub: '柔和朦胧', dark: true, canvasBg: '#3a3234', strip: ['#F5E6E8', '#D5B9B2', '#4A3F3F'] },
  { id: 'sparse-cloud', name: '疏云素笺', sub: '素白水墨', dark: false, canvasBg: '#fafaf8', strip: ['#fafaf8', '#d0d0d0', '#1c1c1c'] },
  { id: 'deep-ocean-moss', name: '深海苔绿', sub: '森系叙事', dark: true, canvasBg: '#1A2E2C', strip: ['#1A2E2C', '#4A6D66', '#E0E7E5'] },
  { id: 'slate-blue-frost', name: '雾蓝霜灰', sub: '专业浅色', dark: false, canvasBg: '#CFD8DC', strip: ['#CFD8DC', '#607D8B', '#263238'] },
  { id: 'sage-earth', name: '鼠尾草大地', sub: '自然 calm', dark: false, canvasBg: '#E8EDEB', strip: ['#E8EDEB', '#94A79E', '#4A5D54'] },
  { id: 'champagne-linen', name: '香槟亚麻', sub: 'Quiet luxury', dark: false, canvasBg: '#F9F5F0', strip: ['#F9F5F0', '#D4C5B3', '#2D2926'] }
]

function xhsStyleById (id) {
  return XHS_EXPORT_STYLES.find(s => s.id === id) || XHS_EXPORT_STYLES[3]
}

/** 导出正文字体（SIL OFL；得意黑 Smiley Sans 随 font-smiley-sans 包） */
const XHS_EXPORT_FONTS = [
  { id: 'noto-serif-sc', name: 'Noto Serif', sub: '衬线' },
  { id: 'noto-sans-sc', name: 'Noto Sans', sub: '无衬线' },
  { id: 'smiley-sans', name: '得意黑', sub: 'Smiley Sans' },
  { id: 'ibm-plex', name: 'IBM Plex', sub: '无衬线中西' }
]

function xhsFontById (id) {
  return XHS_EXPORT_FONTS.find(f => f.id === id) || XHS_EXPORT_FONTS[1]
}

/** 导出图「手机阅读」档位：仅离屏 surface 字号倍率，不改编辑器 */
const XHS_READABILITY_LEVELS = [
  { id: 'standard', name: '标准', sub: '约 20px 正文，按 ## 拆长文' },
  { id: 'comfort', name: '舒适', sub: '约 +45%（≈29px），尽量再按 ### 拆段' },
  { id: 'large', name: '加大', sub: '约 +88%（≈38px），尽量再按 ### 拆段' }
]

/** 相对导出版心基准正文字号倍率；字号在 buildXhsExportSurface 用 style 写入（html2canvas 对 calc+变量不稳） */
function xhsReadabilityMul (readability) {
  if (readability === 'comfort') return 1.45
  if (readability === 'large') return 1.88
  return 1
}

let xhsStyleDialogResolver = null
function setupXhsStyleDialog () {
  const dlg = $('xhs-style-dialog')
  const grid = $('xhs-style-grid')
  const fgrid = $('xhs-font-grid')
  const rgrid = $('xhs-readability-grid')
  const close = (value) => {
    dlg.style.display = 'none'
    const cb = xhsStyleDialogResolver
    xhsStyleDialogResolver = null
    if (cb) cb(value)
  }
  $('xhs-style-cancel').onclick = () => close(null)
  $('xhs-style-ok').onclick = () => {
    const sel = grid.querySelector('.xhs-style-card.selected')
    const sid = sel && sel.dataset.styleId
    const fsel = fgrid.querySelector('.xhs-font-card.selected')
    const fid = fsel && fsel.dataset.fontId
    const rsel = rgrid && rgrid.querySelector('.xhs-read-card.selected')
    const rid = (rsel && rsel.dataset.readabilityId) || 'standard'
    if (!sid || !fid) return
    cfg.xhsExportStyle = sid
    cfg.xhsExportFont = fid
    cfg.xhsExportReadability = rid
    void window.mobiAPI.saveConfig({ xhsExportStyle: sid, xhsExportFont: fid, xhsExportReadability: rid })
    close({ styleId: sid, fontId: fid, readability: rid })
  }
  dlg.onclick = e => { if (e.target === dlg) close(null) }
  grid.onclick = e => {
    const card = e.target.closest('.xhs-style-card')
    if (!card || !grid.contains(card)) return
    grid.querySelectorAll('.xhs-style-card').forEach(c => { c.classList.toggle('selected', c === card) })
  }
  if (rgrid) {
    rgrid.onclick = e => {
      const card = e.target.closest('.xhs-read-card')
      if (!card || !rgrid.contains(card)) return
      rgrid.querySelectorAll('.xhs-read-card').forEach(c => { c.classList.toggle('selected', c === card) })
    }
  }
  fgrid.onclick = e => {
    const card = e.target.closest('.xhs-font-card')
    if (!card || !fgrid.contains(card)) return
    fgrid.querySelectorAll('.xhs-font-card').forEach(c => { c.classList.toggle('selected', c === card) })
  }
}

function openXhsStylePicker () {
  return new Promise(resolve => {
    xhsStyleDialogResolver = resolve
    const dlg = $('xhs-style-dialog')
    const grid = $('xhs-style-grid')
    const fgrid = $('xhs-font-grid')
    const initial = (cfg.xhsExportStyle && XHS_EXPORT_STYLES.some(s => s.id === cfg.xhsExportStyle))
      ? cfg.xhsExportStyle
      : 'slate-blue-frost'
    const initialFont = (cfg.xhsExportFont && XHS_EXPORT_FONTS.some(f => f.id === cfg.xhsExportFont))
      ? cfg.xhsExportFont
      : 'noto-sans-sc'
    const initialRead = (cfg.xhsExportReadability && XHS_READABILITY_LEVELS.some(r => r.id === cfg.xhsExportReadability))
      ? cfg.xhsExportReadability
      : 'standard'
    const rgrid = $('xhs-readability-grid')
    if (rgrid) {
      rgrid.innerHTML = ''
      for (const def of XHS_READABILITY_LEVELS) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'xhs-read-card' + (def.id === initialRead ? ' selected' : '')
        b.dataset.readabilityId = def.id
        b.setAttribute('role', 'option')
        const nm = document.createElement('div')
        nm.className = 'xhs-read-card-name'
        nm.textContent = def.name
        const sub = document.createElement('div')
        sub.className = 'xhs-read-card-sub'
        sub.textContent = def.sub
        b.appendChild(nm)
        b.appendChild(sub)
        rgrid.appendChild(b)
      }
    }
    grid.innerHTML = ''
    for (const def of XHS_EXPORT_STYLES) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'xhs-style-card' + (def.id === initial ? ' selected' : '')
      b.dataset.styleId = def.id
      b.setAttribute('role', 'option')
      const strip = document.createElement('div')
      strip.className = 'xhs-style-card-strip'
      for (const c of def.strip) {
        const sp = document.createElement('span')
        sp.style.background = c
        strip.appendChild(sp)
      }
      const nm = document.createElement('div')
      nm.className = 'xhs-style-card-name'
      nm.textContent = def.name
      const sub = document.createElement('div')
      sub.className = 'xhs-style-card-sub'
      sub.textContent = def.sub
      b.appendChild(strip)
      b.appendChild(nm)
      b.appendChild(sub)
      grid.appendChild(b)
    }
    fgrid.innerHTML = ''
    for (const def of XHS_EXPORT_FONTS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'xhs-font-card' + (def.id === initialFont ? ' selected' : '')
      b.dataset.fontId = def.id
      b.setAttribute('role', 'option')
      const nm = document.createElement('div')
      nm.className = 'xhs-font-card-name'
      nm.textContent = def.name
      const sub = document.createElement('div')
      sub.className = 'xhs-font-card-sub'
      sub.textContent = def.sub
      b.appendChild(nm)
      b.appendChild(sub)
      fgrid.appendChild(b)
    }
    dlg.style.display = 'flex'
    requestAnimationFrame(() => {
      const s = grid.querySelector('.xhs-style-card.selected')
      if (s) s.focus()
    })
  })
}

// ════ 小红书 3:4 图片导出（版心 CSS 1080×1440；输出固定 2× 像素，html2canvas scale=2）══════════
const XHS_LAYOUT_W = 1080
const XHS_LAYOUT_H = 1440
/** 相对版心的像素倍率（固定 2，不再让用户选择） */
const XHS_EXPORT_SCALE = 2
const XHS_MAX_CANVAS_H = 32000
/** 导出版心正文基准 px（仅导出层；舒适/再乘 xhsReadabilityMul） */
const XHS_EXPORT_BASE_FONT_PX = 20

/** 围栏语言为以下时仍按「代码」保留 pre（html2canvas 对真正代码块另说） */
const XHS_CODE_FENCE_LANGS = new Set([
  'js', 'javascript', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'jsx', 'json', 'json5', 'jsonc',
  'html', 'htm', 'xml', 'css', 'scss', 'sass', 'less',
  'py', 'python', 'rb', 'php', 'java', 'kt', 'kts', 'go', 'rs', 'rust', 'swift', 'c', 'cpp', 'cxx', 'cc', 'cs', 'fs', 'fsx', 'vb',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'yaml', 'yml', 'toml', 'ini', 'sql', 'mdx', 'vue', 'dockerfile', 'nginx', 'graphql', 'http', 'diff', 'patch', 'wasm', 'r', 'lua', 'dart', 'scala', 'clj', 'ex', 'exs', 'erl', 'haskell', 'hs', 'jl', 'julia', 'matlab', 'pl', 'perl', 'zig', 'v', 'verilog', 'vhdl', 'asm', 'cmake', 'makefile', 'mk', 'gradle', 'properties', 'env', 'gitignore', 'dockerignore'
])
/** 围栏语言为以下时强制当正文排版（不用 pre） */
const XHS_PROSE_FENCE_LANGS = new Set(['text', 'txt', 'plaintext', 'plain', 'markdown', 'md', 'meta', 'none'])

/**
 * 仅在围栏（```…```）外按「整行匹配 headingRe」切段，避免 ## / ### 切在围栏中间导致 marked 不识别围栏、导出出现字面量反引号。
 */
function xhsSplitLinesRespectingFence (md, headingLineRe) {
  const t = String(md || '').replace(/\r\n/g, '\n')
  const lines = t.split('\n')
  let inFence = false
  const parts = []
  let buf = []
  const flushBuf = () => {
    const s = buf.join('\n').trim()
    if (s.length) parts.push(s)
    buf = []
  }
  for (const line of lines) {
    const tr = line.trim()
    if (tr.startsWith('```') || tr.startsWith('~~~')) {
      buf.push(line)
      inFence = !inFence
      continue
    }
    if (!inFence && headingLineRe.test(tr) && buf.length > 0) {
      flushBuf()
      buf.push(line)
      continue
    }
    buf.push(line)
  }
  flushBuf()
  return parts
}

/** 按二级标题(##)拆 Markdown，供超长文导出；无 ## 时返回整篇单段 */
function splitMdByH2ForXhsExport (md) {
  const raw = String(md || '').replace(/\r\n/g, '\n')
  let parts = xhsSplitLinesRespectingFence(raw, /^## .+$/)
  if (parts.length >= 2 && !/^## .+$/m.test(parts[0])) {
    parts = [parts[0] + '\n\n' + parts[1], ...parts.slice(2)]
  }
  return parts.length ? parts : [raw.trim()].filter(s => s.length > 0)
}

/** 在一段内按 ### 拆（无 ### 则整段返回） */
function splitChunkByH3 (chunk) {
  const t = String(chunk || '').replace(/\r\n/g, '\n').trim()
  if (!t) return []
  if (!/^### .+$/m.test(t)) return [t]
  let parts = xhsSplitLinesRespectingFence(t, /^### .+$/)
  if (parts.length >= 2 && !/^### .+$/m.test(parts[0])) {
    parts = [parts[0] + '\n\n' + parts[1], ...parts.slice(2)]
  }
  return parts.length ? parts : [t]
}

/** 各阅读档的单段字符安全上限（含段间距/标题等高度开销的保守估算） */
const XHS_MAX_CHARS_PER_SEGMENT = { standard: 9000, comfort: 5500, large: 3500 }

/**
 * 兜底拆分：在段落边界（空行）切开超长 chunk，不依赖标题存在。
 * 围栏代码块内的空行不视为切割点，避免拆断 ``` 块。
 * 若单段落本身超长（无空行可切），按行数硬切，确保任意内容都能导出。
 */
function splitChunkByParagraphs (chunk, maxChars) {
  const text = String(chunk || '').trim()
  if (!text || text.length <= maxChars) return text ? [text] : []
  const lines = text.split('\n')
  const parts = []
  let buf = []
  let bufLen = 0
  let inFence = false
  const flush = () => {
    const s = buf.join('\n').trim()
    if (s) parts.push(s)
    buf = []
    bufLen = 0
  }
  for (const line of lines) {
    const tr = line.trim()
    if (tr.startsWith('```') || tr.startsWith('~~~')) inFence = !inFence
    // 段落边界且已超限：在空行处切割
    if (!inFence && tr === '' && bufLen >= maxChars) { flush(); continue }
    // 单段落内部超限（无空行可切）：按行强制切割，不拆断围栏块
    if (!inFence && bufLen >= maxChars * 1.5) { flush() }
    buf.push(line)
    bufLen += line.length + 1
  }
  flush()
  return parts.length ? parts : [text]
}

/**
 * 导出用 Markdown 段列表：标准档仅按 ##；舒适/加大在 ## 后再尽量按 ### 拆，降低单图高度触顶。
 * 最后对所有 chunk 做段落兜底拆分，避免无标题长文触顶报错。
 */
function splitMdForXhsExport (md, readability) {
  const h2 = splitMdByH2ForXhsExport(md)
  let chunks
  if (readability === 'standard') {
    chunks = h2
  } else {
    const flat = []
    for (const p of h2) {
      const subs = splitChunkByH3(p)
      if (subs.length <= 1) flat.push(p)
      else flat.push(...subs)
    }
    chunks = flat.length ? flat : h2
  }
  const maxChars = XHS_MAX_CHARS_PER_SEGMENT[readability] || XHS_MAX_CHARS_PER_SEGMENT.standard
  const final = []
  for (const chunk of chunks) final.push(...splitChunkByParagraphs(chunk, maxChars))
  return final.length ? final : chunks
}

/** 与预览一致的 Markdown → HTML（hljs、本地图片路径），不写入预览区 */
async function mdFragmentToExportableHtml (md) {
  if (!window.marked) throw new Error('marked 未加载')
  window.marked.setOptions({ breaks: true, gfm: true })
  /* 全角重音符 U+FF40 常被误作反引号，会导致行内 code 不闭合、导出出现字面 ` 或整段被当成 code */
  const src = String(md || '')
    .replace(/\uFF40/g, '`')
    .replace(/^([ \t]*[-*+] )\[([ xX])\] /gm, (_, b, c) => `${b}<input type="checkbox" ${c !== ' ' ? 'checked' : ''}> `)
  const wrap = document.createElement('div')
  wrap.innerHTML = window.marked.parse(src)
  if (window.hljsAPI) {
    for (const blk of wrap.querySelectorAll('pre code')) {
      const lang = (blk.className.match(/language-([\w-]+)/) || [])[1] || ''
      try {
        const r = await window.hljsAPI.highlight(blk.textContent, lang)
        blk.innerHTML = r.value
        blk.classList.add('hljs')
      } catch (_) {}
    }
  }
  for (const img of wrap.querySelectorAll('img')) {
    const s = img.getAttribute('src')
    if (!s || /^https?:\/\//i.test(s)) continue
    try {
      const resolved = await window.mobiAPI.resolveMarkdownImage(currentFile || '', s)
      if (resolved) img.setAttribute('src', resolved)
    } catch (_) {}
  }
  return wrap.innerHTML
}

/** 多段长图：在已选路径旁生成 stem-01.png …（单段时返回原路径） */
function xhsDerivedLongPngPaths (pickedPath, nParts) {
  const n = Math.max(1, Math.round(nParts))
  if (n <= 1) return [pickedPath]
  const last = Math.max(pickedPath.lastIndexOf('/'), pickedPath.lastIndexOf('\\'))
  const dir = last >= 0 ? pickedPath.slice(0, last + 1) : ''
  const file = last >= 0 ? pickedPath.slice(last + 1) : pickedPath
  const stem = file.replace(/\.png$/i, '') || 'export'
  const paths = []
  for (let i = 0; i < n; i++) {
    paths.push(dir + stem + '-' + String(i + 1).padStart(2, '0') + '.png')
  }
  return paths
}

async function getXhsExportTitle () {
  let t = ''
  if (currentFile) t = bn(currentFile).replace(/\.md$/i, '')
  else {
    const raw = ($('file-name').textContent || '').trim()
    if (raw && raw !== '无题文档') t = raw.replace(/\.md$/i, '')
  }
  if (!t || t === '无题' || t === '无题文档') {
    const v = await openPromptDialog({
      title: '导出图片',
      label: '文档标题',
      defaultValue: '未命名笔记',
      placeholder: '用作文件名与短图文件夹名'
    })
    if (v == null) return null
    t = String(v).trim() || '未命名笔记'
  }
  return t.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || '未命名笔记'
}

function canvasToPngDataUrl (canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      if (!b) { reject(new Error('toBlob 失败')); return }
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(b)
    }, 'image/png', 0.95)
  })
}

function normalizeCanvasToTargetWidth (src, fillColor, targetW) {
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(src.height * (tw / src.width)))
  const c = document.createElement('canvas')
  c.width = tw
  c.height = th
  const ctx = c.getContext('2d')
  ctx.fillStyle = fillColor || '#ffffff'
  ctx.fillRect(0, 0, tw, th)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(src, 0, 0, tw, th)
  return c
}

function xhsParseHexFill (hex) {
  if (!hex || typeof hex !== 'string') return { r: 255, g: 255, b: 255 }
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6) return { r: 255, g: 255, b: 255 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

function xhsRgbNear (r, g, b, target, tol = 22) {
  return Math.abs(r - target.r) <= tol && Math.abs(g - target.g) <= tol && Math.abs(b - target.b) <= tol
}

/** 分页尾页多为「防裁切」留白时可删；阈值略松以保留右下角签名 */
function isXhsCanvasPageMostlyBlank (canvas, targetRgb) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  if (w < 4 || h < 4) return true
  const stepX = Math.max(6, Math.floor(w / 26))
  const stepY = Math.max(8, Math.floor(h / 34))
  let samples = 0
  let near = 0
  for (let y = stepY; y < h - 4; y += stepY) {
    for (let x = stepX; x < w - 4; x += stepX) {
      try {
        const d = ctx.getImageData(Math.min(x, w - 1), Math.min(y, h - 1), 1, 1).data
        samples++
        if (xhsRgbNear(d[0], d[1], d[2], targetRgb)) near++
      } catch (_) {
        samples++
      }
    }
  }
  return samples > 24 && near / samples >= 0.968
}

function dropTrailingBlankXhsPages (pages, fillColor) {
  const rgb = xhsParseHexFill(fillColor)
  const out = [...pages]
  while (out.length > 1 && isXhsCanvasPageMostlyBlank(out[out.length - 1], rgb)) {
    out.pop()
  }
  return out
}

function sliceCanvasToFixedPages (normalizedCanvas, fillColor, pageW, pageH) {
  const W = Math.max(1, Math.round(pageW))
  const H = Math.max(1, Math.round(pageH))
  const totalH = normalizedCanvas.height
  const pages = []
  const n = Math.max(1, Math.ceil(totalH / H))
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.fillStyle = fillColor || '#ffffff'
    ctx.fillRect(0, 0, W, H)
    const sy = i * H
    const sh = Math.min(H, Math.max(0, totalH - sy))
    if (sh > 0) ctx.drawImage(normalizedCanvas, 0, sy, W, sh, 0, 0, W, sh)
    pages.push(c)
  }
  return pages
}

/** 右下角小签名（短图每张、长图一张）；边距加大、字号略增，避免与正文抢位 */
function stampExportSignature (canvas, dark) {
  const sc = XHS_EXPORT_SCALE
  const text = 'pongrabbit-md'
  const padR = Math.round(24 * sc)
  const padB = Math.round(28 * sc)
  const fs = Math.round(16 * sc)
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.font = `600 ${fs}px system-ui,"Segoe UI","Noto Sans SC",sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const x = canvas.width - padR
  const y = canvas.height - padB
  const lw = Math.max(2, Math.round(2.6 * sc))
  ctx.lineWidth = lw
  if (dark) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.fillStyle = 'rgba(22,30,45,0.9)'
  }
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

function clearXhsExportHost () {
  const h = $('xhs-export-host')
  if (h) h.innerHTML = ''
}

// #region agent log
function dbgXhsAgentLog (location, message, data, hypothesisId) {
  const payload = {
    sessionId: '45714f',
    location,
    message,
    data: data || {},
    timestamp: Date.now(),
    hypothesisId: hypothesisId || 'none'
  }
  fetch('http://127.0.0.1:7278/ingest/3ffc2732-0189-43ea-8955-7dd62494b1c3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '45714f' },
    body: JSON.stringify(payload)
  }).catch(() => {})
  if (window.mobiAPI && typeof window.mobiAPI.debugSessionLog === 'function') {
    void window.mobiAPI.debugSessionLog(payload)
  }
}
// #endregion

/**
 * html2canvas 只接收 surface 子树时，head 里 link 的 WebFont 有时不参与测量；得意黑易回退成 Noto。
 * 将 woff2 以绝对 URL 的 @font-face 插到 surface 内（随子树一起参与解析），并 fonts.load。
 */
function injectSmileySansFaceIntoSurface (surface) {
  if (surface.querySelector('style[data-xhs-smiley-face]')) return
  let woffHref
  try {
    woffHref = new URL('../../node_modules/font-smiley-sans/SmileySans-Oblique.ttf.woff2', window.location.href).href
  } catch (e) {
    console.warn('[xhs-export] smiley woff url', e)
    return
  }
  const tag = document.createElement('style')
  tag.setAttribute('data-xhs-smiley-face', '1')
  const u = JSON.stringify(woffHref)
  tag.textContent = '@font-face{font-family:"smiley-sans";font-style:normal;font-weight:400;font-display:block;src:url(' + u + ') format("woff2");}'
  surface.insertBefore(tag, surface.firstChild)
}

/** 导出前去掉当前文档绝对路径、file:// 链接等，避免出现在截图里 */
function stripDocPathFromXhsSurface (surface) {
  // #region agent log
  let _xhsStripLinkTouched = 0
  let _xhsStripTextNodes = 0
  // #endregion
  const doc = currentFile ? String(currentFile) : ''
  const variants = []
  if (doc) {
    variants.push(doc, doc.replace(/\\/g, '/'), doc.replace(/\//g, '\\'))
  }
  const uniq = [...new Set(variants.filter(s => s && s.length > 1))]

  for (const a of surface.querySelectorAll('a[href]')) {
    const href = (a.getAttribute('href') || '').trim()
    if (!/^file:/i.test(href)) continue
    a.setAttribute('href', '#')
    const txt = (a.textContent || '').trim()
    const looksPath = /^file:/i.test(txt) ||
      /^[a-zA-Z]:[/\\]/.test(txt) ||
      uniq.some(v => v && txt.includes(v))
    if (!txt || looksPath) {
      a.textContent = '本地链接'
      // #region agent log
      _xhsStripLinkTouched++
      // #endregion
    }
  }

  const tw = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, null)
  let tn
  while ((tn = tw.nextNode())) {
    const p = tn.parentElement
    if (!p || p.closest('pre, code')) continue
    let s = tn.nodeValue
    if (!s) continue
    let next = s
    for (const v of uniq) {
      if (v && next.includes(v)) next = next.split(v).join('')
    }
    if (next !== s) {
      tn.nodeValue = next.replace(/[ \t]{2,}/g, ' ')
      // #region agent log
      _xhsStripTextNodes++
      // #endregion
    }
  }

  for (const img of surface.querySelectorAll('img[title], img[alt]')) {
    for (const attr of ['title', 'alt']) {
      const v = img.getAttribute(attr)
      if (!v) continue
      if (uniq.some(prefix => prefix && v.includes(prefix))) {
        img.setAttribute(attr, attr === 'alt' ? '' : '')
      }
    }
  }
  // #region agent log
  dbgXhsAgentLog('app.js:stripDocPathFromXhsSurface', 'path strip summary', {
    docLen: doc.length,
    variantCount: uniq.length,
    linkLocalizeCount: _xhsStripLinkTouched,
    textNodeStripCount: _xhsStripTextNodes
  }, 'H3')
  // #endregion
}

const XHS_RELAX_REJECT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA'])

/**
 * 整段只有一对反引号时 marked 会生成 <p><code>很长…</code></p>；行内 code + 多行折行在 html2canvas 下背景与字易错位。
 * 独占 code：够长、含换行、或已折成多行矩形时升为块级，导出 CSS 与 fenced 接近并避免灰底压行。
 */
function xhsUpgradeLongParagraphCode (surface) {
  const MIN_LEN = 20
  const sel = 'p > code:only-child, li > code:only-child, blockquote p > code:only-child'
  // #region agent log
  let _xhsLongCodeUpgraded = 0
  let _xhsLongCodeByMultiline = 0
  const list = surface.querySelectorAll(sel)
  const _xhsLongCodeCandidates = list.length
  // #endregion
  for (const el of list) {
    const raw = el.textContent || ''
    const collapsed = raw.replace(/\s+/g, ' ').trim()
    void el.offsetHeight
    const multiLineVisual = el.getClientRects().length > 1
    const hasRawNewline = /[\r\n]/.test(raw)
    const longEnough = collapsed.length >= MIN_LEN
    if (!longEnough && (multiLineVisual || hasRawNewline)) {
      // #region agent log
      _xhsLongCodeByMultiline++
      // #endregion
    }
    if (longEnough || multiLineVisual || hasRawNewline) {
      el.classList.add('xhs-export-long-code')
      // #region agent log
      _xhsLongCodeUpgraded++
      // #endregion
    }
  }
  // #region agent log
  dbgXhsAgentLog('app.js:xhsUpgradeLongParagraphCode', 'long code upgrade', {
    upgraded: _xhsLongCodeUpgraded,
    candidates: _xhsLongCodeCandidates,
    byMultilineOrNewline: _xhsLongCodeByMultiline
  }, 'H2')
  // #endregion
}

/**
 * 无语言或「正文类」语言的 ``` 围栏在 DOM 里是 pre+code；html2canvas 对 pre 内多行中文常算错行高→叠字。
 * 导出时改为多块级 div（每行一行盒），外观仍用与 pre 相同的底与边距；显式标注语言的代码块保留 pre。
 */
function xhsKeepFencedBlockAsRealPre (codeEl) {
  const cls = String(codeEl.className || '')
  const m = cls.match(/language-([\w-]+)/)
  const lang = m ? m[1].toLowerCase() : ''
  const raw = (codeEl.textContent || '').replace(/\r\n/g, '\n')
  const text = raw.replace(/^\n+/, '').replace(/\n+$/, '')
  const lines = text.length ? text.split('\n') : ['']
  if (XHS_PROSE_FENCE_LANGS.has(lang)) return false
  if (lang && XHS_CODE_FENCE_LANGS.has(lang)) return true
  /* 未列入的语言：多行或长段中文更像「误用围栏」→ 导出不用 pre，避免 html2canvas 叠字 */
  if (lang && !XHS_CODE_FENCE_LANGS.has(lang)) {
    if (lines.length >= 2) return false
    if (lines.length === 1 && text.length > 220 && /[\u4e00-\u9fff]/.test(text)) return false
    return true
  }
  if (!lang && lines.length >= 2) return false
  return true
}

function xhsFlattenProseCodeFencesForCanvas (surface) {
  for (const pre of Array.from(surface.querySelectorAll('pre'))) {
    const code = pre.querySelector(':scope > code')
    if (!code) continue
    if (xhsKeepFencedBlockAsRealPre(code)) continue
    const raw = (code.textContent || '').replace(/\r\n/g, '\n')
    const text = raw.replace(/^\n+/, '').replace(/\n+$/, '')
    const lines = text.length ? text.split('\n') : ['']
    const box = document.createElement('div')
    box.className = 'xhs-export-fenced-plain'
    for (let i = 0; i < lines.length; i++) {
      const row = document.createElement('div')
      row.className = 'xhs-export-fence-line'
      row.textContent = lines[i]
      box.appendChild(row)
    }
    pre.parentNode.replaceChild(box, pre)
  }
}

/**
 * html2canvas 对行内 code 的 background 常错误铺成整行，看起来像「整段进了代码块」。
 * 用 inline-block 外壳承载灰底，code 仅保留字体与内边距（与预览语义一致：只有反引号内是 code）。
 */
function xhsWrapInlineCodeForCanvas (surface) {
  const codes = Array.from(surface.querySelectorAll('code'))
  for (const code of codes) {
    if (code.closest('pre')) continue
    if (code.classList.contains('xhs-export-long-code')) continue
    const par = code.parentElement
    if (!par || par.classList.contains('xhs-inline-code-chip')) continue
    const span = document.createElement('span')
    span.className = 'xhs-inline-code-chip'
    par.insertBefore(span, code)
    span.appendChild(code)
  }
}

/**
 * 部分粘贴/解析结果里换行留在文本节点的 \\n，未变成 br；先规范成 br 再拆分。
 */
function xhsNormalizeNewlinesToBrInFlow (surface) {
  const seen = new Set()
  for (const el of surface.querySelectorAll('p, li, blockquote p')) {
    if (seen.has(el)) continue
    seen.add(el)
    if (el.closest('pre') || el.querySelector('pre, table, ul, ol')) continue
    for (const tn of Array.from(el.childNodes)) {
      if (tn.nodeType !== 3) continue
      const v = tn.nodeValue
      if (!v || !/\n/.test(v)) continue
      const parts = v.split(/\n/)
      const frag = document.createDocumentFragment()
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] !== '') frag.appendChild(document.createTextNode(parts[i]))
        if (i < parts.length - 1) frag.appendChild(document.createElement('br'))
      }
      tn.parentNode.replaceChild(frag, tn)
    }
  }
}

/**
 * marked + breaks:true 常把「多行一条」渲成单个 p/li 里多个 br。
 * html2canvas 对 br 换行的行盒高度易算错→整段字叠在一起；导出前拆成多个块级段落（每段独立行盒）。
 */
function xhsSplitFlowAtLineBreaks (surface) {
  const seen = new Set()
  for (const p of surface.querySelectorAll('p, li, blockquote p')) {
    if (seen.has(p)) continue
    seen.add(p)
    if (p.closest('pre') || p.querySelector('pre, table, ul, ol')) continue
    if (!p.getElementsByTagName('br').length) continue
    const parent = p.parentNode
    if (!parent) continue
    const chunks = []
    let cur = []
    for (const n of Array.from(p.childNodes)) {
      if (n.nodeType === 1 && String(n.nodeName).toUpperCase() === 'BR') {
        chunks.push(cur)
        cur = []
      } else {
        cur.push(n)
      }
    }
    chunks.push(cur)
    const nonempty = chunks.filter(ch => ch.length > 0)
    if (nonempty.length < 2) continue
    const ref = p.nextSibling
    const tag = String(p.tagName).toLowerCase()
    parent.removeChild(p)
    for (const ch of nonempty) {
      const el = document.createElement(tag)
      for (const n of ch) el.appendChild(n)
      parent.insertBefore(el, ref)
    }
  }
}

/** 在导出 DOM 里为标点两侧加薄空格，减轻 html2canvas 叠字（跳过 pre 与行内 code：改 code 内字宽会破坏等宽与背景测量） */
function xhsRelaxPunctuationInSurface (surface) {
  const acceptNode = (node) => {
    const root = node.parentElement
    if (!root) return NodeFilter.FILTER_REJECT
    if (root.closest('pre')) return NodeFilter.FILTER_REJECT
    if (root.closest('code')) return NodeFilter.FILTER_REJECT
    let el = root
    while (el && el !== surface) {
      if (XHS_RELAX_REJECT_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT
      el = el.parentElement
    }
    return NodeFilter.FILTER_ACCEPT
  }
  const tw = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, { acceptNode })
  let tn
  while ((tn = tw.nextNode())) {
    const s = tn.nodeValue
    if (!s || !/[-－/\u2014\u00b7\u30fb\uFF5E~\uFF1A\u2022\u25cf●\u300c\u300d\u3010\u3011\u300a\u300b（）]/.test(s)) continue
    let next = s
    /* 中文词组之间的斜杠（如 振动 / 感知） */
    next = next.replace(/([\u4e00-\u9fff])\s*\/\s*([\u4e00-\u9fff])/g, '$1\u2005/\u2005$2')
    /* 直角引号「」紧邻出现时（如「A」「B」）html2canvas 易挤叠 */
    next = next.replace(/」\s*「/g, '」\u2005「')
    /* 全角冒号后紧跟汉字、数字或 CJK 标点（含「《，如 建议措辞：「）此前未覆盖 U+3000 段，易与「叠字 */
    next = next.replace(/：(?!\u200a)(?=[\u4e00-\u9fff0-9\u3000-\u303f])/g, '：\u200a')
    /* 标题/日志里「日志 · 批次」类：间隔号两侧略疏 */
    next = next.replace(/([\u4e00-\u9fffA-Za-z0-9）】」])\s*·\s*([\u4e00-\u9fffA-Za-z0-9（【「])/g, '$1\u2005·\u2005$2')
    next = next.replace(/([^\s\u00b7])\u00b7([^\s\u00b7])/g, '$1\u2005\u00b7\u2005$2')
    next = next.replace(/([^\s\u30fb])\u30fb([^\s\u30fb])/g, '$1\u2005\u30fb\u2005$2')
    /* 状态行里的 ● 与前后标点 */
    next = next.replace(/([：，、；])\s*●/g, '$1\u2005●')
    next = next.replace(/●\s*([，、。；])/g, '●\u2005$1')
    next = next.replace(/([\u4e00-\u9fff])\s*●\s*([\u4e00-\u9fff])/g, '$1\u2005●\u2005$2')
    next = next.replace(/([\u4e00-\u9fff\u3000-\u303f])-([A-Za-z0-9])/g, '$1\u200a-$2')
    next = next.replace(/([A-Za-z0-9])-([\u4e00-\u9fff])/g, '$1-\u200a$2')
    next = next.replace(/([\u4e00-\u9fff])-([\u4e00-\u9fff])/g, '$1\u200a-$2')
    next = next.replace(/([\u4e00-\u9fff\u3000-\u303f])－([A-Za-z0-9\u4e00-\u9fff])/g, '$1\u200a－$2')
    next = next.replace(/([A-Za-z0-9])－([\u4e00-\u9fff])/g, '$1－\u200a$2')
    next = next.replace(/——/g, '\u2014\u2005\u2014')
    next = next.replace(/([\u4e00-\u9fff])\u2014/g, '$1\u2005\u2014')
    next = next.replace(/\u2014([\u4e00-\u9fff])/g, '\u2014\u2005$1')
    next = next.replace(/(\d)\uFF5E(\d)/g, '$1\u200a\uFF5E\u200a$2')
    next = next.replace(/(\d)~(\d)/g, '$1\u200a~\u200a$2')
    /* 全角括号与前后汉字（如 草案（第三稿）） */
    next = next.replace(/([\u4e00-\u9fff])（/g, '$1\u200a（')
    next = next.replace(/）(?=[\u4e00-\u9fff\u300c\u300d])/g, '）\u200a')
    if (next !== s) tn.nodeValue = next
  }
}

async function waitXhsExportFonts (fontId, readMul = 1) {
  if (fontId !== 'smiley-sans') return
  const sc = XHS_EXPORT_SCALE
  const m = Math.max(0.8, Math.min(2.05, Number(readMul) || 1))
  const px = n => Math.max(8, Math.round(n * sc * m)) + 'px'
  try {
    await document.fonts.load('400 ' + px(17) + ' "smiley-sans"')
    await document.fonts.load('400 ' + px(28) + ' "smiley-sans"')
    await document.fonts.load('400 ' + px(24) + ' "smiley-sans"')
  } catch (e) {
    console.warn('[xhs-export] fonts.load smiley-sans', e)
  }
  try {
    await document.fonts.ready
  } catch (_) {}
}

/**
 * @param {string|null} mdChunk 若传入则仅从该段 Markdown 构建（不刷新整篇预览），用于按 ## 拆段导出
 * @param {string} [readability='standard'] 导出图手机阅读字号档位 standard|comfort|large
 */
async function buildXhsExportSurface (styleId, fontId, mdChunk = null, readability = 'standard') {
  if (mdChunk == null) {
    await renderPreview()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas 未加载，请检查 node_modules 与 index.html 脚本引用')
  const st = xhsStyleById(styleId)
  const fd = xhsFontById(fontId)
  const read = ['standard', 'comfort', 'large'].includes(readability) ? readability : 'standard'
  const readMul = xhsReadabilityMul(read)
  let host = $('xhs-export-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'xhs-export-host'
    document.body.appendChild(host)
  }
  host.innerHTML = ''
  const surface = document.createElement('div')
  surface.className = 'xhs-export-surface xhs-style-' + st.id + ' xhs-export-font-' + fd.id + ' xhs-read-' + read
  if (st.dark) surface.classList.add('xhs-export--dark')
  surface.innerHTML = await mdFragmentToExportableHtml(mdChunk != null ? mdChunk : getCurrentMd())
  {
    const fz = Math.round(10 * XHS_EXPORT_BASE_FONT_PX * xhsReadabilityMul(read)) / 10
    surface.style.fontSize = fz + 'px'
    /* 与 #xhs-export-host .xhs-export-surface 一致；长文/表格混排时略大行高减轻 html2canvas 叠字 */
    surface.style.lineHeight = '2.12'
    /* 过大会撑出大量空白分页；略大于行高即可防末行裁切 */
    surface.style.paddingBottom = Math.min(150, Math.round(48 + fz * 2.45)) + 'px'
  }
  xhsFlattenProseCodeFencesForCanvas(surface)
  stripDocPathFromXhsSurface(surface)
  xhsNormalizeNewlinesToBrInFlow(surface)
  xhsSplitFlowAtLineBreaks(surface)
  xhsRelaxPunctuationInSurface(surface)
  xhsUpgradeLongParagraphCode(surface)
  xhsWrapInlineCodeForCanvas(surface)
  if (fd.id === 'smiley-sans') injectSmileySansFaceIntoSurface(surface)
  host.appendChild(surface)
  for (const img of surface.querySelectorAll('img')) {
    const s = img.getAttribute('src')
    if (!s || s.startsWith('data:')) continue
    try {
      let href = s
      if (!/^https?:\/\//i.test(s)) {
        const r = await window.mobiAPI.resolveMarkdownImage(currentFile || '', s)
        if (r) href = r
      }
      img.setAttribute('src', href)
      const blob = await fetch(href).then(r => r.blob())
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = rej
        fr.readAsDataURL(blob)
      })
      img.setAttribute('src', dataUrl)
    } catch (e) {
      console.warn('[xhs-export] img inline', e)
    }
  }
  await Promise.all([...surface.querySelectorAll('img')].map(im => im.decode().catch(() => {})))
  await new Promise(r => setTimeout(r, 120))
  await waitXhsExportFonts(fd.id, readMul)
  try {
    await document.fonts.ready
  } catch (_) {}
  await new Promise(r => setTimeout(r, 80))
  // #region agent log
  const _mdForExport = mdChunk != null ? String(mdChunk) : String(getCurrentMd() || '')
  const _inlineOnlyCode = surface.querySelectorAll('p > code:only-child, li > code:only-child').length
  let _paraFenceLeak = 0
  for (const p of surface.querySelectorAll('p')) {
    if (/^\s*```/.test(p.textContent || '')) _paraFenceLeak++
  }
  dbgXhsAgentLog('app.js:buildXhsExportSurface', 'pre-capture layout', {
    mdChunkWasNull: mdChunk == null,
    mdLen: _mdForExport.length,
    readability: read,
    fontId: fd.id,
    scrollHeight: surface.scrollHeight,
    offsetHeight: surface.offsetHeight,
    clientHeight: surface.clientHeight,
    preCount: surface.querySelectorAll('pre').length,
    codeTagCount: surface.querySelectorAll('code').length,
    longCodeClassCount: surface.querySelectorAll('code.xhs-export-long-code').length,
    inlineOnlyCodeCandidates: _inlineOnlyCode,
    bqCount: surface.querySelectorAll('blockquote').length,
    bqCodeCount: surface.querySelectorAll('blockquote code').length,
    paraLooksLikeBrokenFence: _paraFenceLeak,
    fontsStatus: (typeof document !== 'undefined' && document.fonts && document.fonts.status) ? document.fonts.status : 'n/a'
  }, 'H1,H4,H5,H12,H14')
  // #endregion
  return surface
}

/** 截图前强制排版，避免 html2canvas 少算高度；overflow 避免裁切 */
async function captureXhsSurfaceToCanvas (surface, canvasBg) {
  const host = surface.parentElement && surface.parentElement.id === 'xhs-export-host'
    ? surface.parentElement
    : $('xhs-export-host')
  let hostMoved = false
  if (host) {
    host.style.setProperty('left', '0px')
    host.style.setProperty('top', '0px')
    hostMoved = true
  }
  surface.style.overflow = 'visible'
  void surface.offsetHeight
  const shBefore = surface.scrollHeight
  void surface.scrollHeight
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const capW = Math.max(1, Math.ceil(surface.offsetWidth || surface.getBoundingClientRect().width))
  const capH = Math.max(1, Math.ceil(Math.max(surface.scrollHeight, shBefore)))
  let cv
  try {
    cv = await window.html2canvas(surface, {
      backgroundColor: canvasBg,
      scale: XHS_EXPORT_SCALE,
      useCORS: true,
      allowTaint: true,
      logging: false,
      /* 默认 window 为视口尺寸时，克隆 iframe 过矮会导致长文排版测量偏差→叠字；与版心同宽高 */
      width: capW,
      height: capH,
      windowWidth: capW,
      windowHeight: capH,
      scrollX: 0,
      scrollY: 0
      /* 勿开 foreignObjectRendering：Electron/Chromium 下常整页空白，仅余签名 */
    })
  } finally {
    if (hostMoved && host) {
      host.style.removeProperty('left')
      host.style.removeProperty('top')
    }
  }
  // #region agent log
  const expectH = Math.round(shBefore * XHS_EXPORT_SCALE)
  dbgXhsAgentLog('app.js:captureXhsSurfaceToCanvas', 'canvas vs scrollHeight', {
    scrollHeightBefore: shBefore,
    canvasWidth: cv.width,
    canvasHeight: cv.height,
    scale: XHS_EXPORT_SCALE,
    expectCanvasHeight: expectH,
    heightShortfallPx: expectH - cv.height
  }, 'H1')
  // #endregion
  return cv
}

async function exportXhsShort () {
  let title
  try {
    title = await getXhsExportTitle()
    if (title == null) return
    const pickOpts = await openXhsStylePicker()
    if (pickOpts == null) return
    const { styleId, fontId, readability: readPick } = pickOpts
    const readability = readPick || cfg.xhsExportReadability || 'standard'
    const pageW = XHS_LAYOUT_W * XHS_EXPORT_SCALE
    const pageH = XHS_LAYOUT_H * XHS_EXPORT_SCALE
    const pick = await window.mobiAPI.xhsExportPickDir()
    if (!pick || pick.cancelled || !pick.path) return
    const st = xhsStyleById(styleId)
    const mdParts = splitMdForXhsExport(getCurrentMd(), readability)
    const useParts = mdParts.length > 1
    const splitHint = readability === 'standard' ? '## 二级标题' : '## 与 ### 标题'
    if (useParts && !confirm(`当前文档将按 ${mdParts.length} 段（按 ${splitHint}）依次导出（文件名：段号-页号.png），是否继续？`)) return

    const files = []
    const runOne = async (mdSlice, segIdx0) => {
      const surface = await buildXhsExportSurface(styleId, fontId, useParts ? mdSlice : null, readability)
      const raw = await captureXhsSurfaceToCanvas(surface, st.canvasBg)
      clearXhsExportHost()
      const norm = normalizeCanvasToTargetWidth(raw, st.canvasBg, pageW)
      if (norm.height > XHS_MAX_CANVAS_H) {
        const seg = useParts ? `第 ${segIdx0 + 1} 段` : '文档'
        alert(`${seg}仍超过单段高度上限（${XHS_MAX_CANVAS_H}px）。可改用导出对话框里的「标准」阅读档、在该段增加 \`###\` / \`##\` 拆段，或精简内容。`)
        throw new Error('xhs-height-limit')
      }
      let pages = sliceCanvasToFixedPages(norm, st.canvasBg, pageW, pageH)
      pages = dropTrailingBlankXhsPages(pages, st.canvasBg)
      for (let pi = 0; pi < pages.length; pi++) {
        stampExportSignature(pages[pi], st.dark)
        const data = await canvasToPngDataUrl(pages[pi])
        const name = useParts
          ? `${String(segIdx0 + 1).padStart(2, '0')}-${String(pi + 1).padStart(3, '0')}.png`
          : `${String(pi + 1).padStart(2, '0')}.png`
        files.push({ name, data })
      }
    }

    if (useParts) {
      for (let si = 0; si < mdParts.length; si++) {
        await runOne(mdParts[si], si)
      }
    } else {
      await runOne(null, 0)
    }

    const r = await window.mobiAPI.xhsExportWriteMany({ parentPath: pick.path, folderName: title, files })
    if (r && r.error) { alert(r.error); return }
    const segHint = useParts ? `（${mdParts.length} 段共 ${files.length} 张）` : `（${files.length} 张）`
    alert(`已导出短图${segHint}，每张约 ${pageW}×${pageH}，${XHS_EXPORT_SCALE}× 采样：\n${r.dir}`)
  } catch (e) {
    clearXhsExportHost()
    if (String(e && e.message) === 'xhs-height-limit') return
    console.error(e)
    alert('导出短图失败：' + (e.message || String(e)))
  }
}

async function exportXhsLong () {
  let title
  try {
    title = await getXhsExportTitle()
    if (title == null) return
    const pickOpts = await openXhsStylePicker()
    if (pickOpts == null) return
    const { styleId, fontId, readability: readPick } = pickOpts
    const readability = readPick || cfg.xhsExportReadability || 'standard'
    const pageW = XHS_LAYOUT_W * XHS_EXPORT_SCALE
    const mdParts = splitMdForXhsExport(getCurrentMd(), readability)
    const useParts = mdParts.length > 1
    const splitHint = readability === 'standard' ? '## 二级标题' : '## 与 ### 标题'
    if (useParts && !confirm(`当前文档将按 ${mdParts.length} 段（按 ${splitHint}）导出为多张长图（文件名：所选名-01.png、-02.png …），是否继续？`)) return

    const p = await window.mobiAPI.xhsExportSaveLongPath({ defaultTitle: title })
    if (!p || p.cancelled || !p.filePath) return
    const outPaths = xhsDerivedLongPngPaths(p.filePath, useParts ? mdParts.length : 1)
    const st = xhsStyleById(styleId)

    const runSlice = async (mdSlice, outPath, segIdx0) => {
      const surface = await buildXhsExportSurface(styleId, fontId, useParts ? mdSlice : null, readability)
      const raw = await captureXhsSurfaceToCanvas(surface, st.canvasBg)
      clearXhsExportHost()
      const norm = normalizeCanvasToTargetWidth(raw, st.canvasBg, pageW)
      if (norm.height > XHS_MAX_CANVAS_H) {
        const seg = useParts ? `第 ${segIdx0 + 1} 段` : '文档'
        alert(`${seg}仍超过单张长图安全高度（${XHS_MAX_CANVAS_H}px）。可改用「标准」阅读档、增加 \`###\` / \`##\` 拆段，或改用短图导出。`)
        throw new Error('xhs-height-limit')
      }
      stampExportSignature(norm, st.dark)
      const data = await canvasToPngDataUrl(norm)
      const w = await window.mobiAPI.xhsExportWriteOne({ filePath: outPath, data })
      if (w && w.error) { alert(w.error); throw new Error(w.error) }
    }

    if (useParts) {
      for (let si = 0; si < mdParts.length; si++) {
        await runSlice(mdParts[si], outPaths[si], si)
      }
      alert(`已导出 ${mdParts.length} 张长图（宽约 ${pageW}px，${XHS_EXPORT_SCALE}× 采样），例如：\n${outPaths[0]}`)
    } else {
      await runSlice(null, outPaths[0], 0)
      alert(`长图已保存（宽约 ${pageW}px，${XHS_EXPORT_SCALE}× 采样）：\n` + outPaths[0])
    }
  } catch (e) {
    clearXhsExportHost()
    if (String(e && e.message) === 'xhs-height-limit') return
    console.error(e)
    alert('导出长图失败：' + (e.message || String(e)))
  }
}

async function syncWorkspaceHint(){
  const w=await window.mobiAPI.workspaceGetRoot()
  const hint=$('workspace-path-hint')
  if(hint)hint.textContent=w.root||'未选择工作区，点击 📁 指定文件夹'
  if(w.root)cfg.workspaceRoot=w.root
  const sw=$('settings-workspace-display')
  if(sw)sw.textContent=w.root||'未选择'
}

function getCurrentWorkspaceRel(){
  const wrRaw=(cfg.workspaceRoot||'').replace(/[/\\]+$/,'')
  if(!wrRaw||!currentFile)return null
  const wr=wrRaw.replace(/\\/g,'/')
  const cf=currentFile.replace(/\\/g,'/')
  const wnorm=wr.toLowerCase()
  const cfnorm=cf.toLowerCase()
  if(!cfnorm.startsWith(wnorm))return null
  if(cf.length>wr.length){
    const next=cf.charAt(wr.length)
    if(next!=='/'&&next!=='\\')return null
  }
  return cf.slice(wr.length).replace(/^[/\\]+/,'')
}

async function appendTreeLevel(rel,depth,parentEl){
  const r=await window.mobiAPI.workspaceListDir(rel)
  if(r.error||!r.entries)return
  const activeRel=getCurrentWorkspaceRel()
  for(const e of r.entries){
    if(e.isDirectory){
      const row=document.createElement('div')
      row.className='tree-row tree-folder'
      row.style.paddingLeft=(6+depth*12)+'px'
      const chev=document.createElement('button')
      chev.type='button'
      chev.className='tree-chevron'
      chev.textContent=treeExpanded.has(e.relPath)?'▼':'▶'
      chev.onclick=ev=>{
        ev.stopPropagation()
        if(treeExpanded.has(e.relPath))treeExpanded.delete(e.relPath)
        else treeExpanded.add(e.relPath)
        void refreshWorkspaceTree()
      }
      const name=document.createElement('span')
      name.className='tree-name'
      name.textContent=e.name
      name.onclick=ev=>{
        ev.stopPropagation()
        treeContextDir=e.relPath
        treeExpanded.add(e.relPath)
        void refreshWorkspaceTree()
      }
      row.appendChild(chev)
      row.appendChild(name)
      parentEl.appendChild(row)
      if(treeExpanded.has(e.relPath))await appendTreeLevel(e.relPath,depth+1,parentEl)
    }else{
      const row=document.createElement('div')
      row.className='tree-row tree-file'+(e.relPath===activeRel?' tree-row-active':'')
      row.style.paddingLeft=(6+depth*12)+'px'
      const sp=document.createElement('span')
      sp.className='tree-chevron-spacer'
      row.appendChild(sp)
      const name=document.createElement('span')
      name.className='tree-name'
      name.textContent=e.name
      row.onclick=()=>{void openWorkspaceRelFile(e.relPath)}
      row.appendChild(name)
      parentEl.appendChild(row)
    }
  }
}

async function refreshWorkspaceTree(){
  const tree=$('file-tree')
  if(!tree)return
  await syncWorkspaceHint()
  const w=await window.mobiAPI.workspaceGetRoot()
  tree.innerHTML=''
  if(!w.root)return
  await appendTreeLevel('',0,tree)
}

async function openWorkspaceRelFile(relPath){
  if(isModified){
    const resp=await window.mobiAPI.newFile({hasChanges:true})
    if(resp.action==='cancel')return
    if(resp.action==='save')await saveFile()
  }
  const r=await window.mobiAPI.workspaceReadFile(relPath)
  if(!r||r.error)return
  applyOpenedDocument(r)
  await loadRecentFiles()
  await refreshWorkspaceTree()
}

function setupWorkspaceSidebar(){
  $('btn-sidebar-collapse').onclick=async()=>{
    applySidebarCollapsedState(true)
    await window.mobiAPI.saveConfig({sidebarCollapsed:true})
    Object.assign(cfg,{sidebarCollapsed:true})
  }
  $('sidebar-rail').onclick=async()=>{
    applySidebarCollapsedState(false)
    await window.mobiAPI.saveConfig({sidebarCollapsed:false})
    Object.assign(cfg,{sidebarCollapsed:false})
  }
  $('btn-workspace-pick').onclick=async()=>{
    const r=await window.mobiAPI.workspacePickRoot()
    if(r.cancelled)return
    cfg.workspaceRoot=r.root
    await syncWorkspaceHint()
    await refreshWorkspaceTree()
  }
  $('btn-workspace-refresh').onclick=()=>{void refreshWorkspaceTree()}
  $('btn-tree-new-file').onclick=async()=>{
    const name=await openPromptDialog({
      title:'新笔记',
      label:'名称',
      defaultValue:'未命名.md',
      placeholder:'可省略 .md，将自动补全'
    })
    if(name==null||!String(name).trim())return
    const r=await window.mobiAPI.workspaceCreateFile(treeContextDir,String(name).trim())
    if(r.error){
      alert(r.error==='exists'?'已存在同名文件':r.error==='no-workspace'?'请先选择工作区':String(r.error))
      return
    }
    if(treeContextDir)treeExpanded.add(treeContextDir)
    await refreshWorkspaceTree()
    await openWorkspaceRelFile(r.relPath)
  }
  $('btn-tree-new-folder').onclick=async()=>{
    const name=await openPromptDialog({
      title:'新文件夹',
      label:'名称',
      defaultValue:'新建文件夹'
    })
    if(name==null||!String(name).trim())return
    const r=await window.mobiAPI.workspaceMkdir(treeContextDir,String(name).trim())
    if(r.error){
      alert(r.error==='exists'?'已存在同名文件夹':r.error==='no-workspace'?'请先选择工作区':String(r.error))
      return
    }
    if(treeContextDir)treeExpanded.add(treeContextDir)
    if(r.relPath)treeExpanded.add(r.relPath)
    await refreshWorkspaceTree()
  }
}

async function insertMarkdownImageAtCursor(){
  if(readOnlyDoc)return
  const r=await window.mobiAPI.importMarkdownImage({mdFilePath:currentFile||''})
  if(r.cancelled)return
  if(r.error){alert(r.error);return}
  if(editMode==='markdown'||(editMode==='split'&&_lastSrc==='md')){
    insertMd('![]('+r.mdRel+')')
    return
  }
  if(editMode==='preview')return
  const img=document.createElement('img')
  img.setAttribute('src',r.fileUrl)
  img.setAttribute('alt','')
  img.setAttribute('data-md-src',r.mdRel)
  document.execCommand('insertHTML',false,img.outerHTML)
  _lastSrc='wysiwyg'
  setModified(true)
  scheduleRender();updateStatus()
}

// ════ 面板 ══════════════════════════════════════════════════
function setupPanels(){
  $('music-panel-close').onclick=()=>closePanel('music-panel')
  $('settings-panel-close').onclick=()=>closePanel('settings-panel')
  $('panel-mask').onclick=closeAllPanels
  setupMusicPanel();setupSettingsPanel()
}
function togglePanel(id){
  const isOpen=$(id).style.display!=='none';closeAllPanels()
  if(!isOpen){$(id).style.display='flex';$('panel-mask').style.display=''}
}
function closePanel(id){
  $(id).style.display='none'
  if($('music-panel').style.display==='none'&&$('settings-panel').style.display==='none')
    $('panel-mask').style.display='none'
}
function closeAllPanels(){
  $('music-panel').style.display='none'
  $('settings-panel').style.display='none'
  $('panel-mask').style.display='none'
}

// ════ 设置面板 ══════════════════════════════════════════════
function setupSettingsPanel(){
  $('font-size-slider').oninput=function(){const v=+this.value;richEditor.style.fontSize=mdEditor.style.fontSize=v+'px';$('font-size-display').textContent=v+'px';save_cfg({fontSize:v})}
  $('line-height-slider').oninput=function(){const v=+this.value/10;richEditor.style.lineHeight=mdEditor.style.lineHeight=v;$('line-height-display').textContent=v.toFixed(1);save_cfg({lineHeight:v})}
  $('font-family-select').onchange=function(){setFont(this.value);save_cfg({fontFamily:this.value})}
  $('word-wrap-toggle').onchange=function(){body.classList.toggle('no-wrap',!this.checked);save_cfg({wordWrap:this.checked})}
  $('btn-pick-bg').onclick=async()=>{
    const p=await window.mobiAPI.pickBgImage()
    if(!p)return
    $('bg-path-display').textContent=p
    await save_cfg({bgImagePath:p})
    await applyBgImage(p)
  }
  $('btn-clear-bg').onclick=async()=>{
    $('bg-path-display').textContent=''
    await save_cfg({bgImagePath:''})
    await applyBgImage('')
  }
  const btnWs=$('btn-settings-workspace')
  if(btnWs)btnWs.onclick=async()=>{
    const r=await window.mobiAPI.workspacePickRoot()
    if(r.cancelled)return
    cfg.workspaceRoot=r.root
    await syncWorkspaceHint()
    await refreshWorkspaceTree()
  }
  $('blur-slider').oninput=function(){const v=+this.value;$('blur-display').textContent=v+'px';applyGlassBlur(v);save_cfg({glassBlur:v})}
  $('overlay-slider').oninput=function(){
    const v=+this.value
    $('overlay-display').textContent=Math.round(v/60*100)+'%'
    applyGlassOverlay(v)
    save_cfg({glassOverlay:v})
  }
  const gtc = $('glass-text-contrast-select')
  if (gtc) {
    gtc.onchange = async function () {
      cfg.glassTextContrast = this.value
      await save_cfg({ glassTextContrast: this.value })
      await syncWallpaperTextContrast(lastBgDataUrl)
    }
  }
}
function save_cfg(p){
  Object.assign(cfg,p)
  return window.mobiAPI.saveConfig(p)
}

function syncVolumeSliderVar(){
  const el=$('volume-slider')
  if(el) el.style.setProperty('--vol', el.value + '%')
}

// ════ 音频 ══════════════════════════════════════════════════
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}

const AMBIENT_LABELS={rain:'雨声',forest:'森林',ocean:'海浪',wind:'城市',fire:'篝火',cafe:'咖啡馆'}

function setupMusicPanel(){
  document.querySelectorAll('.noise-btn').forEach(btn=>{
    btn.onclick=function(){
      const t=this.dataset.type
      if(noiseType===t){
        stopNoise()
        document.querySelectorAll('.noise-btn').forEach(b=>b.classList.remove('active'))
      } else {
        stopAmbientImmediate()
        document.querySelectorAll('.noise-btn').forEach(b=>b.classList.remove('active'))
        this.classList.add('active')
        void startNoise(t)
      }
    }
  })
  // 停止白噪音按钮
  $('btn-stop-noise').onclick=()=>{
    stopNoise()
    document.querySelectorAll('.noise-btn').forEach(b=>b.classList.remove('active'))
  }
  $('btn-pick-music-folder').onclick=async()=>{const f=await window.mobiAPI.pickMusicFolder();if(f){$('music-folder-display').textContent=f;save_cfg({musicFolder:f});await loadMusicFolder(f)}}
  document.querySelectorAll('.mode-btn').forEach(btn=>{btn.onclick=function(){document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');playMode=this.dataset.mode}})
  $('volume-slider').oninput=function(){
    musicVolume=+this.value/100
    $('volume-display').textContent=this.value+'%'
    syncVolumeSliderVar()
    if(noiseNodes){
      if(noiseNodes.kind==='file')noiseNodes.audio.volume=musicVolume
      else noiseNodes.gain.gain.value=musicVolume
    }
    if(musicAudio)musicAudio.volume=musicVolume
    save_cfg({musicVolume})
  }
  $('btn-play-pause').onclick=togglePlayPause
  $('btn-prev-track').onclick=prevTrack
  $('btn-next-track').onclick=nextTrack
  syncVolumeSliderVar()
}

async function startNoise(type){
  let url=null
  try{
    url=await window.mobiAPI.getAmbientAudioUrl(type)
  }catch(_){url=null}
  if(url){
    const audio=new Audio()
    audio.loop=true
    audio.volume=0
    audio.src=url
    noiseType=type
    noiseNodes={kind:'file',audio}
    try{
      await audio.play()
      fadeTo(audio,musicVolume,2000)
    }catch(e){
      console.warn('ambient file',e)
      stopAmbientImmediate()
      startNoiseSynth(type)
      return
    }
    $('btn-stop-noise').style.display=''
    setMusicStatus(AMBIENT_LABELS[type]||type)
    return
  }
  startNoiseSynth(type)
}

/** sounds 目录无对应文件时的合成音兜底 */
function startNoiseSynth(type){
  const ctx=getCtx();noiseType=type
  const sr=ctx.sampleRate,len=sr*4,buf=ctx.createBuffer(2,len,sr)
  const master=type==='rain'?0.56:0.58
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,lp=0,sm=0,drip=0
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1
      let s=0
      if(type==='rain'){
        b0=0.9932*b0+w*0.0068
        if(Math.random()<0.000062)drip+=(Math.random()*2-1)*(0.36+Math.random()*0.26)
        drip*=0.9892
        s=b0*0.11+drip
        sm=sm*0.84+s*0.16
      } else if(type==='ocean'){
        b0=0.9992*b0+w*0.0008;s=b0*0.55+w*0.018
        sm=sm*0.93+s*0.07
      } else if(type==='forest'){
        b0=0.978*b0+w*0.022;s=b0*0.5+w*0.045
        sm=sm*0.93+s*0.07
      } else if(type==='wind'){
        b0=0.992*b0+w*0.008;lp=0.97*lp+w*0.03;s=b0*0.42+lp*0.35
        sm=sm*0.93+s*0.07
      } else if(type==='fire'){
        b0=0.945*b0+w*0.055;s=b0+(Math.random()<0.0018?w*0.32:0)
        sm=sm*0.93+s*0.07
      } else if(type==='cafe'){
        b0=0.93*b0+w*0.07;s=b0*0.32+w*0.065
        sm=sm*0.93+s*0.07
      } else { s=w*0.22;sm=sm*0.93+s*0.07 }
      d[i]=sm*master
    }
  }
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true
  const gain=ctx.createGain();gain.gain.value=0
  const filt=ctx.createBiquadFilter()
  const soften=ctx.createBiquadFilter()
  if(type==='rain'){
    filt.type='bandpass'
    filt.frequency.value=5200
    filt.Q.value=0.55
    soften.type='lowpass'
    soften.frequency.value=12000
    soften.Q.value=0.35
  } else if(type==='ocean'){filt.type='lowpass';filt.frequency.value=260}
  else if(type==='forest'){filt.type='bandpass';filt.frequency.value=1650;filt.Q.value=0.55}
  else if(type==='wind'){filt.type='highpass';filt.frequency.value=420}
  else if(type==='fire'){filt.type='lowpass';filt.frequency.value=420}
  else if(type==='cafe'){filt.type='bandpass';filt.frequency.value=950;filt.Q.value=0.48}
  else{filt.type='lowpass';filt.frequency.value=2000}
  if(type!=='rain'){
    soften.type='lowpass'
    soften.frequency.value=3000
    soften.Q.value=0.45
  }
  src.connect(filt);filt.connect(soften);soften.connect(gain);gain.connect(ctx.destination);src.start()
  gain.gain.linearRampToValueAtTime(musicVolume,ctx.currentTime+(type==='rain'?2.6:2.2))
  noiseNodes={kind:'synth',source:src,gain,filter:filt,soften}
  $('btn-stop-noise').style.display=''
  setMusicStatus(AMBIENT_LABELS[type]||type)
}

function stopAmbientImmediate(){
  if(!noiseNodes)return
  const n=noiseNodes
  noiseNodes=null
  noiseType=null
  if(n.kind==='file'){
    try{n.audio.pause();n.audio.removeAttribute('src');n.audio.load()}catch(_){}
    return
  }
  if(n.kind==='synth'){
    try{
      n.source.stop()
      n.source.disconnect()
      if(n.filter)n.filter.disconnect()
      if(n.soften)n.soften.disconnect()
      n.gain.disconnect()
    }catch(_){}
  }
}

function stopNoise(){
  if(!noiseNodes){noiseType=null;$('btn-stop-noise').style.display='none';return}
  const n=noiseNodes;noiseNodes=null;noiseType=null
  if(n.kind==='file'){
    fadeTo(n.audio,0,550).then(()=>{
      try{n.audio.pause();n.audio.removeAttribute('src');n.audio.load()}catch(_){}
    })
    $('btn-stop-noise').style.display='none'
    if(!musicPlaying)hideMusicStatus()
    return
  }
  try{
    const ctx=getCtx()
    n.gain.gain.cancelScheduledValues(ctx.currentTime)
    n.gain.gain.setValueAtTime(n.gain.gain.value,ctx.currentTime)
    n.gain.gain.linearRampToValueAtTime(0,ctx.currentTime+0.5)
    setTimeout(()=>{try{n.source.stop();n.source.disconnect();if(n.filter)n.filter.disconnect();if(n.soften)n.soften.disconnect();n.gain.disconnect()}catch(e){}},600)
  }catch(e){try{n.source.stop()}catch(e2){}}
  $('btn-stop-noise').style.display='none'
  if(!musicPlaying)hideMusicStatus()
}

async function loadMusicFolder(folder){
  musicTracks=await window.mobiAPI.scanMusicFolder(folder)
  const list=$('music-list');list.innerHTML=''
  if(!musicTracks.length){list.innerHTML='<div style="font-size:12px;padding:8px 4px;opacity:.5">未找到音频文件</div>';return}
  musicTracks.forEach((t,i)=>{const el=document.createElement('div');el.className='music-item';el.id='track-'+i;el.textContent=t.name;el.onclick=()=>playTrack(i);list.appendChild(el)})
}
function nextIdx(){if(playMode==='shuffle'){let n=Math.floor(Math.random()*musicTracks.length);if(musicTracks.length>1&&n===musicIdx)n=(n+1)%musicTracks.length;return n}if(playMode==='loop')return musicIdx;return(musicIdx+1)%musicTracks.length}
function prevIdx(){if(playMode==='shuffle')return nextIdx();return(musicIdx-1+musicTracks.length)%musicTracks.length}
function mkAudio(idx){const t=musicTracks[idx];if(!t)return null;const a=new Audio();a.volume=0;a.src='file:///'+t.path.replace(/\\/g,'/').replace(/ /g,'%20');a.preload='auto';return a}
function playTrack(idx){
  if(!musicTracks.length)return
  idx=((idx%musicTracks.length)+musicTracks.length)%musicTracks.length
  if(musicAudio&&musicPlaying)fadeTo(musicAudio,0,1200).then(()=>musicAudio.pause())
  const audio=(musicNext&&musicNext._ti===idx)?musicNext:mkAudio(idx)
  if(!audio)return
  musicNext=null;musicIdx=idx;musicAudio=audio;audio._ti=idx
  audio.addEventListener('ended',()=>playTrack(nextIdx()),{once:true})
  audio.addEventListener('error',()=>playTrack(nextIdx()),{once:true})
  audio.play().then(()=>{
    fadeTo(audio,musicVolume,1200);musicPlaying=true;$('btn-play-pause').textContent='⏸'
    const name=musicTracks[idx].name;setMusicStatus(name);$('current-track-name').textContent=name
    document.querySelectorAll('.music-item').forEach((el,i)=>el.classList.toggle('playing',i===idx))
    const ni=nextIdx();musicNext=mkAudio(ni);if(musicNext)musicNext._ti=ni
  }).catch(()=>playTrack(nextIdx()))
}
function togglePlayPause(){
  if(!musicAudio){if(musicTracks.length)playTrack(0);return}
  if(musicPlaying){fadeTo(musicAudio,0,400).then(()=>musicAudio.pause());musicPlaying=false;$('btn-play-pause').textContent='▶'}
  else{musicAudio.play().then(()=>fadeTo(musicAudio,musicVolume,400));musicPlaying=true;$('btn-play-pause').textContent='⏸'}
}
function prevTrack(){if(musicTracks.length)playTrack(prevIdx())}
function nextTrack(){if(musicTracks.length)playTrack(nextIdx())}
function fadeTo(audio,target,dur){return new Promise(res=>{const steps=20,iv=dur/steps,from=audio.volume,delta=(target-from)/steps;let n=0;const id=setInterval(()=>{n++;audio.volume=Math.max(0,Math.min(1,from+delta*n));if(n>=steps){clearInterval(id);audio.volume=target;res()}},iv)})}
function setMusicStatus(name){$('music-status').style.display='flex';$('music-name').textContent=name}
function hideMusicStatus(){$('music-status').style.display='none'}

window.addEventListener('DOMContentLoaded',init)
