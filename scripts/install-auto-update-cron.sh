#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPDATER="$REPO_DIR/scripts/auto-update.sh"
LOG_FILE="${AUTO_UPDATE_LOG_FILE:-$REPO_DIR/auto-update.log}"
CRON_SCHEDULE="${AUTO_UPDATE_CRON_SCHEDULE:-* * * * *}"
CRON_LINE="$CRON_SCHEDULE $UPDATER >> $LOG_FILE 2>&1"
TMP_CRON="$(mktemp)"

cleanup() {
  rm -f "$TMP_CRON"
}
trap cleanup EXIT

chmod +x "$UPDATER"

if crontab -l >"$TMP_CRON" 2>/dev/null; then
  grep -Fv "$UPDATER" "$TMP_CRON" >"$TMP_CRON.next"
  mv "$TMP_CRON.next" "$TMP_CRON"
else
  : >"$TMP_CRON"
fi

printf '%s\n' "$CRON_LINE" >>"$TMP_CRON"
crontab "$TMP_CRON"

printf 'Installed auto-update cron entry:\n%s\n' "$CRON_LINE"
