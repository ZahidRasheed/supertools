# Apps

Monorepo at `/Users/zahidrasheed/Documents/Projects/Apps`

**Operating model:** [docs/OPERATING_MODEL.md](docs/OPERATING_MODEL.md) · **Project catalog:** [docs/REGISTRY.md](docs/REGISTRY.md)

Two apps for reading and clipping:

| App | Folder | What it does |
|-----|--------|--------------|
| **Summary** | `apps/summary/` | Chrome extension — summarize web pages with Gemini |
| **Assistant Clipper** | `apps/macos-clipper/` | macOS menu bar app — clip selected text to Obsidian vaults |

Shared clipping format and vault schema live in `packages/clip-core/`.

---

## Summary (Chrome extension)

### Install

1. Open `chrome://extensions` → **Developer mode** ON
2. **Load unpacked** → select:
   ```
   apps/summary
   ```
3. Pin **Summary** in the toolbar
4. Open **Settings** → add your Gemini API key and prompt

### Use

- Open any article → click the extension icon → **Summarize**

---

## Assistant Clipper (macOS)

System-wide floating popup when you select text (any app). Saves to daily markdown files in your Obsidian vaults.

### Build & install

```bash
cd apps/macos-clipper
./scripts/build-app.sh
./scripts/install.sh
```

Or manually:

```bash
cp -R "apps/macos-clipper/dist/Assistant Clipper.app" /Applications/
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
cd apps/macos-clipper
swift test
```

---

## Development

```bash
# Shared clip format tests (JS)
npm test

# Mac clipper unit tests (Swift)
cd apps/macos-clipper && swift test

# Mac app (debug)
cd apps/macos-clipper && swift build && swift run
```

---

## Project layout

```
apps/
  summary/           Chrome extension (Gemini summaries only)
  macos-clipper/     macOS menu bar clipper
packages/
  clip-core/         Shared clip markdown format + vault schema
scripts/
  migrate-vaults.mjs Import vaults from old extension export
docs/
  OPERATING_MODEL.md Portfolio layout, sharing, Übersicht widgets
  REGISTRY.md        Catalog of all apps and external paths
```
