#!/usr/bin/env bash
# 活動後成就更新一鍵腳本（過渡期：外部售票平台名單匯入）。
# 用法：
#   1. 把 KKTIX zip / Accupass xlsx 丟進 dddtw-attendees/
#   2. ./scripts/update-achievements.sh
#   3. 檢查輸出無 [warn] 後：git add -A && git commit && git push
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d dddtw-attendees ]; then
  echo "找不到 dddtw-attendees/（原始名單目錄，不進版控）。" >&2
  exit 1
fi

echo "=== 1/3 彙整名單 ==="
if command -v uv >/dev/null; then
  uv run --with openpyxl python3 scripts/consolidate-attendees.py
else
  python3 scripts/consolidate-attendees.py
fi

echo ""
echo "=== 2/3 重算成就 ==="
python3 scripts/build-achievements.py

echo ""
echo "=== 3/3 檢查 ==="
# 防呆：build 輸出若有 [warn]（活動代碼不在 registry），提醒補 event-registry.json
if python3 scripts/build-achievements.py 2>&1 | grep -q '\[warn\]'; then
  echo ""
  echo "⚠️  有活動代碼未登記於 src/data/event-registry.json——該場次不會計入成就。"
  echo "   請在 registry 加上對應的 eventId/sources 後重跑本腳本。"
  exit 1
fi
echo "✅ 完成。變更檔案："
git status --short public/api/achievements src/data | head -10
echo ""
echo "下一步：git add -A && git commit -m 'Update achievements' && git push"
