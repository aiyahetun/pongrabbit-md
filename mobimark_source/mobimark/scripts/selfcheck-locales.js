/**
 * 语言文件键一致，且验签模块不带价格和网址。
 * 校验 index.html / 渲染进程引用的 i18n 键均存在于 zh、en。
 * 用法：node scripts/selfcheck-locales.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { DICTS, localeFromOs, storeFromCountry } = require('../src/shared/i18n')

const root = path.join(__dirname, '..')

let failed = 0
function check (name, cond) {
  if (cond) console.log('  ✓ ' + name)
  else {
    failed++
    console.error('  ✗ ' + name)
  }
}

const zhKeys = new Set(Object.keys(DICTS.zh))
const enKeys = new Set(Object.keys(DICTS.en))
const zhKeyList = [...zhKeys].sort()
const enKeyList = [...enKeys].sort()
check('中英键一致', zhKeyList.join('\n') === enKeyList.join('\n'))
check('中文值非空', zhKeyList.every(k => String(DICTS.zh[k]).trim()))
check('英文值非空', enKeyList.every(k => String(DICTS.en[k]).trim()))
check('简体地区用中文', localeFromOs('zh-CN') === 'zh' && localeFromOs('zh-TW') === 'zh')
check('其他语言用英文', localeFromOs('en-US') === 'en' && localeFromOs('de-DE') === 'en')
check('中国地区默认国内店', storeFromCountry('CN') === 'cn' && storeFromCountry('', 'zh-CN') === 'cn')
check('其他地区默认海外店', storeFromCountry('US') === 'intl' && storeFromCountry('', 'en-US') === 'intl')

function addKey (out, key) {
  if (!key || key.endsWith('.')) return
  out.add(key)
}

function collectI18nKeysFromText (text, out) {
  const attrRe = /data-i18n(?:-title|-placeholder|-aria|-data-placeholder)?="([^"]+)"/g
  let m
  while ((m = attrRe.exec(text)) !== null) addKey(out, m[1])
  const ttRe = /tt\(\s*['"]([^'"]+)['"]/g
  while ((m = ttRe.exec(text)) !== null) addKey(out, m[1])
  const menuRe = /menuLabel\(\s*['"]([^'"]+)['"]\)/g
  while ((m = menuRe.exec(text)) !== null) addKey(out, m[1])
}

const used = new Set()
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
collectI18nKeysFromText(indexHtml, used)
for (const rel of ['src/renderer/app.js', 'src/renderer/context-menu.js', 'src/main/main.js']) {
  collectI18nKeysFromText(fs.readFileSync(path.join(root, rel), 'utf8'), used)
}

const missingZh = [...used].filter(k => !zhKeys.has(k)).sort()
const missingEn = [...used].filter(k => !enKeys.has(k)).sort()
check('界面引用的键在中文包存在', missingZh.length === 0)
if (missingZh.length) console.error('    缺少: ' + missingZh.join(', '))
check('界面引用的键在英文包存在', missingEn.length === 0)
if (missingEn.length) console.error('    缺少: ' + missingEn.join(', '))

const licenseSrc = fs.readFileSync(path.join(root, 'src/main/license.js'), 'utf8')
check('验签模块不含标价', !licenseSrc.includes('¥') && !/\$\d/.test(licenseSrc))
check('验签模块不含网址', !licenseSrc.includes('http'))
const mainSrc = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8')
check('试用锁定返回错误代码', mainSrc.includes("error: 'license-required'") && !mainSrc.includes('试用已结束，继续写'))

if (failed) {
  console.error('\n' + failed + ' failed')
  process.exit(1)
}
console.log('\nall passed')
