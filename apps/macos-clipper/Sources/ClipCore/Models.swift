import Foundation

public struct Vault: Codable, Identifiable, Equatable {
    public var id: String
    public var name: String
    public var path: String
    public var clippingsFolder: String
    /// Optional override. When nil, vault index maps to ⌘⇧1–9.
    public var shortcut: VaultShortcut?

    public init(
        id: String = UUID().uuidString,
        name: String,
        path: String,
        clippingsFolder: String = "Clippings",
        shortcut: VaultShortcut? = nil
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.clippingsFolder = clippingsFolder
        self.shortcut = shortcut
    }
}

public struct VaultShortcut: Codable, Equatable {
    public var keyCode: UInt32
    public var carbonModifiers: UInt32

    public init(keyCode: UInt32, carbonModifiers: UInt32) {
        self.keyCode = keyCode
        self.carbonModifiers = carbonModifiers
    }

    /// US keyboard: ⌘⇧1 through ⌘⇧9
    public static func defaultForIndex(_ index: Int) -> VaultShortcut? {
        guard (0..<9).contains(index) else { return nil }
        let keyCodes: [UInt32] = [18, 19, 20, 21, 23, 22, 26, 28, 25]
        return VaultShortcut(keyCode: keyCodes[index], carbonModifiers: 768 | 512) // cmdKey | shiftKey
    }

    public var displayLabel: String {
        let digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
        if let idx = [18, 19, 20, 21, 23, 22, 26, 28, 25].firstIndex(of: keyCode),
           idx < digits.count {
            return "⌘⇧\(digits[idx])"
        }
        return "Custom"
    }
}

public struct VaultConfig: Codable {
    public var version: Int = 1
    public var defaultVaultId: String = ""
    public var vaults: [Vault] = []

    public init(version: Int = 1, defaultVaultId: String = "", vaults: [Vault] = []) {
        self.version = version
        self.defaultVaultId = defaultVaultId
        self.vaults = vaults
    }
}

public struct ClipperPreferences: Codable {
    public var launchAtLogin: Bool = true
    public var showFloatingToolbar: Bool = true
    public var globalShortcutsEnabled: Bool = true

    public init(
        launchAtLogin: Bool = true,
        showFloatingToolbar: Bool = true,
        globalShortcutsEnabled: Bool = true
    ) {
        self.launchAtLogin = launchAtLogin
        self.showFloatingToolbar = showFloatingToolbar
        self.globalShortcutsEnabled = globalShortcutsEnabled
    }
}

public struct ClipContext {
    public var text: String
    public var pageTitle: String
    public var pageUrl: String

    public init(text: String, pageTitle: String, pageUrl: String) {
        self.text = text
        self.pageTitle = pageTitle
        self.pageUrl = pageUrl
    }
}

public enum VaultColors {
    public static let palette: [String] = [
        "#5b8def", "#6dd4a0", "#f0a060", "#f07178",
        "#b48def", "#60c0f0", "#e879a8", "#85c88a",
    ]

    public static func color(at index: Int) -> String {
        palette[index % palette.count]
    }

    public static func initial(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let ch = trimmed.first else { return "V" }
        return String(ch).uppercased()
    }
}
