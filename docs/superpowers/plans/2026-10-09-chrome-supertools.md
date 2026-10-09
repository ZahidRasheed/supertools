# Chrome Supertools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 Chrome extension **Supertools** with a popup tool menu and one tool that copies current-window `http`/`https` tab URLs to the clipboard (one per line).

**Architecture:** Popup reads a tools registry and renders one button per tool. Pure helpers in `tools/urls.js` filter and format URLs; `tools/copy-all-urls.js` queries tabs, uses those helpers, writes the clipboard, and returns a status string for the popup.

**Tech Stack:** Chrome Extension Manifest V3, vanilla ES modules (no bundler), Node for a tiny assert self-check (no test framework).

**Spec:** `docs/superpowers/specs/2026-10-09-chrome-supertools-design.md`

## Global Constraints

- Product display name: **Supertools**; folder: `apps/chrome-supertools/`
- Manifest V3; no background service worker in v1
- No npm workspace entry; no `packages/` dependency
- Not features inside Summary
- v1 tools: only **Copy all urls**
- Tab scope: `chrome.tabs.query({ currentWindow: true })`, keep only URLs starting with `http://` or `https://`
- Clipboard format: URLs joined with `\n` (no trailing blank line after the last URL)
- Status copy (exact): `Copied N URLs` | `No http(s) tabs in this window` | short error string on failure
- Prefer `navigator.clipboard.writeText` from the popup click; add `clipboardWrite` only if manual smoke proves it is required
- Portfolio docs must be updated when the app is added

## Review Focus

- Tabs with missing/`undefined` `url` (discard; must not throw)
- Mixed list including `chrome://` and `http(s)` (only http(s) appear in clipboard, order preserved among kept tabs)
- Zero matching tabs (status message; clipboard not written)
- Clipboard API rejection (error status; never show success)
- Tab query rejection (error status)

---

## File structure

| Path | Responsibility |
|------|----------------|
| `apps/chrome-supertools/tools/urls.js` | Pure: filter http(s) URLs from tab-like objects; join to clipboard text |
| `apps/chrome-supertools/tools/urls.selfcheck.mjs` | Node assert self-check for `urls.js` |
| `apps/chrome-supertools/tools/copy-all-urls.js` | Async `run()`: query → format → clipboard → status string |
| `apps/chrome-supertools/tools/registry.js` | Export `tools` array |
| `apps/chrome-supertools/popup/popup.html` | Shell: title, `#tools`, `#status` |
| `apps/chrome-supertools/popup/popup.css` | Minimal popup styles |
| `apps/chrome-supertools/popup/popup.js` | Render registry; call `run`; set status text |
| `apps/chrome-supertools/manifest.json` | MV3 manifest |
| `apps/chrome-supertools/icons/*` | 16/48/128 PNG |
| `apps/chrome-supertools/README.md` | Install + add-a-tool |
| `docs/REGISTRY.md`, `README.md`, `.cursor/rules/portfolio-operating-model.mdc` | Portfolio registration |
| Spec status line | Mark approved / plan ready |

---

### Task 1: URL helpers + self-check

**Files:**
- Create: `apps/chrome-supertools/tools/urls.js`
- Create: `apps/chrome-supertools/tools/urls.selfcheck.mjs`
- Test: `apps/chrome-supertools/tools/urls.selfcheck.mjs`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export function httpUrlsFromTabs(tabs: Array<{ url?: string }>): string[]`
  - `export function urlsToClipboardText(urls: string[]): string`
  - `export function copyStatusMessage(count: number): string` — `count > 0` → `Copied ${count} URLs`; else → `No http(s) tabs in this window`
  - Behavior: keep tabs whose `url` starts with `http://` or `https://`, preserve order; join with `\n`; empty array → `""`

- [ ] **Step 1: Write the failing self-check**

In `urls.selfcheck.mjs`, import from `./urls.js` and assert at least:

```js
import assert from 'node:assert/strict';
import { httpUrlsFromTabs, urlsToClipboardText, copyStatusMessage } from './urls.js';

assert.deepEqual(
  httpUrlsFromTabs([
    { url: 'chrome://extensions' },
    { url: 'https://a.example' },
    { url: undefined },
    { url: 'http://b.example' },
    {},
  ]),
  ['https://a.example', 'http://b.example']
);
assert.equal(urlsToClipboardText(['https://a.example', 'http://b.example']), 'https://a.example\nhttp://b.example');
assert.equal(urlsToClipboardText([]), '');
assert.deepEqual(httpUrlsFromTabs([]), []);
assert.equal(copyStatusMessage(2), 'Copied 2 URLs');
assert.equal(copyStatusMessage(0), 'No http(s) tabs in this window');
console.log('urls.selfcheck: ok');
```

- [ ] **Step 2: Run self-check to verify it fails**

Run: `node apps/chrome-supertools/tools/urls.selfcheck.mjs`  
Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Implement `httpUrlsFromTabs`, `urlsToClipboardText`, and `copyStatusMessage` in `apps/chrome-supertools/tools/urls.js`**

