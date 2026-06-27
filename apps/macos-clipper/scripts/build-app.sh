#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Assistant Clipper"
BUILD_DIR="$ROOT/.build/release"
APP_DIR="$ROOT/dist/${APP_NAME}.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "Running unit tests…"
"$ROOT/scripts/test.sh"

echo "Backing up Assistant settings…"
"$ROOT/../../scripts/backup-assistant-settings.sh" || true

echo "Building app icon…"
"$ROOT/scripts/build-icon.sh"

echo "Building release binary…"
cd "$ROOT"
swift build -c release

echo "Packaging ${APP_NAME}.app…"
rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RESOURCES"

cp "$BUILD_DIR/AssistantClipper" "$MACOS/AssistantClipper"
cp "$ROOT/Sources/AssistantClipper/Resources/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/Resources/AppIcon.icns" "$RESOURCES/AppIcon.icns"

chmod +x "$MACOS/AssistantClipper"

echo "Signing app bundle…"
"$ROOT/scripts/codesign-app.sh" "$APP_DIR"

echo "Built: $APP_DIR"
echo ""
echo "Install: cp -R \"$APP_DIR\" /Applications/"
