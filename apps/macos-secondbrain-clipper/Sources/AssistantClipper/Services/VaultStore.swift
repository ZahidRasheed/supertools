import ClipCore
import Combine
import Foundation

@MainActor
final class VaultStore: ObservableObject {
    @Published var config: VaultConfig
    @Published var preferences: ClipperPreferences
    @Published var statusMessage: String = ""

    private let supportDir: URL
    private let vaultsURL: URL
    private let prefsURL: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Assistant", isDirectory: true)
        supportDir = base
        vaultsURL = base.appendingPathComponent("vaults.json")
        prefsURL = base.appendingPathComponent("clipper.json")

        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)

        config = VaultStore.loadJSON(VaultConfig.self, from: vaultsURL) ?? VaultConfig()
        preferences = VaultStore.loadJSON(ClipperPreferences.self, from: prefsURL) ?? ClipperPreferences()

        normalizeDefaults()
        tryMigrateFromExtensionExport()
    }

    func save() {
        touchConfig()
        normalizeDefaults()
        VaultStore.saveJSON(config, to: vaultsURL)
        VaultStore.saveJSON(preferences, to: prefsURL)
        if preferences.launchAtLogin {
            LaunchAtLogin.setEnabled(true)
        }
    }

    /// `@Published` on a struct does not fire when nested fields mutate — reassign to notify observers.
    func touchConfig() {
        config = config
    }

    func addVault() {
        let vault = Vault(name: "My Vault", path: "", clippingsFolder: "Clippings")
        config.vaults.append(vault)
        if config.defaultVaultId.isEmpty {
            config.defaultVaultId = vault.id
        }
        touchConfig()
        save()
    }

    func removeVault(id: String) {
        config.vaults.removeAll { $0.id == id }
        normalizeDefaults()
        touchConfig()
        save()
    }

    func resolveVault(id: String?) -> Vault? {
        guard !config.vaults.isEmpty else { return nil }
        if let id, let vault = config.vaults.first(where: { $0.id == id }) {
            return vault
        }
        if let vault = config.vaults.first(where: { $0.id == config.defaultVaultId }) {
            return vault
        }
        return config.vaults.first
    }

    func importExtensionExport(from url: URL) throws {
        let data = try Data(contentsOf: url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let settings = json?["settings"] as? [String: Any]
        let clip = settings?["clip"] as? [String: Any]
        let vaults = clip?["vaults"] as? [[String: Any]] ?? []

        config.vaults = vaults.map { item in
            Vault(
                id: item["id"] as? String ?? UUID().uuidString,
                name: item["name"] as? String ?? "Vault",
                path: item["path"] as? String ?? "",
                clippingsFolder: item["clippingsFolder"] as? String ?? "Clippings"
            )
        }
        config.defaultVaultId = clip?["defaultVaultId"] as? String ?? config.vaults.first?.id ?? ""
        if let show = clip?["showFloatingToolbar"] as? Bool {
            preferences.showFloatingToolbar = show
        }
        touchConfig()
        save()
        statusMessage = "Imported \(config.vaults.count) vault(s)."
    }

    func testVault(_ vault: Vault) {
        do {
            let path = try ClipWriter.save(
                vault: vault,
                context: ClipContext(
                    text: "Connection test from Assistant Clipper.",
                    pageTitle: "Test",
                    pageUrl: ""
                )
            )
            statusMessage = "Test clip saved to \(path)"
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func normalizeDefaults() {
        if config.defaultVaultId.isEmpty {
            config.defaultVaultId = config.vaults.first?.id ?? ""
        }
        if !config.vaults.contains(where: { $0.id == config.defaultVaultId }) {
            config.defaultVaultId = config.vaults.first?.id ?? ""
        }
    }

    private func tryMigrateFromExtensionExport() {
        guard config.vaults.isEmpty else { return }
        let candidates = [
            supportDir.appendingPathComponent("extension-export.json"),
            URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Downloads/news-reader-settings.json"),
        ]
        for url in candidates where FileManager.default.fileExists(atPath: url.path) {
            try? importExtensionExport(from: url)
            return
        }
    }

    private static func loadJSON<T: Decodable>(_ type: T.Type, from url: URL) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private static func saveJSON<T: Encodable>(_ value: T, to url: URL) {
        guard let data = try? JSONEncoder.pretty.encode(value) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
