#!/usr/bin/env sh
# Wraps a Playwright/Storybook-test command so the Chromium child process can
# find the project-local native libraries (see scripts/setup-chromium-deps.sh).
#
# Usage:  sh scripts/run-with-chromium.sh <command> [args...]

REPO_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LIB_DIR="$REPO_DIR/.playwright-deps/lib"

if [ -d "$LIB_DIR" ]; then
  export LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec "$@"
