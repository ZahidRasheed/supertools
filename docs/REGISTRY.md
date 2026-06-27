# Project registry

Catalog of apps and widgets. **Update this when adding or retiring a project.**

| Name | Type | Source path | Install / runtime | Shareable | Notes |
|------|------|-------------|-------------------|-----------|-------|
| **Summary** | Chrome extension | `apps/summary/` | Chrome → Load unpacked | Yes | Gemini API key per user |
| **Assistant Clipper** | macOS menu bar app | `apps/macos-clipper/` | `/Applications/Assistant Clipper.app` | Yes | Config: `~/Library/Application Support/Assistant/` |
| **clip-core** | Shared JS library | `packages/clip-core/` | npm workspace | Yes | Clip markdown format + vault schema |
| **Gemini calendar actions** | Planned (Clipper) | `docs/plans/gemini-calendar-actions.md` | — | — | Not built yet |
| **FootballMatches** | Übersicht widget | `/Users/zahidrasheed/Library/Application Support/Übersicht/widgets/FootballMatches/` | Übersicht desktop | Yes | Desktop widget — not in monorepo yet |
| **Countdown** | Übersicht widget | `…/Übersicht/widgets/Countdown/` | Übersicht desktop | Yes | |
| **home-assistant** | Übersicht widget | `…/Übersicht/widgets/home-assistant.jsx` | Übersicht desktop | Maybe | May contain local HA URLs |
| **screvi-remember** | Übersicht widget | `…/Übersicht/widgets/screvi-remember.coffee` | Übersicht desktop | Yes | CoffeeScript widget |

**Übersicht widgets root (always):**

```
/Users/zahidrasheed/Library/Application Support/Übersicht/widgets/
```

---

## Quick agent lookup

| You say… | Work here |
|----------|-----------|
| desktop widget, Übersicht, desktop | Übersicht widgets path above |
| Summary, extension, Chrome, Gemini | `apps/summary/` |
| Clipper, clip, Obsidian, menu bar | `apps/macos-clipper/` |
| shared clip format | `packages/clip-core/` |
| operating model, where does X live | `docs/OPERATING_MODEL.md` |

---

## Adding a new row

```markdown
| **My App** | Chrome extension | `apps/my-app/` | Chrome load unpacked | Yes | One-line note |
```

Types: `Chrome extension`, `macOS app`, `Übersicht widget`, `Shared library`, `Script`, `External repo`
