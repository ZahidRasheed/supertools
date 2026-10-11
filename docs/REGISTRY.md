# Project registry

**Source of truth for which apps exist.** Update this whenever you add, rename, or retire a project.

Monorepo root: `/Users/zahidrasheed/Documents/Personal/super-tools`

---

## Apps & libraries

| Name | Aliases / how user may say it | Type | Source path | Install / runtime | Notes |
|------|-------------------------------|------|-------------|-------------------|-------|
| **Summary** | Summary, Chrome Summary, chrome-summary, Gemini summarizer, side panel | Chrome extension | `apps/chrome-summary/` | Chrome → Load unpacked | Was `apps/summary/` |
| **Supertools** | Supertools, chrome-supertools, copy all open links, copy link cleaned | Chrome extension | `apps/chrome-supertools/` | Chrome → Load unpacked | Popup tools; copy open links, clean active URL |
| **Assistant Clipper** | Clipper, Second Brain clipper, macos-secondbrain-clipper, Obsidian clip, bookmark menu | macOS menu bar app | `apps/macos-secondbrain-clipper/` | `/Applications/Assistant Clipper.app` | Was `apps/macos-clipper/`; config: `~/Library/Application Support/Assistant/` |
| **Instagram downloader** | Instagram, ig-saved-sync, download reel/post, saved sync | Python CLI app | `apps/instagram-downloader/` | `.venv` + CLI in that app | Downloads under `apps/instagram-downloader/downloads/` |
| **ESP32 / AtomS3R** | ESP32, AtomS3R, Atom, scale bridge, RunSTAR, house fleet | Embedded firmware (PlatformIO) | `apps/ESP32/` | Flash via PlatformIO; MQTT → Home Assistant | AtomS3R Ext fleet; scale BLE → MQTT |
| **clip-core** | shared clip format, vault schema | Shared JS library | `packages/clip-core/` | npm workspace | Clip format + vault helpers; Mac clipper has Swift twin |

## Planned

| Name | Status | Doc |
|------|--------|-----|
| **Gemini calendar actions** | Not built | `docs/plans/gemini-calendar-actions.md` |

## Übersicht desktop widgets

**Always edit here (not in monorepo unless asked to sync):**

```
~/Library/Application Support/Übersicht/widgets/
```

| Name | Path under widgets/ | Notes |
|------|---------------------|-------|
| **Countdown** | `Countdown/` | Active |
| **home-assistant** | `home-assistant.jsx` | May contain local HA URLs |
| **screvi-remember** | `screvi-remember.coffee` | Active |
| **GettingStarted** | `GettingStarted.jsx` | Sample |
| **FootballMatches** | active or `…/Übersicht/disabled-widgets/` | Upcoming matches |

When user says **widgets** / **desktop widgets**, they mean Übersicht.

---

## Quick agent lookup

| User says… | Work here | Unsure? |
|------------|-----------|---------|
| Summary, chrome-summary, Gemini summarize | `apps/chrome-summary/` | — |
| Supertools, chrome-supertools, copy all open links, copy link cleaned | `apps/chrome-supertools/` | — |
| Clipper, Second Brain clip, Obsidian bookmark menu | `apps/macos-secondbrain-clipper/` | — |
| Instagram, download post/reel, saved sync | `apps/instagram-downloader/` | — |
| ESP32, Atom, AtomS3R, scale, RunSTAR | `apps/ESP32/` | — |
| desktop widget, Übersicht | Übersicht widgets path above | — |
| shared clip format | `packages/clip-core/` | — |
| ambiguous (“the app”, “fix it”, “download”) | — | **Ask which app** |

### Renames (historical)

| Old path | New path |
|----------|----------|
| `apps/summary/` | `apps/chrome-summary/` |
| `apps/macos-clipper/` | `apps/macos-secondbrain-clipper/` |

---

## Agent rule (required)

1. Open this file (or rely on the always-on Cursor rule that points here) when the user mentions work without a clear target.
2. Match aliases in the table above.
3. If more than one app could apply, **ask before changing code or running tools**.
4. When adding or renaming an app: update this file + `.cursor/rules/portfolio-operating-model.mdc` + root `README.md` + `package.json` workspaces if needed.

### Adding a new row

```markdown
| **My App** | short aliases | Chrome extension | `apps/my-app/` | how to run | one-line note |
```

Types: `Chrome extension`, `macOS app`, `Python CLI`, `Embedded firmware`, `Übersicht widget`, `Shared library`, `Script`, `Planned`
