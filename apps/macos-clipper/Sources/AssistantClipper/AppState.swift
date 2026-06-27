import AppKit
import ClipCore
import Combine
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var toastMessage: String?
    @Published private(set) var accessibilityTrusted: Bool = SelectionReader.isTrusted

    let store = VaultStore()
    private let popup = PopupPanelController()
    private let toast = ToastPanelController()
    private let monitor = SelectionMonitor()
    private let hotKeys = HotKeyManager()
    private var pendingText: String = ""
    private var cachedSelection: ClipCore.CachedSelection?
    private var lastContentApp: ContentAppSnapshot?
    private var lastSeenContentApp: NSRunningApplication?

    private var accessibilityObserver: NSObjectProtocol?
    private var workspaceObserver: NSObjectProtocol?
    private var cancellables = Set<AnyCancellable>()

    init() {
        store.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)

        store.$config
            .dropFirst()
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.refreshMonitoring()
            }
            .store(in: &cancellables)

        start()
    }

    deinit {
        if let accessibilityObserver {
            NotificationCenter.default.removeObserver(accessibilityObserver)
        }
        if let workspaceObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(workspaceObserver)
        }
    }

    func start() {
        NSApp.setActivationPolicy(.accessory)

        if store.preferences.launchAtLogin {
            LaunchAtLogin.setEnabled(true)
        }

        configurePopup()
        configureHotKeys()
        configureMonitor()
        observeAccessibilityChanges()
        observeWorkspaceChanges()
        refreshAccessibilityStatus()

        if !accessibilityTrusted {
            NSLog("Assistant Clipper: Accessibility not granted — selection clipping disabled until enabled in System Settings.")
            NSLog("Assistant Clipper: Running from \(Bundle.main.bundlePath)")
        }
    }

    func refreshMonitoring() {
        monitor.isPopupEnabled = store.preferences.showFloatingToolbar
        configurePopup()
        configureHotKeys()
    }

    var isAccessibilityTrusted: Bool {
        accessibilityTrusted
    }

    var runningAppPath: String {
        Bundle.main.bundlePath
    }

    func refreshAccessibilityStatus() {
        let trusted = SelectionReader.isTrusted
        if accessibilityTrusted != trusted {
            accessibilityTrusted = trusted
        }
    }

    private func observeWorkspaceChanges() {
        workspaceObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor in
                guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                      !SelectionReader.isClipper(app) else { return }
                self?.lastSeenContentApp = app
            }
        }
    }

    private func contentAppForCapture() -> NSRunningApplication? {
        if let app = SelectionReader.frontmostNonClipperApplication() {
            lastSeenContentApp = app
            return app
        }
        return lastSeenContentApp
    }

    private func observeAccessibilityChanges() {
        accessibilityObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: NSApp,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.refreshAccessibilityStatus()
            }
        }
    }

    func openAccessibilitySettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    func requestAccessibility(prompt: Bool) {
        _ = SelectionReader.requestTrust(prompt: prompt)
        refreshAccessibilityStatus()
    }

    /// Called on bookmark mouse-down, before the menu opens and focus moves away.
    func prepareForMenuClip() {
        guard SelectionReader.isTrusted else { return }
        captureSelectionFromContentApp()
    }

    /// Clip the current text selection (not clipboard) to a vault.
    func clipToVault(_ vaultId: String) {
        guard ensureAccessibilityForClip() else { return }

        // Menu path: selection was captured on bookmark mouse-down. Hotkey path: read now.
        if cachedSelection == nil {
            captureSelectionFromContentApp()
        }

        guard let payload = resolvedSelection(preferCache: true) else {
            showToast("Select some text first, then choose a vault.")
            return
        }

        clip(to: vaultId, text: payload.text, pageTitle: payload.pageTitle, pageUrl: payload.pageUrl)
    }

    private func captureSelectionFromContentApp() {
        guard SelectionReader.isTrusted else { return }

        guard let app = contentAppForCapture() else { return }
        let pid = pid_t(app.processIdentifier)
        let source = SourceContext.from(app: app)
        let snapshot = ContentAppSnapshot(
            pid: pid,
            bundleIdentifier: app.bundleIdentifier,
            localizedName: app.localizedName ?? "Unknown",
            pageTitle: source.title,
            pageUrl: source.url
        )
        lastContentApp = snapshot

        let vaultNames = store.config.vaults.map(\.name)
        guard let text = SelectionReader.bestAvailableText(preferredPID: pid)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              text.count >= 2,
              !vaultNames.contains(text) else {
            return
        }

        rememberSelection(text: text, snapshot: snapshot)
    }

    private func resolvedSelection(preferCache: Bool = false) -> (text: String, pageTitle: String, pageUrl: String)? {
        let vaultNames = store.config.vaults.map(\.name)

        if preferCache,
           let cached = cachedSelection,
           cached.payload.text.count >= 2,
           Date().timeIntervalSince(cached.capturedAt) < SelectionResolver.defaultCacheTTL {
            return (cached.payload.text, cached.payload.pageTitle, cached.payload.pageUrl)
        }

        if let pid = lastContentApp?.pid,
           let text = SelectionReader.bestAvailableText(preferredPID: pid)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           text.count >= 2,
           !vaultNames.contains(text),
           let snapshot = lastContentApp {
            rememberSelection(text: text, snapshot: snapshot)
            return (text, snapshot.pageTitle, snapshot.pageUrl)
        }

        switch SelectionResolver.resolve(
            liveText: SelectionReader.bestAvailableText(),
            cached: cachedSelection,
            clipperFrontmost: isClipperFrontmost(),
            vaultNames: vaultNames
        ) {
        case .useLive(let text):
            let source = currentSourceContext()
            rememberSelection(text: text, pageTitle: source.title, pageUrl: source.url)
            return (text, source.title, source.url)
        case .useCached(let payload):
            return (payload.text, payload.pageTitle, payload.pageUrl)
        case .none:
            return nil
        }
    }

    private func currentSourceContext() -> (title: String, url: String) {
        if let snapshot = lastContentApp {
            return SourceContext.from(snapshot: snapshot)
        }
        return SourceContext.current()
    }

    private func isClipperFrontmost() -> Bool {
        let app = NSWorkspace.shared.frontmostApplication
        return app?.bundleIdentifier == "com.assistant.clipper"
            || app?.localizedName == "Assistant Clipper"
    }

    private func rememberSelection(text: String, pageTitle: String, pageUrl: String) {
        cachedSelection = ClipCore.CachedSelection(
            payload: SelectionPayload(text: text, pageTitle: pageTitle, pageUrl: pageUrl),
            capturedAt: Date()
        )
    }

    private func rememberSelection(text: String, snapshot: ContentAppSnapshot) {
        lastContentApp = snapshot
        rememberSelection(text: text, pageTitle: snapshot.pageTitle, pageUrl: snapshot.pageUrl)
    }

    private func snapshotSelection(text: String) {
        guard SelectionReader.isTrusted,
              let app = SelectionReader.frontmostNonClipperApplication() else { return }

        let vaultNames = store.config.vaults.map(\.name)
        guard SelectionResolver.shouldUpdateCache(
            clipperFrontmost: false,
            selectedText: text,
            vaultNames: vaultNames
        ) else { return }

        let source = SourceContext.from(app: app)
        let snapshot = ContentAppSnapshot(
            pid: pid_t(app.processIdentifier),
            bundleIdentifier: app.bundleIdentifier,
            localizedName: app.localizedName ?? "Unknown",
            pageTitle: source.title,
            pageUrl: source.url
        )
        rememberSelection(text: text, snapshot: snapshot)
    }

    private func configureMonitor() {
        monitor.isPopupEnabled = store.preferences.showFloatingToolbar
        monitor.onSelectionChanged = { [weak self] text in
            guard let self else { return }
            self.snapshotSelection(text: text)
        }
        monitor.onSelection = { [weak self] text, point in
            guard let self, self.store.preferences.showFloatingToolbar, !self.store.config.vaults.isEmpty else { return }
            self.pendingText = text
            self.popup.show(text: text, near: point)
        }
        monitor.onSelectionCleared = { [weak self] in
            self?.popup.hide()
        }
        monitor.shouldIgnoreMouseUp = { [weak self] point in
            self?.popup.contains(screenPoint: point) ?? false
        }
        monitor.start()
    }

    private func configurePopup() {
        popup.configure(vaults: store.config.vaults) { [weak self] vaultId, text in
            guard let self else { return }
            if let cached = self.cachedSelection, cached.payload.text == text {
                self.clip(
                    to: vaultId,
                    text: text,
                    pageTitle: cached.payload.pageTitle,
                    pageUrl: cached.payload.pageUrl
                )
            } else if !self.isClipperFrontmost() {
                let source = SourceContext.current()
                self.clip(to: vaultId, text: text, pageTitle: source.title, pageUrl: source.url)
            } else if let cached = self.cachedSelection {
                self.clip(
                    to: vaultId,
                    text: cached.payload.text,
                    pageTitle: cached.payload.pageTitle,
                    pageUrl: cached.payload.pageUrl
                )
            } else {
                self.clip(to: vaultId, text: text, pageTitle: "Untitled page", pageUrl: "")
            }
        }
    }

    private func configureHotKeys() {
        hotKeys.onHotKey { [weak self] vaultId in
            self?.clipToVault(vaultId)
        }
        hotKeys.register(
            vaults: store.config.vaults,
            enabled: store.preferences.globalShortcutsEnabled
        )
    }

    private func ensureAccessibilityForClip() -> Bool {
        refreshAccessibilityStatus()
        if accessibilityTrusted { return true }

        _ = SelectionReader.requestTrust(prompt: true)
        refreshAccessibilityStatus()
        if accessibilityTrusted { return true }

        showToast("Allow Accessibility for Assistant Clipper (see Settings for details).")
        return false
    }

    private func clip(to vaultId: String, text: String, pageTitle: String, pageUrl: String) {
        guard let vault = store.resolveVault(id: vaultId) else {
            showToast("Vault not found.")
            return
        }

        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            showToast("Selection lost — select text and try again.")
            return
        }

        do {
            let path = try ClipWriter.save(
                vault: vault,
                context: ClipContext(text: trimmed, pageTitle: pageTitle, pageUrl: pageUrl)
            )
            showToast("Saved to \(vault.name)")
            NSLog("Clipped to \(path)")
        } catch {
            showToast(error.localizedDescription)
        }
    }

    func openSettings(onClose: @escaping () -> Void) {
        refreshAccessibilityStatus()
        SettingsWindowController.shared.show(appState: self, store: store, onClose: onClose)
    }

    private func showToast(_ message: String) {
        toastMessage = message
        toast.show(message)
    }
}
