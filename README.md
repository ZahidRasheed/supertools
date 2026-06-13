# News Reader AI

A local Chrome extension that summarizes any web page using the **Gemini API**. It opens as a **side panel** on the right (like Claude for Chrome), caches summaries for **30 days** per URL, and lets you customize prompts.

## Features

- **Side panel UI** — click the extension icon to open a docked panel on the right
- **Smart content extraction** — pulls main article text, skips nav/ads/sidebars
- **Smart API usage** — short pages sent in one request; long articles use map-reduce chunking
- **30-day cache** — same URL + same prompt returns instantly without another API call
- **Edit prompt** — one-time prompt override that forces a fresh summary
- **Settings** — permanent default prompt, API key, and model selection
- **Obsidian clippings** — clip selected text to a daily markdown file in your vault

## Obsidian clippings

Clip any selected text into `Clippings/YYYY-MM-DD.md` inside an Obsidian vault. Multiple vaults supported.

### Two ways to write files

| Method | Best for | Requirements |
|--------|----------|--------------|
| **Native host** (recommended) | Multiple vaults, works without Obsidian open | One-time install script |
| **Obsidian REST API** | Quick setup if Obsidian is already open | [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin |

**Auto** mode tries native host first, then REST API.

### Setup

1. Open **Settings → Obsidian Clippings**
2. Click **+ Add vault** for each vault:
   - **Name** — label shown in menus (e.g. `Second Brain`)
   - **Vault folder path** — absolute path on disk (for native write), e.g. `/Users/you/Documents/Obsidian/Second Brain`
   - **Clippings folder** — subfolder inside vault (default: `Clippings`)
   - **REST API URL / key** — optional, from the Local REST API plugin settings
3. Pick a **Default vault**
4. Save settings

### Install native host (macOS / Linux)

```bash
cd native-host
./install.sh YOUR_EXTENSION_ID
```

Find `YOUR_EXTENSION_ID` at `chrome://extensions` (Developer mode ON). Restart Chrome after installing.

### Clip text

- **Right-click** selected text → **Clip to Obsidian** → choose vault
- Or open the side panel → select text on page → choose vault → **Clip**

Each clip appends to today's file with source URL, page title, and timestamp.

## Setup (local, unpublished)

1. **Get a Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).

2. **Load the extension in Chrome:**
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select this folder: `ChromeNewsReader`

3. **Configure settings:**
   - Click the extension icon → open the side panel
   - Click the settings (gear) icon, or right-click the extension → **Options**
   - Paste your API key and customize the permanent prompt
   - Save

4. **Use it:**
   - Navigate to any article or news page
   - Open the side panel (extension icon)
   - Click **Summarize**
   - Use **Edit prompt** to add one-time instructions and force a new summary

## How smart text handling works

| Page size | Strategy |
|-----------|----------|
| Under ~120k characters | Single Gemini request with title, URL, and full content |
| Over ~120k characters | Split at paragraph boundaries → summarize each chunk → combine into final summary |

Content is extracted from semantic HTML (`article`, `main`, etc.) with noise elements removed. Very long single requests are middle-truncated as a fallback.

## Cache behavior

- Cached by **normalized URL** (one summary per page for 30 days)
- Legacy entries keyed by URL + prompt are still found automatically
- TTL: **30 days**
- **Summarize** uses cache when available
- **Edit prompt → Apply & Summarize** or the refresh button forces a new API call
- Changing the permanent prompt in Settings creates a new cache key (old entries remain until expiry)

## Project structure

```
manifest.json          Extension manifest (MV3)
background.js          Service worker: API calls, cache, messaging
content.js             Page content extraction
sidepanel/             Side panel UI
options/               Settings page
lib/
  gemini.js            Gemini API client + map-reduce
  text-processor.js    Chunking and prompt building
  cache.js             30-day local storage cache
  utils.js             Shared helpers
icons/                 Extension icons
```

## Permissions

| Permission | Why |
|------------|-----|
| `sidePanel` | Right-side panel UI |
| `storage` | Settings + summary cache |
| `tabs` / `activeTab` / `scripting` | Read active tab content |
| `<all_urls>` | Extract content from any page you visit |

## Notes

- This extension is intended for **personal local use** — not published to the Chrome Web Store
- API keys stay in your browser (`chrome.storage.sync`); only sent to Google's Gemini API
- Restricted pages (`chrome://`, Chrome Web Store, etc.) cannot be summarized
