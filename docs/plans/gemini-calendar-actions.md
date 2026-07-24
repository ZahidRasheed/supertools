# Plan: Gemini actions in Assistant Clipper

Parse selected text with Gemini + user prompt → preview → confirm → open calendar (or clip to Obsidian).

**Status:** Not implemented — design for Phase 1.

---

## User story (example)

1. Select text about DHL Stafetten (times, location, date).
2. Menu bar → **Actions** → **Add to calendar…**
3. App sends selection + prompt to Gemini.
4. Preview sheet shows: title, date/time, location, Google Calendar link.
5. User clicks **Add to Google Calendar** → browser opens pre-filled event.
6. Optional: **Save .ics** for Apple Calendar, or **Clip to Obsidian** after confirm.

---

## Why not “direct calendar API” first

| Approach | Pros | Cons |
|----------|------|------|
| **Google Calendar URL** (`action=TEMPLATE`) | No OAuth; one click opens browser; user confirms in Google | Requires Google account; not native Apple Calendar |
| **Download `.ics` file** | Works with Apple Calendar, Outlook | Extra step (open file) |
| **Google Calendar API** | True “add without browser” | OAuth, tokens, complexity |
| **Apple EventKit** | Native Apple Calendar | No Google sync unless user uses iCloud; needs app permissions |

**Phase 1 recommendation:** Gemini returns structured event fields → build **Google Calendar URL** + optional **`.ics`** → user confirms in preview sheet.

---

## Architecture

```mermaid
sequenceDiagram
  participant User
  participant Clipper as Assistant Clipper
  participant AX as SelectionReader
  participant Gemini as Gemini API
  participant Cal as Browser / Calendar

  User->>Clipper: Select text + Actions → Add to calendar
  Clipper->>AX: selectedText()
  AX-->>Clipper: raw text
  Clipper->>Gemini: prompt + text (JSON schema)
  Gemini-->>Clipper: CalendarEvent JSON
  Clipper->>User: Preview sheet
  User->>>Clipper: Confirm
  Clipper->>Cal: Open googleCalendarURL or .ics
```

### New modules (Swift)

```
Sources/ClipCore/           (or new ClipCore target)
  GeminiClient.swift        URLSession → generativelanguage.googleapis.com
  CalendarEvent.swift       Codable model + URL builders

Sources/AssistantClipper/
  Services/ActionRunner.swift     run action on selection
  Views/ActionPreviewWindow.swift  confirm UI
  Models/ActionTemplate.swift     prompt presets
```

Reuse from **Summary** extension (same API, same key pattern):

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Header: `x-goog-api-key`
- Model default: `gemini-2.5-flash`

---

## Gemini prompt strategy

Ask for **JSON only** (easier to parse than free text):

```text
Extract calendar event details from the user's text.
Return ONLY valid JSON matching this schema:
{
  "title": string,
  "startISO8601": string,   // e.g. 2026-08-26T18:00:00+02:00
  "endISO8601": string,
  "location": string,
  "description": string,
  "allDay": boolean
}
Use Europe/Copenhagen timezone if not specified. If multiple times (runners/walkers), prefer the earliest start and a reasonable end (e.g. 4 hours).
```

System prompt templates stored as **Action templates** in settings:

| ID | Label | Use |
|----|-------|-----|
| `calendar` | Add to Google Calendar | Event extraction |
| `custom` | Run custom prompt… | User-editable prompt |

---

## Google Calendar link builder

Format (no API key needed):

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text={title}
  &dates={startUTC}/{endUTC}
  &details={description}
  &location={location}
```

`dates` must be `YYYYMMDDTHHMMSSZ` in UTC (convert from ISO8601).

Example for DHL Relay, Aug 26 2026 18:00–22:00 Copenhagen (UTC+2):

- Start: `20260826T160000Z`
- End: `20260826T200000Z`

---

## Settings additions

Store in `~/Library/Application Support/Assistant/clipper.json` or new `gemini.json`:

```json
{
  "apiKey": "",          
  "model": "gemini-2.5-flash",
  "actionsEnabled": true
}
```

**API key:** store in **Keychain** (not plain JSON) — same security bar as Summary.

---

## UI flow (Phase 1)

### Menu bar

```
Clip selection to…     (existing vaults)
─────────────────
Actions ▶
  Add to calendar…     ⌘⌥C
  Custom prompt…
─────────────────
Settings…
Quit
```

### Preview window (after Gemini returns)

```
┌─ Add to calendar ─────────────────────┐
│ Title:    DHL Relay (DHL Stafetten)   │
│ Start:    Wed 26 Aug 2026, 18:00      │
│ End:      Wed 26 Aug 2026, 22:00      │
│ Location: Fælledparken, Øster Allé    │
│                                       │
│ [ Open in Google Calendar ]  (primary)│
│ [ Save .ics file ]                    │
│ [ Cancel ]                            │
└───────────────────────────────────────┘
```

No auto-add without confirm.

---

## Implementation phases

### Phase 1 — MVP (1–2 sessions)

- [ ] Keychain storage for Gemini API key in Clipper settings
- [ ] `GeminiClient` + `CalendarEvent` parse
- [ ] Menu item **Add to calendar…** on current selection
- [ ] Preview window + **Open in Google Calendar**
- [ ] Error toasts (no key, no selection, bad JSON)

### Phase 2

- [ ] `.ics` export + open with default calendar app
- [ ] Custom prompt action (textarea → Gemini → show result)
- [ ] Optional: second button “Clip summary to Obsidian” after confirm

### Phase 3

- [ ] Action templates editable in Settings
- [ ] Floating popup: calendar icon next to vault letters
- [ ] Share `GeminiClient` pattern doc with Summary extension

### Phase 4 (optional)

- [ ] Google Calendar API + OAuth (true silent add)
- [ ] Apple EventKit integration

---

## Testing

| Layer | Test |
|-------|------|
| `CalendarEvent` URL builder | Unit test fixed ISO → expected Google URL |
| JSON parse | Fixture JSON from Gemini sample |
| Gemini | Manual with DHL text; mock URLSession in unit tests |
| E2E | Select text → menu → preview → link opens in browser |

Add Swift tests in `ClipCoreTests` for URL/ics builders (no network).

---

## Getting started (developer)

1. Add **Gemini API key** field to Clipper Settings (Keychain).
2. Copy minimal `GeminiClient` from Summary’s `lib/gemini.js` logic into Swift.
3. Implement **one action**: `CalendarAction.run(text:) async throws -> CalendarEvent`.
4. Add **preview window** + open URL.
5. Test with your DHL Relay paragraph.

Command to run tests after changes:

```bash
cd apps/macos-secondbrain-clipper && swift test
```

---

## Open questions

1. **Same API key as Summary?** — Convenient if one Keychain entry `assistant.gemini.apiKey` shared by Summary + Clipper (future).
2. **Rename app?** — “Assistant Clipper” → “Assistant” if it does clip + actions (product decision).
3. **Default calendar** — Google vs Apple: offer both buttons in preview.

---

## Related

- Summary extension Gemini client: `apps/chrome-summary/lib/gemini.js`
- Operating model: `docs/OPERATING_MODEL.md`
