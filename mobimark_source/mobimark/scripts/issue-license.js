/**
 * 签发授权码，并打出对应渠道的邮件正文。
 *   node scripts/issue-license.js --store cn buyer@example.com
 *   node scripts/issue-license.js --store intl buyer@example.com
 * 省略 --store 时按 cn。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { signLicense } = require('../src/main/license')
const { t } = require('../src/shared/i18n')

const args = process.argv.slice(2)
let store = 'cn'
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--store') {
    store = args[++i]
  } else {
    positional.push(args[i])
  }
}
const email = positional[0]
const privatePath = path.join(__dirname, '..', 'license-keys', 'private.pem')

if (!email || (store !== 'cn' && store !== 'intl')) {
  console.error('用法: node scripts/issue-license.js --store cn|intl 邮箱')
  process.exit(1)
}
if (!fs.existsSync(privatePath)) {
  console.error('找不到私钥。先在本机运行 node scripts/generate-license-keys.js')
  console.error(privatePath)
  process.exit(1)
}

let token
try {
  token = signLicense(email, fs.readFileSync(privatePath, 'utf8'))
} catch (e) {
  const locale = store === 'intl' ? 'en' : 'zh'
  console.error(t(locale, 'error.' + (e && e.message)))
  process.exit(1)
}

const templateName = store === 'intl' ? 'mail-intl.txt' : 'mail-cn.txt'
const body = fs.readFileSync(path.join(__dirname, templateName), 'utf8').split('{token}').join(token)
process.stdout.write(token + '\n\n' + body)
