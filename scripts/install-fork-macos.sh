#!/usr/bin/env bash
# Builds this fork for macOS and installs it as /Applications/MonoCode.app.
# The app being replaced is kept in ~/.monocode-fork/MonoCode-previous.app.
set -euo pipefail

[ "$(uname)" = "Darwin" ] || { echo "macOS only." >&2; exit 1; }
cd "$(dirname "$0")/.."

DEST="/Applications/MonoCode.app"
BACKUP_DIR="$HOME/.monocode-fork"
BUILT="target/release/bundle/macos/MonoCode.app"

if pgrep -f "$DEST/Contents/MacOS/" >/dev/null; then
  echo "Quit MonoCode first (it runs from $DEST), then run this again." >&2
  exit 1
fi

# The fork has no updater signing key, so skip the updater artifacts.
npm run tauri build -- --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'

[ -d "$BUILT" ] || { echo "Build output not found: $BUILT" >&2; exit 1; }

if [ -d "$DEST" ]; then
  mkdir -p "$BACKUP_DIR"
  rm -rf "$BACKUP_DIR/MonoCode-previous.app"
  mv "$DEST" "$BACKUP_DIR/MonoCode-previous.app"
  echo "Previous app kept in $BACKUP_DIR/MonoCode-previous.app"
fi

ditto "$BUILT" "$DEST"
echo "Installed $DEST ($(git rev-parse --short HEAD) on $(git branch --show-current))."
