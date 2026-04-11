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
let editMode='wysiwyg'  // wysiwyg | markdown | preview | split
let _lastSrc='wysiwyg' // last edited source
let renderTimer=null
let findMatches=[], findIdx=0, isResizing=false
// Audio
let audioCtx=null,noiseNodes=null,noiseType=null
let musicTracks=[],musicIdx=0,musicAudio=null,musicNext=null
let musicPlaying=false,playMode='order',musicVolume=0.6

// ── Init ─────────────────────────────────────────────────────
async function init() {
  if (window.pengPlatform === 'darwin') body.classList.add('platform-darwin')
  else if (window.pengPlatform === 'win32') body.classList.add('platform-win32')
  else body.classList.add('platform-linux')
  if (window.mobiAPI.onOpenFilePath) {
    window.mobiAPI.onOpenFilePath(p => { openFileFromPath(p) })
  }
  cfg = await window.mobiAPI.getConfig()
  applyConfig(cfg)
  setupModeTabs()
  setupRichEditor()
  setupMdToolbar()
  setupTopActions()
  setupFindBar()
  setupResizer()
  setupPanels()
  setupKeyboard()
  setupMenu()
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
  mdEditor.value = r.content
  richEditor.innerHTML = md2html(r.content)
  _lastSrc = 'wysiwyg'
  currentFile = r.filePath
  setModified(false)
  setTitle(bn(r.filePath))
  setMode('wysiwyg')
  renderPreview()
  updateStatus()
  await loadRecentFiles()
}

// ── Config ───────────────────────────────────────────────────
function applyConfig(c) {
  applyTheme(c.theme||'light', false)
  setFont(c.fontFamily||'system')
  const fs=(c.fontSize||15)+'px', lh=c.lineHeight||1.8
  richEditor.style.fontSize=fs; richEditor.style.lineHeight=lh
  mdEditor.style.fontSize=fs;   mdEditor.style.lineHeight=lh
  if(c.bgImagePath) applyBgImage(c.bgImagePath)
  if(c.glassBlur)   applyGlassBlur(c.glassBlur)
  if(c.glassOverlay!==undefined) applyGlassOverlay(c.glassOverlay)
  musicVolume=c.musicVolume!==undefined?c.musicVolume:0.6
  $('volume-slider').value=Math.round(musicVolume*100)
  $('volume-display').textContent=Math.round(musicVolume*100)+'%'
  syncVolumeSliderVar()
  syncUI(c)
  if(c.musicFolder){$('music-folder-display').textContent=c.musicFolder;loadMusicFolder(c.musicFolder)}
}

function syncUI(c){
  $('font-size-slider').value=c.fontSize||15
  $('font-size-display').textContent=(c.fontSize||15)+'px'
  $('line-height-slider').value=Math.round((c.lineHeight||1.8)*10)
  $('line-height-display').textContent=(c.lineHeight||1.8)
  $('font-family-select').value=c.fontFamily||'system'
  $('word-wrap-toggle').checked=c.wordWrap!==false
  $('blur-slider').value=c.glassBlur||20
  $('blur-display').textContent=(c.glassBlur||20)+'px'
  $('overlay-slider').value=c.glassOverlay!==undefined?c.glassOverlay:15
  $('overlay-display').textContent=(c.glassOverlay!==undefined?c.glassOverlay:15)+'%'
  if(c.bgImagePath)$('bg-path-display').textContent=c.bgImagePath
}

// ── Theme ────────────────────────────────────────────────────
function applyTheme(theme, save=true) {
  body.className=body.className.replace(/theme-\S+/g,'').trim()
  body.classList.add('theme-'+theme); cfg.theme=theme
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
  if(save) save_cfg({theme})
}
async function setTheme(t){
  applyTheme(t)
  await window.mobiAPI.saveConfig({theme:t})
  // 无需重建窗口，CSS 变量切换即时生效
}

