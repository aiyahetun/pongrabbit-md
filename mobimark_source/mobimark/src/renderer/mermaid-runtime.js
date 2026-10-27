/**
 * Mermaid 渲染与主题（依赖 window.mermaid IIFE bundle）。
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root)
  } else {
    root.pongrabbitMermaidRuntime = factory(root)
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  let _initialized = false

  /** esbuild IIFE 可能暴露为 { default: api }，统一取可调用 API */
  function getMermaidApi () {
    const raw = root.mermaid
    if (!raw) return null
    if (typeof raw.initialize === 'function' && typeof raw.run === 'function') return raw
    if (raw.default && typeof raw.default.initialize === 'function') return raw.default
    return null
  }

  function getMermaidTheme () {
    const body = root.document && root.document.body
    if (!body) return 'default'
    if (body.classList.contains('theme-dark') || body.classList.contains('theme-glass')) return 'dark'
    return 'default'
  }

  function ensureMermaidInit () {
    const api = getMermaidApi()
    if (_initialized || !api) return
    api.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: getMermaidTheme()
    })
    _initialized = true
  }

  function reinitThemeIfNeeded () {
    const api = getMermaidApi()
    if (!api || !_initialized) return
    const theme = getMermaidTheme()
    try {
      api.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme
      })
    } catch (_) {}
  }

  /**
   * @param {ParentNode} container
   */
  async function renderMermaidIn (container) {
    const mermaidApi = getMermaidApi()
    if (!container || !mermaidApi) {
      root.__pongrabbitMermaidReady = Promise.resolve()
      return root.__pongrabbitMermaidReady
    }
    ensureMermaidInit()
    reinitThemeIfNeeded()

    function applyFlowchartLayoutsIn (scope) {
      const layoutMod = root.pongrabbitFlowchartLayout
      if (!layoutMod || !scope) return
      scope.querySelectorAll('.mermaid, .diagram-view').forEach(node => {
        const svg = node.querySelector('svg')
        if (!svg) return
        const block = node.closest('.diagram-block')
        const src =
          (block && block.querySelector('.diagram-source') && block.querySelector('.diagram-source').value) ||
          node.getAttribute('data-source') ||
          node.textContent ||
          ''
        layoutMod.applyLayoutToSvg(svg, layoutMod.parseLayout(src))
      })
    }

    const nodes = [...container.querySelectorAll('.mermaid')].filter(n => !n.querySelector('svg'))
    if (!nodes.length) {
      applyFlowchartLayoutsIn(container)
      root.__pongrabbitMermaidReady = Promise.resolve()
      return root.__pongrabbitMermaidReady
    }

    const run = async () => {
      try {
        await mermaidApi.run({ nodes, suppressErrors: true })
        applyFlowchartLayoutsIn(container)
      } catch (err) {
        for (const node of nodes) {
          if (node.querySelector('svg')) continue
          const msg = err && err.message ? String(err.message) : String(err)
          node.innerHTML =
            '<div class="mermaid-error" role="alert">' +
            (root.document && root.pongrabbitTt
              ? root.pongrabbitTt('diagram.renderError')
              : 'Diagram render error') +
            '</div><details class="mermaid-error-source"><summary>source</summary><pre></pre></details>'
          const pre = node.querySelector('pre')
          if (pre) pre.textContent = node.getAttribute('data-source') || node.textContent || msg
        }
      }
    }
    root.__pongrabbitMermaidReady = run()
    return root.__pongrabbitMermaidReady
  }

  function waitForMermaidIdle () {
    return root.__pongrabbitMermaidReady || Promise.resolve()
  }

  return {
    getMermaidTheme,
    ensureMermaidInit,
    renderMermaidIn,
    waitForMermaidIdle
  }
})
