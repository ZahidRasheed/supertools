import ApplicationServices
import AppKit
import CoreGraphics
import Foundation

public struct ContentAppSnapshot: Equatable {
    public var pid: pid_t
    public var bundleIdentifier: String?
    public var localizedName: String
    public var pageTitle: String
    public var pageUrl: String
    public var capturedAt: Date

    public init(
        pid: pid_t,
        bundleIdentifier: String?,
        localizedName: String,
        pageTitle: String,
        pageUrl: String,
        capturedAt: Date = Date()
    ) {
        self.pid = pid
        self.bundleIdentifier = bundleIdentifier
        self.localizedName = localizedName
        self.pageTitle = pageTitle
        self.pageUrl = pageUrl
        self.capturedAt = capturedAt
    }
}

public enum SelectionReader {
    public static let clipperBundleId = "com.assistant.clipper"

    public static var isTrusted: Bool {
        AXIsProcessTrusted()
    }

    @discardableResult
    public static func requestTrust(prompt: Bool) -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    /// AX first, then ⌘C fallback — works in Chrome where AX selection is often empty.
    public static func bestAvailableText(preferredPID: pid_t? = nil) -> String? {
        guard isTrusted else { return nil }

        if let pid = preferredPID ?? frontmostNonClipperPID(),
           let text = selectedText(fromApplicationPID: pid), !text.isEmpty {
            return text
        }

        if let text = selectedText(), !text.isEmpty {
            return text
        }

        if let pid = preferredPID ?? frontmostNonClipperPID() {
            return copySelectionViaKeyboard(from: pid)
        }

        return nil
    }

    public static func selectedText() -> String? {
        guard isTrusted else { return nil }
        if let pid = frontmostNonClipperPID(),
           let fromApp = selectedText(fromApplicationPID: pid) {
            return fromApp
        }
        return selectedTextSystemWide()
    }

    public static func selectedTextFromFrontmostApplication() -> String? {
        guard isTrusted else { return nil }
        if let pid = frontmostNonClipperPID() {
            return selectedText(fromApplicationPID: pid)
        }
        return nil
    }

    public static func frontmostNonClipperApplication() -> NSRunningApplication? {
        guard let app = NSWorkspace.shared.frontmostApplication else { return nil }
        if isClipper(app) { return nil }
        return app
    }

    public static func frontmostNonClipperPID() -> pid_t? {
        guard let app = frontmostNonClipperApplication() else { return nil }
        return pid_t(app.processIdentifier)
    }

    public static func isClipper(_ app: NSRunningApplication) -> Bool {
        app.bundleIdentifier == clipperBundleId || app.localizedName == "Assistant Clipper"
    }

    public static func selectedText(fromApplicationPID pid: pid_t) -> String? {
        guard isTrusted else { return nil }
        let appElement = AXUIElementCreateApplication(pid)

        if let focused = copyAttribute(appElement, kAXFocusedUIElementAttribute as CFString),
           let text = selectedText(from: focused), !text.isEmpty {
            return text
        }

        if let window = copyAttribute(appElement, kAXFocusedWindowAttribute as CFString),
           let text = findSelectedText(in: window, depth: 0), !text.isEmpty {
            return text
        }

        if let windowsRef = copyAttributeValue(appElement, kAXWindowsAttribute as CFString),
           let windows = windowsRef as? [AXUIElement] {
            for window in windows {
                if let text = findSelectedText(in: window, depth: 0), !text.isEmpty {
                    return text
                }
            }
        }

        return nil
    }

    public static func copySelectionViaKeyboard(from pid: pid_t) -> String? {
        guard isTrusted else { return nil }

        let pasteboard = NSPasteboard.general
        let backup = PasteboardBackup(pasteboard: pasteboard)
        defer { backup.restore() }

        guard postCommandC(to: pid) else { return nil }
        Thread.sleep(forTimeInterval: 0.15)

        guard let text = pasteboard.string(forType: .string)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              text.count >= 2 else {
            return nil
        }
        return text
    }

    private static func postCommandC(to pid: pid_t) -> Bool {
        let source = CGEventSource(stateID: .combinedSessionState)
        let keyCode = CGKeyCode(8) // C

        guard let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true),
              let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false) else {
            return false
        }

        keyDown.flags = .maskCommand
        keyUp.flags = .maskCommand
        keyDown.postToPid(pid)
        keyUp.postToPid(pid)
        return true
    }

    private static func selectedTextSystemWide() -> String? {
        let system = AXUIElementCreateSystemWide()
        guard let focused = copyAttribute(system, kAXFocusedUIElementAttribute as CFString) else {
            return nil
        }
        return selectedText(from: focused)
    }

    public static func selectedText(from element: AXUIElement) -> String? {
        var selected: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXSelectedTextAttribute as CFString, &selected) == .success,
           let value = selected as? String, !value.isEmpty {
            return value
        }

        var selectedRange: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &selectedRange) == .success,
           let rangeValue = selectedRange {
            var text: CFTypeRef?
            if AXUIElementCopyParameterizedAttributeValue(
                element,
                kAXStringForRangeParameterizedAttribute as CFString,
                rangeValue,
                &text
            ) == .success, let value = text as? String, !value.isEmpty {
                return value
            }
        }

        return nil
    }

    private static func findSelectedText(in element: AXUIElement, depth: Int) -> String? {
        if depth > 14 { return nil }

        if let direct = selectedText(from: element), !direct.isEmpty {
            return direct
        }

        guard let childrenRef = copyAttributeValue(element, kAXChildrenAttribute as CFString),
              let array = childrenRef as? [Any] else {
            return nil
        }

        for case let child as AXUIElement in array {
            if let found = findSelectedText(in: child, depth: depth + 1), !found.isEmpty {
                return found
            }
        }
        return nil
    }

    private static func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> AXUIElement? {
        guard let value = copyAttributeValue(element, attribute),
              CFGetTypeID(value) == AXUIElementGetTypeID() else {
            return nil
        }
        return (value as! AXUIElement)
    }

    private static func copyAttributeValue(_ element: AXUIElement, _ attribute: CFString) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, attribute, &value) == .success else {
            return nil
        }
        return value
    }
}

private struct PasteboardBackup {
    private let items: [[NSPasteboard.PasteboardType: Data]]

    init(pasteboard: NSPasteboard) {
        items = pasteboard.pasteboardItems?.map { item in
            var map: [NSPasteboard.PasteboardType: Data] = [:]
            for type in item.types {
                if let data = item.data(forType: type) {
                    map[type] = data
                }
            }
            return map
        } ?? []
    }

    func restore() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        guard !items.isEmpty else { return }

        for itemMap in items {
            let item = NSPasteboardItem()
            for (type, data) in itemMap {
                item.setData(data, forType: type)
            }
            pasteboard.writeObjects([item])
        }
    }
}
