# Project registry

**Source of truth for which apps exist.** Update this whenever you add, rename, or retire a project.

Monorepo root: `/Users/zahidrasheed/Documents/Personal/Apps`

---

## Apps & libraries

| Name | Aliases / how user may say it | Type | Source path | Install / runtime | Notes |
|------|-------------------------------|------|-------------|-------------------|-------|
| **Summary** | Summary, Chrome extension, Gemini summarizer, side panel | Chrome extension | `apps/summary/` | Chrome → Load unpacked | Gemini API key in extension settings |
| **Assistant Clipper** | Clipper, bookmark menu, Obsidian clip, menu bar clipper | macOS menu bar app | `apps/macos-clipper/` | `/Applications/Assistant Clipper.app` | Config: `~/Library/Application Support/Assistant/` |
| **Instagram downloader** | Instagram, ig-saved-sync, download reel/post, saved sync | Python CLI app | `apps/instagram-downloader/` | `.venv` + CLI in that app | Downloads under `apps/instagram-downloader/downloads/` |
| **clip-core** | shared clip format, vault schema | Shared JS library | `packages/clip-core/` | npm workspace | Used by Summary / clip format tests |

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
| **FootballMatches** | may be active or under `…/Übersicht/disabled-widgets/` | Upcoming matches; moved to disabled once before |

When user says **widgets** / **desktop widgets**, they mean Übersicht.

---

## Quick agent lookup

| User says… | Work here | Unsure? |
|------------|-----------|---------|
| Summary, extension, Gemini summarize | `apps/summary/` | — |
| Clipper, clip, Obsidian, bookmark menu | `apps/macos-clipper/` | — |
| Instagram, download post/reel, saved sync | `apps/instagram-downloader/` | — |
| desktop widget, Übersicht | Übersicht widgets path above | — |
| shared clip format | `packages/clip-core/` | — |
| ambiguous (“the app”, “fix it”, “download”) | — | **Ask which app** |

---

## Agent rule (required)

1. Open this file (or rely on the always-on Cursor rule that points here) when the user mentions work without a clear target.
2. Match aliases in the table above.
3. If more than one app could apply, **ask before changing code or running tools**.
4. When adding a new app: add a row here + update `.cursor/rules/portfolio-operating-model.mdc`.

### Adding a new row

```markdown
| **My App** | short aliases | Chrome extension | `apps/my-app/` | how to run | one-line note |
```

Types: `Chrome extension`, `macOS app`, `Python CLI`, `Übersicht widget`, `Shared library`, `Script`, `Planned`
