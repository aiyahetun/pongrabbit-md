#!/bin/bash
cd "$(dirname "$0")/.."
if [[ -f "pengtuzi-md/package.json" ]]; then
  cd "pengtuzi-md"
elif [[ -f "mobimark_source/mobimark/package.json" ]]; then
  cd "mobimark_source/mobimark"
else
  echo "未找到工程目录。请将应用放在与 mac 脚本同级的 pengtuzi-md 下（含 package.json）。"
  exit 1
fi
echo ""
echo "安装 pongrabbit-MD 依赖（首次可能较久）…"
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 node。请先安装 Node.js LTS：https://nodejs.org"
  exit 1
fi
npm install || exit 1
echo ""
echo "启动 pongrabbit-MD…"
echo ""
npm start
