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
        myPeer = MCPeerID(displayName: UIDevice.current.name)
        super.init()
    }

    // MARK: - Lifecycle

    func start(context: ModelContext, email: String) {
        guard session == nil else { return }
        modelContext = context
        storedEmail = email
        emailHash = String(email.lowercased().hashValue)

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

    // MARK: - Apply received records

    private func applyPatients(_ records: [PeerPatient], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let iso = ISO8601DateFormatter()
        for rec in records {
            // Match by syncCode first; fall back to remoteId for records synced before this feature
            let patient = existing.first { $0.syncCode == rec.syncCode }
                ?? existing.first { rid in rec.remoteId != nil && rid.remoteId == rec.remoteId }
                ?? {
                    let p = Patient(fullName: rec.fullName)
                    context.insert(p)
                    return p
                }()

            let peerTime = Date(timeIntervalSince1970: rec.syncedAt)
            if let mySyncedAt = patient.syncedAt, mySyncedAt >= peerTime { continue }

            // Preserve the original syncCode (and migrate legacy "" records)
            patient.syncCode      = rec.syncCode
            // Only overwrite remoteId if peer has one and we don't
            if patient.remoteId == nil, let rid = rec.remoteId { patient.remoteId = rid }
            patient.fullName      = rec.fullName
            patient.sex           = Sex(rawValue: (rec.sex ?? "").capitalized) ?? .unspecified
            if let d = rec.dob    { patient.dateOfBirth = iso.date(from: d) }
            patient.phone         = rec.phone
            patient.email         = rec.email
            patient.address       = rec.address
            patient.mrn           = rec.mrn
            patient.nokName       = rec.nokName
            patient.nokRelation   = rec.nokRelation
            patient.nokPhone      = rec.nokPhone
            patient.pmhNotes      = rec.pmhNotes
            patient.familyHistoryNotes  = rec.familyHistoryNotes
            patient.insuranceProvider   = rec.insuranceProvider
            patient.policyNumber        = rec.policyNumber
            if let s = rec.setting  { patient.setting  = ClinicalSetting(rawValue: s.capitalized) ?? .outpatient }
            if let l = rec.location { patient.location  = ClinicalLocation(rawValue: l) ?? .rodney_bay }
            if let a = rec.acuity   { patient.acuity    = acuityFrom(a) }
            patient.chiefComplaint      = rec.chiefComplaint
            patient.hpi                 = rec.hpi
            patient.assessmentText      = rec.assessmentText
            patient.managementPlan      = rec.managementPlan
            patient.workingDiagnosis    = rec.workingDiagnosis
            patient.workingDiagnosisICD = rec.workingDiagnosisICD
            patient.allergiesJson       = rec.allergiesJson
            patient.socialHistory       = rec.socialHistory
            patient.heightCm            = rec.heightCm
            patient.ward                = rec.ward
            patient.bedNumber           = rec.bedNumber
            patient.examGeneral         = rec.examGeneral
            patient.examCVS             = rec.examCVS
            patient.examResp            = rec.examResp
            patient.examAbdo            = rec.examAbdo
            patient.examNeuro           = rec.examNeuro
            patient.examMSK             = rec.examMSK
            patient.examSkin            = rec.examSkin
            patient.examOther           = rec.examOther
            patient.syncedAt            = peerTime
            patient.pendingSync         = false
        }
        try context.save()
    }

    private func applyNotes(_ records: [PeerNote], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<ClinicalNote>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
            // Match patient by syncCode; fall back to remoteId
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                              ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let noteType = NoteType(rawValue: rec.noteType) ?? .other
            let note = ClinicalNote(noteType: noteType, patient: patient)
            note.syncCode    = rec.syncCode
            note.remoteId    = rec.remoteId
            note.status      = NoteStatus(rawValue: rec.status) ?? .draft
            note.freeText    = rec.content
            note.syncedAt    = Date(timeIntervalSince1970: rec.syncedAt)
            note.pendingSync = false
            context.insert(note)
        }
        try context.save()
    }

    private func applyPrescriptions(_ records: [PeerPrescription], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Prescription>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let rx = Prescription(drug: rec.drug,
                                  dose: rec.dose ?? "",
                                  route: rec.route ?? "Oral",
                                  frequency: rec.frequency ?? "",
                                  duration: rec.duration ?? "",
                                  indication: rec.indication ?? "")
            rx.syncCode     = rec.syncCode
            rx.instructions = rec.instructions
            rx.prescribedAt = Date(timeIntervalSince1970: rec.prescribedAt)
            rx.patient      = patient
            rx.remoteId     = rec.remoteId
            rx.syncedAt     = Date(timeIntervalSince1970: rec.syncedAt)
            rx.pendingSync  = false
            context.insert(rx)
        }
        try context.save()
    }

    private func applyVitals(_ records: [PeerVitals], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<VitalsEntry>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let v = VitalsEntry(patient: patient,
                                recordedAt: Date(timeIntervalSince1970: rec.recordedAt))
            v.syncCode           = rec.syncCode
            v.bpSystolic         = rec.bpSystolic
            v.bpDiastolic        = rec.bpDiastolic
            v.heartRate          = rec.heartRate
            v.respiratoryRate    = rec.respiratoryRate
            v.temperatureCelsius = rec.temperatureCelsius
            v.spo2               = rec.spo2
            v.weightKg           = rec.weightKg
            v.glucoseMmol        = rec.glucoseMmol
            v.avpu               = AVPU(rawValue: rec.avpu) ?? .alert
            v.onSupplementalO2   = rec.onSupplementalO2
            v.notes              = rec.notes
            v.remoteId           = rec.remoteId
            v.syncedAt           = Date(timeIntervalSince1970: rec.syncedAt)
            v.pendingSync        = false
            context.insert(v)
        }
        try context.save()
    }

    private func applyBillingItems(_ records: [PeerBillingItem], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<BillingLineItem>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let item = BillingLineItem(code: rec.cptCode,
                                      description: rec.cptDescription,
                                      category: rec.cptCategory)
            item.syncCode    = rec.syncCode
            item.units       = rec.units
            item.amountXCD   = rec.amountXCD
            item.modifier    = rec.modifier
            item.note        = rec.note
            item.addedAt     = Date(timeIntervalSince1970: rec.addedAt)
            item.patient     = patient
            item.remoteId    = rec.remoteId
            item.syncedAt    = Date(timeIntervalSince1970: rec.syncedAt)
            item.pendingSync = false
            context.insert(item)
        }
        try context.save()
    }

    // MARK: - Helpers

    private func acuityFrom(_ s: String) -> Acuity {
        switch s {
        case "emergency": return .emergency
        case "urgent":    return .urgent
        case "priority":  return .priority
        default:          return .routine
        }
    }
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension PeerSyncService: MCNearbyServiceAdvertiserDelegate {
    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didReceiveInvitationFromPeer peer: MCPeerID,
                                 withContext context: Data?,
                                 invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        var peerHash: String? = nil
        if let ctx = context, let str = String(data: ctx, encoding: .utf8) {
            peerHash = str
        }
        Task { @MainActor in
            let accept = peerHash == nil || peerHash == self.emailHash
            invitationHandler(accept, self.session)
        }
    }

    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didNotStartAdvertisingPeer error: Error) {
        Task { @MainActor in
            self.peerSyncStatus = "Proximity sync unavailable"
        }
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension PeerSyncService: MCNearbyServiceBrowserDelegate {
    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              foundPeer peer: MCPeerID,
                              withDiscoveryInfo info: [String: String]?) {
        let peerHash = info?["h"]
        Task { @MainActor in
            guard peerHash == nil || peerHash == self.emailHash else { return }
            guard let sess = self.session else { return }
            guard !sess.connectedPeers.contains(peer) else { return }
            self.foundPeers.insert(peer)
            self.nearbyCount = self.foundPeers.count
            let ctx = self.emailHash.data(using: .utf8)
            browser.invitePeer(peer, to: sess, withContext: ctx, timeout: 30)
            self.peerSyncStatus = "Connecting to \(peer.displayName)…"
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              lostPeer peer: MCPeerID) {
        Task { @MainActor in
            self.foundPeers.remove(peer)
            self.nearbyCount = self.foundPeers.count
            if self.connectedCount == 0 { self.peerSyncStatus = "Looking for nearby devices…" }
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              didNotStartBrowsingForPeers error: Error) {
        Task { @MainActor in self.peerSyncStatus = "Proximity sync unavailable" }
    }
}

// MARK: - MCSessionDelegate

extension PeerSyncService: MCSessionDelegate {
    nonisolated func session(_ session: MCSession,
                              peer peerID: MCPeerID,
                              didChange state: MCSessionState) {
        Task { @MainActor in
            self.connectedCount = session.connectedPeers.count
            switch state {
            case .connected:
                self.peerSyncStatus = "Syncing with \(peerID.displayName)…"
                self.sendManifest(to: peerID)
            case .notConnected:
                let rcvd = self.receivedCount.removeValue(forKey: peerID) ?? 0
                let sent  = self.sentCount.removeValue(forKey: peerID) ?? 0
                for (count, direction) in [(rcvd, PeerSyncEvent.Direction.received), (sent, .sent)] {
                    guard count > 0 else { continue }
                    let event = PeerSyncEvent(peerName: peerID.displayName,
                                              recordCount: count,
                                              direction: direction,
                                              at: .now)
                    self.syncHistory.insert(event, at: 0)
                    if self.syncHistory.count > 20 {
                        self.syncHistory = Array(self.syncHistory.prefix(20))
                    }
                }
                if session.connectedPeers.isEmpty { self.peerSyncStatus = "Looking for nearby devices…" }
            default: break
            }
        }
    }

    nonisolated func session(_ session: MCSession,
                              didReceive data: Data,
                              fromPeer peerID: MCPeerID) {
        Task { @MainActor in
            guard let ctx = self.modelContext else { return }
            guard let message = try? JSONDecoder().decode(PeerMessage.self, from: data) else { return }

            switch message {
            case .manifest(let m):
                self.handleManifest(m, from: peerID)

            case .patients(let recs):
                try? self.applyPatients(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count
                self.lastPeerSyncAt = .now
                self.peerSyncStatus = "Synced \(recs.count) patient\(recs.count == 1 ? "" : "s") from \(peerID.displayName)"

            case .notes(let recs):
                try? self.applyNotes(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .prescriptions(let recs):
                try? self.applyPrescriptions(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .vitals(let recs):
                try? self.applyVitals(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .billingItems(let recs):
                try? self.applyBillingItems(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count
            }
        }
    }

    nonisolated func session(_ session: MCSession, didReceive stream: InputStream,
                              withName streamName: String, fromPeer peerID: MCPeerID) {}
    nonisolated func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String,
                              fromPeer peerID: MCPeerID, with progress: Progress) {}
    nonisolated func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                              fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

// MARK: - Message protocol

private indirect enum PeerMessage: Codable {
    case manifest(PeerManifest)
    case patients([PeerPatient])
    case notes([PeerNote])
    case prescriptions([PeerPrescription])
    case vitals([PeerVitals])
    case billingItems([PeerBillingItem])

    private enum TypeKey: String, Codable {
        case manifest, patients, notes, prescriptions, vitals, billingItems
    }
    private enum CodingKeys: String, CodingKey { case type, payload }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .manifest(let v):      try c.encode(TypeKey.manifest, forKey: .type);      try c.encode(v, forKey: .payload)
        case .patients(let v):      try c.encode(TypeKey.patients, forKey: .type);      try c.encode(v, forKey: .payload)
        case .notes(let v):         try c.encode(TypeKey.notes, forKey: .type);         try c.encode(v, forKey: .payload)
        case .prescriptions(let v): try c.encode(TypeKey.prescriptions, forKey: .type); try c.encode(v, forKey: .payload)
        case .vitals(let v):        try c.encode(TypeKey.vitals, forKey: .type);        try c.encode(v, forKey: .payload)
        case .billingItems(let v):  try c.encode(TypeKey.billingItems, forKey: .type);  try c.encode(v, forKey: .payload)
        }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(TypeKey.self, forKey: .type)
        switch type {
        case .manifest:      self = .manifest(try c.decode(PeerManifest.self, forKey: .payload))
        case .patients:      self = .patients(try c.decode([PeerPatient].self, forKey: .payload))
        case .notes:         self = .notes(try c.decode([PeerNote].self, forKey: .payload))
        case .prescriptions: self = .prescriptions(try c.decode([PeerPrescription].self, forKey: .payload))
        case .vitals:        self = .vitals(try c.decode([PeerVitals].self, forKey: .payload))
        case .billingItems:  self = .billingItems(try c.decode([PeerBillingItem].self, forKey: .payload))
        }
    }
}

// MARK: - Transfer data structs

private struct PeerManifest: Codable {
    let emailHash:     String
    let patients:      [String: Double]   // syncCode → syncedAt epoch seconds
    let notes:         [String: Double]
    let prescriptions: [String: Double]
    let vitals:        [String: Double]
    let billingItems:  [String: Double]
}

private struct PeerPatient: Codable {
    let syncCode: String       // stable offline sync ID
    let remoteId: String?      // Supabase ID if cloud-synced
    let fullName: String
    let sex, dob, phone, email, address, mrn: String?
    let nokName, nokRelation, nokPhone: String?
    let pmhNotes, familyHistoryNotes: String?
    let insuranceProvider, policyNumber: String?
    let setting, location, acuity: String?
    let chiefComplaint, hpi, assessmentText, managementPlan: String?
    let workingDiagnosis, workingDiagnosisICD: String?
    let allergiesJson, socialHistory: String?
    let heightCm: Double?
    let ward, bedNumber: String?
    let examGeneral, examCVS, examResp, examAbdo: String?
    let examNeuro, examMSK, examSkin, examOther: String?
    let syncedAt: Double

    init(_ p: Patient) {
        let iso = ISO8601DateFormatter()
        syncCode        = p.syncCode.isEmpty ? p.id.uuidString : p.syncCode
        remoteId        = p.remoteId
        fullName        = p.fullName
        sex             = p.sex.rawValue.lowercased()
        dob             = p.dateOfBirth.map { iso.string(from: $0) }
        phone           = p.phone; email = p.email; address = p.address; mrn = p.mrn
        nokName         = p.nokName; nokRelation = p.nokRelation; nokPhone = p.nokPhone
        pmhNotes        = p.pmhNotes; familyHistoryNotes = p.familyHistoryNotes
        insuranceProvider = p.insuranceProvider; policyNumber = p.policyNumber
        setting         = p.setting.rawValue.lowercased()
        location        = p.location.rawValue
        acuity          = p.acuity.label.lowercased()
        chiefComplaint  = p.chiefComplaint; hpi = p.hpi
        assessmentText  = p.assessmentText; managementPlan = p.managementPlan
        workingDiagnosis = p.workingDiagnosis; workingDiagnosisICD = p.workingDiagnosisICD
        allergiesJson   = p.allergiesJson; socialHistory = p.socialHistory
        heightCm        = p.heightCm; ward = p.ward; bedNumber = p.bedNumber
        examGeneral     = p.examGeneral; examCVS = p.examCVS; examResp = p.examResp
        examAbdo        = p.examAbdo; examNeuro = p.examNeuro; examMSK = p.examMSK
        examSkin        = p.examSkin; examOther = p.examOther
        syncedAt        = (p.syncedAt ?? .distantPast).timeIntervalSince1970
    }
}

private struct PeerNote: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let noteType, status, content: String
    let syncedAt: Double

    init?(_ n: ClinicalNote) {
        guard let pid = n.patient?.syncCode, !pid.isEmpty else { return nil }
        syncCode        = n.syncCode.isEmpty ? n.id.uuidString : n.syncCode
        patientSyncCode = pid
        remoteId        = n.remoteId
        noteType        = n.noteType.rawValue
        status          = n.status.rawValue
        content         = n.contentForSync
        syncedAt        = (n.syncedAt ?? .distantPast).timeIntervalSince1970
    }
}

private struct PeerPrescription: Codable {
    let syncCode, patientSyncCode, drug: String
    let remoteId: String?
    let dose, route, frequency, duration, indication, instructions: String?
    let prescribedAt, syncedAt: Double

    init(_ rx: Prescription) {
        syncCode        = rx.syncCode.isEmpty ? rx.id.uuidString : rx.syncCode
        patientSyncCode = rx.patient?.syncCode.isEmpty == false
                          ? rx.patient!.syncCode : rx.patient?.id.uuidString ?? ""
        remoteId        = rx.remoteId
        drug            = rx.drug
        dose            = rx.dose.isEmpty ? nil : rx.dose
        route           = rx.route.isEmpty ? nil : rx.route
        frequency       = rx.frequency.isEmpty ? nil : rx.frequency
        duration        = rx.duration.isEmpty ? nil : rx.duration
        indication      = rx.indication.isEmpty ? nil : rx.indication
        instructions    = rx.instructions
        prescribedAt    = rx.prescribedAt.timeIntervalSince1970
        syncedAt        = (rx.syncedAt ?? .distantPast).timeIntervalSince1970
    }
}

private struct PeerVitals: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let recordedAt: Double
    let bpSystolic, bpDiastolic, heartRate, respiratoryRate: Int?
    let temperatureCelsius: Double?
    let spo2: Int?
    let weightKg, glucoseMmol: Double?
    let avpu: String
    let onSupplementalO2: Bool
    let notes: String?
    let syncedAt: Double

    init(_ v: VitalsEntry) {
        syncCode           = v.syncCode.isEmpty ? v.id.uuidString : v.syncCode
        patientSyncCode    = v.patient?.syncCode.isEmpty == false
                             ? v.patient!.syncCode : v.patient?.id.uuidString ?? ""
        remoteId           = v.remoteId
        recordedAt         = v.recordedAt.timeIntervalSince1970
        bpSystolic         = v.bpSystolic; bpDiastolic = v.bpDiastolic
        heartRate          = v.heartRate; respiratoryRate = v.respiratoryRate
        temperatureCelsius = v.temperatureCelsius
        spo2               = v.spo2; weightKg = v.weightKg; glucoseMmol = v.glucoseMmol
        avpu               = v.avpu.rawValue; onSupplementalO2 = v.onSupplementalO2
        notes              = v.notes
        syncedAt           = (v.syncedAt ?? .distantPast).timeIntervalSince1970
    }
}

private struct PeerBillingItem: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let cptCode, cptDescription, cptCategory: String
    let units: Int; let amountXCD: Double
    let modifier, note: String
    let addedAt, syncedAt: Double

    init(_ b: BillingLineItem) {
        syncCode           = b.syncCode.isEmpty ? b.id.uuidString : b.syncCode
        patientSyncCode    = b.patient?.syncCode.isEmpty == false
                             ? b.patient!.syncCode : b.patient?.id.uuidString ?? ""
        remoteId           = b.remoteId
        cptCode            = b.cptCode; cptDescription = b.cptDescription; cptCategory = b.cptCategory
        units              = b.units; amountXCD = b.amountXCD
        modifier           = b.modifier; note = b.note
        addedAt            = b.addedAt.timeIntervalSince1970
        syncedAt           = (b.syncedAt ?? .distantPast).timeIntervalSince1970
    }
}
