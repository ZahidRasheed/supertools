import ClipCore
import Foundation
import XCTest

/// Regression tests for real bugs found in manual testing (Jun 2026).
final class SelectionResolverTests: XCTestCase {
    private let vaults = ["Second Brain", "Aeven Second Brain"]
    private let pageSelection = "The DHL Relay starts at 18:00 in Fælledparken."

    private var cached: CachedSelection {
        CachedSelection(
            payload: SelectionPayload(
                text: pageSelection,
                pageTitle: "Event details",
                pageUrl: "https://example.com/event"
            ),
            capturedAt: Date(timeIntervalSince1970: 1_000_000)
        )
    }

    // MARK: - Menu bar stole selection (vault name clipped instead of page text)

    func testMenuOpenUsesCachedSelectionNotVaultName() {
        let snapshot = cached
        let result = SelectionResolver.resolve(
            liveText: "Aeven Second Brain",
            cached: snapshot,
            clipperFrontmost: true,
            vaultNames: vaults,
            now: snapshot.capturedAt.addingTimeInterval(5)
        )

        XCTAssertEqual(result, SelectionResolver.ResolveResult.useCached(snapshot.payload))
    }

    func testMenuOpenDoesNotOverwriteCacheWithVaultName() {
        XCTAssertFalse(
            SelectionResolver.shouldUpdateCache(
                clipperFrontmost: true,
                selectedText: "Second Brain",
                vaultNames: vaults
            )
        )
    }

    func testLiveBrowserSelectionIsUsedWhenNotClipperFrontmost() {
        let result = SelectionResolver.resolve(
            liveText: pageSelection,
            cached: cached,
            clipperFrontmost: false,
            vaultNames: vaults,
            now: cached.capturedAt.addingTimeInterval(5)
        )

        XCTAssertEqual(result, SelectionResolver.ResolveResult.useLive(text: pageSelection))
    }

    func testExpiredCacheReturnsNoneWhenMenuStealsFocus() {
        let snapshot = cached
        let result = SelectionResolver.resolve(
            liveText: "Second Brain",
            cached: snapshot,
            clipperFrontmost: true,
            vaultNames: vaults,
            now: snapshot.capturedAt.addingTimeInterval(400)
        )

        XCTAssertEqual(result, SelectionResolver.ResolveResult.none)
    }

    func testVaultNameNeverTreatedAsLiveSelection() {
        let result = SelectionResolver.resolve(
            liveText: "Second Brain",
            cached: nil,
            clipperFrontmost: false,
            vaultNames: vaults
        )

        XCTAssertEqual(result, SelectionResolver.ResolveResult.none)
    }

    func testLiveVaultNameUsesCacheWhenAvailable() {
        let snapshot = cached
        let result = SelectionResolver.resolve(
            liveText: "Aeven Second Brain",
            cached: snapshot,
            clipperFrontmost: false,
            vaultNames: vaults,
            now: snapshot.capturedAt.addingTimeInterval(1)
        )

        XCTAssertEqual(result, SelectionResolver.ResolveResult.useCached(snapshot.payload))
    }
}
