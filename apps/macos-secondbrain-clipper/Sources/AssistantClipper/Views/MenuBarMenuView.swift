import ClipCore
import SwiftUI

struct MenuBarMenuView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var store: VaultStore

    var body: some View {
        if !appState.isAccessibilityTrusted {
            Text("Accessibility required for selection clipping")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Open Accessibility Settings…") {
                appState.openAccessibilitySettings()
            }
            Divider()
        }

        let vaults = store.config.vaults
        if vaults.isEmpty {
            Text("Add a vault in Settings")
                .foregroundStyle(.secondary)
        } else {
            ForEach(Array(vaults.enumerated()), id: \.element.id) { index, vault in
                Button {
                    appState.clipToVault(vault.id)
                } label: {
                    HStack {
                        Text(vault.name)
                        Spacer()
                        if let shortcut = vault.shortcut ?? VaultShortcut.defaultForIndex(index) {
                            Text(shortcut.displayLabel)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .keyboardShortcut(menuShortcut(for: index))
            }
        }

        Divider()

        Button("Settings…") {
            appState.openSettings {
                appState.refreshMonitoring()
            }
        }
        .keyboardShortcut(",", modifiers: [.command])

        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
        .keyboardShortcut("q")
    }

    private func menuShortcut(for index: Int) -> KeyboardShortcut {
        let keys: [KeyEquivalent] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map { KeyEquivalent($0) }
        guard index < keys.count else {
            return KeyboardShortcut("0", modifiers: [.command, .shift])
        }
        return KeyboardShortcut(keys[index], modifiers: [.command, .shift])
    }
}
