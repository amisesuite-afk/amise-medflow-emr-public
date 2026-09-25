import Foundation
import MultipeerConnectivity
import SwiftData
import UIKit

// MARK: - Peer-to-peer sync (Multipeer Connectivity)
//
// Works over Bluetooth + WiFi with no internet. Devices that have been paired once
// (Settings → Nearby devices → Pair a device) and are signed in to the same account
// exchange whichever records each side is missing or has newer. Safe to run
// alongside Supabase sync.
//
// Admission and transport security (PeerSyncService+Pairing.swift, protocol in
// PeerPairingCrypto.swift): one encrypted MCSession per peer; discovery info carries only a
// random device id and a pairing-mode flag; every session runs a mutual HMAC challenge-response
// with the Keychain pair secret, then the same-account check, before any manifest or record is
// sent or read.
//
// Matching key: syncCode (a UUID string generated locally at record creation).
// This lets offline-created records — ones that have never reached Supabase
// and therefore have no remoteId — still participate in peer sync.

struct PeerSyncEvent: Identifiable {
    let id = UUID()
    let peerName:    String
    let recordCount: Int
    let direction:   Direction
    let at:          Date

    enum Direction { case received, sent }

    var label: String {
        "\(recordCount) record\(recordCount == 1 ? "" : "s") \(direction == .received ? "from" : "to") \(peerName)"
    }
}

@MainActor
final class PeerSyncService: NSObject, ObservableObject {

    @Published var nearbyCount    = 0   // devices found (may not be connected)
    @Published var connectedCount = 0   // devices actively exchanging data
    @Published var isRunning      = false  // true while advertiser+browser are active
    @Published var lastPeerSyncAt: Date?
    @Published var peerSyncStatus: String = ""
    @Published var syncHistory: [PeerSyncEvent] = []   // last 20 sync events

    // Pairing (PeerSyncService+Pairing.swift)
    @Published var pairedDevices: [PairedPeerDevice] = []
    @Published var pairingCode: String?            // shown on this device while pairing
    @Published var pairingCodeExpiresAt: Date?
    @Published var pairingStatus: String = ""
    @Published var isPairingInProgress = false     // a code typed here is being used
    @Published var unpairedDeviceNearby = false    // a device on this build that is not paired
    @Published var legacyDeviceNearby = false      // a device still on a build without pairing
    @Published var pairingMigrationPending = false // updated from a build without pairing, not yet paired

    static let serviceType = "amise-medflow"   // ≤15 chars, alphanumeric+hyphen
    private static let peerIDKey = "com.amise.medflow.mcPeerID"

    let myPeer: MCPeerID
    /// This install's random id: the only identifier in discovery info.
    let deviceId: String
    /// One session per peer, so a peer that fails authentication can be disconnected alone.
    var sessions: [MCPeerID: MCSession] = [:]
    /// Handshake state per peer. Data flows only while `phase == .authenticated`.
    var links: [MCPeerID: PeerLink] = [:]
    var advertiser: MCNearbyServiceAdvertiser?
    var browser:    MCNearbyServiceBrowser?

    var modelContext: ModelContext?
    private(set) var storedEmail: String = ""

    var discovered: [MCPeerID: PeerPairingCrypto.Discovered] = [:]   // devices on this build
    var connectAttempts: [MCPeerID: Int] = [:]
    var pairingCodeAttemptUsed = false   // one confirmation attempt per displayed code
    var enteredCode: String?             // code typed on this device (the pairing initiator)
    var pairingTarget: MCPeerID?         // the device this device is pairing with

    var foundPeers: Set<MCPeerID> = []   // paired devices in range
    var receivedCount: [MCPeerID: Int] = [:]
    var sentCount:     [MCPeerID: Int] = [:]

    override init() {
        // An MCPeerID saved by an earlier launch means this install already used peer sync
        // under the old (unpaired) scheme: the user is asked to pair once.
        let existingInstall = UserDefaults.standard.data(forKey: Self.peerIDKey) != nil
        myPeer = Self.loadOrCreatePeerID()
        deviceId = PeerDeviceIdentity.loadOrCreate(existingInstall: existingInstall)
        super.init()
        pairingMigrationPending = PeerDeviceIdentity.migrationPending
        reloadPairedDevices()
    }

    // Persist the MCPeerID across launches — MPC uses the archived identity internally
    // to track known peers. Recreating a new ID each launch looks like a different device
    // to the framework and breaks discovery reliability.
    private static func loadOrCreatePeerID() -> MCPeerID {
        let key = peerIDKey
        if let data = UserDefaults.standard.data(forKey: key),
           let peer = try? NSKeyedUnarchiver.unarchivedObject(ofClass: MCPeerID.self, from: data) {
            return peer
        }
        let peer = MCPeerID(displayName: UIDevice.current.name)
        if let data = try? NSKeyedArchiver.archivedData(withRootObject: peer, requiringSecureCoding: true) {
            UserDefaults.standard.set(data, forKey: key)
        }
        return peer
    }

