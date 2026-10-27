/**
 * Markdown ↔ 围栏 HTML 往返（Node selfcheck + 与 app.js nodeToMd 对齐的 pre 逻辑）。
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.pongrabbitRichMdRoundtrip = factory()
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const path = require('path')
  const fence = () => {
    try {
      return require(path.join(__dirname, 'fence-blocks.js'))
    } catch (_) {
      return null
    }
  }

  function normalizeMarkdownForMarked (md) {
    return String(md || '')
      .replace(/\uFF40/g, '`')
      .replace(/^([ \t]*[-*+] )\[([ xX])\] /gm, (_, b, c) => `${b}<input type="checkbox" ${c !== ' ' ? 'checked' : ''}> `)
  }

  /**
   * @param {import('jsdom').DOMWindow} win
   * @param {string} md
   */
  function markdownToPreviewRoot (win, md) {
    const marked = require('marked')
    const FB = fence()
    marked.setOptions({ breaks: true, gfm: true })
    const html = marked.parse(normalizeMarkdownForMarked(md))
    const doc = win.document
    const root = doc.createElement('div')
    root.id = 'preview-root'
    root.innerHTML = html
    if (FB) FB.promoteMermaidFencesInElement(root)
    return root
  }

  /** @param {HTMLElement} root */
  function collectFencesFromPreviewRoot (root) {
    const FB = fence()
    if (!FB || !root) return []
    const fences = []
    const nodes = root.querySelectorAll('.mermaid, pre')
    for (const el of nodes) {
      if (el.classList && el.classList.contains('mermaid')) {
        fences.push({
          lang: 'mermaid',
          body: (el.textContent || '').replace(/\n$/, '')
        })
      } else if (el.tagName && el.tagName.toLowerCase() === 'pre') {
        const code = el.querySelector('code')
        const lang = code ? FB.fenceLangFromClassName(code.className) : ''
        const body = (code ? code.textContent : el.textContent || '').replace(/\n$/, '')
        fences.push({ lang, body })
      }
    }
    return fences
  }

  /** @param {string} md */
  function roundtripFencesFromMarkdown (md) {
    const FB = fence()
    if (!FB) throw new Error('fence-blocks missing')
    const { JSDOM } = require('jsdom')
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    const root = markdownToPreviewRoot(dom.window, md)
    dom.window.document.body.appendChild(root)
    const fencesIn = FB.extractFences(md)
    const fencesOut = collectFencesFromPreviewRoot(root)
    return { fencesIn, fencesOut, ok: FB.fencesEquivalent(fencesIn, fencesOut) }
  }

  return {
    normalizeMarkdownForMarked,
    markdownToPreviewRoot,
    collectFencesFromPreviewRoot,
    roundtripFencesFromMarkdown
  }
})
