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
            let myTime   = patient.syncedAt ?? .distantPast
            let remoteIsNewer = peerTime > myTime

            // Identity — always propagate syncCode; fill in remoteId if missing
            patient.syncCode = rec.syncCode
            if patient.remoteId == nil, let rid = rec.remoteId { patient.remoteId = rid }

            // ── Administrative fields: remote wins when it is newer ──────────
            if remoteIsNewer {
                patient.fullName    = rec.fullName
                patient.sex         = Sex(rawValue: (rec.sex ?? "").capitalized) ?? .unspecified
                if let d = rec.dob  { patient.dateOfBirth = iso.date(from: d) }
                patient.phone       = rec.phone
                patient.email       = rec.email
                patient.address     = rec.address
                patient.mrn         = rec.mrn
                patient.nokName     = rec.nokName
                patient.nokRelation = rec.nokRelation
                patient.nokPhone    = rec.nokPhone
                patient.insuranceProvider = rec.insuranceProvider
                patient.policyNumber      = rec.policyNumber
                if let s = rec.setting  { patient.setting  = ClinicalSetting(rawValue: s.capitalized) ?? .outpatient }
                if let l = rec.location { patient.location  = ClinicalLocation(rawValue: l) ?? .rodney_bay }
                if let a = rec.acuity   { patient.acuity    = acuityFrom(a) }
                if let h = rec.heightCm { patient.heightCm  = h }
                if let w = rec.ward,        !w.isEmpty { patient.ward       = w }
                if let b = rec.bedNumber,   !b.isEmpty { patient.bedNumber  = b }
            }

            // ── Clinical narrative: longer value wins regardless of timestamp ─
            // Questionnaire data is multi-line structured text; booking stubs are
            // short phrases. The longer string is reliably the more clinically
            // informative source, so length is a safe proxy for richness.
            patient.chiefComplaint     = peerMerge(patient.chiefComplaint,     rec.chiefComplaint)
            patient.hpi                = peerMerge(patient.hpi,                rec.hpi)
            patient.pmhNotes           = peerMerge(patient.pmhNotes,           rec.pmhNotes)
            patient.familyHistoryNotes = peerMerge(patient.familyHistoryNotes, rec.familyHistoryNotes)
            patient.allergiesJson      = peerMerge(patient.allergiesJson,      rec.allergiesJson)
            patient.investigationsJson = peerMerge(patient.investigationsJson, rec.investigationsJson)
            patient.pmhEntriesJson     = peerMerge(patient.pmhEntriesJson,     rec.pmhEntriesJson)
            patient.pshxEntriesJson    = peerMerge(patient.pshxEntriesJson,    rec.pshxEntriesJson)
            patient.socialHistory      = peerMerge(patient.socialHistory,      rec.socialHistory)
            patient.surgicalHistory    = peerMerge(patient.surgicalHistory,    rec.surgicalHistory)

            // ── Visit metadata: nil on first fill; newer wins for updates ────────────
            if let vt = rec.visitType, patient.visitType == nil || remoteIsNewer {
                patient.visitType = VisitType(rawValue: vt)
            }
            if let ms = rec.mallampatiScore, (patient.mallampatiScore == nil || remoteIsNewer) {
                patient.mallampatiScore = ms
            }
            if let od = rec.operationDate {
                let iso = ISO8601DateFormatter()
                if let d = iso.date(from: od), (patient.operationDate == nil || remoteIsNewer) {
                    patient.operationDate = d
                }
            }

            // ── Procedure form JSON blobs: longer value wins (richer data) ───────────
            patient.traumaDataJson              = peerMerge(patient.traumaDataJson,              rec.traumaDataJson)
            patient.ogdDataJson                 = peerMerge(patient.ogdDataJson,                 rec.ogdDataJson)
            patient.colonoscopyDataJson         = peerMerge(patient.colonoscopyDataJson,         rec.colonoscopyDataJson)
            patient.surgeryDataJson             = peerMerge(patient.surgeryDataJson,             rec.surgeryDataJson)
            patient.ercpDataJson                = peerMerge(patient.ercpDataJson,                rec.ercpDataJson)
            patient.bronchoscopyDataJson        = peerMerge(patient.bronchoscopyDataJson,        rec.bronchoscopyDataJson)
            patient.dischargeSummaryDataJson    = peerMerge(patient.dischargeSummaryDataJson,    rec.dischargeSummaryDataJson)
            patient.postOpReviewDataJson        = peerMerge(patient.postOpReviewDataJson,        rec.postOpReviewDataJson)
            patient.referralLetterDataJson      = peerMerge(patient.referralLetterDataJson,      rec.referralLetterDataJson)
            patient.consentFormDataJson         = peerMerge(patient.consentFormDataJson,         rec.consentFormDataJson)
            patient.preOpChecklistDataJson      = peerMerge(patient.preOpChecklistDataJson,      rec.preOpChecklistDataJson)
            patient.patientInstructionsDataJson = peerMerge(patient.patientInstructionsDataJson, rec.patientInstructionsDataJson)

            // ── Doctor-assessed fields: non-empty on first fill; newer wins for updates ──
            patient.assessmentText = mergeDoc(patient.assessmentText, rec.assessmentText, remoteIsNewer: remoteIsNewer)
            patient.managementPlan = mergeDoc(patient.managementPlan, rec.managementPlan, remoteIsNewer: remoteIsNewer)
            if let r = rec.workingDiagnosis, !r.isEmpty {
                if (patient.workingDiagnosis ?? "").isEmpty || remoteIsNewer {
                    patient.workingDiagnosis    = r
                    patient.workingDiagnosisICD = rec.workingDiagnosisICD
                }
            }

            // ── Exam findings: non-empty on first fill; newer wins for updates ─
            patient.examGeneral = mergeDoc(patient.examGeneral, rec.examGeneral, remoteIsNewer: remoteIsNewer)
            patient.examCVS     = mergeDoc(patient.examCVS,     rec.examCVS,     remoteIsNewer: remoteIsNewer)
            patient.examResp    = mergeDoc(patient.examResp,    rec.examResp,    remoteIsNewer: remoteIsNewer)
            patient.examAbdo    = mergeDoc(patient.examAbdo,    rec.examAbdo,    remoteIsNewer: remoteIsNewer)
            patient.examNeuro   = mergeDoc(patient.examNeuro,   rec.examNeuro,   remoteIsNewer: remoteIsNewer)
            patient.examMSK     = mergeDoc(patient.examMSK,     rec.examMSK,     remoteIsNewer: remoteIsNewer)
            patient.examSkin    = mergeDoc(patient.examSkin,    rec.examSkin,    remoteIsNewer: remoteIsNewer)
            patient.examOther   = mergeDoc(patient.examOther,   rec.examOther,   remoteIsNewer: remoteIsNewer)

            patient.syncedAt    = max(myTime, peerTime)
            patient.pendingSync = false
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

    // DJB2 — stable across devices/processes, unlike Swift's randomized hashValue
    private static func stableHash(_ s: String) -> String {
        var h: UInt64 = 5381
        for byte in s.utf8 { h = h &* 33 &+ UInt64(byte) }
        return String(h)
    }

    private func acuityFrom(_ s: String) -> Acuity {
        switch s {
        case "emergency": return .emergency
        case "urgent":    return .urgent
        case "priority":  return .priority
        default:          return .routine
        }
    }

    // Non-empty wins; on both-non-empty, keeps the longer (more structured) value.
    // Used for questionnaire narrative fields where length correlates with clinical richness.
    private func peerMerge(_ local: String?, _ remote: String?) -> String? {
        let loc = (local ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rem = (remote ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if loc.isEmpty && rem.isEmpty { return nil }
        if loc.isEmpty { return rem }
        if rem.isEmpty { return loc }
        return loc.count >= rem.count ? loc : rem
    }

    // Non-empty wins on first fill; newer timestamp wins when both sides have content.
    // Used for doctor-entered fields (assessment, exam) that may be revised on any device.
    private func mergeDoc(_ local: String?, _ remote: String?, remoteIsNewer: Bool) -> String? {
        let loc = (local ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rem = (remote ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if rem.isEmpty { return local }   // Never overwrite existing content with empty
        if loc.isEmpty { return rem }     // Fill from remote if local is empty
        return remoteIsNewer ? rem : loc  // Both have content: newer device wins
    }
}