    // MARK: - Lifecycle

    func start(context: ModelContext, email: String) {
        guard !isRunning else { return }
        teardownTransport()
        modelContext = context
        storedEmail = email
        isRunning = true
        reloadPairedDevices()

        // Discovery info: random device id + pairing flag only (never the email or a hash of it).
        readvertise()

        browser = MCNearbyServiceBrowser(peer: myPeer, serviceType: Self.serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()

        peerSyncStatus = pairedDevices.isEmpty ? "" : "Looking for nearby devices…"
    }

    func stop() {
        isRunning = false   // first, so clearPairingCode() does not start a new advertiser
        teardownTransport()
        if pairingCode != nil || enteredCode != nil {
            pairingStatus = "Pairing stopped. Start again from Settings → Nearby devices."
        }
        clearPairingCode()
        enteredCode = nil
        pairingTarget = nil
        isPairingInProgress = false
        peerSyncStatus = ""
    }

    /// Stops advertising and browsing and disconnects every session.
    private func teardownTransport() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        advertiser?.delegate = nil
        browser?.delegate    = nil
        for peer in sessions.keys { recordHistory(for: peer) }
        for sess in sessions.values { sess.disconnect() }
        sessions.removeAll()
        links.removeAll()
        advertiser = nil
        browser    = nil
        discovered.removeAll()
        connectAttempts.removeAll()
        foundPeers.removeAll()
        receivedCount.removeAll()
        sentCount.removeAll()
        unpairedDeviceNearby = false
        legacyDeviceNearby   = false
        nearbyCount    = 0
        connectedCount = 0
    }

    func signOut() {
        stop()
        storedEmail = ""
    }

    // MARK: - Manual controls

    func syncNow() {
        guard isRunning else {
            peerSyncStatus = "Proximity sync not running"
            return
        }
        let peers = authenticatedPeers
        guard !peers.isEmpty else {
            peerSyncStatus = pairingPrompt ?? "No peers connected"
            return
        }
        for peer in peers { sendManifest(to: peer) }
        peerSyncStatus = "Sync triggered…"
    }

    func restart() {
        guard let ctx = modelContext, !storedEmail.isEmpty else { return }
        stop()
        start(context: ctx, email: storedEmail)
    }

    // MARK: - Send manifest on connect

    func sendManifest(to peer: MCPeerID) {
        // Only to a peer that has passed the challenge-response and the same-account check.
        guard let ctx = modelContext, isAuthenticated(peer), let sess = sessions[peer] else { return }
        Task {
            let manifest = await buildManifest(context: ctx)
            guard let data = try? JSONEncoder().encode(PeerMessage.manifest(manifest)) else { return }
            try? sess.send(data, toPeers: [peer], with: .reliable)
        }
    }

    // MARK: - Manifest builder (keyed by syncCode — includes offline records)

    /// syncKey: syncCode if set, otherwise the local id (legacy records).
    private static func syncKey(_ syncCode: String, _ id: UUID) -> String {
        syncCode.isEmpty ? id.uuidString : syncCode
    }

    /// One record type's manifest maps: cloud sync times (for older builds) and stamps
    /// (PeerVersion: max(updatedAt, syncedAt)).
    private static func manifestMaps<T>(_ records: [T], key: (T) -> String,
                                        updatedAt: (T) -> Date?, syncedAt: (T) -> Date?)
        -> (synced: [String: Double], stamps: [String: Double]) {
        var synced: [String: Double] = [:]
        var stamps: [String: Double] = [:]
        for record in records {
            let k = key(record)
            synced[k] = PeerVersion.epoch(syncedAt(record))
            stamps[k] = PeerVersion.stamp(updatedAt: updatedAt(record), syncedAt: syncedAt(record))
        }
        return (synced, stamps)
    }

    private func buildManifest(context: ModelContext) async -> PeerManifest {
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        var patients = Self.manifestMaps(allPatients, key: { Self.syncKey($0.syncCode, $0.id) },
                                         updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt })
        // Deleted on this device: listed with a far-future stamp, so no peer (this build or an
        // older one) sends them again. A live record's own entry wins.
        for id in PatientIdentityStore.deletedIds() where patients.synced[id] == nil {
            patients.synced[id] = PeerVersion.deletedHere
            patients.stamps[id] = PeerVersion.deletedHere
        }

