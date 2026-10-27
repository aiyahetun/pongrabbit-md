/**
 * 预览 HTML → 可离线打开的导出片段（内联 Mermaid SVG，去掉编辑器专用 UI）。
 */
;(function (root, factory) {
  root.pongrabbitExportPreview = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  function snapshotMermaidElement (el) {
    const svg = el.querySelector('svg')
    const figure = (el.ownerDocument || root.document).createElement('figure')
    figure.className = 'mermaid-inline-export'
    if (svg) {
      const clone = svg.cloneNode(true)
      clone.removeAttribute('id')
      figure.appendChild(clone)
    } else {
      const pre = (el.ownerDocument || root.document).createElement('pre')
      pre.className = 'mermaid-export-fallback'
      pre.textContent = (el.textContent || '').trim()
      figure.appendChild(pre)
    }
    return figure
  }

  /**
   * @param {HTMLElement} rootEl 克隆后的容器（可安全改写）
   */
  function inlineMermaidSvgs (rootEl) {
    if (!rootEl) return
    rootEl.querySelectorAll('.diagram-block').forEach(block => {
      const view = block.querySelector('.diagram-view, .mermaid')
      if (view) block.replaceWith(snapshotMermaidElement(view))
      else block.remove()
    })
    rootEl.querySelectorAll('.mermaid').forEach(el => {
      el.replaceWith(snapshotMermaidElement(el))
    })
    rootEl.querySelectorAll('.diagram-block-toolbar, .diagram-source').forEach(n => n.remove())
  }

  function buildExportBodyHtml (previewRoot) {
    const doc = previewRoot.ownerDocument || root.document
    const wrap = doc.createElement('div')
    wrap.innerHTML = previewRoot.innerHTML
    inlineMermaidSvgs(wrap)
    return wrap.innerHTML
  }

  /**
   * @param {HTMLElement} previewRoot
   * @param {{ mdFilePath?: string, imageDataUrl?: (mdPath: string, src: string) => Promise<{ dataUrl?: string, external?: string, error?: string } | null> }} opts
   */
  async function buildExportBodyHtmlAsync (previewRoot, opts) {
    const doc = previewRoot.ownerDocument || root.document
    const wrap = doc.createElement('div')
    wrap.innerHTML = previewRoot.innerHTML
    inlineMermaidSvgs(wrap)
    const mdPath = opts && opts.mdFilePath ? opts.mdFilePath : ''
    const resolver = opts && opts.imageDataUrl
    if (resolver) {
      for (const img of wrap.querySelectorAll('img')) {
        const cur = img.getAttribute('src') || ''
        if (cur.startsWith('data:')) continue
        const mdSrc = (img.getAttribute('data-md-src') || cur).trim()
        if (!mdSrc || /^https?:\/\//i.test(mdSrc)) continue
        try {
          const r = await resolver(mdPath, mdSrc)
          if (r && r.dataUrl) img.setAttribute('src', r.dataUrl)
        } catch (_) {}
      }
    }
    return wrap.innerHTML
  }

  const EXPORT_HEAD_STYLE =
    '<style>' +
    '.mermaid-inline-export{margin:16px 0;text-align:center}' +
    '.mermaid-inline-export svg{max-width:100%;height:auto;display:inline-block}' +
    '.mermaid-export-fallback{font-size:13px;opacity:.85;white-space:pre-wrap}' +
    'img{max-width:100%;height:auto}' +
    '</style>'

  return {
    inlineMermaidSvgs,
    buildExportBodyHtml,
    buildExportBodyHtmlAsync,
    EXPORT_HEAD_STYLE
  }
})