function setFont(f){
  body.classList.remove('font-songti','font-kaiti','font-mono')
  if(f!=='system')body.classList.add('font-'+f);cfg.fontFamily=f
}
function applyBgImage(p){
  if(!p){$('bg-layer').style.backgroundImage='';return}
  $('bg-layer').style.backgroundImage=`url("file:///${p.replace(/\\/g,'/').replace(/#/g,'%23')}")`
}
function applyGlassBlur(v){
  $('glass-overlay').style.backdropFilter=`blur(${Math.min(v/3,10)}px) brightness(1.05)`
  $('glass-overlay').style.webkitBackdropFilter=`blur(${Math.min(v/3,10)}px) brightness(1.05)`
}
function applyGlassOverlay(v){
  $('glass-overlay').style.background=`rgba(255,255,255,${v/400})`
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
    if(e.ctrlKey){
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
    if(e.ctrlKey){
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
  $('fmt-ul').onclick=()=>prefixMd('- ')
  $('fmt-ol').onclick=()=>prefixMd('1. ')
  $('fmt-task').onclick=()=>prefixMd('- [ ] ')
  $('fmt-table').onclick=()=>showTableDialog()
  $('fmt-hr').onclick=()=>insertMd('\n\n---\n\n')
  $('btn-find-md').onclick=()=>showFindBar()
}

function handleMdEnter(e){
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
  $('btn-export-pdf').onclick=exportPdf
  $('btn-export-html').onclick=exportHtml
  $('btn-music').onclick=()=>togglePanel('music-panel')
  $('btn-settings').onclick=()=>togglePanel('settings-panel')
  $('btn-theme-light').onclick=()=>setTheme('light')
  $('btn-theme-dark').onclick=()=>setTheme('dark')
  $('btn-theme-glass').onclick=()=>setTheme('glass')
  $('btn-minimize').onclick=()=>window.mobiAPI.winMinimize()
  $('btn-maximize').onclick=()=>window.mobiAPI.winMaximize()
  $('btn-close').onclick=()=>window.mobiAPI.winClose()
}

// ════ 文件操作 ══════════════════════════════════════════════
function getCurrentMd(){
  if(_lastSrc==='md'||editMode==='markdown')return mdEditor.value
  return richToMd()
}
async function newFile(){
  const r=await window.mobiAPI.newFile({hasChanges:isModified})
  if(r.action==='save')await saveFile()
  if(r.action!=='cancel'){richEditor.innerHTML='';mdEditor.value='';currentFile=null;setModified(false);setTitle('无题文档');updateStatus()}
}
async function openFile(){
  const r=await window.mobiAPI.openFile();if(!r||r.error)return
  mdEditor.value=r.content
  richEditor.innerHTML=md2html(r.content)
  _lastSrc='wysiwyg'
  currentFile=r.filePath;setModified(false);setTitle(bn(r.filePath))
  renderPreview();updateStatus();await loadRecentFiles()
}
async function saveFile(){
  const r=await window.mobiAPI.saveFile({filePath:currentFile,content:getCurrentMd()})
  if(r&&!r.error){currentFile=r;setModified(false);setTitle(bn(r));await loadRecentFiles()}
}
async function saveFileAs(){
  const r=await window.mobiAPI.saveFileAs({content:getCurrentMd()})
  if(r&&!r.error){currentFile=r;setModified(false);setTitle(bn(r));await loadRecentFiles()}
}
async function exportHtml(){
  await window.mobiAPI.exportHtml({html:previewEl.innerHTML,title:currentFile?bn(currentFile).replace(/\.md$/i,''):'无题'})
}
async function exportPdf(){
  if(window.mobiAPIPdf)await window.mobiAPIPdf.exportPdf({html:previewEl.innerHTML,title:currentFile?bn(currentFile).replace(/\.md$/i,''):'无题'})
}

function setModified(v){isModified=v;$('file-modified').style.display=v?'':'none'}
function setTitle(n){$('file-name').textContent=n}
function bn(p){return p.replace(/\\/g,'/').split('/').pop()}
function updateStatus(){
  const text=editMode==='markdown'||_lastSrc==='md'?mdEditor.value:(richEditor.innerText||'')
  const cjk=(text.match(/[\u4e00-\u9fa5]/g)||[]).length
  const words=text.trim()===''?0:text.trim().split(/\s+/).length+cjk
  $('status-words').textContent='字数 '+words
  $('status-chars').textContent='字符 '+text.length
  $('status-lines').textContent='行 '+text.split('\n').length
  $('status-file').textContent=currentFile?bn(currentFile):'未保存'
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
    case 'img':return '!['+node.getAttribute('alt')+']('+(node.getAttribute('src')||'')+')'
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
  const s=mdEditor.selectionStart,e2=mdEditor.selectionEnd
  mdEditor.value=mdEditor.value.substring(0,s)+txt+mdEditor.value.substring(e2)
  mdEditor.selectionStart=mdEditor.selectionEnd=s+txt.length
  mdEditor.focus();setModified(true);scheduleRender()
}
function wrapMd(b,a){
  const s=mdEditor.selectionStart,e2=mdEditor.selectionEnd,sel=mdEditor.value.substring(s,e2)
  mdEditor.value=mdEditor.value.substring(0,s)+b+sel+a+mdEditor.value.substring(e2)
  if(sel){mdEditor.selectionStart=s+b.length;mdEditor.selectionEnd=e2+b.length}
  else{mdEditor.selectionStart=mdEditor.selectionEnd=s+b.length}
  mdEditor.focus();setModified(true);scheduleRender()
}
function prefixMd(prefix){
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
  if(!findMatches.length)return
  const i=findMatches[findIdx]
  mdEditor.value=mdEditor.value.substring(0,i)+replaceInput.value+mdEditor.value.substring(i+findInput.value.length)
  setModified(true);scheduleRender();doFind()
}
function replaceAll(){
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
    if(e.ctrlKey&&e.shiftKey&&e.key==='S'){e.preventDefault();saveFileAs();return}
    if(e.key==='Escape'){
      if(findBar.style.display!=='none'){hideFindBar();return}
      if($('table-dialog').style.display!=='none'){$('table-dialog').style.display='none';return}
      if($('link-dialog').style.display!=='none'){$('link-dialog').style.display='none';return}
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
      'menu-find':showFindBar,'menu-theme':()=>setTheme(args[0])}
    if(map[ev])map[ev]()
  })
}

