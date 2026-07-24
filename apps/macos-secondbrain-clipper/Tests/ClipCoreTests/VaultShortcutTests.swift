import ClipCore
import XCTest

final class VaultShortcutTests: XCTestCase {
    func testDefaultShortcutsForFirstNineVaults() {
        for index in 0..<9 {
            XCTAssertNotNil(VaultShortcut.defaultForIndex(index))
        }
        XCTAssertNil(VaultShortcut.defaultForIndex(9))
    }

    func testDisplayLabelForFirstVault() {
        let shortcut = VaultShortcut.defaultForIndex(0)!
        XCTAssertEqual(shortcut.displayLabel, "⌘⇧1")
    }
}
