# Supertools

Chrome extension with a popup menu of small tools.

**v1 tools**

- **Copy all urls** — copies `http`/`https` tab URLs from the current window to the clipboard (one URL per line).

## Install

1. Open `chrome://extensions` → **Developer mode** ON
2. **Load unpacked** → select:
   ```
   apps/chrome-supertools
   ```
3. Pin **Supertools** in the toolbar

## Use

1. Open the tabs you care about in the current window
2. Click the **Supertools** icon
3. Click **Copy all urls**
4. Paste wherever you need the list

## Add a tool

1. Add `tools/<name>.js` exporting `async function run()` that returns a status string
2. Register `{ id, label, run }` in `tools/registry.js`
3. Add permissions in `manifest.json` only if the new tool needs them
