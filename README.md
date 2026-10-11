# Apps

Monorepo at `/Users/zahidrasheed/Documents/Personal/super-tools`

**Operating model:** [docs/OPERATING_MODEL.md](docs/OPERATING_MODEL.md) · **App catalog (source of truth):** [docs/REGISTRY.md](docs/REGISTRY.md)

Agents should use the registry to pick the right app; if unclear, they ask.

| App | Folder | What it does |
|-----|--------|--------------|
| **Summary** | `apps/chrome-summary/` | Chrome extension — summarize web pages with Gemini |
| **Supertools** | `apps/chrome-supertools/` | Chrome extension — small tools (copy all tab URLs, …) |
| **Assistant Clipper** | `apps/macos-secondbrain-clipper/` | macOS menu bar app — clip selected text to Obsidian vaults |
| **Instagram downloader** | `apps/instagram-downloader/` | Download Instagram posts / saved collections (`ig-saved-sync`) |
| **ESP32 / AtomS3R** | `apps/ESP32/` | AtomS3R firmware — Wi‑Fi/MQTT/BLE scale bridge → Home Assistant |

Shared clipping format and vault schema live in `packages/clip-core/`. Desktop widgets are Übersicht (see registry), not this table.

---

## Summary (Chrome extension)

### Install

1. Open `chrome://extensions` → **Developer mode** ON
2. **Load unpacked** → select:
   ```
   apps/chrome-summary
   ```
3. Pin **Summary** in the toolbar
4. Open **Settings** → add your Gemini API key and prompt

### Use

- Open any article → click the extension icon → **Summarize**

---

## Supertools (Chrome extension)

### Install

1. Open `chrome://extensions` → **Developer mode** ON
2. **Load unpacked** → select:
   ```
   apps/chrome-supertools
   ```
3. Pin **Supertools** in the toolbar

### Use

- Click the extension icon → **Copy all open links** or **Copy Link (Cleaned)**

---

## Assistant Clipper (macOS)

System-wide floating popup when you select text (any app). Saves to daily markdown files in your Obsidian vaults.

### Build & install

```bash
cd apps/macos-secondbrain-clipper
./scripts/build-app.sh
./scripts/install.sh
```

Or manually:

```bash
cp -R "apps/macos-secondbrain-clipper/dist/Assistant Clipper.app" /Applications/
open "/Applications/Assistant Clipper.app"
```

### First-time setup

1. **Accessibility** — System Settings → Privacy & Security → Accessibility → enable **Assistant Clipper** (required for selection popup)
2. **Menu bar** — click the bookmark icon → **Settings**
3. **Add vaults** — name, vault folder path, clippings subfolder (as many as you want)
4. **Launch at login** — enabled by default; toggle in Settings if needed

### Import vaults from the old extension

If you exported settings from the previous combined extension:

```bash
node scripts/migrate-vaults.mjs path/to/your-export.json
```

Or use **Import from extension export…** in the Mac app Settings.

Config files:

```
~/Library/Application Support/Assistant/
├── vaults.json      # vault list
└── clipper.json     # launch at login, popup toggle
```

### Clip text

- **Menu bar** → pick a vault → clips **currently selected text** (not clipboard)
- **Global shortcuts** → ⌘⇧1 through ⌘⇧9 for vaults 1–9 (toggle in Settings)
- **Select text** → floating popup (if enabled) → click a vault letter

### Run tests

```bash
cd apps/macos-secondbrain-clipper
swift test
```

---

## Instagram downloader

```bash
cd apps/instagram-downloader
# see apps/instagram-downloader/README.md
```

---

## ESP32 / AtomS3R

Firmware for M5Stack AtomS3R Ext devices (MQTT → Home Assistant, optional RunSTAR scale bridge).

```bash
cd apps/ESP32
# see apps/ESP32/README.md — PlatformIO build/flash
```

---

## Development

```bash
# Shared clip format tests (JS)
npm test

# Mac clipper unit tests (Swift)
cd apps/macos-secondbrain-clipper && swift test

# Mac app (debug)
cd apps/macos-secondbrain-clipper && swift build && swift run
```

---

## Project layout

```
apps/
  chrome-summary/              Chrome extension (Gemini summaries)
  chrome-supertools/           Chrome extension (small tools menu)
  macos-secondbrain-clipper/   macOS menu bar Obsidian clipper
  instagram-downloader/        Instagram download / saved sync CLI
  ESP32/                       AtomS3R firmware (PlatformIO)
packages/
  clip-core/                   Shared clip markdown format + vault schema
scripts/
  migrate-vaults.mjs           Import vaults from old extension export
  backup-assistant-settings.sh
docs/
  OPERATING_MODEL.md           Portfolio layout, sharing, Übersicht
  REGISTRY.md                  Catalog of all apps — keep updated
```
