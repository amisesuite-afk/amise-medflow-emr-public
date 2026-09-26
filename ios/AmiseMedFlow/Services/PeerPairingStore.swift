// PeerPairingStore.swift
// Keychain storage for nearby-device pairing: one 32-byte secret per paired device, keyed by
// that device's random id, plus this install's own device id.

import Foundation
import Security
import CryptoKit

struct PairedPeerDevice: Identifiable, Equatable {
    let deviceId: String
    let name: String
    let pairedAt: Date?
    var id: String { deviceId }
}

enum PeerPairingStore {
    private static let service = "com.amisesuite.medflow.peer-pairing"

    private static func baseQuery(_ deviceId: String? = nil) -> [CFString: Any] {
        var query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
        ]
        if let deviceId { query[kSecAttrAccount] = deviceId }
        return query
    }

    /// Stores (or replaces) the secret shared with `deviceId`. Readable after the first unlock
    /// since boot, never leaves this device (not in backups, not in iCloud Keychain).
    @discardableResult
    static func save(secret: SymmetricKey, deviceId: String, name: String) -> Bool {
        let query = baseQuery(deviceId)
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData]      = PeerPairingCrypto.keyData(secret)
        add[kSecAttrLabel]      = name
        add[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    static func secret(for deviceId: String) -> SymmetricKey? {
        var query = baseQuery(deviceId)
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data, data.count == PeerPairingCrypto.secretLength else { return nil }
        return SymmetricKey(data: data)
    }

    static func hasSecret(for deviceId: String) -> Bool { secret(for: deviceId) != nil }

    static func delete(deviceId: String) {
        SecItemDelete(baseQuery(deviceId) as CFDictionary)
    }

    /// Removes every pairing (used on a fresh install, whose new device id no peer knows).
    static func deleteAll() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    /// Paired devices, newest first. Reads attributes only, never the secrets.
    static func pairedDevices() -> [PairedPeerDevice] {
        var query = baseQuery()
        query[kSecReturnAttributes] = true
        query[kSecMatchLimit]       = kSecMatchLimitAll
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let items = result as? [[String: Any]] else { return [] }
        return items.compactMap { attrs -> PairedPeerDevice? in
            guard let id = attrs[kSecAttrAccount as String] as? String else { return nil }
            let name = (attrs[kSecAttrLabel as String] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Device"
            return PairedPeerDevice(deviceId: id, name: name,
                                    pairedAt: attrs[kSecAttrCreationDate as String] as? Date)
        }
        .sorted { ($0.pairedAt ?? .distantPast) > ($1.pairedAt ?? .distantPast) }
    }
}

/// This install's random device id (the only identifier peer sync broadcasts).
enum PeerDeviceIdentity {
    private static let idKey        = "com.amise.medflow.peerDeviceId"
    private static let migrationKey = "com.amise.medflow.peerPairingMigrationPending"

    /// The device id, created on first use. Kept in UserDefaults on purpose: it is wiped when
    /// the app is deleted, so a reinstall is a new device that must be paired again. The
    /// Keychain survives a reinstall, so pairings from the earlier install are removed here.
    /// `existingInstall`: this install ran an older build with peer sync (it had an MCPeerID),
    /// so the user is shown "Pair your iPad to resume nearby sync" until they pair.
    static func loadOrCreate(existingInstall: Bool, defaults: UserDefaults = .standard) -> String {
        if let id = defaults.string(forKey: idKey), PeerPairingCrypto.isValidDeviceId(id) { return id }
        let id = PeerPairingCrypto.newDeviceId()
        defaults.set(id, forKey: idKey)
        PeerPairingStore.deleteAll()
        if existingInstall { defaults.set(true, forKey: migrationKey) }
        return id
    }

    static var migrationPending: Bool { UserDefaults.standard.bool(forKey: migrationKey) }

    static func clearMigrationPending() { UserDefaults.standard.removeObject(forKey: migrationKey) }
}
