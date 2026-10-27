/**
 * 流程图编辑：实验画布（C1）+ mermaid.live 降级（C2）。
 */
;(function (root, factory) {
  root.pongrabbitFlowchartEditor = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  const L = () => root.pongrabbitFlowchartLayout

  function tt (key) {
    if (root.i18nAPI && root.i18nAPI.t) {
      const v = root.i18nAPI.t(key)
      return v === key ? key : v
    }
    return key
  }

  function isFlowchartSource (source) {
    const head = String(source || '').trim().split(/\s/)[0].toLowerCase()
    return head === 'flowchart' || head === 'graph' || head === 'flowchart-v2' || head === 'flowchart-elk'
  }

  function openFlowchartCanvas (source, viewEl, onApply) {
    const layoutMod = L()
    if (!layoutMod || !viewEl) return Promise.resolve('cancel')
    const svg = viewEl.querySelector('svg')
    if (!svg) return Promise.resolve('cancel')

    return new Promise(resolve => {
      const doc = root.document
      const overlay = doc.createElement('div')
      overlay.className = 'flowchart-canvas-overlay'
      const panel = doc.createElement('div')
      panel.className = 'flowchart-canvas-panel'
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-modal', 'true')

      const title = doc.createElement('div')
      title.className = 'flowchart-canvas-title'
      title.textContent = tt('diagram.openCanvas')

      const host = doc.createElement('div')
      host.className = 'flowchart-canvas-host'
      const clone = svg.cloneNode(true)
      host.appendChild(clone)
      const baseLayout = layoutMod.parseLayout(source)
      layoutMod.applyLayoutToSvg(clone, baseLayout)

      const bar = doc.createElement('div')
      bar.className = 'flowchart-canvas-actions'
      const btnSave = doc.createElement('button')
      btnSave.type = 'button'
      btnSave.className = 'action-btn'
      btnSave.textContent = tt('diagram.canvasSave')
      const btnCancel = doc.createElement('button')
      btnCancel.type = 'button'
      btnCancel.className = 'action-btn'
      btnCancel.textContent = tt('diagram.canvasClose')

      bar.appendChild(btnSave)
      bar.appendChild(btnCancel)
      panel.appendChild(title)
      panel.appendChild(host)
      panel.appendChild(bar)
      overlay.appendChild(panel)
      doc.body.appendChild(overlay)

      let drag = null
      function onPointerDown (e) {
        const g = e.target.closest && e.target.closest('g.node')
        if (!g || !host.contains(g)) return
        e.preventDefault()
        drag = { el: g, x: e.clientX, y: e.clientY }
        g.setPointerCapture(e.pointerId)
      }
      function onPointerMove (e) {
        if (!drag) return
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        drag.x = e.clientX
        drag.y = e.clientY
        const tr = drag.el.getAttribute('transform') || ''
        const m = tr.match(/translate\(\s*([-\d.]+)\s*[, ]\s*([-\d.]+)\s*\)/)
        let ox = m ? parseFloat(m[1]) : 0
        let oy = m ? parseFloat(m[2]) : 0
        ox += dx
        oy += dy
        const rest = tr.replace(/translate\([^)]*\)/, '').trim()
        drag.el.setAttribute('transform', `translate(${ox},${oy}) ${rest}`.trim())
      }
      function onPointerUp (e) {
        if (!drag) return
        try { drag.el.releasePointerCapture(e.pointerId) } catch (_) {}
        drag = null
      }

      host.addEventListener('pointerdown', onPointerDown)
      host.addEventListener('pointermove', onPointerMove)
      host.addEventListener('pointerup', onPointerUp)
      host.addEventListener('pointercancel', onPointerUp)

      function close (result) {
        host.removeEventListener('pointerdown', onPointerDown)
        host.removeEventListener('pointermove', onPointerMove)
        host.removeEventListener('pointerup', onPointerUp)
        overlay.remove()
        resolve(result)
      }

      btnCancel.onclick = () => close('cancel')
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close('cancel')
      })
      btnSave.onclick = () => {
        const nextLayout = layoutMod.collectLayoutFromSvg(clone, { nodes: {} })
        const stripped = layoutMod.stripLayoutLine(source)
        const nextSrc = layoutMod.injectLayoutLine(stripped, nextLayout)
        if (onApply) onApply(nextSrc)
        close('canvas')
      }
    })
  }

  /**
   * @returns {Promise<'live'|'canvas'|'cancel'|'noop'>}
   */
  async function openFlowchartEditor (source, opts) {
    const prefs = root.pongrabbitDiagramPrefs ? root.pongrabbitDiagramPrefs() : {}
    if (!isFlowchartSource(source)) return 'noop'
    if (prefs.flowchartWysiwyg && opts && opts.viewEl) {
      const r = await openFlowchartCanvas(source, opts.viewEl, opts.onApply)
      return r === 'canvas' ? 'canvas' : 'cancel'
    }
    if (!prefs.flowchartWysiwyg) return 'noop'
    if (!prefs.openInLive) return 'noop'
    const live = root.pongrabbitMermaidLive
    if (!live || !live.openInMermaidLive) return 'noop'
    const r = await live.openInMermaidLive(source)
    return r && r.ok ? 'live' : 'cancel'
  }

  return {
    isFlowchartSource,
    openFlowchartEditor,
    openFlowchartCanvas
  }
})
