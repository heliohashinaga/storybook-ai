#!/usr/bin/env sh
# Installs the storybook-ai pre-commit hook (scripts/pre-commit) into git.
#
# Invoked automatically via `pnpm postinstall`, so a fresh `pnpm install` wires
# the quality gate. Can also be run manually:  sh scripts/install-hooks.sh
#
# Uses a plain copy (not a symlink): git treats hook files at .git/hooks as
# executable scripts, and a copy is more robust than a symlink across git
# versions/editors. Re-running this after updating scripts/pre-commit re-syncs
# the installed copy.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOOK_SRC="$ROOT/scripts/pre-commit"
HOOK_DST="$(git rev-parse --git-dir)/hooks/pre-commit"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[install-hooks] not a git work tree; skipping." >&2
  exit 0
fi

mkdir -p "$(dirname "$HOOK_DST")"
chmod +x "$HOOK_SRC"
cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "[install-hooks] pre-commit hook installed -> $HOOK_DST"
