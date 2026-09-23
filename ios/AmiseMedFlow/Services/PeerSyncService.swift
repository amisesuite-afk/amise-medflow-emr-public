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
    private var session:   MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser:    MCNearbyServiceBrowser?

    private var modelContext: ModelContext?
    private var emailHash: String = ""
    private var storedEmail: String = ""

    private var foundPeers: Set<MCPeerID> = []
    private var receivedCount: [MCPeerID: Int] = [:]
    private var sentCount:     [MCPeerID: Int] = [:]

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

    private func sendManifest(to peer: MCPeerID) {
        guard let ctx = modelContext, let sess = session else { return }
        Task {
            let manifest = await buildManifest(context: ctx)
            guard let data = try? JSONEncoder().encode(PeerMessage.manifest(manifest)) else { return }
            try? sess.send(data, toPeers: [peer], with: .reliable)
        }
    }

    // MARK: - Manifest builder (keyed by syncCode — includes offline records)

    private func buildManifest(context: ModelContext) async -> PeerManifest {
        // syncKey: syncCode if set, otherwise fall back to local id (legacy records)
        let patients = (try? context.fetch(FetchDescriptor<Patient>()))?.reduce(into: [String:Double]()) { d, p in
            d[p.syncCode.isEmpty ? p.id.uuidString : p.syncCode] = (p.syncedAt ?? .distantPast).timeIntervalSince1970
        } ?? [:]

        let notes = (try? context.fetch(FetchDescriptor<ClinicalNote>()))?.reduce(into: [String:Double]()) { d, n in
            d[n.syncCode.isEmpty ? n.id.uuidString : n.syncCode] = (n.syncedAt ?? .distantPast).timeIntervalSince1970
        } ?? [:]

        let rxs = (try? context.fetch(FetchDescriptor<Prescription>()))?.reduce(into: [String:Double]()) { d, rx in
            d[rx.syncCode.isEmpty ? rx.id.uuidString : rx.syncCode] = (rx.syncedAt ?? .distantPast).timeIntervalSince1970
        } ?? [:]

        let vitals = (try? context.fetch(FetchDescriptor<VitalsEntry>()))?.reduce(into: [String:Double]()) { d, v in
            d[v.syncCode.isEmpty ? v.id.uuidString : v.syncCode] = (v.syncedAt ?? .distantPast).timeIntervalSince1970
        } ?? [:]

        let billing = (try? context.fetch(FetchDescriptor<BillingLineItem>()))?.reduce(into: [String:Double]()) { d, b in
            d[b.syncCode.isEmpty ? b.id.uuidString : b.syncCode] = (b.syncedAt ?? .distantPast).timeIntervalSince1970
        } ?? [:]

        return PeerManifest(emailHash: emailHash,
                            patients: patients, notes: notes,
                            prescriptions: rxs, vitals: vitals,
                            billingItems: billing)
    }

    // MARK: - Process received manifest → send missing records

    private func handleManifest(_ manifest: PeerManifest, from peer: MCPeerID) {
        guard manifest.emailHash == emailHash,
              let ctx = modelContext, let sess = session else { return }

        Task {
            let allPatients = (try? ctx.fetch(FetchDescriptor<Patient>())) ?? []
            let missingPatients = allPatients.filter { p in
                let myCode   = p.syncCode.isEmpty ? p.id.uuidString : p.syncCode
                let peerTime = manifest.patients[myCode] ?? 0
                let myTime   = (p.syncedAt ?? .distantPast).timeIntervalSince1970
                return myTime > peerTime
            }.map(PeerPatient.init)
            if !missingPatients.isEmpty,
               let data = try? JSONEncoder().encode(PeerMessage.patients(missingPatients)) {
                try? sess.send(data, toPeers: [peer], with: .reliable)
                self.sentCount[peer, default: 0] += missingPatients.count
            }

            let allNotes = (try? ctx.fetch(FetchDescriptor<ClinicalNote>())) ?? []
            let missingNotes = allNotes.filter { n in
                let myCode   = n.syncCode.isEmpty ? n.id.uuidString : n.syncCode
                let peerTime = manifest.notes[myCode] ?? 0
                let myTime   = (n.syncedAt ?? .distantPast).timeIntervalSince1970
                return myTime > peerTime
            }.compactMap(PeerNote.init)
            if !missingNotes.isEmpty,
               let data = try? JSONEncoder().encode(PeerMessage.notes(missingNotes)) {
                try? sess.send(data, toPeers: [peer], with: .reliable)
                self.sentCount[peer, default: 0] += missingNotes.count
            }

            let allRxs = (try? ctx.fetch(FetchDescriptor<Prescription>())) ?? []
            let missingRxs = allRxs.filter { rx in
                let myCode   = rx.syncCode.isEmpty ? rx.id.uuidString : rx.syncCode
                let peerTime = manifest.prescriptions[myCode] ?? 0
                let myTime   = (rx.syncedAt ?? .distantPast).timeIntervalSince1970
                return myTime > peerTime
            }.map(PeerPrescription.init)
            if !missingRxs.isEmpty,
               let data = try? JSONEncoder().encode(PeerMessage.prescriptions(missingRxs)) {
                try? sess.send(data, toPeers: [peer], with: .reliable)
                self.sentCount[peer, default: 0] += missingRxs.count
            }

            let allVitals = (try? ctx.fetch(FetchDescriptor<VitalsEntry>())) ?? []
            let missingVitals = allVitals.filter { v in
                let myCode   = v.syncCode.isEmpty ? v.id.uuidString : v.syncCode
                let peerTime = manifest.vitals[myCode] ?? 0
                let myTime   = (v.syncedAt ?? .distantPast).timeIntervalSince1970
                return myTime > peerTime
            }.map(PeerVitals.init)
            if !missingVitals.isEmpty,
               let data = try? JSONEncoder().encode(PeerMessage.vitals(missingVitals)) {
                try? sess.send(data, toPeers: [peer], with: .reliable)
                self.sentCount[peer, default: 0] += missingVitals.count
            }

            let allBilling = (try? ctx.fetch(FetchDescriptor<BillingLineItem>())) ?? []
            let missingBilling = allBilling.filter { b in
                let myCode   = b.syncCode.isEmpty ? b.id.uuidString : b.syncCode
                let peerTime = manifest.billingItems[myCode] ?? 0
                let myTime   = (b.syncedAt ?? .distantPast).timeIntervalSince1970
                return myTime > peerTime
            }.map(PeerBillingItem.init)
            if !missingBilling.isEmpty,
               let data = try? JSONEncoder().encode(PeerMessage.billingItems(missingBilling)) {
                try? sess.send(data, toPeers: [peer], with: .reliable)
                self.sentCount[peer, default: 0] += missingBilling.count
            }
        }
    }

}
