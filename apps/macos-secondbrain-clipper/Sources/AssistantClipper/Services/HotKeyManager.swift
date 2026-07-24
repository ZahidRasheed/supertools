import Carbon
import ClipCore
import Foundation

final class HotKeyManager {
    private struct Entry {
        var ref: EventHotKeyRef?
        let vaultId: String
    }

    private var entries: [Entry] = []
    private var handler: EventHandlerRef?
    private var onVaultHotKey: ((String) -> Void)?

    init() {
        installHandler()
    }

    deinit {
        unregisterAll()
        if let handler {
            RemoveEventHandler(handler)
        }
    }

    func onHotKey(_ handler: @escaping (String) -> Void) {
        onVaultHotKey = handler
    }

    func register(vaults: [Vault], enabled: Bool) {
        unregisterAll()
        guard enabled else { return }

        for (index, vault) in vaults.enumerated() {
            guard let shortcut = vault.shortcut ?? VaultShortcut.defaultForIndex(index) else { continue }
            var ref: EventHotKeyRef?
            let hotKeyID = EventHotKeyID(signature: OSType(0x434C5052), id: UInt32(index))
            let status = RegisterEventHotKey(
                shortcut.keyCode,
                shortcut.carbonModifiers,
                hotKeyID,
                GetApplicationEventTarget(),
                0,
                &ref
            )
            if status == noErr, let ref {
                entries.append(Entry(ref: ref, vaultId: vault.id))
            }
        }
    }

    private func unregisterAll() {
        for entry in entries {
            if let ref = entry.ref {
                UnregisterEventHotKey(ref)
            }
        }
        entries.removeAll()
    }

    private func installHandler() {
        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )

        let callback: EventHandlerUPP = { _, event, userData -> OSStatus in
            guard let userData, let event else { return OSStatus(eventNotHandledErr) }
            let manager = Unmanaged<HotKeyManager>.fromOpaque(userData).takeUnretainedValue()

            var hotKeyID = EventHotKeyID()
            let status = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotKeyID
            )
            guard status == noErr else { return status }

            let index = Int(hotKeyID.id)
            guard manager.entries.indices.contains(index) else { return noErr }
            let vaultId = manager.entries[index].vaultId
            DispatchQueue.main.async {
                manager.onVaultHotKey?(vaultId)
            }
            return noErr
        }

        InstallEventHandler(
            GetApplicationEventTarget(),
            callback,
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &handler
        )
    }
}
