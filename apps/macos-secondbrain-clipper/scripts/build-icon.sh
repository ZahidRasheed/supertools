#!/usr/bin/env bash
# Build AppIcon.icns from Resources/AppIcon.png (1024×1024 source)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/Resources/AppIcon.png}"
ICONSET="$ROOT/Resources/AppIcon.iconset"
ICNS="$ROOT/Resources/AppIcon.icns"

if [[ ! -f "$SRC" ]]; then
  echo "Source icon not found: $SRC" >&2
  exit 1
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

python3 << PY
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow', '-q'])
    from PIL import Image

src = Path("$SRC")
iconset = Path("$ICONSET")
img = Image.open(src).convert('RGBA')
w, h = img.size
size = min(w, h)
left = (w - size) // 2
top = (h - size) // 2
img = img.crop((left, top, left + size, top + size))

sizes = {
    'icon_16x16.png': 16,
    'icon_16x16@2x.png': 32,
    'icon_32x32.png': 32,
    'icon_32x32@2x.png': 64,
    'icon_128x128.png': 128,
    'icon_128x128@2x.png': 256,
    'icon_256x256.png': 256,
    'icon_256x256@2x.png': 512,
    'icon_512x512.png': 512,
    'icon_512x512@2x.png': 1024,
}
for name, px in sizes.items():
    img.resize((px, px), Image.Resampling.LANCZOS).save(iconset / name)
print('Iconset written to', iconset)
PY

iconutil -c icns "$ICONSET" -o "$ICNS"
echo "Built $ICNS"
