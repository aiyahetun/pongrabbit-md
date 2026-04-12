#!/usr/bin/env bash
# 在仓库根目录执行：上传 dist 中已有安装包到 GitHub Release（需 gh 已登录）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/mobimark_source/mobimark/dist"
VER=$(node -p "require('$ROOT/mobimark_source/mobimark/package.json').version")
TAG="v${VER}"

if ! command -v gh >/dev/null 2>&1; then
  echo "未找到 gh。请先安装: brew install gh && gh auth login"
  echo "或按 docs/RELEASES.md 在网页上手动创建 Release。"
  exit 1
fi

ASSETS=()
for f in \
  "$DIST/pongrabbit-MD-${VER}.dmg" \
  "$DIST/pongrabbit-MD-${VER}.zip" \
  "$DIST/pongrabbit-MD Setup ${VER}.exe" \
  "$DIST/pongrabbit-MD ${VER}.exe"
do
  [[ -f "$f" ]] && ASSETS+=("$f")
done

if [[ ${#ASSETS[@]} -eq 0 ]]; then
  echo "dist 下没有找到可上传的安装包（版本 ${VER}）。请先 npm run build-mac / npm run build。"
  exit 1
fi

NOTES="$ROOT/docs/RELEASE_NOTES_v${VER}.md"
[[ -f "$NOTES" ]] || NOTES="$ROOT/docs/RELEASES.md"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG 已存在，改为上传资源…"
  gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
  gh release create "$TAG" "${ASSETS[@]}" \
    --title "pongrabbit-MD ${VER}" \
    --notes-file "$NOTES"
fi

echo "完成: https://github.com/aiyahetun/pongrabbit-md/releases/tag/$TAG"
