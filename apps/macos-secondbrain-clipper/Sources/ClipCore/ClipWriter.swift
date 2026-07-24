import Foundation

public enum ClipWriter {
    public static func save(vault: Vault, context: ClipContext, fileManager: FileManager = .default) throws -> String {
        guard !vault.path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ClipError.missingVaultPath
        }

        let vaultURL = URL(fileURLWithPath: vault.path).standardizedFileURL
        var isDir: ObjCBool = false
        guard fileManager.fileExists(atPath: vaultURL.path, isDirectory: &isDir), isDir.boolValue else {
            throw ClipError.vaultNotFound(vault.path)
        }

        let folder = vault.clippingsFolder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Clippings"
            : vault.clippingsFolder
        let targetDir = vaultURL.appendingPathComponent(folder, isDirectory: true)
        try fileManager.createDirectory(at: targetDir, withIntermediateDirectories: true)

        let filename = ClipFormatter.todayFilename()
        let fileURL = targetDir.appendingPathComponent(filename)
        let content = ClipFormatter.formatClipping(
            text: context.text,
            pageTitle: context.pageTitle,
            pageUrl: context.pageUrl
        )

        if !fileManager.fileExists(atPath: fileURL.path) {
            let header = ClipFormatter.dailyFileHeader()
            try (header + content).write(to: fileURL, atomically: true, encoding: .utf8)
        } else {
            let handle = try FileHandle(forWritingTo: fileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            if let data = content.data(using: .utf8) {
                try handle.write(contentsOf: data)
            }
        }

        return fileURL.path
    }
}

public enum ClipError: LocalizedError, Equatable {
    case missingVaultPath
    case vaultNotFound(String)

    public var errorDescription: String? {
        switch self {
        case .missingVaultPath:
            return "Vault folder path is empty."
        case .vaultNotFound(let path):
            return "Vault not found: \(path)"
        }
    }
}
