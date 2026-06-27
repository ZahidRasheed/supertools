import AppKit
import ApplicationServices
import ClipCore
import Foundation

final class SelectionMonitor {
    var onSelection: ((String, NSPoint) -> Void)?
    var onSelectionChanged: ((String) -> Void)?
    var onSelectionCleared: (() -> Void)?
    var shouldIgnoreMouseUp: ((NSPoint) -> Bool)?
    var isPopupEnabled: Bool = true

    private var globalMonitor: Any?
    private var localMonitor: Any?
    private var pollTimer: Timer?
    private var lastText: String = ""
    private var debounce: DispatchWorkItem?

    func start() {
        stop()

        let mask: NSEvent.EventTypeMask = [.leftMouseUp, .leftMouseDragged, .keyUp, .flagsChanged]

        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: mask) { [weak self] event in
            self?.handleEvent(event)
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: mask) { [weak self] event in
            self?.handleEvent(event)
            return event
        }

        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            self?.checkSelection()
        }
    }

    func stop() {
        if let globalMonitor { NSEvent.removeMonitor(globalMonitor) }
        if let localMonitor { NSEvent.removeMonitor(localMonitor) }
        globalMonitor = nil
        localMonitor = nil
        pollTimer?.invalidate()
        pollTimer = nil
        debounce?.cancel()
    }

    private func handleEvent(_ event: NSEvent) {
        if event.type == .leftMouseUp {
            let point = NSEvent.mouseLocation
            if shouldIgnoreMouseUp?(point) == true { return }
        }
        scheduleCheck()
    }

    private func scheduleCheck() {
        debounce?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.checkSelection() }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08, execute: work)
    }

    private func checkSelection() {
        guard SelectionReader.isTrusted else { return }

        guard let text = SelectionReader.selectedText()?.trimmingCharacters(in: .whitespacesAndNewlines),
              text.count >= 2 else {
            if !lastText.isEmpty {
                lastText = ""
                onSelectionCleared?()
            }
            return
        }

        guard text != lastText else { return }
        lastText = text
        onSelectionChanged?(text)

        guard isPopupEnabled else { return }
        onSelection?(text, NSEvent.mouseLocation)
    }
}
