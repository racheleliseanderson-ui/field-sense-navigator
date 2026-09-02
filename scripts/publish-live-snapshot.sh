#!/usr/bin/env bash
# Publish ingest artifacts to the live-snapshot branch without wiping history.
# Usage: publish-live-snapshot.sh [snapshot] [status] [closures]
#
# Regular commits (no orphan checkout of the runner tree, no force-push).
# Hourly copies of snapshot.json live in archive/ and are pruned after 24
# hours. Files this run does not produce are left untouched on the branch.
# A worktree keeps the Action's working copy on main so notify can still
# read public/live/status.json after publish.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIVE_SRC="$ROOT/public/live"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
HOUR="$(date -u +%Y-%m-%dT%H)"
MSG="${PUBLISH_MESSAGE:-live: snapshot ${STAMP}}"
WT="/tmp/live-snapshot-wt-$$"

WANT_SNAP=0
WANT_STATUS=0
WANT_CLOSURES=0
if [ "$#" -eq 0 ]; then
  WANT_SNAP=1
  WANT_STATUS=1
else
  for arg in "$@"; do
    case "$arg" in
      snapshot) WANT_SNAP=1 ;;
      status) WANT_STATUS=1 ;;
      closures) WANT_CLOSURES=1 ;;
      *) echo "unknown artifact: $arg" >&2; exit 2 ;;
    esac
  done
fi

# These commits are made by the scheduled ingest, not by a person, so they are
# authored as a bot. A private address should not be stamped on every automated
# commit in a public repository. Override with GIT_AUTHOR_EMAIL / _NAME.
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git config user.name "${GIT_AUTHOR_NAME:-field-sense ingest}"

mkdir -p /tmp/live-pub
if [ "$WANT_SNAP" -eq 1 ]; then
  test -f "$LIVE_SRC/snapshot.json"
  cp "$LIVE_SRC/snapshot.json" /tmp/live-pub/snapshot.json
fi
if [ "$WANT_STATUS" -eq 1 ] && [ -f "$LIVE_SRC/status.json" ]; then
  cp "$LIVE_SRC/status.json" /tmp/live-pub/status.json
fi
if [ "$WANT_CLOSURES" -eq 1 ]; then
  test -f "$LIVE_SRC/closures.json"
  cp "$LIVE_SRC/closures.json" /tmp/live-pub/closures.json
fi

cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"; }
trap cleanup EXIT

git fetch origin live-snapshot || true
if git show-ref --verify --quiet refs/remotes/origin/live-snapshot; then
  git worktree add -B live-snapshot "$WT" origin/live-snapshot
else
  git worktree add --detach "$WT"
  git -C "$WT" checkout --orphan live-snapshot
  git -C "$WT" rm -rf --quiet . || true
fi

if [ -f /tmp/live-pub/snapshot.json ]; then
  cp /tmp/live-pub/snapshot.json "$WT/snapshot.json"
  mkdir -p "$WT/archive"
  cp /tmp/live-pub/snapshot.json "$WT/archive/${HOUR}.json"
  if ls "$WT"/archive/*.json >/dev/null 2>&1; then
    ls -1t "$WT"/archive/*.json | tail -n +25 | xargs -r rm -f
  fi
fi
if [ -f /tmp/live-pub/status.json ]; then
  cp /tmp/live-pub/status.json "$WT/status.json"
fi
if [ -f /tmp/live-pub/closures.json ]; then
  cp /tmp/live-pub/closures.json "$WT/closures.json"
fi

git -C "$WT" add -- snapshot.json status.json closures.json archive 2>/dev/null || true

if git -C "$WT" diff --cached --quiet; then
  echo "no live-snapshot changes to commit"
  exit 0
fi

git -C "$WT" commit -m "$MSG"
git -C "$WT" push origin HEAD:live-snapshot
