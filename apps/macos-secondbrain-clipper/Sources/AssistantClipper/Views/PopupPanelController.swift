import AppKit
import ClipCore

final class PopupPanelController: NSWindowController {
    private let stack = NSStackView()
    private var onClip: ((String, String) -> Void)?
    private var currentText: String = ""

    init() {
        let panel = ClipPopupPanel(
            contentRect: NSRect(x: 0, y: 0, width: 120, height: 44),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.acceptsMouseMovedEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        super.init(window: panel)

        let container = NSVisualEffectView()
        container.material = .hudWindow
        container.state = .active
        container.wantsLayer = true
        container.layer?.cornerRadius = 10
        container.layer?.masksToBounds = true
        container.translatesAutoresizingMaskIntoConstraints = false

        stack.orientation = .horizontal
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)
        stack.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(stack)
        panel.contentView = container

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            stack.topAnchor.constraint(equalTo: container.topAnchor),
            stack.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    func configure(vaults: [Vault], onClip: @escaping (String, String) -> Void) {
        self.onClip = onClip
        stack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (index, vault) in vaults.enumerated() {
            let button = VaultButton(title: VaultColors.initial(for: vault.name), colorHex: VaultColors.color(at: index))
            button.toolTip = vault.name
            button.target = self
            button.action = #selector(vaultTapped(_:))
            button.vaultId = vault.id
            stack.addArrangedSubview(button)
        }

        if let panel = window {
            panel.setContentSize(panel.contentView?.fittingSize ?? NSSize(width: 120, height: 44))
        }
    }

    func show(text: String, near screenPoint: NSPoint) {
        currentText = text
        guard let panel = window, !stack.arrangedSubviews.isEmpty else { return }

        panel.setContentSize(panel.contentView?.fittingSize ?? NSSize(width: 120, height: 44))
        let size = panel.frame.size
        var origin = NSPoint(x: screenPoint.x - size.width / 2, y: screenPoint.y - size.height - 12)

        if let screen = NSScreen.screens.first(where: { NSMouseInRect(screenPoint, $0.frame, false) }) ?? NSScreen.main {
            let visible = screen.visibleFrame
            origin.x = max(visible.minX + 8, min(origin.x, visible.maxX - size.width - 8))
            origin.y = max(visible.minY + 8, min(origin.y, visible.maxY - size.height - 8))
        }

        panel.setFrameOrigin(origin)
        panel.makeKeyAndOrderFront(nil)
    }

    func hide() {
        window?.orderOut(nil)
    }

    func contains(screenPoint: NSPoint) -> Bool {
        guard let frame = window?.frame else { return false }
        return frame.contains(screenPoint)
    }

    @objc private func vaultTapped(_ sender: VaultButton) {
        guard let vaultId = sender.vaultId else { return }
        let text = currentText
        hide()
        onClip?(vaultId, text)
    }
}

private final class VaultButton: NSButton {
    var vaultId: String?

    init(title: String, colorHex: String) {
        super.init(frame: .zero)
        self.title = title
        self.bezelStyle = .rounded
        self.isBordered = false
        self.wantsLayer = true
        self.layer?.cornerRadius = 7
        self.layer?.backgroundColor = NSColor(hex: colorHex)?.cgColor
        self.font = .systemFont(ofSize: 13, weight: .bold)
        self.contentTintColor = .white
        self.translatesAutoresizingMaskIntoConstraints = false
        self.sendAction(on: .leftMouseDown)
        widthAnchor.constraint(equalToConstant: 28).isActive = true
        heightAnchor.constraint(equalToConstant: 28).isActive = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    override func mouseDown(with event: NSEvent) {
        super.mouseDown(with: event)
    }
}

private extension NSColor {
    convenience init?(hex: String) {
        var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cleaned.hasPrefix("#") { cleaned.removeFirst() }
        guard cleaned.count == 6, let value = Int(cleaned, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255
        let g = CGFloat((value >> 8) & 0xFF) / 255
        let b = CGFloat(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
