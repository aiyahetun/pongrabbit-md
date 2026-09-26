'use strict'
/** 将 data-i18n* 应用到 DOM；供 bootstrap-i18n.js 与 app.js 共用 */
window.prmdApplyI18nDom = function prmdApplyI18nDom (opts) {
  const tt = opts.tt
  const state = opts.state || {}
  const locale = opts.locale || state.locale || 'zh'
  const cfg = opts.cfg || {}
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'

  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.hasAttribute('data-i18n-skip')) return
    const key = el.getAttribute('data-i18n')
    if (!key) return
    const prefix = el.getAttribute('data-i18n-prefix') || ''
    el.textContent = prefix + tt(key)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = tt(el.getAttribute('data-i18n-title'))
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', tt(el.getAttribute('data-i18n-placeholder')))
  })
  document.querySelectorAll('[data-i18n-data-placeholder]').forEach(el => {
    el.setAttribute('data-placeholder', tt(el.getAttribute('data-i18n-data-placeholder')))
  })
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', tt(el.getAttribute('data-i18n-aria')))
  })

  const mfd = document.getElementById('music-folder-display')
  if (mfd && !(cfg.musicFolder && String(cfg.musicFolder).trim())) {
    mfd.textContent = tt('music.noFolder')
  }
  if (typeof opts.onAfterDom === 'function') opts.onAfterDom()

  const stores = state.stores || {}
  const cn = document.getElementById('store-cn')
  const intl = document.getElementById('store-intl')
  if (cn) {
    cn.textContent = tt('store.cn', { price: (stores.cn && stores.cn.price) || '' })
    cn.classList.toggle('selected', state.store === 'cn')
  }
  if (intl) {
    intl.textContent = tt('store.intl', { price: (stores.intl && stores.intl.price) || '' })
    intl.classList.toggle('selected', state.store === 'intl')
  }
  const loc = document.getElementById('locale-select')
  if (loc) loc.value = locale === 'en' ? 'en' : 'zh'
  const buy = document.getElementById('btn-license-buy')
  const row = state.store === 'intl' ? stores.intl : stores.cn
  if (buy) buy.disabled = !(row && row.url)

  const fileName = document.getElementById('file-name')
  if (fileName && (!String(fileName.textContent || '').trim() || fileName.textContent === '无题文档' || fileName.textContent === 'Untitled')) {
    fileName.textContent = tt('ui.untitled')
  }
}
