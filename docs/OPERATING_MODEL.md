# Operating model — personal app portfolio

How we organize, build, maintain, and share apps across this workspace and related locations on your Mac.

---

## 1. Portfolio layers

```mermaid
flowchart TB
  subgraph monorepo ["Monorepo — ~/Documents/Personal/Apps"]
    APPS[apps/ — shippable products]
    PKG[packages/ — shared libraries]
    SCR[scripts/ — cross-app tooling]
    DOC[docs/ — operating model + registry]
  end

  subgraph external ["External / runtime locations"]
    UBER["Übersicht widgets"]
    APPDATA["~/Library/Application Support/…"]
    CHROME[Chrome profile / extensions]
  end

  subgraph share ["Sharing with others"]
    REL[Release bundle — no secrets]
    SETUP[Friend setup doc per app]
  end

  APPS --> APPDATA
  APPS --> CHROME
  UBER -. optional link .-> APPS
  APPS --> REL
  REL --> SETUP
```

| Layer | Path | Purpose |
|-------|------|---------|
| **Monorepo** | `/Users/zahidrasheed/Documents/Personal/Apps` | Default home for extensions, Mac apps, shared packages |
| **Satellite** | Other paths (see [REGISTRY.md](./REGISTRY.md)) | Tools with their own install location (Übersicht, etc.) |
| **Runtime data** | `~/Library/Application Support/…` | User config, vaults, caches — never committed |
| **Exports / backups** | `exports/` in monorepo | Optional JSON exports; scrub secrets before sharing |
| **Settings backups** | `exports/backups/<timestamp>/` | Auto-created before clipper build/install (gitignored) |

### Back up settings before risky changes

Assistant Clipper stores vaults and preferences outside git:

```
~/Library/Application Support/Assistant/
  vaults.json
  clipper.json
```

Before installs or config edits, run:

```bash
bash scripts/backup-assistant-settings.sh
```

`apps/macos-clipper/scripts/build-app.sh` and `install.sh` run this automatically. Restore from `exports/backups/<timestamp>/` if needed.

---

## 2. What goes where

### Put in the monorepo (`Apps/`)

- Chrome extensions → `apps/<name>/`
- macOS apps → `apps/<name>/`
- Code shared by 2+ products → `packages/<name>/`
- One-off migration/setup scripts → `scripts/`
- Portfolio docs → `docs/`

### Put outside the monorepo

| Type | Why | Example |
|------|-----|---------|
| **Übersicht widgets** | Übersicht only loads from its widgets folder | See §3 |
| **Third-party plugin configs** | Owned by another app | Obsidian plugins, HA config |
| **Personal data** | Secrets, vault paths, API keys | `~/Library/Application Support/Assistant/` |

### Naming

- Folder names: lowercase, hyphenated (`macos-clipper`, not `MacOS Clipper`)
- Product display names: user-facing (`Summary`, `Assistant Clipper`)
- Shared packages: `@assistant/<name>` in `package.json` (JS) or Swift target `ClipCore`

---

## 3. Übersicht desktop widgets

**Übersicht** is a separate macOS app. Widgets must live where it expects them:

```
/Users/zahidrasheed/Library/Application Support/Übersicht/widgets/
```

When you ask to change **desktop widgets**, work in that folder (or in monorepo source if we add a deploy step — see below).

Current widgets (see registry): `FootballMatches`, `Countdown`, `home-assistant.jsx`, `screvi-remember.coffee`, etc.

### Recommended pattern (for sharing & git)

Keep **source** in monorepo, **deploy** to Übersicht:

```
apps/ubersicht-widgets/
  FootballMatches/
  Countdown/
  deploy.sh          # rsync or cp → Übersicht widgets folder
```

Until migrated, treat the Übersicht folder as **canonical runtime** and document widgets in [REGISTRY.md](./REGISTRY.md).

---

## 4. Monorepo layout (current)

