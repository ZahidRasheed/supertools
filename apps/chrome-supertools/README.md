# Supertools

Chrome extension with a popup menu of small tools.

**Tools**

- **Copy all open links** — copies `http`/`https` tab URLs from the current window (blank line between each)
- **Copy Link (Cleaned)** — copies the active tab URL with query string and hash removed (origin + path only)

## Install

1. Open `chrome://extensions` → **Developer mode** ON
2. **Load unpacked** → select:
   ```
   apps/chrome-supertools
   ```
3. Pin **Supertools** in the toolbar

## Use

1. Click the **Supertools** (robot) icon
2. Pick a tool
3. Paste wherever you need the result

## Add a tool

1. Add `tools/<name>.js` exporting `async function run()` that returns a status string
2. Register `{ id, label, icon, run }` in `tools/registry.js` (add an SVG key in `tools/icons.js` if needed)
3. Add permissions in `manifest.json` only if the new tool needs them
