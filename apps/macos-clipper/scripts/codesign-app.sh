#!/usr/bin/env bash
# Sign an .app bundle. Prefers Developer ID / Apple Development so macOS keeps
# Accessibility permission across rebuilds (same bundle ID + team).
set -euo pipefail

APP_DIR="${1:?Usage: codesign-app.sh /path/to/App.app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTITLEMENTS="$ROOT/scripts/AssistantClipper.entitlements"

pick_signing_identity() {
  local line=""
  line=$(security find-identity -v -p codesigning 2>/dev/null \
    | grep "Developer ID Application" \
    | head -1 || true)
  if [[ -z "$line" ]]; then
    line=$(security find-identity -v -p codesigning 2>/dev/null \
      | grep "Apple Development" \
      | head -1 || true)
  fi
  if [[ -z "$line" ]]; then
    return
  fi
  echo "$line" | sed -E 's/.*"([^"]+)".*/\1/'
}

IDENTITY="$(pick_signing_identity)"

if [[ -n "$IDENTITY" ]]; then
  echo "Signing with: $IDENTITY"
  codesign --force --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$IDENTITY" \
    "$APP_DIR/Contents/MacOS/AssistantClipper"
  codesign --force --sign "$IDENTITY" "$APP_DIR"
  echo "Signed with Apple certificate — Accessibility should persist across updates."
else
  echo "⚠ No code signing certificate found — using ad-hoc signature."
  echo "  Accessibility permission will reset after every rebuild."
  echo "  Fix (one time): open Xcode → Settings → Accounts → add your Apple ID."
  echo "  Then rebuild; Xcode creates a free \"Apple Development\" certificate."
  codesign --force --deep --sign - \
    --entitlements "$ENTITLEMENTS" \
    "$APP_DIR"
fi

codesign --verify --deep --strict "$APP_DIR" 2>/dev/null || codesign --verify "$APP_DIR"
