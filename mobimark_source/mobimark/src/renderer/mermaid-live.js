/**
 * mermaid.live 外链（阶段 C2）。无第三方压缩库，使用 #base64: 状态片段。
 */
;(function (root, factory) {
  root.pongrabbitMermaidLive = factory(root)
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict'

  const MERMAID_LIVE_EDIT = 'https://mermaid.live/edit'

  function themeForMermaidLive () {
    const body = root.document && root.document.body
    if (!body) return 'default'
    if (body.classList.contains('theme-dark')) return 'dark'
    if (body.classList.contains('theme-glass')) return 'neutral'
    return 'default'
  }

  function toBase64Url (utf8) {
    const bytes = new TextEncoder().encode(utf8)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function buildMermaidLiveEditUrl (source, theme) {
    const code = String(source || '').replace(/\n$/, '')
    const state = {
      code,
      mermaid: JSON.stringify({ theme: theme || themeForMermaidLive() })
    }
    return MERMAID_LIVE_EDIT + '#base64:' + toBase64Url(JSON.stringify(state))
  }

  async function openInMermaidLive (source) {
    let url = ''
    try {
      url = buildMermaidLiveEditUrl(source)
    } catch (e) {
      console.warn('mermaid.live url build failed', e)
    }
    if (!url) return { ok: false, reason: 'build' }
    if (!root.mobiAPI || !root.mobiAPI.openExternal) return { ok: false, reason: 'api' }
    try {
      await root.mobiAPI.openExternal(url)
      return { ok: true, url }
    } catch (e) {
      console.warn('openExternal failed', e)
      return { ok: false, reason: 'open' }
    }
  }

  return {
    MERMAID_LIVE_EDIT,
    buildMermaidLiveEditUrl,
    openInMermaidLive
  }
})
