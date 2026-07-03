'use strict'
/* 编辑区 + 工作区文件树右键菜单（依赖 app.js 全局函数与状态） */

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
        { id: 'undo', label: '撤销', shortcut: 'Ctrl+Z' },
        { id: 'redo', label: '重做', shortcut: 'Ctrl+Y' },
        { sep: true },
        { id: 'cut', label: '剪切', shortcut: 'Ctrl+X' },
        { id: 'copy', label: '复制', shortcut: 'Ctrl+C' },
        { id: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
        { id: 'selectAll', label: '全选', shortcut: 'Ctrl+A' },
        { sep: true },
        { id: 'find', label: '查找…', shortcut: 'Ctrl+F' }
      )
    } else {
      items.push(
        { id: 'copy', label: '复制', shortcut: 'Ctrl+C' },
        { id: 'selectAll', label: '全选', shortcut: 'Ctrl+A' }
      )
    }

    if (c.kind === 'table' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'tbl-row-above', label: '在上方插入行' },
        { id: 'tbl-row-below', label: '在下方插入行' },
        { id: 'tbl-col-left', label: '在左侧插入列' },
        { id: 'tbl-col-right', label: '在右侧插入列' },
        { sep: true },
        { id: 'tbl-del-row', label: '删除当前行' },
        { id: 'tbl-del-col', label: '删除当前列' },
        { id: 'tbl-del-table', label: '删除表格' }
      )
    }

    if (c.kind === 'selection' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'bold', label: '加粗', shortcut: 'Ctrl+B' },
        { id: 'italic', label: '斜体', shortcut: 'Ctrl+I' },
        { id: 'strike', label: '删除线' },
        { id: 'link', label: '插入链接…' }
      )
    }

    if (c.kind === 'image' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'img-replace', label: '替换图片…' },
        { id: 'img-copy-path', label: '复制图片路径' },
        { id: 'img-reveal', label: '在文件夹中显示' },
        { id: 'img-delete', label: '删除图片' }
      )
    }

    if (c.kind === 'link' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'link-open', label: '打开链接' },
        { id: 'link-edit', label: '编辑链接…' },
        { id: 'link-unlink', label: '移除链接' }
      )
    }

    if (c.kind === 'codeblock' && !ro && !prev) {
      items.push({ sep: true })
      items.push(
        { id: 'code-copy', label: '复制代码' },
        { id: 'code-delete', label: '删除代码块' }
      )
    }

    if (c.kind === 'empty' && !ro && !prev) {
      items.push({
        id: 'insert-sub',
        label: '插入',
        children: [
          { id: 'ins-table', label: '表格…' },
          { id: 'ins-image', label: '图片…' },
          { id: 'ins-link', label: '链接…' },
          { id: 'ins-hr', label: '分割线' },
          { id: 'ins-code', label: '代码块' }
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
      items.push({ id: 'ws-pick', label: '选择工作区…' })
      return items
    }
    if (c.empty) {
      items.push(
        { id: 'ws-refresh', label: '刷新' },
        { sep: true },
        { id: 'tree-new-file', label: '新建笔记…' },
        { id: 'tree-new-folder', label: '新建文件夹…' },
        { sep: true },
        { id: 'ws-pick', label: '更换工作区…' }
      )
      return items
    }
    if (!c.isDir) {
      items.push({ id: 'tree-open', label: '打开' })
      items.push({ sep: true })
    }
    if (c.isDir) {
      items.push({ id: 'tree-new-file', label: '新建笔记…' })
      items.push({ id: 'tree-new-folder', label: '新建文件夹…' })
      items.push({ sep: true })
    }
    items.push(
      { id: 'tree-rename', label: '重命名…' },
      { id: 'tree-delete', label: '删除' },
      { id: 'tree-reveal', label: '在文件夹中显示' },
      { id: 'tree-copy-path', label: '复制路径' }
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
      const url = c.linkEl ? c.linkEl.getAttribute('href') : c.linkUrl
      if (action === 'link-open' && url) {
        try { window.open(url, '_blank', 'noopener') } catch (_) {}
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
      const name = await openPromptDialog({ title: '新笔记', label: '名称', defaultValue: '未命名.md', placeholder: '可省略 .md' })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceCreateFile(treeContextDir, String(name).trim())
      if (r.error) { alert(r.error === 'exists' ? '已存在同名文件' : String(r.error)); return }
      if (treeContextDir) treeExpanded.add(treeContextDir)
      await refreshWorkspaceTree()
      await openWorkspaceRelFile(r.relPath)
      return
    }
    if (action === 'tree-new-folder') {
      treeContextDir = c.isDir ? c.relPath : parent
      const name = await openPromptDialog({ title: '新文件夹', label: '名称', defaultValue: '新建文件夹' })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceMkdir(treeContextDir, String(name).trim())
      if (r.error) { alert(r.error === 'exists' ? '已存在同名文件夹' : String(r.error)); return }
      if (treeContextDir) treeExpanded.add(treeContextDir)
      if (r.relPath) treeExpanded.add(r.relPath)
      await refreshWorkspaceTree()
      return
    }
    if (action === 'tree-rename' && c.relPath) {
      const name = await openPromptDialog({ title: '重命名', label: '新名称', defaultValue: c.name })
      if (name == null || !String(name).trim()) return
      const r = await window.mobiAPI.workspaceRename(c.relPath, String(name).trim())
      if (r.error) { alert(String(r.error)); return }
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
      if (r.error) { alert(String(r.error)); return }
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
