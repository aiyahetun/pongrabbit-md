/**
 * 生成授权密钥。私钥已存在时拒绝覆盖。
 * 用法：node scripts/generate-license-keys.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.resolve(__dirname, '..')
const keyDir = path.join(root, 'license-keys')
const privatePath = path.join(keyDir, 'private.pem')
const publicPath = path.join(root, 'src', 'main', 'license-public.pem')

if (fs.existsSync(privatePath)) {
  console.error('私钥已存在，不覆盖：' + privatePath)
  process.exit(1)
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

fs.mkdirSync(keyDir, { recursive: true })
fs.writeFileSync(privatePath, privateKey, { encoding: 'utf8', mode: 0o600 })
fs.writeFileSync(publicPath, publicKey, 'utf8')
console.log('公钥已写入 ' + publicPath)
console.log('私钥只在本机：' + privatePath)
console.log('不要把私钥提交到 git。')
