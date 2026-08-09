#!/usr/bin/env sh
# Installs the native libraries Chromium needs to launch in this environment
# into a shared, user-level cache so every git worktree (and devloop slice)
# reuses the same setup instead of reinstalling per slice (ADR 0002).
# Browser binaries stay at Playwright's default shared install.
#
# Strategy:
#   * With root -> delegate to Playwright's official `install-deps`, which
#     installs all system libraries (recommended; covers every dependency).
#   * Without root -> download and extract just the missing library
#     (libasound.so.2 on this host) into the shared cache dir.
#
# Idempotent: does nothing once the library is already available.

set -e

BASE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/storybook-ai-e2e"
LIB_DIR="$BASE_DIR/lib"

# True if libasound.so.2 is not resolvable by the dynamic linker.
if ldconfig -p 2>/dev/null | grep -qi 'libasound\.so\.2'; then
  echo "libasound.so.2 already available on the system; nothing to install."
  exit 0
fi

if [ -e "$LIB_DIR/libasound.so.2" ]; then
  echo "libasound already vendored at $LIB_DIR."
  exit 0
fi

# 1) System-wide path when we have root (the standard Playwright fix).
if [ "$(id -u)" = "0" ]; then
  echo "Root detected — installing Chromium system dependencies (playwright install-deps)..."
  (cd "$(dirname -- "$0")/.." && pnpm exec playwright install-deps chromium)
  echo "Installed. Re-run the Playwright/Storybook tests."
  exit 0
fi

# 2) User-space fallback: vendor the missing ALSA library into the shared dir.
echo "No root — vendoring libasound locally under $LIB_DIR."
mkdir -p "$LIB_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
if ! apt-get download libasound2t64 >/dev/null 2>&1; then
  curl -fsSL -o alsa.deb \
    "http://archive.ubuntu.com/ubuntu/pool/main/a/alsa-lib/libasound2t64_1.2.15.3-1ubuntu1.1_amd64.deb"
  DEB=alsa.deb
else
  DEB=$(ls libasound2t64_*.deb)
fi
dpkg -x "$DEB" extracted
cp -P extracted/usr/lib/x86_64-linux-gnu/libasound.so.2* "$LIB_DIR/"
echo "Vendored libasound → $LIB_DIR"
