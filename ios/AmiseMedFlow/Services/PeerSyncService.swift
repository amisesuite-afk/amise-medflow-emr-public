import Foundation
import MultipeerConnectivity
import SwiftData
import UIKit

// MARK: - Peer-to-peer sync (Multipeer Connectivity)
//
// Works over Bluetooth + WiFi with no internet. Devices running the same
// signed-in account discover each other automatically and exchange
// whichever records each side is missing or has newer. Safe to run
// alongside Supabase sync.
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

    private static let serviceType = "amise-medflow"   // ≤15 chars, alphanumeric+hyphen

    private let myPeer: MCPeerID
    var session:   MCSession?
    var advertiser: MCNearbyServiceAdvertiser?
    var browser:    MCNearbyServiceBrowser?

    var modelContext: ModelContext?
    var emailHash: String = ""
    private var storedEmail: String = ""

    var foundPeers: Set<MCPeerID> = []
    var receivedCount: [MCPeerID: Int] = [:]
    var sentCount:     [MCPeerID: Int] = [:]

    override init() {
        myPeer = Self.loadOrCreatePeerID()
        super.init()
    }

    // Persist the MCPeerID across launches — MPC uses the archived identity internally
    // to track known peers. Recreating a new ID each launch looks like a different device
    // to the framework and breaks discovery reliability.
    private static func loadOrCreatePeerID() -> MCPeerID {
        let key = "com.amise.medflow.mcPeerID"
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
        guard session == nil else { return }
        modelContext = context
        storedEmail = email
        emailHash = Self.stableHash(email.lowercased())

        session = MCSession(peer: myPeer, securityIdentity: nil,
                            encryptionPreference: .required)
        session?.delegate = self

        let info = ["h": emailHash]
        advertiser = MCNearbyServiceAdvertiser(peer: myPeer,
                                               discoveryInfo: info,
                                               serviceType: Self.serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()

        browser = MCNearbyServiceBrowser(peer: myPeer, serviceType: Self.serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()

        isRunning      = true
        peerSyncStatus = "Looking for nearby devices…"
    }

    func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        session    = nil
        advertiser = nil
        browser    = nil
        foundPeers.removeAll()
        receivedCount.removeAll()
        sentCount.removeAll()
        nearbyCount    = 0
        connectedCount = 0
        isRunning      = false
        peerSyncStatus = ""
    }

    func signOut() {
        stop()
        storedEmail = ""
        emailHash   = ""
    }

    // MARK: - Manual controls

    func syncNow() {
        guard let sess = session else {
            peerSyncStatus = "Proximity sync not running"
            return
        }
        guard !sess.connectedPeers.isEmpty else {
            peerSyncStatus = "No peers connected"
            return
        }
        for peer in sess.connectedPeers { sendManifest(to: peer) }
        peerSyncStatus = "Sync triggered…"
    }

    func restart() {
        guard let ctx = modelContext, !storedEmail.isEmpty else { return }
        stop()
        start(context: ctx, email: storedEmail)
    }

    // MARK: - Send manifest on connect

    func sendManifest(to peer: MCPeerID) {
        guard let ctx = modelContext, let sess = session else { return }
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

        return PeerManifest(emailHash: emailHash,
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
        guard manifest.emailHash == emailHash,
              let ctx = modelContext, let sess = session else { return }

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
