import AppKit
import ClipCore
import Foundation

enum SourceContext {
    static func current() -> (title: String, url: String) {
        if let app = SelectionReader.frontmostNonClipperApplication() {
            return from(app: app)
        }
        return ("Unknown", "")
    }

    static func from(snapshot: ContentAppSnapshot) -> (title: String, url: String) {
        if !snapshot.pageTitle.isEmpty || !snapshot.pageUrl.isEmpty {
            let title = snapshot.pageTitle.isEmpty ? snapshot.localizedName : snapshot.pageTitle
            return (title, snapshot.pageUrl)
        }
        if let app = NSRunningApplication(processIdentifier: Int32(snapshot.pid)) {
            return from(app: app)
        }
        return (snapshot.localizedName, "")
    }

    static func from(app: NSRunningApplication) -> (title: String, url: String) {
        let appName = app.localizedName ?? "Unknown"
        guard let browser = BrowserKind.from(
            bundleIdentifier: app.bundleIdentifier,
            localizedName: app.localizedName
        ), isInstalled(browser) else {
            return (appName, "")
        }

        let url = browserURL(browser) ?? ""
        let title = browserTitle(browser) ?? appName
        return (title, url)
    }

    private static func browserURL(_ browser: BrowserKind) -> String? {
        nonEmpty(runAppleScript(script: browser.urlScript()))
    }

    private static func browserTitle(_ browser: BrowserKind) -> String? {
        nonEmpty(runAppleScript(script: browser.titleScript()))
    }

    private static func isInstalled(_ browser: BrowserKind) -> Bool {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: browser.bundleIdentifier) != nil
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }

    private static func runAppleScript(script source: String) -> String? {
        var error: NSDictionary?
        guard let appleScript = NSAppleScript(source: source) else { return nil }
        let output = appleScript.executeAndReturnError(&error)
        if error != nil { return nil }
        return output.stringValue
    }
}
