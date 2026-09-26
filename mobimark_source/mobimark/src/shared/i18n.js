'use strict'

const fs = require('fs')
const path = require('path')

const ZH = new Set(['zh', 'zh-cn', 'zh-hans', 'zh-tw', 'zh-hk', 'zh-mo'])
const CN_REGIONS = new Set(['CN', 'HK', 'MO', 'TW'])

function loadJson (name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'))
}

const DICTS = {
  zh: loadJson('locales/zh.json'),
  en: loadJson('locales/en.json')
}

const STORES = loadJson('stores.json')

function localeFromOs (osLocale) {
  const value = String(osLocale || '').toLowerCase()
  if (ZH.has(value) || value.startsWith('zh')) return 'zh'
  return 'en'
}

function storeFromCountry (country, osLocale) {
  const code = String(country || '').toUpperCase()
  if (code) return CN_REGIONS.has(code) ? 'cn' : 'intl'
  return localeFromOs(osLocale) === 'zh' ? 'cn' : 'intl'
}

function t (locale, key, vars) {
  const lang = locale === 'en' ? 'en' : 'zh'
  const str = DICTS[lang][key]
  if (str == null) return key
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

function intlLocale (locale) {
  return locale === 'en' ? 'en' : 'zh-CN'
}

module.exports = {
  DICTS,
  STORES,
  localeFromOs,
  storeFromCountry,
  t,
  intlLocale
}
