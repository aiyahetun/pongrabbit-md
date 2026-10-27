/**
 * Flowchart 布局注释：%% prabbit:layout v1 {...} %%
 * Mermaid 忽略该行；用于画布拖拽偏移持久化。
 */
;(function (root, factory) {
  const api = factory()
  root.pongrabbitFlowchartLayout = api
  if (typeof module === 'object' && module.exports) module.exports = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const LAYOUT_LINE_RE = /^\s*%%\s*prabbit:layout\s+v1\s+(.+?)\s*%%\s*$/m

  function parseLayout (source) {
    const m = String(source || '').match(LAYOUT_LINE_RE)
    if (!m) return { nodes: {} }
    try {
      const o = JSON.parse(m[1])
      return o && typeof o === 'object' && o.nodes ? o : { nodes: o || {} }
    } catch (_) {
      return { nodes: {} }
    }
  }

  function stripLayoutLine (source) {
    return String(source || '').replace(LAYOUT_LINE_RE, '').replace(/^\n+/, '')
  }

  function injectLayoutLine (source, layout) {
    const body = stripLayoutLine(source).replace(/\n$/, '')
    const line = '%% prabbit:layout v1 ' + JSON.stringify({ nodes: layout.nodes || layout }) + ' %%'
    const lines = body.split('\n')
    if (!lines.length) return line + '\n'
    const head = lines[0]
    if (/^\s*(flowchart|graph)\b/i.test(head)) {
      return head + '\n' + line + '\n' + lines.slice(1).join('\n') + '\n'
    }
    return line + '\n' + body + '\n'
  }

  function applyLayoutToSvg (svgRoot, layout) {
    if (!svgRoot || !layout || !layout.nodes) return
    const nodes = layout.nodes
    for (const [id, off] of Object.entries(nodes)) {
      if (!off || typeof off !== 'object') continue
      const el = svgRoot.querySelector('#' + CSS.escape(id)) ||
        svgRoot.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]')
      if (!el) continue
      const dx = Number(off.dx) || 0
      const dy = Number(off.dy) || 0
      if (!dx && !dy) continue
      const prev = el.getAttribute('transform') || ''
      el.setAttribute('transform', `translate(${dx},${dy}) ${prev}`.trim())
    }
  }

  function collectLayoutFromSvg (svgRoot, baseLayout) {
    const nodes = Object.assign({}, (baseLayout && baseLayout.nodes) || {})
    if (!svgRoot) return { nodes }
    svgRoot.querySelectorAll('g.node[id]').forEach(g => {
      const id = g.getAttribute('id')
      if (!id) return
      const tr = g.getAttribute('transform') || ''
      const m = tr.match(/translate\(\s*([-\d.]+)\s*[, ]\s*([-\d.]+)\s*\)/)
      const dx = m ? parseFloat(m[1]) : 0
      const dy = m ? parseFloat(m[2]) : 0
      if (dx || dy) nodes[id] = { dx, dy }
      else delete nodes[id]
    })
    return { nodes }
  }

  return {
    parseLayout,
    stripLayoutLine,
    injectLayoutLine,
    applyLayoutToSvg,
    collectLayoutFromSvg
  }
})
