import Foundation

public struct SelectionPayload: Equatable {
    public var text: String
    public var pageTitle: String
    public var pageUrl: String

    public init(text: String, pageTitle: String, pageUrl: String) {
        self.text = text
        self.pageTitle = pageTitle
        self.pageUrl = pageUrl
    }
}

public struct CachedSelection: Equatable {
    public var payload: SelectionPayload
    public var capturedAt: Date

    public init(payload: SelectionPayload, capturedAt: Date) {
        self.payload = payload
        self.capturedAt = capturedAt
    }
}

/// Pure selection logic — safe to unit test without Accessibility or the menu bar.
public enum SelectionResolver {
    public static let defaultCacheTTL: TimeInterval = 300

    /// Whether a polled selection should update the cache (guards menu-bar false reads).
    public static func shouldUpdateCache(
        clipperFrontmost: Bool,
        selectedText: String,
        vaultNames: [String]
    ) -> Bool {
        let trimmed = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return false }
        guard !clipperFrontmost else { return false }
        guard !vaultNames.contains(trimmed) else { return false }
        return true
    }

    public enum ResolveResult: Equatable {
        case useLive(text: String)
        case useCached(SelectionPayload)
        case none
    }

    /// Decide which text to clip. Page title/URL for `.useLive` are filled in by the caller.
    public static func resolve(
        liveText: String?,
        cached: CachedSelection?,
        clipperFrontmost: Bool,
        vaultNames: [String],
        now: Date = Date(),
        cacheTTL: TimeInterval = defaultCacheTTL
    ) -> ResolveResult {
        if let live = normalized(liveText),
           live.count >= 2,
           vaultNames.contains(live),
           let cached,
           normalized(cached.payload.text)?.count ?? 0 >= 2,
           now.timeIntervalSince(cached.capturedAt) < cacheTTL {
            return .useCached(cached.payload)
        }

        if !clipperFrontmost,
           let live = normalized(liveText),
           live.count >= 2,
           !vaultNames.contains(live) {
            return .useLive(text: live)
        }

        guard let cached,
              normalized(cached.payload.text)?.count ?? 0 >= 2,
              now.timeIntervalSince(cached.capturedAt) < cacheTTL else {
            return .none
        }

        return .useCached(cached.payload)
    }

    private static func normalized(_ text: String?) -> String? {
        guard let text else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
