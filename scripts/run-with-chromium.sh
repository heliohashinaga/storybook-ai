#!/usr/bin/env sh
# Wraps a Playwright/Storybook-test command so the Chromium child process can
# find the shared native libraries it needs to launch on a minimal Linux host.
#
# Native deps (e.g. libasound.so.2) are vendored once per user into a shared,
# user-level cache under $XDG_CACHE_HOME (see scripts/setup-chromium-deps.sh)
# and exposed here via LD_LIBRARY_PATH, so git worktrees never reinstall them
# per devloop slice (ADR 0002). Browser binaries stay at Playwright's default
# shared install (~/.cache/ms-playwright), which is already reused across
# worktrees.
#
# Usage:  sh scripts/run-with-chromium.sh <command> [args...]

BASE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/storybook-ai-e2e"
LIB_DIR="$BASE_DIR/lib"

if [ -d "$LIB_DIR" ]; then
  export LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec "$@"
