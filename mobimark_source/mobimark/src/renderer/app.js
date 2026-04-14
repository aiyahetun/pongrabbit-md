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
  if(window.mobiAPIPdf)await window.mobiAPIPdf.exportPdf({html:previewEl.innerHTML,title:currentFile?bn(currentFile).replace(/\.md$/i,''):'无题'})
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

// ════ 小红书 3:4 图片导出（1080×1440，基于预览渲染 + html2canvas）══════════
const XHS_PAGE_W = 1080
const XHS_PAGE_H = 1440
const XHS_MAX_CANVAS_H = 32000

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

function normalizeCanvasToWidth1080 (src) {
  const tw = XHS_PAGE_W
  const th = Math.max(1, Math.round(src.height * (tw / src.width)))
  const c = document.createElement('canvas')
  c.width = tw
  c.height = th
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, tw, th)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(src, 0, 0, tw, th)
  return c
}

function sliceCanvasToFixedPages (normalizedCanvas) {
  const W = XHS_PAGE_W
  const H = XHS_PAGE_H
  const totalH = normalizedCanvas.height
  const pages = []
  const n = Math.max(1, Math.ceil(totalH / H))
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    const sy = i * H
    const sh = Math.min(H, Math.max(0, totalH - sy))
    if (sh > 0) ctx.drawImage(normalizedCanvas, 0, sy, W, sh, 0, 0, W, sh)
    pages.push(c)
  }
  return pages
}

function clearXhsExportHost () {
  const h = $('xhs-export-host')
  if (h) h.innerHTML = ''
}

async function buildXhsExportSurface () {
  await renderPreview()
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas 未加载，请检查 node_modules 与 index.html 脚本引用')
  let host = $('xhs-export-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'xhs-export-host'
    document.body.appendChild(host)
  }
  host.innerHTML = ''
  const surface = document.createElement('div')
  surface.className = 'xhs-export-surface'
  surface.innerHTML = previewEl.innerHTML
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
  return surface
}

async function exportXhsShort () {
  let title
  try {
    title = await getXhsExportTitle()
    if (title == null) return
    const pick = await window.mobiAPI.xhsExportPickDir()
    if (!pick || pick.cancelled || !pick.path) return
    const surface = await buildXhsExportSurface()
    const raw = await window.html2canvas(surface, {
      backgroundColor: '#ffffff',
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false
    })
    clearXhsExportHost()
    const norm = normalizeCanvasToWidth1080(raw)
    if (norm.height > XHS_MAX_CANVAS_H) {
      alert('文档过长，请精简内容或改用长图导出（仍可能受系统限制）。')
      return
    }
    const pages = sliceCanvasToFixedPages(norm)
    const files = []
    for (let i = 0; i < pages.length; i++) {
      const data = await canvasToPngDataUrl(pages[i])
      files.push({ name: `${String(i + 1).padStart(2, '0')}.png`, data })
    }
    const r = await window.mobiAPI.xhsExportWriteMany({ parentPath: pick.path, folderName: title, files })
    if (r && r.error) { alert(r.error); return }
    alert(`已导出 ${pages.length} 张图片（每张 ${XHS_PAGE_W}×${XHS_PAGE_H}）：\n${r.dir}`)
  } catch (e) {
    clearXhsExportHost()
    console.error(e)
    alert('导出短图失败：' + (e.message || String(e)))
  }
}

async function exportXhsLong () {
  let title
  try {
    title = await getXhsExportTitle()
    if (title == null) return
    const p = await window.mobiAPI.xhsExportSaveLongPath({ defaultTitle: title })
    if (!p || p.cancelled || !p.filePath) return
    const surface = await buildXhsExportSurface()
    const raw = await window.html2canvas(surface, {
      backgroundColor: '#ffffff',
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false
    })
    clearXhsExportHost()
    const norm = normalizeCanvasToWidth1080(raw)
    if (norm.height > XHS_MAX_CANVAS_H) {
      alert('文档过长，超出单张图片安全高度，请分段导出短图。')
      return
    }
    const data = await canvasToPngDataUrl(norm)
    const w = await window.mobiAPI.xhsExportWriteOne({ filePath: p.filePath, data })
    if (w && w.error) { alert(w.error); return }
    alert('长图已保存（宽 ' + XHS_PAGE_W + 'px）：\n' + p.filePath)
  } catch (e) {
    clearXhsExportHost()
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
