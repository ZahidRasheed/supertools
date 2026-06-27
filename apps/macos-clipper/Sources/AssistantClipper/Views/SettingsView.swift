import AppKit
import ClipCore
import SwiftUI

struct SettingsView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var store: VaultStore
    @State private var importError: String?

    var body: some View {
        Form {
            Section("Accessibility") {
                if appState.isAccessibilityTrusted {
                    Label("Enabled — selection clipping works", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Label("Required to read selected text in other apps", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)

                    Text("If you already toggled this on, you may have enabled an older build. Remove every \"Assistant Clipper\" row in System Settings → Privacy & Security → Accessibility, then use Request Access below.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(appState.runningAppPath)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .textSelection(.enabled)

                    HStack {
                        Button("Open System Settings…") {
                            appState.openAccessibilitySettings()
                        }
                        Button("Request Access…") {
                            appState.requestAccessibility(prompt: true)
                        }
                        Button("Refresh status") {
                            appState.refreshAccessibilityStatus()
                        }
                    }
                }
            }

            Section("Clipping") {
                Toggle("Show floating popup on text selection", isOn: $store.preferences.showFloatingToolbar)
                    .onChange(of: store.preferences.showFloatingToolbar) { _ in store.save() }

                Toggle("Global keyboard shortcuts (⌘⇧1–9 per vault)", isOn: $store.preferences.globalShortcutsEnabled)
                    .onChange(of: store.preferences.globalShortcutsEnabled) { _ in store.save() }

                Toggle("Launch at login", isOn: $store.preferences.launchAtLogin)
                    .onChange(of: store.preferences.launchAtLogin) { value in
                        LaunchAtLogin.setEnabled(value)
                        store.save()
                    }
            }

            Section("Vaults") {
                if store.config.vaults.isEmpty {
                    Text("Add at least one Obsidian vault to start clipping.")
                        .foregroundStyle(.secondary)
                }

                ForEach(Array(store.config.vaults.enumerated()), id: \.element.id) { index, vault in
                    VaultEditorRow(
                        vault: binding(for: vault),
                        shortcutLabel: (vault.shortcut ?? VaultShortcut.defaultForIndex(index))?.displayLabel ?? "—",
                        onRemove: { store.removeVault(id: vault.id) },
                        onTest: { store.testVault(vault) }
                    )
                }

                HStack {
                    Button("Add vault") { store.addVault() }
                    Button("Import from extension export…") { importSettings() }
                }
            }

            if !store.statusMessage.isEmpty {
                Section {
                    Text(store.statusMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 580, minHeight: 560)
        .padding()
        .alert("Import failed", isPresented: Binding(
            get: { importError != nil },
            set: { if !$0 { importError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(importError ?? "")
        }
    }

    private func binding(for vault: Vault) -> Binding<Vault> {
        guard let index = store.config.vaults.firstIndex(where: { $0.id == vault.id }) else {
            return .constant(vault)
        }
        return Binding(
            get: { store.config.vaults[index] },
            set: { newValue in
                store.config.vaults[index] = newValue
                store.touchConfig()
            }
        )
    }

    private func importSettings() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.message = "Choose a settings export JSON from the old extension"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try store.importExtensionExport(from: url)
        } catch {
            importError = error.localizedDescription
        }
    }
}

private struct VaultEditorRow: View {
    @Binding var vault: Vault
    let shortcutLabel: String
    let onRemove: () -> Void
    let onTest: () -> Void

    var body: some View {
        GroupBox(vault.name.isEmpty ? "Vault" : vault.name) {
            TextField("Name", text: $vault.name)
            TextField("Vault folder path", text: $vault.path)
            TextField("Clippings folder", text: $vault.clippingsFolder)
            HStack {
                Text("Shortcut")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(shortcutLabel)
                    .foregroundStyle(.secondary)
            }
            HStack {
                Button("Test write", action: onTest)
                Spacer()
                Button("Remove", role: .destructive, action: onRemove)
            }
        }
    }
}
