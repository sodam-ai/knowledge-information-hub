#!/usr/bin/env bash
# ===== Knowledge Information Hub — Local Launcher (Mac/Linux) =====
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-127.0.0.1}"

# 포터블 모드: 같은 폴더의 data/ 를 DB 위치로 사용
export KIH_DATA_DIR="${KIH_DATA_DIR:-$SCRIPT_DIR/data}"
mkdir -p "$KIH_DATA_DIR"

# SESSION_SECRET 자동 생성 (없을 때만)
if [ -z "$SESSION_SECRET" ]; then
  export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

# 초기 비밀번호 (없을 때만 — 첫 실행 후 /admin 에서 변경 가능)
export VIEW_PASSWORD="${VIEW_PASSWORD:-1234}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"

URL="http://$HOSTNAME:$PORT"

echo "============================================================"
echo "  Knowledge Information Hub - Local"
echo "============================================================"
echo "  URL        : $URL"
echo "  DATA       : $KIH_DATA_DIR"
echo "  PASSWORD   : $VIEW_PASSWORD  (첫 실행 후 /admin 에서 변경)"
echo "============================================================"
echo ""
echo "브라우저가 자동으로 열립니다. Ctrl+C 로 종료하세요."
echo ""

# === 자동 백업 (일 1회, 30일 보관) ===
node "$SCRIPT_DIR/scripts/backup.mjs" 2>/dev/null || true


# 브라우저 자동 열기 (OS별)
case "$(uname)" in
  Darwin) (sleep 1 && open "$URL") &>/dev/null & ;;
  Linux)  (sleep 1 && (xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null)) &>/dev/null & ;;
esac

# Next.js standalone 서버 실행
exec node server.js
