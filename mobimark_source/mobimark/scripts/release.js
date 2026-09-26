/**
 * 自检通过后打 Windows 安装包。不购买苹果开发者账号，也不购买代码签名证书。
 * 海外不卖 Mac。国内 Mac 包用 npm run build-mac，不经过本脚本。
 */
'use strict'

const { spawnSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')

function run (cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (result.status !== 0) process.exit(result.status || 1)
}

run('node', ['scripts/selfcheck-locales.js'])
run('node', ['scripts/selfcheck-license.js'])
run('node', ['scripts/prepare-nsis-eula.js'])

if (process.platform !== 'win32') {
  console.error('Windows 安装包请在 Windows 上执行 npm run release。国内 Mac 包请执行 npm run build-mac。海外不提供 Mac 版。')
  process.exit(1)
}

run('npx', ['electron-builder', '--win', '--x64'])
