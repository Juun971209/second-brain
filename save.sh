#!/bin/bash
# Usage: save.sh <category> <title>   (markdown body comes from stdin)
set -euo pipefail

CATEGORY="${1:-}"
TITLE="${2:-}"
CONTENT="$(cat)"

case "$CATEGORY" in
  clients|insights|templates|study|prompts|logs) ;;
  *) echo "허용되지 않은 카테고리입니다: $CATEGORY" >&2; exit 1 ;;
esac

if [ -z "$TITLE" ]; then
  echo "제목이 비어 있습니다." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

DATE="$(date +%F)"
SLUG="$(printf '%s' "$TITLE" | sed -E 's/[<>:"/\\|?*]+//g; s/[[:space:]]+/-/g')"
SLUG="${SLUG:-untitled}"

mkdir -p "$CATEGORY"
FILE="${CATEGORY}/${DATE}-${SLUG}.md"

{
  printf '%s\n' "---"
  printf 'title: %s\n' "$TITLE"
  printf 'date: %s\n' "$DATE"
  printf 'category: %s\n' "$CATEGORY"
  printf '%s\n' "---"
  printf '\n'
  printf '%s\n' "$CONTENT"
} > "$FILE"

git add "$FILE"

if git diff --cached --quiet; then
  printf '%s (변경 사항 없음)\n' "$FILE"
  exit 0
fi

git commit -m "add: ${TITLE} (${DATE})" --quiet
git push --quiet

printf '%s\n' "$FILE"
