import ClipCore
import XCTest

final class BrowserScriptsTests: XCTestCase {
    func testChromeBundleIdDetection() {
        XCTAssertEqual(
            BrowserKind.from(bundleIdentifier: "com.google.Chrome", localizedName: nil),
            .chrome
        )
    }

    func testSafariBundleIdDetection() {
        XCTAssertEqual(
            BrowserKind.from(bundleIdentifier: "com.apple.Safari", localizedName: nil),
            .safari
        )
    }

    func testArcBundleIdDetection() {
        XCTAssertEqual(
            BrowserKind.from(bundleIdentifier: "company.thebrowser.Browser", localizedName: nil),
            .arc
        )
    }

    func testUnknownAppReturnsNil() {
        XCTAssertNil(BrowserKind.from(bundleIdentifier: "com.assistant.clipper", localizedName: "Assistant Clipper"))
    }

    // Regression: combined AppleScript mentioning Arc triggered "Where is Arc?" when Arc not installed.
    func testChromeScriptDoesNotReferenceArc() {
        let script = BrowserKind.chrome.urlScript()
        XCTAssertEqual(BrowserKind.chrome.referencedApplicationNames(in: script), ["Google Chrome"])
        XCTAssertFalse(script.contains("Arc"))
    }

    func testSafariScriptDoesNotReferenceArcOrChrome() {
        let script = BrowserKind.safari.titleScript()
        XCTAssertEqual(BrowserKind.safari.referencedApplicationNames(in: script), ["Safari"])
        XCTAssertFalse(script.contains("Arc"))
        XCTAssertFalse(script.contains("Google Chrome"))
    }

    func testArcScriptOnlyReferencesArc() {
        let script = BrowserKind.arc.urlScript()
        XCTAssertEqual(BrowserKind.arc.referencedApplicationNames(in: script), ["Arc"])
    }
}
