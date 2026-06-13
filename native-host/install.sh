#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_SCRIPT="$SCRIPT_DIR/clip_to_obsidian.py"
MANIFEST_NAME="com.newsreader.obsidianclip.json"

INSTALL_LIB="$HOME/.local/share/com.newsreader.obsidianclip"
INSTALL_BIN="$HOME/.local/bin/com.newsreader.obsidianclip"

if [[ ! -f "$SOURCE_SCRIPT" ]]; then
  echo "Error: clip_to_obsidian.py not found in $SCRIPT_DIR" >&2
  exit 1
fi

if [[ -z "${1:-}" ]]; then
  echo "Usage: ./install.sh <chrome-extension-id>" >&2
  echo "" >&2
  echo "Find your extension ID at chrome://extensions (Developer mode ON)." >&2
  exit 1
fi

EXT_ID="$1"

# Prefer macOS system python — Chrome can launch this more reliably than Framework builds.
if [[ -x /usr/bin/python3 ]]; then
  PYTHON_BIN="/usr/bin/python3"
else
  PYTHON_BIN="$(command -v python3)"
fi

if [[ -z "$PYTHON_BIN" ]]; then
  echo "Error: python3 not found" >&2
  exit 1
fi

mkdir -p "$INSTALL_LIB" "$HOME/.local/bin"
cp "$SOURCE_SCRIPT" "$INSTALL_LIB/clip_to_obsidian.py"
chmod +x "$INSTALL_LIB/clip_to_obsidian.py"

cat > "$INSTALL_BIN" <<EOF
#!/bin/bash
exec "$PYTHON_BIN" "$INSTALL_LIB/clip_to_obsidian.py"
EOF
chmod +x "$INSTALL_BIN"

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$INSTALL_BIN" "$INSTALL_LIB" 2>/dev/null || true
fi

TMP_MANIFEST="$(mktemp)"
sed \
  -e "s|REPLACE_HOST_BIN|${INSTALL_BIN}|" \
  -e "s|REPLACE_WITH_EXTENSION_ID|${EXT_ID}|" \
  "$SCRIPT_DIR/$MANIFEST_NAME" > "$TMP_MANIFEST"

TARGET_DIRS=()
if [[ "$(uname)" == "Darwin" ]]; then
  TARGET_DIRS+=("$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts")
  TARGET_DIRS+=("$HOME/Library/Application Support/Chromium/NativeMessagingHosts")
  TARGET_DIRS+=("$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts")
elif [[ -n "${LOCALAPPDATA:-}" ]]; then
  TARGET_DIRS+=("$LOCALAPPDATA/Google/Chrome/NativeMessagingHosts")
else
  TARGET_DIRS+=("$HOME/.config/google-chrome/NativeMessagingHosts")
fi

for TARGET_DIR in "${TARGET_DIRS[@]}"; do
  mkdir -p "$TARGET_DIR"
  cp "$TMP_MANIFEST" "$TARGET_DIR/$MANIFEST_NAME"
  echo "Installed manifest: $TARGET_DIR/$MANIFEST_NAME"
done

rm "$TMP_MANIFEST"

echo ""
echo "Host binary: $INSTALL_BIN"
echo "Python:      $PYTHON_BIN"
echo "Extension:   $EXT_ID"
echo ""
echo "Fully quit Chrome (Cmd+Q), reopen, then test again."

python3 - <<PY
import json, struct, subprocess, os
msg = json.dumps({'action': 'ping'}).encode()
proc = subprocess.Popen(['$INSTALL_BIN'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
proc.stdin.write(struct.pack('<I', len(msg)) + msg)
proc.stdin.close()
out, err = proc.stdout.read(), proc.stderr.read()
code = proc.wait()
print('Local test (normal):', 'OK' if code == 0 and b'pong' in out else f'FAILED {err.decode()}')
proc = subprocess.Popen(['env','-i','PATH=','$INSTALL_BIN'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
proc.stdin.write(struct.pack('<I', len(msg)) + msg)
proc.stdin.close()
out, err = proc.stdout.read(), proc.stderr.read()
code = proc.wait()
print('Local test (empty PATH):', 'OK' if code == 0 and b'pong' in out else f'FAILED {err.decode()}')
if code != 0:
    raise SystemExit(1)
PY