// ════ 最近文件 ══════════════════════════════════════════════
async function loadRecentFiles(){
  const files=await window.mobiAPI.getRecentFiles()
  const list=$('recent-list');list.innerHTML=''
  if(!files.length){list.innerHTML='<div style="font-size:12px;padding:12px;opacity:.4">暂无最近打开的文档</div>';return}
  files.forEach(f=>{
    const el=document.createElement('div');el.className='recent-item';el.textContent=bn(f);el.title=f
    el.onclick=async()=>{
      const r=await window.mobiAPI.readFile(f);if(!r||r.error)return
      mdEditor.value=r.content;richEditor.innerHTML=md2html(r.content);_lastSrc='wysiwyg'
      currentFile=r.filePath;setModified(false);setTitle(bn(f));renderPreview();updateStatus()
    }
    list.appendChild(el)
  })
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
  $('btn-pick-bg').onclick=async()=>{const p=await window.mobiAPI.pickBgImage();if(p){applyBgImage(p);$('bg-path-display').textContent=p;save_cfg({bgImagePath:p})}}
  $('btn-clear-bg').onclick=()=>{$('bg-layer').style.backgroundImage='';$('bg-path-display').textContent='';save_cfg({bgImagePath:''})}
  $('blur-slider').oninput=function(){const v=+this.value;$('blur-display').textContent=v+'px';applyGlassBlur(v);save_cfg({glassBlur:v})}
  $('overlay-slider').oninput=function(){const v=+this.value;$('overlay-display').textContent=v+'%';applyGlassOverlay(v);save_cfg({glassOverlay:v})}
}
function save_cfg(p){Object.assign(cfg,p);window.mobiAPI.saveConfig(p)}

