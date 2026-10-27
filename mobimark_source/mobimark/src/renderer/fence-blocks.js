/**
 * Mermaid 围栏识别与 HTML 后处理（浏览器 + Node selfcheck 共用）。
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.pongrabbitFenceBlocks = factory()
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const MERMAID_LANG = 'mermaid'

  function fenceLangFromClassName (className) {
    const m = String(className || '').match(/language-([\w-]+)/i)
    return m ? m[1].toLowerCase() : ''
  }

  function isMermaidLang (lang) {
    return String(lang || '').toLowerCase() === MERMAID_LANG
  }

  function stripBlockquotePrefixFromFenceBody (body) {
    return String(body || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => (/^>\s?/.test(line) ? line.replace(/^>\s?/, '') : line))
      .join('\n')
      .replace(/\n$/, '')
  }

  /** @param {string} md */
  function extractFences (md) {
    const text = String(md || '')
    const fences = []
    const re = /^(?:>\s*)?```([^\n`]*)\n([\s\S]*?)^(?:>\s*)?```/gm
    let m
    while ((m = re.exec(text)) !== null) {
      const info = (m[1] || '').trim()
      const lang = info.split(/\s+/)[0].toLowerCase()
      fences.push({
        lang: lang || '',
        body: stripBlockquotePrefixFromFenceBody(m[2])
      })
    }
    return fences
  }

  function normalizeFenceBodies (fences) {
    return fences.map(f => ({
      lang: f.lang,
      body: String(f.body).replace(/\r\n/g, '\n').replace(/\n$/, '')
    }))
  }

  /** 比较围栏序列是否一致（用于往返测试） */
  function fencesEquivalent (a, b) {
    const A = normalizeFenceBodies(a)
    const B = normalizeFenceBodies(b)
    if (A.length !== B.length) return false
    for (let i = 0; i < A.length; i++) {
      if (A[i].lang !== B[i].lang) return false
      if (A[i].body !== B[i].body) return false
    }
    return true
  }

  function normalizeFenceRoundTrip (md) {
    return md
  }

  let _diagramId = 0
  function nextDiagramId () {
    _diagramId += 1
    return 'mmd-' + _diagramId
  }

  /**
   * 将 marked 生成的 pre>code.language-mermaid 换成 div.mermaid
   * @param {ParentNode} container
   */
  function promoteMermaidFencesInElement (container) {
    if (!container || !container.querySelectorAll) return
    const pres = container.querySelectorAll('pre')
    for (const pre of pres) {
      const code = pre.querySelector('code')
      if (!code) continue
      const lang = fenceLangFromClassName(code.className)
      if (!isMermaidLang(lang)) continue
      const doc = pre.ownerDocument || (typeof document !== 'undefined' ? document : null)
      if (!doc) continue
      const div = doc.createElement('div')
      div.className = 'mermaid'
      div.setAttribute('data-diagram-id', nextDiagramId())
      div.textContent = (code.textContent || '').replace(/\n$/, '')
      pre.replaceWith(div)
    }
  }

  /** @param {HTMLElement} pre */
  function fenceMdFromPreElement (pre) {
    const code = pre && pre.querySelector && pre.querySelector('code')
    const lang = code ? fenceLangFromClassName(code.className) : ''
    const body = (code ? code.textContent : pre.textContent || '').replace(/\n$/, '')
    if (lang) return '```' + lang + '\n' + body + '\n```'
    return '```\n' + body + '\n```'
  }

  /** @param {HTMLElement} el */
  function fenceMdFromMermaidElement (el) {
    const body = (el.textContent || '').replace(/\n$/, '')
    return '```mermaid\n' + body + '\n```'
  }

  /**
   * 从预览容器收集围栏 markdown（Mermaid 块 + 普通 pre）
   * @param {ParentNode} container
   */
  function collectFenceMarkdownFromHtml (container) {
    const parts = []
    if (!container || !container.childNodes) return ''
    for (const node of container.childNodes) {
      if (node.nodeType !== 1) continue
      const tag = node.tagName.toLowerCase()
      if (tag === 'div' && node.classList && node.classList.contains('mermaid')) {
        parts.push(fenceMdFromMermaidElement(node))
      } else if (tag === 'pre') {
        parts.push(fenceMdFromPreElement(node))
      }
    }
    return parts.join('\n\n')
  }

  return {
    MERMAID_LANG,
    fenceLangFromClassName,
    isMermaidLang,
    extractFences,
    fencesEquivalent,
    normalizeFenceRoundTrip,
    promoteMermaidFencesInElement,
    fenceMdFromPreElement,
    fenceMdFromMermaidElement,
    collectFenceMarkdownFromHtml
  }
})
