import AppKit

/// Panel that accepts keyboard focus so buttons receive clicks reliably.
final class ClipPopupPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

final class ToastPanelController {
    private var panel: NSPanel?
    private var hideWork: DispatchWorkItem?

    func show(_ message: String, near point: NSPoint? = nil) {
        hideWork?.cancel()

        let label = NSTextField(labelWithString: message)
        label.font = .systemFont(ofSize: 12, weight: .medium)
        label.textColor = .labelColor
        label.lineBreakMode = .byTruncatingTail
        label.maximumNumberOfLines = 2
        label.preferredMaxLayoutWidth = 240

        let padding = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        let host = NSView()
        host.translatesAutoresizingMaskIntoConstraints = false
        label.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(label)

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: host.topAnchor, constant: padding.top),
            label.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -padding.bottom),
            label.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: padding.left),
            label.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -padding.right),
        ])

        let effect = NSVisualEffectView()
        effect.material = .hudWindow
        effect.state = .active
        effect.wantsLayer = true
        effect.layer?.cornerRadius = 8
        effect.layer?.masksToBounds = true
        effect.translatesAutoresizingMaskIntoConstraints = false
        effect.addSubview(host)

        NSLayoutConstraint.activate([
            host.topAnchor.constraint(equalTo: effect.topAnchor),
            host.bottomAnchor.constraint(equalTo: effect.bottomAnchor),
            host.leadingAnchor.constraint(equalTo: effect.leadingAnchor),
            host.trailingAnchor.constraint(equalTo: effect.trailingAnchor),
        ])

        let size = effect.fittingSize
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .statusBar
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.contentView = effect
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]

        let anchor = point ?? NSEvent.mouseLocation
        var origin = NSPoint(x: anchor.x - size.width / 2, y: anchor.y + 16)
        if let screen = NSScreen.screens.first(where: { NSMouseInRect(anchor, $0.frame, false) }) ?? NSScreen.main {
            let visible = screen.visibleFrame
            origin.x = max(visible.minX + 8, min(origin.x, visible.maxX - size.width - 8))
            origin.y = max(visible.minY + 8, min(origin.y, visible.maxY - size.height - 8))
        }

        panel.setFrameOrigin(origin)
        panel.orderFrontRegardless()
        self.panel = panel

        let work = DispatchWorkItem { [weak self] in
            self?.panel?.orderOut(nil)
            self?.panel = nil
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4, execute: work)
    }
}
