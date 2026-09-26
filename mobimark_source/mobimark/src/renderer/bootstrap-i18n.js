'use strict'
(function () {
  const root = document.documentElement
  try {
    const boot = window.i18nInitial
    if (!boot || !window.i18nAPI || !window.prmdApplyI18nDom) return
    window.i18nAPI.useLocale(boot.locale)
    const tt = (key, vars) => window.i18nAPI.t(key, vars)
    window.prmdApplyI18nDom({
      tt,
      locale: boot.locale,
      state: boot,
      cfg: { musicFolder: boot.musicFolder || '' }
    })
  } catch (e) {
    console.error('[bootstrap-i18n]', e)
  } finally {
    root.classList.remove('i18n-pending')
  }
})()
