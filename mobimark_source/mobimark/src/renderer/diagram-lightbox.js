/**
 * 图表放大查看：缩放 + 拖拽平移（复杂 Mermaid 图阅读）
 */
;(function (root, factory) {
  root.pongrabbitDiagramLightbox = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  function tt (key) {
    if (root.i18nAPI && root.i18nAPI.t) {
      const v = root.i18nAPI.t(key)
      return v === key ? key : v
    }
    return key
  }

  /**
   * @param {HTMLElement} fromEl 含 svg 的 .mermaid / .diagram-view
   * @param {{ title?: string }} opts
   */
  function open (fromEl, opts) {
    if (!fromEl) return
    const srcSvg = fromEl.querySelector('svg')
    if (!srcSvg) return

    const doc = root.document
    const overlay = doc.createElement('div')
    overlay.className = 'diagram-lightbox-overlay'

    const panel = doc.createElement('div')
    panel.className = 'diagram-lightbox-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')

    const titleEl = doc.createElement('div')
    titleEl.className = 'diagram-lightbox-title'
    titleEl.textContent = (opts && opts.title) || tt('diagram.expandView')

    const host = doc.createElement('div')
    host.className = 'diagram-lightbox-host'

    const stage = doc.createElement('div')
    stage.className = 'diagram-lightbox-stage'
    const clone = srcSvg.cloneNode(true)
    clone.removeAttribute('id')
    stage.appendChild(clone)
    host.appendChild(stage)

    const bar = doc.createElement('div')
    bar.className = 'diagram-lightbox-actions'

    const btnOut = doc.createElement('button')
    btnOut.type = 'button'
    btnOut.className = 'action-btn'
    btnOut.textContent = tt('diagram.zoomOut')
    const btnIn = doc.createElement('button')
    btnIn.type = 'button'
    btnIn.className = 'action-btn'
    btnIn.textContent = tt('diagram.zoomIn')
    const btnFit = doc.createElement('button')
    btnFit.type = 'button'
    btnFit.className = 'action-btn'
    btnFit.textContent = tt('diagram.zoomFit')
    const btnReset = doc.createElement('button')
    btnReset.type = 'button'
    btnReset.className = 'action-btn'
    btnReset.textContent = tt('diagram.zoomReset')
    const btnClose = doc.createElement('button')
    btnClose.type = 'button'
    btnClose.className = 'action-btn'
    btnClose.textContent = tt('diagram.lightboxClose')

    bar.appendChild(btnOut)
    bar.appendChild(btnIn)
    bar.appendChild(btnFit)
    bar.appendChild(btnReset)
    bar.appendChild(btnClose)

    panel.appendChild(titleEl)
    panel.appendChild(host)
    panel.appendChild(bar)
    overlay.appendChild(panel)
    doc.body.appendChild(overlay)

    let scale = 1
    let panX = 0
    let panY = 0
    let drag = null

    function applyTransform () {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
    }

    function fitToHost () {
      const box = clone.getBBox()
      if (!box.width || !box.height) return
      const pad = 32
      const w = host.clientWidth - pad
      const h = host.clientHeight - pad
      scale = Math.min(w / box.width, h / box.height, 2.5)
      scale = Math.max(0.25, scale)
      panX = (host.clientWidth - box.width * scale) / 2 - box.x * scale
      panY = (host.clientHeight - box.height * scale) / 2 - box.y * scale
      applyTransform()
    }

    function zoomAt (factor, cx, cy) {
      const prev = scale
      scale = Math.min(4, Math.max(0.2, scale * factor))
      if (cx != null && cy != null) {
        panX = cx - (cx - panX) * (scale / prev)
        panY = cy - (cy - panY) * (scale / prev)
      }
      applyTransform()
    }

    host.addEventListener('wheel', e => {
      e.preventDefault()
      const rect = host.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, cx, cy)
    }, { passive: false })

    host.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY, px: panX, py: panY }
      host.setPointerCapture(e.pointerId)
      host.classList.add('is-panning')
    })
    host.addEventListener('pointermove', e => {
      if (!drag) return
      panX = drag.px + (e.clientX - drag.x)
      panY = drag.py + (e.clientY - drag.y)
      applyTransform()
    })
    host.addEventListener('pointerup', e => {
      if (!drag) return
      drag = null
      host.classList.remove('is-panning')
      try { host.releasePointerCapture(e.pointerId) } catch (_) {}
    })

    btnIn.onclick = () => zoomAt(1.2, host.clientWidth / 2, host.clientHeight / 2)
    btnOut.onclick = () => zoomAt(1 / 1.2, host.clientWidth / 2, host.clientHeight / 2)
    btnFit.onclick = () => fitToHost()
    btnReset.onclick = () => {
      scale = 1
      panX = 0
      panY = 0
      applyTransform()
    }

    function close () {
      overlay.remove()
    }
    btnClose.onclick = close
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close()
    })
    root.addEventListener('keydown', function onKey (e) {
      if (e.key === 'Escape') {
        close()
        root.removeEventListener('keydown', onKey)
      }
    })

    requestAnimationFrame(() => fitToHost())
  }

  return { open }
})
