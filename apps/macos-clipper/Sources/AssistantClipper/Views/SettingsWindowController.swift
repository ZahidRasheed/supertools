import AppKit
import SwiftUI

@MainActor
final class SettingsWindowController: NSWindowController, NSWindowDelegate {
    static let shared = SettingsWindowController()

    private var onClose: (() -> Void)?

    private init() {
        super.init(window: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    func windowWillClose(_ notification: Notification) {
        store?.save()
        onClose?()
        onClose = nil
        NSApp.setActivationPolicy(.accessory)
    }

    private weak var store: VaultStore?
    private weak var appState: AppState?

    func show(appState: AppState, store: VaultStore, onClose: @escaping () -> Void) {
        self.appState = appState
        self.store = store
        self.onClose = onClose

        if window == nil {
            let host = NSHostingController(rootView: SettingsView(appState: appState, store: store))
            let panel = NSWindow(contentViewController: host)
            panel.title = "Assistant Clipper Settings"
            panel.styleMask = [.titled, .closable, .miniaturizable]
            panel.setContentSize(NSSize(width: 580, height: 540))
            panel.center()
            panel.isReleasedWhenClosed = false
            panel.delegate = self
            window = panel
        } else {
            window?.contentViewController = NSHostingController(rootView: SettingsView(appState: appState, store: store))
        }

        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        appState.refreshAccessibilityStatus()
    }
}
