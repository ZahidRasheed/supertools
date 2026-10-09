# Design: Chrome Supertools

**Status:** Approved (2026-10-09). Implementation plan: `docs/superpowers/plans/2026-10-09-chrome-supertools.md`.

**Product name:** Supertools  
**Source path:** `apps/chrome-supertools/`  
**Type:** Chrome extension (Manifest V3)

---

## Intent

One personal Chrome extension that hosts multiple small tools. v1 ships a discoverable shell plus a single tool. Later tools plug into the same menu without redesigning the host.

**Success criteria**

- Open the extension → see **Copy all urls** → one click copies URLs.
- Only the **current window**.
- Only `http://` and `https://` tabs.
- Clipboard text: one URL per line, left-to-right tab order.
- Empty window / no matching tabs: clear status, no crash.
- Adding another tool later does not require restructuring the popup.

**Out of scope (v1)**

- Keyboard shortcuts
- All Chrome windows
- `chrome://`, extension pages, or other non-http(s) URLs
- Titles or metadata alongside URLs
- Options page, sync storage, background service worker
- npm workspace / shared package
- Shipping inside Summary

---

## Approach

**Popup + tools registry** (chosen over side panel and over “icon runs one action”).

Toolbar icon opens a popup. Tools are registered as `{ id, label, run }`. The popup renders one control per entry and shows a short status message after a run.

---

## Architecture

```
apps/chrome-supertools/
  manifest.json
  popup/
    popup.html
    popup.css
    popup.js
  tools/
    registry.js
    copy-all-urls.js
  icons/
    icon16.png
    icon48.png
    icon128.png
  README.md
```

| Piece | Role |
|-------|------|
| `manifest.json` | MV3; name **Supertools**; `action.default_popup`; permissions as needed for listed tools |
| `popup/*` | Lists tools from the registry; shows status |
| `tools/registry.js` | Ordered list of tools |
| `tools/copy-all-urls.js` | Query tabs → filter → join → clipboard |
| `icons/` | Toolbar / store-style icons (can reuse simple placeholders initially) |
| `README.md` | Load unpacked + how to add a tool |

No background service worker in v1. No `packages/` dependency. Not added to root npm workspaces unless shared code appears later.

---

## Tool: Copy all urls

**Flow**

1. User opens popup and clicks **Copy all urls**.
2. `chrome.tabs.query({ currentWindow: true })`.
3. Keep tabs whose `url` starts with `http://` or `https://`.
4. Join URLs with `\n` (no extra blank line after the last URL).
5. `navigator.clipboard.writeText(text)`.
6. Status: `Copied N URLs`, or `No http(s) tabs in this window`, or a short error string.

**Permissions**

- `tabs` — read tab URLs in the current window.
- Clipboard: prefer `navigator.clipboard.writeText` from the user-gesture popup click; add `clipboardWrite` only if required in practice.

---

## Error handling

| Case | Behavior |
|------|----------|
| No matching tabs | Status: no http(s) tabs; clipboard unchanged |
| Clipboard write fails | Status shows short error; do not pretend success |
| Tab query fails | Status shows short error |

---

## Testing

- Extract filter + join into a small pure helper; cover with a minimal assert self-check or one tiny test file (no framework).
- Manual smoke: load unpacked → several http(s) tabs (+ optional `chrome://`) → copy → paste and verify count, order, and exclusion of non-http(s).

---

## Portfolio registration (when implementing)

1. Add row to `docs/REGISTRY.md` (aliases: Supertools, chrome-supertools, copy all urls).
2. Update root `README.md` table and short install section.
3. Update `.cursor/rules/portfolio-operating-model.mdc`.
4. App README: install steps + “add a tool” note.

**Install:** `chrome://extensions` → Developer mode → Load unpacked → `apps/chrome-supertools/`.

---

## Extensibility

To add a tool later:

1. Add `tools/<name>.js` exporting `run`.
2. Register `{ id, label, run }` in `tools/registry.js`.
3. Add manifest permissions only if that tool needs them.

---

## Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| Host UI | Popup + registry | Matches “extension → pick tool”; cheap to extend |
| v1 tools | Copy all urls only | Confirmed scope A |
| Tab set | Current window, http(s) only | Confirmed |
| Background SW | None in v1 | Unnecessary for popup-driven tools |
| Relation to Summary | Separate app | Different product; keep Summary focused |
