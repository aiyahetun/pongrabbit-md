/**
 * 将 mermaid 打成 IIFE，供 renderer 以 <script src> 加载（无打包器）。
 * 用法：node scripts/bundle-mermaid.js
 */
'use strict'

const path = require('path')
const esbuild = require('esbuild')

const root = path.join(__dirname, '..')
const entry = path.join(root, 'node_modules/mermaid/dist/mermaid.esm.min.mjs')
const outfile = path.join(root, 'src/renderer/vendor/mermaid.bundle.js')

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: '__pongrabbitMermaidBundle',
  outfile,
  platform: 'browser',
  target: ['chrome120'],
  logLevel: 'info',
  footer: {
    js: 'window.mermaid = (typeof __pongrabbitMermaidBundle !== "undefined" && (__pongrabbitMermaidBundle.default || __pongrabbitMermaidBundle));'
  }
})

console.log('Bundled mermaid →', outfile)
