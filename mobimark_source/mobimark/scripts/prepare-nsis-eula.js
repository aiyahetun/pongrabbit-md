'use strict'

/**
 * NSIS 许可证页在中文 Windows 上按系统 ANSI（GBK）读文件。
 * UTF-8 会乱码；UTF-16 在本工具链下常显示为空白。打包前转为 GBK。
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const src = path.join(root, 'build', 'eula.txt')
const dest = path.join(root, 'build', 'eula.nsis.txt')

if (process.platform === 'win32') {
  const q = (p) => `'${String(p).replace(/'/g, "''")}'`
  const ps = `[IO.File]::WriteAllBytes(${q(dest)}, [Text.Encoding]::GetEncoding(936).GetBytes((Get-Content -LiteralPath ${q(src)} -Encoding UTF8 -Raw)))`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'prepare-nsis-eula failed')
    process.exit(r.status || 1)
  }
} else {
  fs.copyFileSync(src, dest)
}