        let notes = Self.manifestMaps((try? context.fetch(FetchDescriptor<ClinicalNote>())) ?? [],
                                      key: { Self.syncKey($0.syncCode, $0.id) },
                                      updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt })
        let rxs = Self.manifestMaps((try? context.fetch(FetchDescriptor<Prescription>())) ?? [],
                                    key: { Self.syncKey($0.syncCode, $0.id) },
                                    updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt })
        let vitals = Self.manifestMaps((try? context.fetch(FetchDescriptor<VitalsEntry>())) ?? [],
                                       key: { Self.syncKey($0.syncCode, $0.id) },
                                       updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt })
        let billing = Self.manifestMaps((try? context.fetch(FetchDescriptor<BillingLineItem>())) ?? [],
                                        key: { Self.syncKey($0.syncCode, $0.id) },
                                        updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt })

        // emailHash no longer gates anything (admission is PeerSyncService+Pairing.swift) and is
        // sent empty; the field stays so the manifest shape is unchanged.
        return PeerManifest(emailHash: "",
                            patients: patients.synced, notes: notes.synced,
                            prescriptions: rxs.synced, vitals: vitals.synced,
                            billingItems: billing.synced,
                            patientStamps: patients.stamps, noteStamps: notes.stamps,
                            prescriptionStamps: rxs.stamps, vitalsStamps: vitals.stamps,
                            billingStamps: billing.stamps)
    }

    // MARK: - Process received manifest → send missing or newer records

    /// The records the peer does not have, or holds an older copy of (PeerVersion.shouldSend).
    private static func toSend<T>(_ records: [T], key: (T) -> String,
                                  updatedAt: (T) -> Date?, syncedAt: (T) -> Date?,
                                  peerSynced: [String: Double], peerStamps: [String: Double]?) -> [T] {
        records.filter { record in
            let k = key(record)
            return PeerVersion.shouldSend(
                localStamp: PeerVersion.stamp(updatedAt: updatedAt(record), syncedAt: syncedAt(record)),
                localSynced: PeerVersion.epoch(syncedAt(record)),
                peerStamp: peerStamps?[k],
                peerSynced: peerSynced[k],
                peerSendsStamps: peerStamps != nil)
        }
    }

    private func sendRecords(_ message: PeerMessage, count: Int, to peer: MCPeerID, over sess: MCSession) {
        guard count > 0, let data = try? JSONEncoder().encode(message) else { return }
        try? sess.send(data, toPeers: [peer], with: .reliable)
        sentCount[peer, default: 0] += count
    }

    func handleManifest(_ manifest: PeerManifest, from peer: MCPeerID) {
        guard isAuthenticated(peer),
              let ctx = modelContext, let sess = sessions[peer] else { return }

        Task {
            let patients = Self.toSend((try? ctx.fetch(FetchDescriptor<Patient>())) ?? [],
                                       key: { Self.syncKey($0.syncCode, $0.id) },
                                       updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt },
                                       peerSynced: manifest.patients,
                                       peerStamps: manifest.patientStamps).map(PeerPatient.init)
            self.sendRecords(.patients(patients), count: patients.count, to: peer, over: sess)

            let notes = Self.toSend((try? ctx.fetch(FetchDescriptor<ClinicalNote>())) ?? [],
                                    key: { Self.syncKey($0.syncCode, $0.id) },
                                    updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt },
                                    peerSynced: manifest.notes,
                                    peerStamps: manifest.noteStamps).compactMap(PeerNote.init)
            self.sendRecords(.notes(notes), count: notes.count, to: peer, over: sess)

            let rxs = Self.toSend((try? ctx.fetch(FetchDescriptor<Prescription>())) ?? [],
                                  key: { Self.syncKey($0.syncCode, $0.id) },
                                  updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt },
                                  peerSynced: manifest.prescriptions,
                                  peerStamps: manifest.prescriptionStamps).map(PeerPrescription.init)
            self.sendRecords(.prescriptions(rxs), count: rxs.count, to: peer, over: sess)

            let vitals = Self.toSend((try? ctx.fetch(FetchDescriptor<VitalsEntry>())) ?? [],
                                     key: { Self.syncKey($0.syncCode, $0.id) },
                                     updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt },
                                     peerSynced: manifest.vitals,
                                     peerStamps: manifest.vitalsStamps).map(PeerVitals.init)
            self.sendRecords(.vitals(vitals), count: vitals.count, to: peer, over: sess)

            let billing = Self.toSend((try? ctx.fetch(FetchDescriptor<BillingLineItem>())) ?? [],
                                      key: { Self.syncKey($0.syncCode, $0.id) },
                                      updatedAt: { $0.updatedAt }, syncedAt: { $0.syncedAt },
                                      peerSynced: manifest.billingItems,
                                      peerStamps: manifest.billingStamps).map(PeerBillingItem.init)
            self.sendRecords(.billingItems(billing), count: billing.count, to: peer, over: sess)
        }
    }

}
