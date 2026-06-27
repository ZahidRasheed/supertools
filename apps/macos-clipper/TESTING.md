# Testing — Assistant Clipper

How to catch bugs before manual testing in the browser/menu bar.

## Quick command

```bash
cd apps/macos-clipper
bash scripts/test.sh
```

Run this **before every install** (`scripts/install.sh`). Takes ~2 seconds.

---

## What is covered (automated)

| Area | Tests | Catches |
|------|-------|---------|
| **SelectionResolver** | `SelectionResolverTests.swift` | Menu bar clips vault name instead of page text; cache not used when focus moves |
| **BrowserScripts** | `BrowserScriptsTests.swift` | "Where is Arc?" popup when Arc not installed |
| **ClipFormatter** | `ClipFormatterTests.swift` | Wrong markdown shape (title, quotes, URL) |
| **ClipWriter** | `ClipWriterTests.swift` | Vault path / daily file write failures |
| **VaultShortcut** | `VaultShortcutTests.swift` | Wrong ⌘⇧1–9 mapping |

These are **pure logic tests** — no Accessibility permission, no menu bar, no browser required.

---

## What still needs manual checks

Some failures only appear in the real macOS environment:

| Check | Why not automated |
|-------|-------------------|
| Accessibility granted | TCC / code signature — system dialog |
| Menu shows all vaults after add | SwiftUI `MenuBarExtra` refresh (partially mitigated by `touchConfig`) |
| AppleScript can read Chrome tab | Requires Automation permission + real browser |
| Floating popup position | Visual / multi-monitor |
| Signed build keeps Accessibility | Requires Apple cert on machine |

### Manual smoke test (2 min, after install)

1. Select a sentence in Chrome → wait 1s → menu → vault → verify quote body matches selection.
2. Settings → Add vault → close → menu lists new vault.
3. ⌘⇧1 clips without opening menu.

---

## Architecture for testability

Bug-prone logic lives in **ClipCore** (no AppKit):

- `SelectionResolver` — live vs cached selection, vault-name guard
- `BrowserKind` — one AppleScript per browser
- `ClipFormatter` / `ClipWriter` — output format and files

`AppState` wires ClipCore to Accessibility and the menu bar. Keep new rules in ClipCore + add a regression test.

---

## Adding a regression test

When you find a bug manually:

1. Reproduce the **decision** in plain data (text, vault names, frontmost flag).
2. Add a test to `SelectionResolverTests` or `BrowserScriptsTests` named `testRegression…`.
3. Fix the code in ClipCore.
4. Run `bash scripts/test.sh`.

Example (menu stole selection):

```swift
func testMenuOpenUsesCachedSelectionNotVaultName() {
    let result = SelectionResolver.resolve(
        liveText: "Aeven Second Brain",  // focused menu item
        cached: cachedPageSelection,
        clipperFrontmost: true,
        vaultNames: ["Aeven Second Brain"]
    )
    XCTAssertEqual(result, .useCached(cachedPageSelection.payload))
}
```

---

## CI (optional)

From repo root:

```yaml
- name: Clipper tests
  run: cd apps/macos-clipper && swift test
```

---

## Future improvements

- **UI tests**: macOS menu bar apps are awkward; low ROI for now.
- **Snapshot tests** for `ClipFormatter` output golden files.
- **Pre-install hook**: `install.sh` could call `test.sh` and abort on failure.
