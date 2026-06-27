#!/usr/bin/env bash
# Backup Assistant Clipper runtime settings before installs or risky changes.
# Settings live outside git: ~/Library/Application Support/Assistant/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${ASSISTANT_SETTINGS_DIR:-$HOME/Library/Application Support/Assistant}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="$ROOT/exports/backups/$STAMP"

if [[ ! -d "$SOURCE" ]]; then
  echo "No settings folder at: $SOURCE" >&2
  exit 0
fi

shopt -s nullglob
FILES=("$SOURCE"/*.json)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No JSON settings to backup in: $SOURCE" >&2
  exit 0
fi

mkdir -p "$DEST"
cp "${FILES[@]}" "$DEST/"

cat > "$DEST/README.txt" <<EOF
Assistant Clipper settings backup
Created: $STAMP
Source:  $SOURCE

Restore:
  cp "$DEST"/*.json "$SOURCE/"
  Then restart Assistant Clipper.
EOF

echo "Backed up ${#FILES[@]} file(s) to:"
echo "  $DEST"
ls -1 "$DEST"
