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
echo "构建 macOS 安装包（dmg / zip）…"
echo ""
if [[ ! -d "node_modules" ]]; then
  echo "请先运行 mac/install_and_run.command 完成 npm install。"
  exit 1
fi
npm run build-mac || exit 1
echo ""
echo "完成。输出在 dist/ 目录。"
open dist 2>/dev/null || true
