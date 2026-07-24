import ClipCore
import Foundation
import XCTest

final class ClipFormatterTests: XCTestCase {
    func testTodayFilename() {
        var components = DateComponents()
        components.year = 2026
        components.month = 6
        components.day = 27
        let date = Calendar.current.date(from: components)!
        XCTAssertEqual(ClipFormatter.todayFilename(date: date), "2026-06-27.md")
    }

    func testCleanUrlStripsTracking() {
        let url = "https://example.com/page?utm_source=x&ref=y#section"
        XCTAssertEqual(ClipFormatter.cleanUrl(url), "https://example.com/page")
    }

    func testFormatClippingContainsTitleAndQuotedBody() {
        var components = DateComponents()
        components.year = 2026
        components.month = 6
        components.day = 27
        components.hour = 14
        components.minute = 30
        let date = Calendar.current.date(from: components)!
        let locale = Locale(identifier: "en_US")

        let output = ClipFormatter.formatClipping(
            text: "Line one\nLine two",
            pageTitle: "Example",
            pageUrl: "https://example.com",
            clippedAt: date,
            locale: locale
        )

        XCTAssertTrue(output.contains("## Example"))
        XCTAssertTrue(output.contains("https://example.com"))
        XCTAssertTrue(output.contains("> Line one"))
        XCTAssertTrue(output.contains("> Line two"))
        XCTAssertTrue(output.contains("---"))
    }
}
