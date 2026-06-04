#!/usr/bin/env bash
set -Eeuo pipefail

INTERVAL_SECONDS="${AUTO_UPDATE_INTERVAL_SECONDS:-60}"

while true; do
  /app/scripts/auto-update.sh || true
  sleep "$INTERVAL_SECONDS"
done