function syncVolumeSliderVar(){
  const el=$('volume-slider')
  if(el) el.style.setProperty('--vol', el.value + '%')
}

// ════ 音频 ══════════════════════════════════════════════════
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}

function setupMusicPanel(){
  document.querySelectorAll('.noise-btn').forEach(btn=>{
    btn.onclick=function(){
      const t=this.dataset.type
      if(noiseType===t){
        stopNoise()
        document.querySelectorAll('.noise-btn').forEach(b=>b.classList.remove('active'))
      } else {
        stopNoise()
        document.querySelectorAll('.noise-btn').forEach(b=>b.classList.remove('active'))
        this.classList.add('active')
        startNoise(t)
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
    if(noiseNodes)noiseNodes.gain.gain.value=musicVolume
    if(musicAudio)musicAudio.volume=musicVolume
    save_cfg({musicVolume})
  }
  $('btn-play-pause').onclick=togglePlayPause
  $('btn-prev-track').onclick=prevTrack
  $('btn-next-track').onclick=nextTrack
  syncVolumeSliderVar()
}

function startNoise(type){
  const ctx=getCtx();noiseType=type
  const sr=ctx.sampleRate,len=sr*4,buf=ctx.createBuffer(2,len,sr)
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1
      if(type==='rain'){b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.3104856;b4=0.55*b4+w*0.5329522;b5=-0.7616*b5-w*0.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;b6=w*0.115926}
      else if(type==='ocean'){b0=0.999*b0+w*0.001;d[i]=b0+w*0.04}
      else if(type==='forest'){b0=0.97*b0+w*0.03;d[i]=b0*0.6+w*0.08}
      else if(type==='wind'){d[i]=w*0.35}
      else if(type==='fire'){b0=0.93*b0+w*0.07;d[i]=b0+(Math.random()<0.003?w*0.6:0)}
      else if(type==='cafe'){b0=0.9*b0+w*0.1;d[i]=b0*0.4+w*0.15}
      else d[i]=w*0.3
    }
  }
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true
  const gain=ctx.createGain();gain.gain.value=0
  const filt=ctx.createBiquadFilter()
  if(type==='rain'){filt.type='bandpass';filt.frequency.value=900;filt.Q.value=0.6}
  else if(type==='ocean'){filt.type='lowpass';filt.frequency.value=350}
  else if(type==='forest'){filt.type='bandpass';filt.frequency.value=2200;filt.Q.value=0.9}
  else if(type==='wind'){filt.type='highpass';filt.frequency.value=700}
  else if(type==='fire'){filt.type='lowpass';filt.frequency.value=550}
  else filt.type='allpass'
  src.connect(filt);filt.connect(gain);gain.connect(ctx.destination);src.start()
  gain.gain.linearRampToValueAtTime(musicVolume,ctx.currentTime+1.5)
  noiseNodes={source:src,gain,filter:filt}
  // 显示停止按钮
  $('btn-stop-noise').style.display=''
  setMusicStatus({rain:'雨声',forest:'森林',ocean:'海浪',wind:'风声',fire:'篝火',cafe:'咖啡馆'}[type]||type)
}

function stopNoise(){
  if(!noiseNodes){noiseType=null;$('btn-stop-noise').style.display='none';return}
  const n=noiseNodes;noiseNodes=null;noiseType=null
  try{
    const ctx=getCtx()
    n.gain.gain.cancelScheduledValues(ctx.currentTime)
    n.gain.gain.setValueAtTime(n.gain.gain.value,ctx.currentTime)
    n.gain.gain.linearRampToValueAtTime(0,ctx.currentTime+0.5)
    setTimeout(()=>{try{n.source.stop();n.source.disconnect();n.gain.disconnect()}catch(e){}},600)
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
