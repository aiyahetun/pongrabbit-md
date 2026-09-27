/**
 * 授权码签发、校验、试用天数。
 * 用法：node scripts/selfcheck-license.js
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const license = require('../src/main/license')

const privatePath = path.join(__dirname, '..', 'license-keys', 'private.pem')
let failed = 0

function check (name, cond) {
  if (cond) console.log('  ✓ ' + name)
  else {
    failed++
    console.error('  ✗ ' + name)
  }
}

function shiftDate (iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

console.log('Self-check: license\n')

let pem
if (fs.existsSync(privatePath)) {
  pem = fs.readFileSync(privatePath, 'utf8')
} else {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  license.setPublicKeyPemForTests(publicKey)
  pem = privateKey
  console.log('  (无本地私钥，使用临时密钥做自检)\n')
}
const token = license.signLicense('Buyer@Example.com', pem, '2026-09-23')
const ok = license.verifyToken(token)
check('签发后能通过校验', ok.ok === true)
check('邮箱转成小写写入码内', ok.email === 'buyer@example.com')

const parts = token.split('.')
const bad = parts[0] + '.' + parts[1] + '.' + parts[2].slice(0, -2) + 'aa'
check('改过的签名不能通过', license.verifyToken(bad).ok === false)
check('空码被拒绝', license.verifyToken('   ').ok === false)
check('别的前缀被拒绝', license.verifyToken('NOPE.' + parts[1] + '.' + parts[2]).ok === false)

const today = '2026-09-23'
check('起始日当天剩 14 天', license.daysRemaining(today, today) === 14)
check('第 14 天还剩 1 天', license.daysRemaining(today, shiftDate(today, 13)) === 1)
check('第 15 天锁定', license.daysRemaining(today, shiftDate(today, 14)) === 0)

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prmd-license-'))
license.setStateDirForTests(dir)
try {
  const first = license.getStatus({ today, consumeReminder: false })
  check('首次启动写入试用起始日', first.trialStarted === today && first.unlocked === true && first.daysLeft === 14)
  const again = license.getStatus({ today: shiftDate(today, 13), consumeReminder: false })
  check('重读不会把试用清零', again.trialStarted === today && again.daysLeft === 1 && again.unlocked === true)
  const remind = license.getStatus({ today: shiftDate(today, 11), consumeReminder: true })
  check('剩余 3 天时提示一次', remind.daysLeft === 3 && remind.shouldRemind === true)
  const remind2 = license.getStatus({ today: shiftDate(today, 12), consumeReminder: true })
  check('提示不会重复', remind2.shouldRemind === false && remind2.daysLeft === 2)
  const locked = license.getStatus({ today: shiftDate(today, 14), consumeReminder: false })
  check('试用结束未解锁', locked.unlocked === false && locked.licensed === false)
  const act = license.activate(token)
  check('激活成功', act.ok === true && act.email === 'buyer@example.com')
  const after = license.getStatus({ today: shiftDate(today, 40), consumeReminder: false })
  check('激活后试用结束仍可导出', after.licensed === true && after.unlocked === true)
  const stores = require('../src/shared/stores.json')
  check('国内标价 58', stores.cn.price === '¥58')
  check('海外标价 8.8 美元', stores.intl.price === '$8.80')
  check('国内店链接已配置', /^https:\/\/afdian\.com\/item\//.test(stores.cn.url))
  check('海外店链接未配置或合法', stores.intl.url === '' || /^https:\/\//.test(stores.intl.url))
} finally {
  license.setStateDirForTests(null)
  fs.rmSync(dir, { recursive: true, force: true })
}

if (failed) {
  console.error('\n' + failed + ' failed')
  process.exit(1)
}
console.log('\nall passed')
