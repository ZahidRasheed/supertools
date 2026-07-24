#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_SRC="$SCRIPT_DIR/../dist/Assistant Clipper.app"
APP_DEST="/Applications/Assistant Clipper.app"

if [[ ! -d "$APP_SRC" ]]; then
  echo "Run scripts/build-app.sh first." >&2
  exit 1
fi

echo "Backing up Assistant settings…"
"$REPO_ROOT/scripts/backup-assistant-settings.sh" || true

echo "Quitting any running copy…"
pkill -x AssistantClipper 2>/dev/null || true
sleep 0.5

if [[ -d "$APP_DEST" ]]; then
  echo "Updating $APP_DEST in place (keeps the same install location)…"
  cp "$APP_SRC/Contents/MacOS/AssistantClipper" "$APP_DEST/Contents/MacOS/AssistantClipper"
  cp "$APP_SRC/Contents/Info.plist" "$APP_DEST/Contents/Info.plist"
  if [[ -f "$APP_SRC/Contents/Resources/AppIcon.icns" ]]; then
    cp "$APP_SRC/Contents/Resources/AppIcon.icns" "$APP_DEST/Contents/Resources/AppIcon.icns"
  fi
  chmod +x "$APP_DEST/Contents/MacOS/AssistantClipper"
  "$SCRIPT_DIR/codesign-app.sh" "$APP_DEST"
else
  echo "Installing to $APP_DEST…"
  cp -R "$APP_SRC" "$APP_DEST"
fi

echo "Opening app…"
open "$APP_DEST"

IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null | grep -E "Developer ID Application|Apple Development" | head -1 || true)
echo ""
if [[ -n "$IDENTITY" ]]; then
  echo "Signed with an Apple certificate — you should NOT need to re-enable Accessibility after updates."
  echo "If macOS asks once after this install, allow it; later rebuilds should stick."
else
  echo "This build is ad-hoc signed (no Apple certificate on this Mac)."
  echo "Accessibility will reset on every rebuild until you:"
  echo "  1. Open Xcode → Settings → Accounts → add your Apple ID"
  echo "  2. Run scripts/build-app.sh && scripts/install.sh again"
  echo "  3. Grant Accessibility once — then future updates should keep it"
fi
