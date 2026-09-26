'use strict'
/* 编辑区 + 工作区文件树右键菜单（依赖 app.js 全局函数与状态） */

function tt (key, vars) {
  return window.i18nAPI ? window.i18nAPI.t(key, vars) : key
}

function setupContextMenu () {
  const menu = $('ctx-menu')
  const sub = $('ctx-submenu')
  if (!menu) return

  let ctxState = null
  let subParentId = null

  function hideMenus () {
    menu.style.display = 'none'
    menu.setAttribute('aria-hidden', 'true')
    if (sub) {
      sub.style.display = 'none'
      sub.setAttribute('aria-hidden', 'true')
    }
    ctxState = null
    subParentId = null
  }

  function clampPos (x, y, el) {
    const pad = 8
    const r = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + r.width > window.innerWidth - pad) left = window.innerWidth - r.width - pad
    if (top + r.height > window.innerHeight - pad) top = window.innerHeight - r.height - pad
    if (left < pad) left = pad
    if (top < pad) top = pad
    return { left, top }
  }

  function renderMenu (el, items, x, y) {
    el.innerHTML = ''
    items.forEach(it => {
      if (it.sep) {
        const s = document.createElement('div')
        s.className = 'ctx-menu-sep'
        el.appendChild(s)
        return
      }
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ctx-menu-item' + (it.disabled ? ' disabled' : '') + (it.children ? ' has-sub' : '')
      btn.dataset.action = it.id
      btn.disabled = !!it.disabled
      const label = document.createElement('span')
      label.className = 'ctx-menu-label'
      label.textContent = it.label
      btn.appendChild(label)
      if (it.shortcut) {
        const sc = document.createElement('span')
        sc.className = 'ctx-menu-shortcut'
        sc.textContent = it.shortcut
        btn.appendChild(sc)
      }
      if (it.children) btn.appendChild(document.createTextNode(' ▸'))
      btn.onmouseenter = () => {
        if (!it.children || it.disabled) {
          if (sub) sub.style.display = 'none'
          return
        }
        subParentId = it.id
        renderMenu(sub, it.children, 0, 0)
        const br = btn.getBoundingClientRect()
        sub.style.display = 'block'
        sub.setAttribute('aria-hidden', 'false')
        const pos = clampPos(br.right, br.top, sub)
        sub.style.left = pos.left + 'px'
        sub.style.top = pos.top + 'px'
      }
      btn.onclick = ev => {
        ev.stopPropagation()
        if (it.disabled) return
        if (it.children) return
        const action = it.id
        const st = ctxState
        hideMenus()
        void runContextAction(action, st)
      }
      el.appendChild(btn)
    })
    el.style.display = 'block'
    el.setAttribute('aria-hidden', 'false')
    const pos = clampPos(x, y, el)
    el.style.left = pos.left + 'px'
    el.style.top = pos.top + 'px'
  }

  function isMdMode () {
    return editMode === 'markdown'
  }

  function isRichMode () {
    return editMode === 'wysiwyg'
  }

  function isSplitMdTarget (target) {
    return editMode === 'split' && mdPane && (target === mdEditor || mdPane.contains(target))
  }

  function isSplitRichTarget (target) {
    return editMode === 'split' && richEditor && (target === richEditor || richEditor.contains(target))
  }

  function hasSelectionInEditor (mode) {
    if (mode === 'md') {
      return mdEditor.selectionStart !== mdEditor.selectionEnd
    }
    const sel = window.getSelection()
    return sel && !sel.isCollapsed && richEditor.contains(sel.anchorNode)
  }

  function detectEditorContext (e) {
    const target = e.target
    if (editMode === 'preview') {
      let node = target
      if (node.nodeType === 3) node = node.parentElement
      const a = node && node.closest && node.closest('a[href]')
      if (a && previewEl.contains(a)) {
        const sel = window.getSelection()
        const hasSel = sel && !sel.isCollapsed
        return { zone: 'preview', kind: 'link', linkEl: a, hasSelection: hasSel }
      }
      const sel = window.getSelection()
      const hasSel = sel && !sel.isCollapsed
      return { zone: 'preview', hasSelection: hasSel }
    }
    const useMd = isMdMode() || isSplitMdTarget(target)
    if (useMd) {
      const pos = mdEditor.selectionStart
      const tCtx = getMdTableCellContext(pos)
      if (tCtx) return { zone: 'editor', mode: 'md', kind: 'table', mdTable: tCtx }
      const v = mdEditor.value
      const ls = v.lastIndexOf('\n', pos - 1) + 1
      const le = v.indexOf('\n', pos)
      const line = v.substring(ls, le === -1 ? v.length : le)
      const imgM = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
      if (imgM) return { zone: 'editor', mode: 'md', kind: 'image', mdLine: line, mdSrc: imgM[2] }
      const linkM = line.match(/\[([^\]]*)\]\(([^)]+)\)/)
      if (linkM) return { zone: 'editor', mode: 'md', kind: 'link', linkUrl: linkM[2], linkText: linkM[1] }
      if (/^```/.test(line.trim()) || (pos > 0 && v.lastIndexOf('```', pos) > v.lastIndexOf('```', 0))) {
        return { zone: 'editor', mode: 'md', kind: 'codeblock' }
      }
      if (hasSelectionInEditor('md')) return { zone: 'editor', mode: 'md', kind: 'selection' }
      return { zone: 'editor', mode: 'md', kind: 'empty' }
    }
    if (isRichMode() || isSplitRichTarget(target) || editMode === 'split') {
      let node = target
      if (node.nodeType === 3) node = node.parentElement
      if (!node) return { zone: 'editor', mode: 'rich', kind: 'empty' }
      const tCtx = getRichTableCellContextFromNode(node) || getRichTableCellContext()
      if (tCtx) return { zone: 'editor', mode: 'rich', kind: 'table', richTable: tCtx }
      const img = node.closest && node.closest('img')
      if (img && richEditor.contains(img)) {
        return { zone: 'editor', mode: 'rich', kind: 'image', imgEl: img }
      }
      const a = node.closest && node.closest('a[href]')
      if (a && richEditor.contains(a)) {
        return { zone: 'editor', mode: 'rich', kind: 'link', linkEl: a }
      }
      const pre = node.closest && node.closest('pre')
      if (pre && richEditor.contains(pre)) {
        return { zone: 'editor', mode: 'rich', kind: 'codeblock', preEl: pre }
      }
      if (hasSelectionInEditor('rich')) return { zone: 'editor', mode: 'rich', kind: 'selection' }
      return { zone: 'editor', mode: 'rich', kind: 'empty' }
    }
    return { zone: 'editor', kind: 'empty' }
  }

  function detectTreeContext (e) {
    const row = e.target.closest && e.target.closest('.tree-row')
    if (row && row.dataset.relPath != null) {
      return {
        zone: 'tree',
        relPath: row.dataset.relPath,
        isDir: row.dataset.isDir === '1',
        name: row.dataset.name || bn(row.dataset.relPath)
      }
    }
    const tree = $('file-tree')
    if (tree && (tree === e.target || tree.contains(e.target))) {
      return { zone: 'tree', relPath: treeContextDir || '', isDir: false, empty: true }
    }
    return { zone: 'tree', empty: true, relPath: treeContextDir || '' }
  }

  async function workspaceAbsFromRel (rel) {
    const w = await window.mobiAPI.workspaceGetRoot()
    if (!w.root) return null
    const root = w.root.replace(/[/\\]+$/, '')
    if (!rel) return root
    return root + '/' + rel.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  }

  function buildEditorItems (c) {
    const ro = readOnlyDoc
    const prev = c.zone === 'preview'
    const items = []
    if (!prev && !ro) {
      items.push(
        { id: 'undo', label: tt('ctx.undo'), shortcut: 'Ctrl+Z' },
        { id: 'redo', label: tt('ctx.redo'), shortcut: 'Ctrl+Y' },
        { sep: true },
        { id: 'cut', label: tt('ctx.cut'), shortcut: 'Ctrl+X' },
        { id: 'copy', label: tt('ctx.copy'), shortcut: 'Ctrl+C' },
        { id: 'paste', label: tt('ctx.paste'), shortcut: 'Ctrl+V' },
        { id: 'selectAll', label: tt('ctx.selectAll'), shortcut: 'Ctrl+A' },
        { sep: true },
        { id: 'find', label: tt('ctx.find'), shortcut: 'Ctrl+F' }
      )
    } else {
      items.push(
        { id: 'copy', label: tt('ctx.copy'), shortcut: 'Ctrl+C' },
        { id: 'selectAll', label: tt('ctx.selectAll'), shortcut: 'Ctrl+A' }
      )
    }

    if (c.kind === 'table' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'tbl-row-above', label: tt('ctx.rowAbove') },
        { id: 'tbl-row-below', label: tt('ctx.rowBelow') },
        { id: 'tbl-col-left', label: tt('ctx.colLeft') },
        { id: 'tbl-col-right', label: tt('ctx.colRight') },
        { sep: true },
        { id: 'tbl-del-row', label: tt('ctx.delRow') },
        { id: 'tbl-del-col', label: tt('ctx.delCol') },
        { id: 'tbl-del-table', label: tt('ctx.delTable') }
      )
    }

    if (c.kind === 'selection' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'bold', label: tt('ctx.bold'), shortcut: 'Ctrl+B' },
        { id: 'italic', label: tt('ctx.italic'), shortcut: 'Ctrl+I' },
        { id: 'strike', label: tt('ctx.strike') },
        { id: 'link', label: tt('ctx.link') }
      )
    }

    if (c.kind === 'image' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'img-replace', label: tt('ctx.imgReplace') },
        { id: 'img-copy-path', label: tt('ctx.imgPath') },
        { id: 'img-reveal', label: tt('ctx.imgReveal') },
        { id: 'img-delete', label: tt('ctx.imgDelete') }
      )
    }

    if (c.kind === 'link') {
      items.push({ sep: true })
      if (prev) {
        items.push({ id: 'link-open', label: tt('ctx.linkOpen') })
      } else if (!ro) {
        items.push(
          { id: 'link-open', label: tt('ctx.linkOpen') },
          { id: 'link-edit', label: tt('ctx.linkEdit') },
          { id: 'link-unlink', label: tt('ctx.linkUnlink') }
        )
      }
    }

    if (c.kind === 'codeblock' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'code-copy', label: tt('ctx.codeCopy') },
        { id: 'code-delete', label: tt('ctx.codeDelete') }
      )
    }

    if (c.kind === 'empty' && !ro && !prev) {
      items.push({
        id: 'insert-sub',
        label: tt('ctx.insert'),
        children: [
          { id: 'ins-table', label: tt('ctx.table') },
          { id: 'ins-image', label: tt('ctx.image') },
          { id: 'ins-link', label: tt('ctx.insLink') },
          { id: 'ins-hr', label: tt('ctx.hr') },
          { id: 'ins-code', label: tt('ctx.code') }
        ]
      })
    }

    return items
  }

  async function buildTreeItems (c) {
    const w = await window.mobiAPI.workspaceGetRoot()
    const hasWs = !!(w && w.root)
    const items = []
    if (!hasWs) {
      items.push({ id: 'ws-pick', label: tt('ctx.pickWs') })
      return items
    }
    if (c.empty) {
      items.push(
        { id: 'ws-refresh', label: tt('ctx.refresh') },
        { sep: true },
        { id: 'tree-new-file', label: tt('ctx.newNote') },
        { id: 'tree-new-folder', label: tt('ctx.newFolder') },
        { sep: true },
        { id: 'ws-pick', label: tt('ctx.changeWs') }
      )
      return items
    }
    if (!c.isDir) {
      items.push({ id: 'tree-open', label: tt('ctx.open') })
      items.push({ sep: true })
    }
    if (c.isDir) {
      items.push({ id: 'tree-new-file', label: tt('ctx.newNote') })
      items.push({ id: 'tree-new-folder', label: tt('ctx.newFolder') })
      items.push({ sep: true })
    }
    items.push(
      { id: 'tree-rename', label: tt('ctx.rename') },
      { id: 'tree-delete', label: tt('ctx.delete') },
      { id: 'tree-reveal', label: tt('ctx.reveal') },
      { id: 'tree-copy-path', label: tt('ctx.copyPath') }
    )
    if (c.isDir) items.splice(1, 0, { sep: true })
    return items
  }

  async function runContextAction (action, st) {
    if (!st) return

    if (st.zone === 'tree') {
      await runTreeAction(action, st)
      return
    }

    if (st.zone === 'preview') {
      if (action === 'copy') document.execCommand('copy')
      if (action === 'selectAll') document.execCommand('selectAll')
      if (action === 'link-open' && st.linkEl) {
        const url = normalizeLinkHref(st.linkEl.getAttribute('href'))
        if (url) void openMarkdownLink(url)
      }
      return
    }

    const c = st
    const mdCtx = c.mode === 'md' || (editMode === 'markdown' && c.zone !== 'preview')

    if (action === 'undo') execEditorUndo()
    else if (action === 'redo') execEditorRedo()
    else if (action === 'cut') document.execCommand('cut')
    else if (action === 'copy') document.execCommand('copy')
    else if (action === 'paste') {
      if (mdCtx) document.execCommand('paste')
      else void pastePlainTextInRichEditor()
    }
    else if (action === 'selectAll') {
      if (mdCtx) mdEditor.select()
      else document.execCommand('selectAll')
    }
    else if (action === 'find') showFindBar()
    else if (action === 'bold') {
      if (mdCtx) wrapMd('**', '**')
      else document.execCommand('bold')
    }
    else if (action === 'italic') {
      if (mdCtx) wrapMd('*', '*')
      else document.execCommand('italic')
    }
    else if (action === 'strike') {
      if (mdCtx) wrapMd('~~', '~~')
      else document.execCommand('strikeThrough')
    }
    else if (action === 'link') showLinkDialog()
    else if (action === 'ins-table') showTableDialog()
    else if (action === 'ins-image') insertMarkdownImageAtCursor()
    else if (action === 'ins-link') showLinkDialog()
    else if (action === 'ins-hr') {
      if (mdCtx) insertMd('\n\n---\n\n')
      else document.execCommand('insertHorizontalRule')
    }
    else if (action === 'ins-code') insertCodeBlock()
    else if (c.kind === 'table') {
      if (c.mode === 'rich' && c.richTable) {
        const t = c.richTable
        if (!t.table || !t.table.isConnected) return
        const rows = typeof tableRowsList === 'function' ? tableRowsList(t.table) : []
        const rowIndex = rows.length ? Math.min(t.rowIndex, rows.length - 1) : t.rowIndex
        if (action === 'tbl-row-above') richTableInsertRow(t.table, rowIndex, 'before')
        else if (action === 'tbl-row-below') richTableInsertRow(t.table, rowIndex, 'after')
        else if (action === 'tbl-col-left') richTableInsertCol(t.table, t.colIndex, 'before')
        else if (action === 'tbl-col-right') richTableInsertCol(t.table, t.colIndex, 'after')
        else if (action === 'tbl-del-row') richTableDeleteRow(t.table, rowIndex)
        else if (action === 'tbl-del-col') richTableDeleteCol(t.table, t.colIndex)
        else if (action === 'tbl-del-table') richTableDelete(t.table)
      } else if (c.mdTable) {
        const t = c.mdTable
        if (action === 'tbl-row-above') mdTableInsertRow(t, 'before')
        else if (action === 'tbl-row-below') mdTableInsertRow(t, 'after')
        else if (action === 'tbl-col-left') mdTableInsertCol(t, 'before')
        else if (action === 'tbl-col-right') mdTableInsertCol(t, 'after')
        else if (action === 'tbl-del-row') mdTableDeleteRow(t)
        else if (action === 'tbl-del-col') mdTableDeleteCol(t)
        else if (action === 'tbl-del-table') mdTableDelete(t.info)
      }
    }
    else if (c.kind === 'image') {
      if (action === 'img-replace') insertMarkdownImageAtCursor()
      else if (action === 'img-copy-path') {
        const src = c.imgEl ? (c.imgEl.getAttribute('data-md-src') || c.imgEl.getAttribute('src') || '') : (c.mdSrc || '')
        void navigator.clipboard.writeText(src)
      }
      else if (action === 'img-reveal') {
        const src = c.imgEl ? (c.imgEl.getAttribute('data-md-src') || c.imgEl.getAttribute('src') || '') : (c.mdSrc || '')
        if (currentFile && src) {
          const r = await window.mobiAPI.resolveMarkdownImage(currentFile, src)
          if (r && r.filePath) window.mobiAPI.showInFolder(r.filePath)
        }
      }
      else if (action === 'img-delete') {
        if (c.imgEl) {
          c.imgEl.remove()
          recordRichHistory()
          setModified(true)
          scheduleRender()
        } else if (c.mode === 'md') {
          const v = mdEditor.value
          const ls = v.lastIndexOf('\n', mdEditor.selectionStart - 1) + 1
          const le = v.indexOf('\n', mdEditor.selectionStart)
          const end = le === -1 ? v.length : le
          mdEditor.value = v.substring(0, ls) + v.substring(end + (le === -1 ? 0 : 1))
          recordMdHistory()
          setModified(true)
          scheduleRender()
        }
      }
    }
    else if (c.kind === 'link') {
      const url = c.linkEl ? normalizeLinkHref(c.linkEl.getAttribute('href')) : normalizeLinkHref(c.linkUrl)
      if (action === 'link-open' && url) {
        void openMarkdownLink(url)
      }
      else if (action === 'link-edit') {
        if (c.linkEl) {
          $('link-text').value = c.linkEl.textContent || ''
          $('link-url').value = url || ''
        } else {
          $('link-text').value = c.linkText || ''
          $('link-url').value = url || ''
        }
        showLinkDialog()
      }
      else if (action === 'link-unlink') {
        if (c.linkEl) {
          const t = c.linkEl.textContent
          const tx = document.createTextNode(t)
          c.linkEl.replaceWith(tx)
          recordRichHistory()
          setModified(true)
          scheduleRender()
        } else if (c.mode === 'md') {
          wrapMd('', '')
        }
      }
    }
    else if (c.kind === 'codeblock') {
      if (action === 'code-copy') {
        const text = c.preEl ? c.preEl.textContent : ''
        void navigator.clipboard.writeText(text)
      }
      else if (action === 'code-delete') {
        if (c.preEl) {
          c.preEl.remove()
          recordRichHistory()
          setModified(true)
          scheduleRender()
        }
      }
    }
  }

  async function runTreeAction (action, c) {
    const parent = c.isDir ? c.relPath : (c.relPath.includes('/') ? c.relPath.replace(/[/\\][^/\\]+$/, '') : '')
    if (action === 'ws-pick') {
      const r = await window.mobiAPI.workspacePickRoot()
      if (!r.cancelled) {
        cfg.workspaceRoot = r.root
        await syncWorkspaceHint()
        await refreshWorkspaceTree()
      }
      return
    }
    if (action === 'ws-refresh') {
      await refreshWorkspaceTree()
      return
    }
    if (action === 'tree-open' && c.relPath) {
      await openWorkspaceRelFile(c.relPath)
      return
    }
    if (action === 'tree-new-file') {
      treeContextDir = c.isDir ? c.relPath : parent
      const name = await openPromptDialog({ title: tt('prompt.newNote'), label: tt('prompt.name'), defaultValue: tt('prompt.untitled'), placeholder: '可省略 .md' })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceCreateFile(treeContextDir, String(name).trim())
      if (r.error) { alert(r.error === 'exists' ? errText('exists-file') : errText(r.error)); return }
      if (treeContextDir) treeExpanded.add(treeContextDir)
      await refreshWorkspaceTree()
      await openWorkspaceRelFile(r.relPath)
      return
    }
    if (action === 'tree-new-folder') {
      treeContextDir = c.isDir ? c.relPath : parent
      const name = await openPromptDialog({ title: tt('prompt.newFolder'), label: tt('prompt.name'), defaultValue: tt('prompt.folder') })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceMkdir(treeContextDir, String(name).trim())
      if (r.error) { alert(r.error === 'exists' ? errText('exists-folder') : errText(r.error)); return }
      if (treeContextDir) treeExpanded.add(treeContextDir)
      if (r.relPath) treeExpanded.add(r.relPath)
      await refreshWorkspaceTree()
      return
    }
    if (action === 'tree-rename' && c.relPath) {
      const name = await openPromptDialog({ title: tt('prompt.rename'), label: tt('prompt.newName'), defaultValue: c.name })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceRename(c.relPath, String(name).trim())
      if (r.error) { alert(errText(r.error)); return }
      const active = getCurrentWorkspaceRel()
      if (active === c.relPath && r.filePath) {
        currentFile = r.filePath
        setTitle(bn(r.filePath) + (readOnlyDoc ? ' · 只读' : ''))
      }
      await refreshWorkspaceTree()
      return
    }
    if (action === 'tree-delete' && c.relPath) {
      const active = getCurrentWorkspaceRel()
      if (active === c.relPath) {
        const resp = await window.mobiAPI.newFile({ hasChanges: isModified })
        if (resp.action === 'cancel') return
        if (resp.action === 'save') await saveFile()
      }
      const msg = c.isDir ? `确定删除文件夹「${c.name}」及其全部内容？` : `确定删除「${c.name}」？`
      if (!confirm(msg)) return
      const r = await window.mobiAPI.workspaceDelete(c.relPath, c.isDir)
      if (r.error) { alert(errText(r.error)); return }
      await refreshWorkspaceTree()
      return
    }
    if (action === 'tree-reveal' && c.relPath) {
      const abs = await workspaceAbsFromRel(c.relPath)
      if (abs) window.mobiAPI.showInFolder(abs)
      return
    }
    if (action === 'tree-copy-path' && c.relPath) {
      const abs = await workspaceAbsFromRel(c.relPath)
      if (abs) void navigator.clipboard.writeText(abs)
    }
  }

  async function onContextMenu (e, zone) {
    e.preventDefault()
    e.stopPropagation()
    hideMenus()
    let items
    if (zone === 'tree') {
      ctxState = detectTreeContext(e)
      items = await buildTreeItems(ctxState)
    } else {
      ctxState = detectEditorContext(e)
      items = buildEditorItems(ctxState)
    }
    if (!items.length) return
    renderMenu(menu, items, e.clientX, e.clientY)
  }

  richEditor.addEventListener('contextmenu', e => {
    if (editMode === 'preview') return
    if (editMode === 'wysiwyg' || editMode === 'split') onContextMenu(e, 'editor')
  })
  mdEditor.addEventListener('contextmenu', e => {
    if (editMode === 'markdown' || editMode === 'split') onContextMenu(e, 'editor')
  })
  previewEl.addEventListener('contextmenu', e => {
    if (editMode === 'preview') onContextMenu(e, 'editor')
  })
  const fileTree = $('file-tree')
  if (fileTree) fileTree.addEventListener('contextmenu', e => onContextMenu(e, 'tree'))
  const wsHint = $('workspace-path-hint')
  if (wsHint) wsHint.addEventListener('contextmenu', e => onContextMenu(e, 'tree'))

  document.addEventListener('click', hideMenus)
  document.addEventListener('contextmenu', () => { if (menu.style.display !== 'none') hideMenus() }, true)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideMenus()
  })
  window.addEventListener('scroll', hideMenus, true)
  window.addEventListener('resize', hideMenus)
}