ES module exports matching the Interfaces block.

- [ ] **Step 4: Run self-check to verify it passes**

Run: `node apps/chrome-supertools/tools/urls.selfcheck.mjs`  
Expected: `urls.selfcheck: ok`

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-supertools/tools/urls.js apps/chrome-supertools/tools/urls.selfcheck.mjs
git commit -m "$(cat <<'EOF'
feat(supertools): add http(s) URL filter helpers

EOF
)"
```

---

### Task 2: Extension shell + Copy all urls tool

**Files:**
- Create: `apps/chrome-supertools/manifest.json`
- Create: `apps/chrome-supertools/tools/copy-all-urls.js`
- Create: `apps/chrome-supertools/tools/registry.js`
- Create: `apps/chrome-supertools/popup/popup.html`
- Create: `apps/chrome-supertools/popup/popup.css`
- Create: `apps/chrome-supertools/popup/popup.js`
- Create: `apps/chrome-supertools/icons/icon16.png`, `icon48.png`, `icon128.png`
- Create: `apps/chrome-supertools/README.md`
- Modify: `docs/superpowers/specs/2026-10-09-chrome-supertools-design.md` (status → approved; plan linked)

**Interfaces:**
- Consumes: `httpUrlsFromTabs`, `urlsToClipboardText` from Task 1
- Produces:
  - `export async function run(): Promise<string>` in `copy-all-urls.js` — uses `copyStatusMessage` for success/empty; on zero URLs return that message **without** calling clipboard write; on clipboard/query failure return a short error string (do not return success)
  - `export const tools` in `registry.js`: `[{ id: 'copy-all-urls', label: 'Copy all urls', run }]`
  - Popup: heading **Supertools**; one button per `tools` entry using `label`; `#status` shows returned string
  - Manifest: `"name": "Supertools"`, `"manifest_version": 3`, `"action.default_popup": "popup/popup.html"`, permission `"tabs"`, icons wired; `"type": "module"` for popup scripts via `<script type="module">`

- [ ] **Step 1: Implement `run` in `copy-all-urls.js`**

`chrome.tabs.query({ currentWindow: true })` → helpers → `navigator.clipboard.writeText` when `N > 0`.

- [ ] **Step 2: Wire registry, popup HTML/CSS/JS, manifest, README**

README: load unpacked path `apps/chrome-supertools`; how to add a tool (new file + registry entry + permissions if needed).

Icons: generate distinct simple PNGs (do not copy Summary’s brand icons unchanged), or solid-color placeholders at 16/48/128.

Update spec status line to note plan path `docs/superpowers/plans/2026-10-09-chrome-supertools.md`.

- [ ] **Step 3: Re-run helper self-check**

Run: `node apps/chrome-supertools/tools/urls.selfcheck.mjs`  
Expected: `urls.selfcheck: ok`

- [ ] **Step 4: Manual smoke (document result in commit message or leave for user)**

Load unpacked → mix of http(s) + `chrome://` tabs → **Copy all urls** → paste verifies only http(s), order, and status `Copied N URLs`. Repeat with only `chrome://` → status `No http(s) tabs in this window`. If clipboard fails without `clipboardWrite`, add that permission and re-smoke.

- [ ] **Step 5: Commit**

```bash
git add apps/chrome-supertools docs/superpowers/specs/2026-10-09-chrome-supertools-design.md
git commit -m "$(cat <<'EOF'
feat(supertools): ship popup shell and Copy all urls tool

EOF
)"
```

---

### Task 3: Portfolio registration

**Files:**
- Modify: `docs/REGISTRY.md`
- Modify: `README.md`
- Modify: `.cursor/rules/portfolio-operating-model.mdc`
- Modify: `docs/OPERATING_MODEL.md` layout list if it still omits Supertools / Password Bridge (keep consistent with registry)

**Interfaces:**
- Consumes: installed app at `apps/chrome-supertools/`
- Produces: registry row with aliases Supertools, chrome-supertools, copy all urls; type Chrome extension; install = Load unpacked; agent lookup + Current apps table updated

- [ ] **Step 1: Update registry, root README, portfolio Cursor rule (and OPERATING_MODEL layout if needed)**

Follow the “Adding a new row” pattern in `docs/REGISTRY.md`. Root README: table row + short install section mirroring Summary’s style.

- [ ] **Step 2: Sanity-check docs mention the same path `apps/chrome-supertools/`**

- [ ] **Step 3: Commit**

```bash
git add docs/REGISTRY.md README.md .cursor/rules/portfolio-operating-model.mdc docs/OPERATING_MODEL.md
git commit -m "$(cat <<'EOF'
docs: register Chrome Supertools in the portfolio catalog

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Popup + registry host | 2 |
| Copy all urls behavior / status strings | 1 + 2 |
| Pure helper + self-check | 1 |
| No SW / no workspace / separate from Summary | 2 (manifest + structure) |
| Portfolio registration | 3 |
| Extensibility via registry | 2 (README + registry shape) |
| Manual smoke | 2 Step 4 |