```
Apps/
├── apps/
│   ├── summary/              Chrome extension (Gemini summaries)
│   └── macos-clipper/        macOS menu bar clipper
├── packages/
│   └── clip-core/            Shared clip format (JS) + tests
├── scripts/
│   └── migrate-vaults.mjs
├── docs/
│   ├── OPERATING_MODEL.md    ← this file
│   └── REGISTRY.md           ← catalog of all projects
├── exports/                  Local backups (gitignore secrets)
├── package.json              npm workspaces root
└── README.md                 Quick start per app
```

---

## 5. Development workflow

### Adding a new app

1. Add row to `docs/REGISTRY.md`
2. Create `apps/<name>/` with its own README section
3. If it shares logic with an existing app → extract to `packages/`
4. Add tests (unit at minimum for shared packages)
5. Update root `README.md` table

### Changing an app

1. Check **REGISTRY.md** for path and type
2. Run that app's tests before finishing
3. Bump version in manifest / Info.plist when shipping to yourself
4. Reinstall steps: extension reload, `install.sh`, or widget refresh in Übersicht

### AI / Cursor agent

- Read `docs/REGISTRY.md` first when the request mentions an app by name
- **Desktop widgets** → Übersicht path (§3)
- **Summary / extension** → `apps/summary/`
- **Clipper / Obsidian clip** → `apps/macos-clipper/`
- Do not commit API keys, vault paths, or `exports/` with personal data unless explicitly requested

---

## 6. Sharing with a friend

### Principles

| Do share | Do not share |
|----------|----------------|
| Source code (zip or git) | API keys, tokens |
| README + setup steps | Your Obsidian vault paths |
| Default/example config | `exports/` with your prompts |
| Build/install scripts | `~/Library/Application Support/…` files |

### Per product type

| Type | Friend receives | Friend does |
|------|-----------------|-------------|
| **Chrome extension** | `apps/<name>/` folder or release zip | Load unpacked in Chrome; add own API key in Options |
| **macOS app** | `.app` in zip or build from source | Copy to Applications; configure vaults in Settings |
| **Übersicht widget** | Widget folder | Copy into their `Übersicht/widgets/`; refresh Übersicht |
| **Shared package** | Included in monorepo | Usually not used alone |

### Release checklist (before sharing)

- [ ] Remove / redact secrets from code and sample configs
- [ ] `README` with install + minimum setup
- [ ] Version number bumped
- [ ] Tests pass (`npm test`, `swift test`, etc.)
- [ ] Optional: tag git release `summary-v2.0.0`, `clipper-v1.1.0`

### Future: GitHub

- One repo (`Apps`) with optional **release assets** per app
- Or split repos only when a friend needs a single app without the monorepo — prefer subtree or release zip first

---

## 7. Configuration boundaries

| App | Config location | In git? |
|-----|-----------------|---------|
| Summary | Chrome `storage.sync` | No |
| Assistant Clipper | `~/Library/Application Support/Assistant/` | No |
| Übersicht widgets | Often hardcoded in widget or local JSON | Source in git; personal URLs maybe not |

Use **export/import JSON** for portable settings (API keys excluded), like Summary settings export and vault migration script.

---

## 8. Testing strategy

| Scope | Command | When |
|-------|---------|------|
| JS shared packages | `npm test` (root) | Any change to `packages/` |
| Mac clipper | `cd apps/macos-clipper && swift test` | Clip format / writer changes |
| Chrome extension | Manual smoke test in Chrome | UI or background changes |
| Übersicht widgets | Refresh widget in Übersicht | After edit |

Add tests when adding shared logic — prevents regressions when new apps reuse packages.

---

## 9. Versioning

- **Chrome extension**: `manifest.json` → `version`
- **macOS app**: `Info.plist` → `CFBundleShortVersionString`
- **Widgets**: optional `version` in widget readme or comment
- **Monorepo**: no single version; each app versions independently

---

## 10. Decision log (template)

When we make a structural choice, add a line here:

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-27 | Monorepo at `~/Documents/Projects/Apps` | Summary + Clipper share clip format |
| 2026-06-27 | Split Summary (Chrome) vs Assistant Clipper (Mac) | Different runtimes & permissions |
| 2026-06-27 | Übersicht widgets stay in Application Support path | Übersicht requirement; registry documents them |
