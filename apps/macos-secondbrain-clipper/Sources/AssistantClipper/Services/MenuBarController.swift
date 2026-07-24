import AppKit
import ClipCore
import Combine
import SwiftUI

@MainActor
final class MenuBarController: NSObject, NSMenuDelegate {
    private let appState: AppState
    private let statusItem: NSStatusItem
    private let menu = NSMenu()
    private var cancellables = Set<AnyCancellable>()

    init(appState: AppState) {
        self.appState = appState
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()

        if let button = statusItem.button {
            button.image = NSImage(
                systemSymbolName: "bookmark.fill",
                accessibilityDescription: "Assistant Clipper"
            )
            button.image?.isTemplate = true
        }

        menu.delegate = self
        statusItem.menu = menu
        rebuildMenu()

        appState.store.$config
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.rebuildMenu() }
            .store(in: &cancellables)
    }

    func menuWillOpen(_ menu: NSMenu) {
        appState.prepareForMenuClip()
    }

    private func rebuildMenu() {
        menu.removeAllItems()

        let vaults = appState.store.config.vaults
        if vaults.isEmpty {
            let item = NSMenuItem(title: "Add a vault in Settings", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
        } else {
            for (index, vault) in vaults.enumerated() {
                let item = NSMenuItem(
                    title: vault.name,
                    action: #selector(vaultSelected(_:)),
                    keyEquivalent: menuKeyEquivalent(for: index)
                )
                item.target = self
                item.representedObject = vault.id
                if index < 9 {
                    item.keyEquivalentModifierMask = [.command, .shift]
                }
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())

        let settings = NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settings.target = self
        menu.addItem(settings)

        let quit = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
    }

    private func menuKeyEquivalent(for index: Int) -> String {
        guard (0..<9).contains(index) else { return "" }
        return String(index + 1)
    }

    @objc private func vaultSelected(_ sender: NSMenuItem) {
        guard let vaultId = sender.representedObject as? String else { return }
        appState.clipToVault(vaultId)
    }

    @objc private func openSettings() {
        appState.openSettings { [weak self] in
            self?.rebuildMenu()
        }
    }

    @objc private func quit() {
        NSApplication.shared.terminate(nil)
    }
}
