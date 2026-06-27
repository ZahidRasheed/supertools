import Foundation

/// Browser detection and AppleScript generation — one browser per script (no Arc lookup when using Chrome).
public enum BrowserKind: String, Equatable, CaseIterable {
    case chrome = "Google Chrome"
    case arc = "Arc"
    case safari = "Safari"

    public static func from(bundleIdentifier: String?, localizedName: String?) -> BrowserKind? {
        switch bundleIdentifier {
        case "com.google.Chrome", "com.google.Chrome.canary":
            return .chrome
        case "company.thebrowser.Browser":
            return .arc
        case "com.apple.Safari":
            return .safari
        default:
            break
        }
        guard let localizedName else { return nil }
        return BrowserKind(rawValue: localizedName)
    }

    public var bundleIdentifier: String {
        switch self {
        case .chrome: return "com.google.Chrome"
        case .arc: return "company.thebrowser.Browser"
        case .safari: return "com.apple.Safari"
        }
    }

    public func urlScript() -> String {
        switch self {
        case .chrome, .arc:
            return """
            tell application "\(rawValue)"
                if (count of windows) > 0 then return URL of active tab of front window
            end tell
            """
        case .safari:
            return """
            tell application "Safari"
                if (count of windows) > 0 then return URL of current tab of front window
            end tell
            """
        }
    }

    public func titleScript() -> String {
        switch self {
        case .chrome, .arc:
            return """
            tell application "\(rawValue)"
                if (count of windows) > 0 then return title of active tab of front window
            end tell
            """
        case .safari:
            return """
            tell application "Safari"
                if (count of windows) > 0 then return name of current tab of front window
            end tell
            """
        }
    }

    /// Scripts must reference only the target browser (avoids "Where is Arc?" when Arc is not installed).
    public func referencedApplicationNames(in script: String) -> [String] {
        let pattern = #"tell application "([^"]+)""#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(script.startIndex..<script.endIndex, in: script)
        return regex.matches(in: script, range: range).compactMap { match in
            guard let r = Range(match.range(at: 1), in: script) else { return nil }
            return String(script[r])
        }
    }
}
