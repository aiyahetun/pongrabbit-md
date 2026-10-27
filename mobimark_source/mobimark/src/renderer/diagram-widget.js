/**
 * 可视化模式 Mermaid 图块（阶段 B 最小实现）。
 */
;(function (root, factory) {
  root.pongrabbitDiagramWidget = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  function tt (key) {
    if (root.i18nAPI && root.i18nAPI.t) {
      const v = root.i18nAPI.t(key)
      return v === key ? key : v
    }
    return key
  }

  function defaultMermaidSource () {
    return 'flowchart LR\n  A[开始] --> B[结束]'
  }

  function diagramPrefs () {
    if (root.pongrabbitDiagramPrefs) return root.pongrabbitDiagramPrefs()
    return { openInLive: false, flowchartWysiwyg: false }
  }

  function getBlockSource (block) {
    const ta = block.querySelector('.diagram-source')
    return (ta ? ta.value : (block.querySelector('.diagram-view')?.textContent || '')).replace(/\n$/, '')
  }

  async function copyDiagramSource (block) {
    const src = getBlockSource(block)
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        await root.navigator.clipboard.writeText(src)
        return true
      }
    } catch (e) {
      console.warn('clipboard failed', e)
    }
    return false
  }

  function syncDiagramToolbar (block) {
    const bar = block.querySelector('.diagram-block-toolbar')
    if (!bar) return
    const prefs = diagramPrefs()
    const btnLive = bar.querySelector('[data-action="live"]')
    if (btnLive) btnLive.hidden = !prefs.openInLive
    const btnCanvas = bar.querySelector('[data-action="canvas"]')
    if (btnCanvas) {
      const FC = root.pongrabbitFlowchartEditor
      const show = prefs.flowchartWysiwyg && FC && FC.isFlowchartSource(getBlockSource(block))
      btnCanvas.hidden = !show
    }
  }

  function getSourceFromPre (pre) {
    const code = pre.querySelector('code')
    return (code ? code.textContent : pre.textContent || '').replace(/\n$/, '')
  }

  function buildDiagramBlock (source) {
    const doc = root.document
    const block = doc.createElement('div')
    block.className = 'diagram-block'
    block.contentEditable = 'false'
    block.dataset.fence = 'mermaid'

    const bar = doc.createElement('div')
    bar.className = 'diagram-block-toolbar'

    const btnExpand = doc.createElement('button')
    btnExpand.type = 'button'
    btnExpand.className = 'diagram-btn'
    btnExpand.dataset.action = 'expand'
    btnExpand.textContent = tt('diagram.expandView')

    const btnEdit = doc.createElement('button')
    btnEdit.type = 'button'
    btnEdit.className = 'diagram-btn'
    btnEdit.dataset.action = 'edit'
    btnEdit.textContent = tt('diagram.editSource')

    const btnRefresh = doc.createElement('button')
    btnRefresh.type = 'button'
    btnRefresh.className = 'diagram-btn'
    btnRefresh.dataset.action = 'refresh'
    btnRefresh.textContent = tt('diagram.refresh')

    const btnCopy = doc.createElement('button')
    btnCopy.type = 'button'
    btnCopy.className = 'diagram-btn'
    btnCopy.dataset.action = 'copy'
    btnCopy.textContent = tt('diagram.copySource')

    const btnLive = doc.createElement('button')
    btnLive.type = 'button'
    btnLive.className = 'diagram-btn'
    btnLive.dataset.action = 'live'
    btnLive.textContent = tt('diagram.openLive')

    const btnCanvas = doc.createElement('button')
    btnCanvas.type = 'button'
    btnCanvas.className = 'diagram-btn'
    btnCanvas.dataset.action = 'canvas'
    btnCanvas.textContent = tt('diagram.openCanvas')
    btnCanvas.hidden = true

    bar.appendChild(btnExpand)
    bar.appendChild(btnEdit)
    bar.appendChild(btnCanvas)
    bar.appendChild(btnRefresh)
    bar.appendChild(btnCopy)
    bar.appendChild(btnLive)

    const ta = doc.createElement('textarea')
    ta.className = 'diagram-source'
    ta.setAttribute('aria-hidden', 'true')
    ta.style.display = 'none'
    ta.value = source

    const view = doc.createElement('div')
    view.className = 'mermaid diagram-view'
    view.textContent = source

    block.appendChild(bar)
    block.appendChild(ta)
    block.appendChild(view)

    wireDiagramBlock(block)
    syncDiagramToolbar(block)
    return block
  }

  function applyDiagramSource (block, source) {
    const text = String(source || '').replace(/\n$/, '')
    const ta = block.querySelector('.diagram-source')
    const view = block.querySelector('.diagram-view')
    if (ta) ta.value = text
    if (view) {
      view.textContent = text
      view.innerHTML = ''
      view.textContent = text
    }
  }

  function openExpandForBlock (block) {
    const view = block.querySelector('.diagram-view')
    const LB = root.pongrabbitDiagramLightbox
    if (!view || !LB || !LB.open) return
    LB.open(view, { title: tt('diagram.expandView') })
  }

  async function refreshDiagramBlock (block) {
    const view = block.querySelector('.diagram-view')
    if (!view || !root.pongrabbitMermaidRuntime) return
    await root.pongrabbitMermaidRuntime.renderMermaidIn(block)
  }

  async function openCanvasForBlock (block) {
    const cur = getBlockSource(block)
    const view = block.querySelector('.diagram-view')
    const FC = root.pongrabbitFlowchartEditor
    if (!FC || !FC.openFlowchartEditor || !view) return false
    const mode = await FC.openFlowchartEditor(cur, {
      viewEl: view,
      onApply: nextSrc => {
        applyDiagramSource(block, nextSrc)
        void refreshDiagramBlock(block)
      }
    })
    return mode === 'canvas'
  }

  async function editDiagramBlock (block) {
    const cur = getBlockSource(block)
    const prefs = diagramPrefs()
    const FC = root.pongrabbitFlowchartEditor
    if (prefs.flowchartWysiwyg && FC && FC.isFlowchartSource(cur)) {
      if (await openCanvasForBlock(block)) return true
    }
    if (FC && FC.openFlowchartEditor) {
      const mode = await FC.openFlowchartEditor(cur)
      if (mode === 'live') return false
    }
    const next = root.prompt(tt('diagram.editSource'), cur)
    if (next == null) return false
    applyDiagramSource(block, next)
    void refreshDiagramBlock(block)
    return true
  }

  function wireDiagramBlock (block) {
    const bar = block.querySelector('.diagram-block-toolbar')
    if (!bar || bar.dataset.wired === '1') return
    bar.dataset.wired = '1'
    bar.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      e.preventDefault()
      e.stopPropagation()
      const action = btn.getAttribute('data-action')
      if (action === 'expand') {
        openExpandForBlock(block)
      } else if (action === 'edit') {
        void editDiagramBlock(block).then(changed => {
          if (changed) {
            root.dispatchEvent(new CustomEvent('pongrabbit-diagram-changed', { bubbles: true }))
          }
        })
      } else if (action === 'refresh') {
        void refreshDiagramBlock(block)
      } else if (action === 'copy') {
        void copyDiagramSource(block)
      } else if (action === 'canvas') {
        void openCanvasForBlock(block).then(changed => {
          if (changed) {
            root.dispatchEvent(new CustomEvent('pongrabbit-diagram-changed', { bubbles: true }))
          }
        })
      } else if (action === 'live') {
        const prefs = diagramPrefs()
        if (!prefs.openInLive) return
        const live = root.pongrabbitMermaidLive
        if (live && live.openInMermaidLive) {
          void live.openInMermaidLive(getBlockSource(block))
        }
      }
    })
    block.addEventListener('dblclick', e => {
      if (e.target.closest('.diagram-block-toolbar')) return
      e.preventDefault()
      openExpandForBlock(block)
    })
  }

  function upgradePreToDiagramBlock (pre) {
    const code = pre.querySelector('code')
    const lang = code
      ? (code.className.match(/language-([\w-]+)/i) || [])[1] || ''
      : ''
    if (lang.toLowerCase() !== 'mermaid') return
    const block = buildDiagramBlock(getSourceFromPre(pre))
    pre.replaceWith(block)
  }

  function upgradeMermaidInRichEditor (container) {
    if (!container) return
    for (const pre of Array.from(container.querySelectorAll('pre'))) {
      upgradePreToDiagramBlock(pre)
    }
    container.querySelectorAll('.diagram-block').forEach(block => {
      wireDiagramBlock(block)
      syncDiagramToolbar(block)
    })
  }

  function refreshAllDiagramToolbars (container) {
    const rootEl = container || root.document
    if (!rootEl || !rootEl.querySelectorAll) return
    rootEl.querySelectorAll('.diagram-block').forEach(syncDiagramToolbar)
  }

  function diagramBlockToMd (block) {
    const ta = block.querySelector('.diagram-source')
    const src = ta
      ? ta.value
      : (block.querySelector('.diagram-view')?.textContent || '').replace(/\n$/, '')
    return '```mermaid\n' + src.replace(/\n$/, '') + '\n```'
  }

  return {
    defaultMermaidSource,
    buildDiagramBlock,
    upgradeMermaidInRichEditor,
    upgradePreToDiagramBlock,
    diagramBlockToMd,
    refreshDiagramBlock,
    editDiagramBlock,
    refreshAllDiagramToolbars,
    openCanvasForBlock,
    openExpandForBlock,
    copyDiagramSource
  }
})
