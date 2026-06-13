#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/clip_to_obsidian.py"
MANIFEST_NAME="com.newsreader.obsidianclip.json"

if [[ ! -f "$HOST_SCRIPT" ]]; then
  echo "Error: clip_to_obsidian.py not found in $SCRIPT_DIR" >&2
  exit 1
fi

chmod +x "$HOST_SCRIPT"

if [[ -z "${1:-}" ]]; then
  echo "Usage: ./install.sh <chrome-extension-id>" >&2
  echo "" >&2
  echo "Find your extension ID at chrome://extensions (Developer mode ON)." >&2
  exit 1
fi

EXT_ID="$1"
PYTHON_BIN="$(command -v python3)"

if [[ -z "$PYTHON_BIN" ]]; then
  echo "Error: python3 not found in PATH" >&2
  exit 1
fi

TMP_MANIFEST="$(mktemp)"
sed \
  -e "s|REPLACE_WITH_ABSOLUTE_PATH/clip_to_obsidian.py|${HOST_SCRIPT}|" \
  -e "s|REPLACE_WITH_EXTENSION_ID|${EXT_ID}|" \
  "$SCRIPT_DIR/$MANIFEST_NAME" > "$TMP_MANIFEST"

TARGET_DIR=""
if [[ "$(uname)" == "Darwin" ]]; then
  TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ -n "${LOCALAPPDATA:-}" ]]; then
  TARGET_DIR="$LOCALAPPDATA/Google/Chrome/NativeMessagingHosts"
else
  TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

mkdir -p "$TARGET_DIR"
cp "$TMP_MANIFEST" "$TARGET_DIR/$MANIFEST_NAME"
rm "$TMP_MANIFEST"

echo "Installed native host to:"
echo "  $TARGET_DIR/$MANIFEST_NAME"
echo ""
echo "Restart Chrome, then test a clip from the extension."
