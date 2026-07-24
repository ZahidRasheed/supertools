import ClipCore
import Foundation
import XCTest

final class ClipWriterTests: XCTestCase {
    func testSaveCreatesDailyFileWithHeader() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)

        let vault = Vault(name: "Test", path: temp.path, clippingsFolder: "Clippings")
        let path = try ClipWriter.save(
            vault: vault,
            context: ClipContext(text: "Hello", pageTitle: "Page", pageUrl: "")
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: path))
        let content = try String(contentsOfFile: path, encoding: .utf8)
        XCTAssertTrue(content.contains("# Clippings —"))
        XCTAssertTrue(content.hasPrefix("# Clippings"))
        XCTAssertTrue(content.contains("> Hello"))

        try FileManager.default.removeItem(at: temp)
    }

    func testSaveAppendsToExistingFile() throws {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)

        let vault = Vault(name: "Test", path: temp.path, clippingsFolder: "inbox")
        _ = try ClipWriter.save(vault: vault, context: ClipContext(text: "First", pageTitle: "A", pageUrl: ""))
        _ = try ClipWriter.save(vault: vault, context: ClipContext(text: "Second", pageTitle: "B", pageUrl: ""))

        let filename = ClipFormatter.todayFilename()
        let fileURL = temp.appendingPathComponent("inbox/\(filename)")
        let content = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertTrue(content.contains("> First"))
        XCTAssertTrue(content.contains("> Second"))

        try FileManager.default.removeItem(at: temp)
    }

    func testMissingVaultPathThrows() {
        let vault = Vault(name: "Bad", path: "", clippingsFolder: "Clippings")
        XCTAssertThrowsError(try ClipWriter.save(
            vault: vault,
            context: ClipContext(text: "x", pageTitle: "", pageUrl: "")
        )) { error in
            XCTAssertEqual(error as? ClipError, .missingVaultPath)
        }
    }
}
