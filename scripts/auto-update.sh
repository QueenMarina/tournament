#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${AUTO_UPDATE_REMOTE:-origin}"
LOCK_FILE="${AUTO_UPDATE_LOCK_FILE:-/tmp/tournament-auto-update.lock}"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "missing required command: $1"
    exit 1
  fi
}

require_command git
require_command npm
require_command docker
require_command flock

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another update is already running"
  exit 0
fi

cd "$REPO_DIR"

branch="${AUTO_UPDATE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
upstream="$REMOTE/$branch"

if [[ "$branch" == "HEAD" ]]; then
  log "repository is in detached HEAD state; set AUTO_UPDATE_BRANCH to enable updates"
  exit 1
fi

log "checking $upstream"
git fetch --prune "$REMOTE"

current_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse "$upstream")"
merge_base="$(git merge-base HEAD "$upstream")"

if [[ "$current_head" == "$remote_head" ]]; then
  log "already up to date"
  exit 0
fi

if [[ "$merge_base" != "$current_head" ]]; then
  log "local branch is not a clean ancestor of $upstream; refusing to auto-update"
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  log "tracked files have local changes; refusing to auto-update"
  exit 1
fi

log "updating from $current_head to $remote_head"
git pull --ff-only "$REMOTE" "$branch"

changed_files="$(git diff --name-only "$current_head" HEAD)"
if [[ ! -d node_modules ]] || grep -Eq '(^|/)package(-lock)?\.json$' <<<"$changed_files"; then
  log "installing npm dependencies"
  npm ci
fi

log "building application"
npm run build

log "restarting app service"
if [[ -n "${AUTO_UPDATE_RESTART_CONTAINER:-}" ]]; then
  docker restart "$AUTO_UPDATE_RESTART_CONTAINER"
elif docker compose version >/dev/null 2>&1; then
  docker compose restart app
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose restart app
else
  log "missing required command: docker compose or docker-compose"
  exit 1
fi

log "update complete"
