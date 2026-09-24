import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Peer-sync merge rules (no Multipeer session is started — only the merge code runs):
/// - clinical narrative: the longer value wins regardless of timestamp,
/// - administrative and doctor-assessed fields: the newer device wins when both have content,
/// - content is never replaced by an empty value.
@MainActor
final class PeerSyncMergeTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!
    /// A second store standing in for the other device.
    private var remoteContainer: ModelContainer!
    private var remoteContext: ModelContext!
    private var service: PeerSyncService!

    // PatientIdentityStore's deleted-ids key (private in the app); saved and restored around each test.
    private let deletedKey = "amf.patients.deletedRemoteIds"
    private var savedDeleted: Any?

    private let t0 = Date(timeIntervalSince1970: 1_750_000_000)
    private var t1: Date { t0.addingTimeInterval(3600) }

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        remoteContainer = try ModelContainer(for: schema,
                                             configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        remoteContext = remoteContainer.mainContext
        service = PeerSyncService()
        savedDeleted = UserDefaults.standard.object(forKey: deletedKey)
    }

    override func tearDown() async throws {
        if let saved = savedDeleted {
            UserDefaults.standard.set(saved, forKey: deletedKey)
        } else {
            UserDefaults.standard.removeObject(forKey: deletedKey)
        }
    }

    // MARK: - Helpers

    private func localPatient(syncedAt: Date) -> Patient {
        let p = Patient(fullName: "Mary Local")
        p.phone = "758-111-1111"
        p.mrn = "H-700"
        p.chiefComplaint = "Abdominal pain"
        p.hpi = "RUQ pain"
        p.assessmentText = "Local assessment"
        p.examAbdo = "Soft"
        p.workingDiagnosis = "Biliary colic"
        p.syncedAt = syncedAt
        p.pendingSync = true
        context.insert(p)
        return p
    }

    /// The other device's copy of `local` (same syncCode), as it would arrive over peer sync.
    private func remoteRecord(of local: Patient, syncedAt: Date, _ configure: (Patient) -> Void) -> PeerPatient {
        let r = Patient(fullName: local.fullName)
        remoteContext.insert(r)
        r.syncCode = local.syncCode
        r.mrn = local.mrn
        r.syncedAt = syncedAt
        configure(r)
        return PeerPatient(r)
    }

    private func patientCount() throws -> Int {
        try context.fetch(FetchDescriptor<Patient>()).count
    }

    // MARK: - peerMerge (clinical narrative: longer wins)

    func testPeerMergeLongerValueWins() {
        XCTAssertEqual(service.peerMerge("short", "much longer text"), "much longer text")
        XCTAssertEqual(service.peerMerge("much longer text", "short"), "much longer text")
    }

    func testPeerMergeEqualLengthKeepsLocal() {
        XCTAssertEqual(service.peerMerge("aaa", "bbb"), "aaa")
    }

    func testPeerMergeNeverReplacesContentWithEmpty() {
        XCTAssertEqual(service.peerMerge("local", nil), "local")
        XCTAssertEqual(service.peerMerge("local", "   "), "local")
        XCTAssertEqual(service.peerMerge(nil, "remote"), "remote")
        XCTAssertEqual(service.peerMerge("", "remote"), "remote")
        XCTAssertNil(service.peerMerge(nil, nil))
        XCTAssertNil(service.peerMerge(" ", "\n"))
    }

    func testPeerMergeTrimsWhitespace() {
        XCTAssertEqual(service.peerMerge("  padded  ", nil), "padded")
    }

    // MARK: - mergeDoc (doctor-entered fields: newer wins)

    func testMergeDocNewerWinsWhenBothHaveContent() {
        XCTAssertEqual(service.mergeDoc("local", "remote", remoteIsNewer: true), "remote")
        XCTAssertEqual(service.mergeDoc("local", "remote", remoteIsNewer: false), "local")
    }

    func testMergeDocFillsEmptyAndNeverBlanks() {
        XCTAssertEqual(service.mergeDoc(nil, "remote", remoteIsNewer: false), "remote")
        XCTAssertEqual(service.mergeDoc("", "remote", remoteIsNewer: false), "remote")
        XCTAssertEqual(service.mergeDoc("local", nil, remoteIsNewer: true), "local")
        XCTAssertEqual(service.mergeDoc("local", "  ", remoteIsNewer: true), "local")
        XCTAssertNil(service.mergeDoc(nil, nil, remoteIsNewer: true))
    }

    // MARK: - Helpers used for peer matching

    func testStableHashIsDJB2() {
        XCTAssertEqual(PeerSyncService.stableHash(""), "5381")
        XCTAssertEqual(PeerSyncService.stableHash("a"), "177670")
        XCTAssertEqual(PeerSyncService.stableHash("ab"), "5863208")
        XCTAssertEqual(PeerSyncService.stableHash("dr@example.com"), PeerSyncService.stableHash("dr@example.com"))
        XCTAssertNotEqual(PeerSyncService.stableHash("a"), PeerSyncService.stableHash("b"))
    }

    func testAcuityMapping() {
        XCTAssertEqual(service.acuityFrom("emergency"), .emergency)
        XCTAssertEqual(service.acuityFrom("urgent"), .urgent)
        XCTAssertEqual(service.acuityFrom("priority"), .priority)
        XCTAssertEqual(service.acuityFrom("routine"), .routine)
        XCTAssertEqual(service.acuityFrom("unknown"), .routine)
    }

    // MARK: - applyPatients (whole record)

    func testNewerRemoteWinsAdminAndAssessmentButLongerNarrativeWins() throws {
        let local = localPatient(syncedAt: t0)
        let rec = remoteRecord(of: local, syncedAt: t1) { r in
            r.fullName = "Mary Remote"
            r.phone = "758-222-2222"
            r.chiefComplaint = "Pain"                                   // shorter than local
            r.hpi = "RUQ pain for three days, worse after fatty food"   // longer than local
            r.assessmentText = "Remote assessment"
            r.examAbdo = nil                                            // empty on the other device
            r.workingDiagnosis = "Acute cholecystitis"
            r.workingDiagnosisICD = "K81.0"
        }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(try patientCount(), 1, "matched by syncCode, not duplicated")
        XCTAssertEqual(local.fullName, "Mary Remote")
        XCTAssertEqual(local.phone, "758-222-2222")
        XCTAssertEqual(local.mrn, "H-700")
        XCTAssertEqual(local.chiefComplaint, "Abdominal pain")
        XCTAssertEqual(local.hpi, "RUQ pain for three days, worse after fatty food")
        XCTAssertEqual(local.assessmentText, "Remote assessment")
        XCTAssertEqual(local.examAbdo, "Soft")
        XCTAssertEqual(local.workingDiagnosis, "Acute cholecystitis")
        XCTAssertEqual(local.workingDiagnosisICD, "K81.0")
        XCTAssertEqual(local.syncedAt, t1)
        XCTAssertTrue(local.pendingSync,
                      "unsent local edits are never cleared by a peer (the cloud pull would revert them)")
    }

    func testOlderRemoteKeepsLocalAdminAndAssessmentButStillFillsGaps() throws {
        let local = localPatient(syncedAt: t1)
        let rec = remoteRecord(of: local, syncedAt: t0) { r in
            r.fullName = "Mary Stale"
            r.phone = "758-000-0000"
            r.hpi = "RUQ pain radiating to the right shoulder tip"      // longer than local
            r.assessmentText = "Stale assessment"
            r.examGeneral = "Comfortable at rest"                       // local has none
            r.workingDiagnosis = "Hepatitis"
        }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.fullName, "Mary Local")
        XCTAssertEqual(local.phone, "758-111-1111")
        XCTAssertEqual(local.hpi, "RUQ pain radiating to the right shoulder tip",
                       "narrative: longer wins regardless of timestamp")
        XCTAssertEqual(local.assessmentText, "Local assessment")
        XCTAssertEqual(local.examGeneral, "Comfortable at rest")
        XCTAssertEqual(local.workingDiagnosis, "Biliary colic")
        XCTAssertEqual(local.syncedAt, t1, "syncedAt never moves backwards")
    }

    /// A newer remote record with blank admin fields must not erase non-empty local values.
    func testNewerRemoteBlankAdminFieldsNeverEraseLocalValues() throws {
        let local = localPatient(syncedAt: t0)
        local.email = "mary@example.com"
        local.address = "Gros Islet"
        local.nokName = "John Local"
        local.nokPhone = "758-333-3333"
        local.insuranceProvider = "Sagicor"
        local.policyNumber = "P-123"
        local.sex = .female
        local.dateOfBirth = Date(timeIntervalSince1970: 0)
        let rec = remoteRecord(of: local, syncedAt: t1) { r in
            r.phone = nil
            r.email = ""
            r.address = "   "
            r.mrn = nil
            r.nokName = nil
            r.nokPhone = ""
            r.insuranceProvider = nil
            r.policyNumber = nil
            r.sex = .unspecified
            r.dateOfBirth = nil
        }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.phone, "758-111-1111")
        XCTAssertEqual(local.email, "mary@example.com")
        XCTAssertEqual(local.address, "Gros Islet")
        XCTAssertEqual(local.mrn, "H-700")
        XCTAssertEqual(local.nokName, "John Local")
        XCTAssertEqual(local.nokPhone, "758-333-3333")
        XCTAssertEqual(local.insuranceProvider, "Sagicor")
        XCTAssertEqual(local.policyNumber, "P-123")
        XCTAssertEqual(local.sex, .female, "unspecified is blank, not a correction")
        XCTAssertEqual(local.dateOfBirth, Date(timeIntervalSince1970: 0))
        XCTAssertEqual(local.syncedAt, t1)
    }

    func testAdminMergeHelper() {
        XCTAssertEqual(service.adminMerge("local", "remote"), "remote")
        XCTAssertEqual(service.adminMerge("local", nil), "local")
        XCTAssertEqual(service.adminMerge("local", "  "), "local")
        XCTAssertEqual(service.adminMerge(nil, "remote"), "remote")
        XCTAssertNil(service.adminMerge(nil, ""))
    }

    // MARK: - NEWS2 SpO₂ Scale 2 flag

    func testScale2FlagTravelsWithNewerRecord() throws {
        let local = localPatient(syncedAt: t0)
        XCTAssertFalse(local.news2UseSpO2Scale2)
        let rec = remoteRecord(of: local, syncedAt: t1) { r in r.news2UseSpO2Scale2 = true }
        XCTAssertEqual(rec.news2UseSpO2Scale2, true)

        try service.applyPatients([rec], context: context)
        XCTAssertTrue(local.news2UseSpO2Scale2)
    }

    func testOlderRecordDoesNotChangeScale2Flag() throws {
        let local = localPatient(syncedAt: t1)
        local.news2UseSpO2Scale2 = true
        let rec = remoteRecord(of: local, syncedAt: t0) { r in r.news2UseSpO2Scale2 = false }
        try service.applyPatients([rec], context: context)
        XCTAssertTrue(local.news2UseSpO2Scale2)
    }

    /// Payloads and backups from builds without the flag still decode; the flag is left alone.
    func testPayloadWithoutScale2FlagDecodesAndKeepsLocalFlag() throws {
        let local = localPatient(syncedAt: t0)
        local.news2UseSpO2Scale2 = true
        let rec = remoteRecord(of: local, syncedAt: t1) { r in r.phone = "758-444-4444" }
        let data = try JSONEncoder().encode(rec)
        var object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertNotNil(object["news2UseSpO2Scale2"])
        object.removeValue(forKey: "news2UseSpO2Scale2")
        let oldPayload = try JSONSerialization.data(withJSONObject: object)

        let decoded = try JSONDecoder().decode(PeerPatient.self, from: oldPayload)
        XCTAssertNil(decoded.news2UseSpO2Scale2)

        try service.applyPatients([decoded], context: context)
        XCTAssertTrue(local.news2UseSpO2Scale2, "missing field never clears the flag")
        XCTAssertEqual(local.phone, "758-444-4444")
    }

    /// A record first seen from a peer takes its admin fields even when neither side has a cloud
    /// sync time yet.
    func testNewRecordFromPeerWithoutSyncTimeKeepsAdminFields() throws {
        let other = Patient(fullName: "Peer Only")
        remoteContext.insert(other)
        other.phone = "758-555-5555"
        other.mrn = "H-900"
        other.news2UseSpO2Scale2 = true
        other.syncedAt = nil

        try service.applyPatients([PeerPatient(other)], context: context)

        let added = try context.fetch(FetchDescriptor<Patient>()).first { $0.syncCode == other.syncCode }
        XCTAssertEqual(added?.phone, "758-555-5555")
        XCTAssertEqual(added?.mrn, "H-900")
        XCTAssertEqual(added?.news2UseSpO2Scale2, true)
    }

    func testUnknownRecordIsAdded() throws {
        _ = localPatient(syncedAt: t0)
        let other = Patient(fullName: "New From Peer")
        remoteContext.insert(other)
        other.hpi = "Referred with dysphagia"
        other.syncedAt = t0
        let rec = PeerPatient(other)

        try service.applyPatients([rec], context: context)

        let all = try context.fetch(FetchDescriptor<Patient>())
        XCTAssertEqual(all.count, 2)
        let added = all.first { $0.syncCode == other.syncCode }
        XCTAssertEqual(added?.fullName, "New From Peer")
        XCTAssertEqual(added?.hpi, "Referred with dysphagia")
    }

    func testRecordDeletedOnThisDeviceIsNotRecreated() throws {
        let other = Patient(fullName: "Deleted Here")
        remoteContext.insert(other)
        other.syncedAt = t1
        PatientIdentityStore.markDeleted(other)

        try service.applyPatients([PeerPatient(other)], context: context)

        XCTAssertEqual(try patientCount(), 0)
    }
}

/// Local tombstones for records deleted on this device (so a sync pull does not bring them back).
final class SyncTombstonesTests: XCTestCase {

    private let tables: [SyncTombstones.Table] = [.documents, .vitals]
    private var saved: [String: Any] = [:]

    private func key(_ table: SyncTombstones.Table) -> String { "amf.tombstones.\(table.rawValue)" }

    override func setUp() {
        super.setUp()
        for t in tables {
            if let value = UserDefaults.standard.object(forKey: key(t)) { saved[key(t)] = value }
            UserDefaults.standard.removeObject(forKey: key(t))
        }
    }

    override func tearDown() {
        for t in tables {
            if let value = saved[key(t)] {
                UserDefaults.standard.set(value, forKey: key(t))
            } else {
                UserDefaults.standard.removeObject(forKey: key(t))
            }
        }
        super.tearDown()
    }

    func testNilAndEmptyIdsAreIgnored() {
        SyncTombstones.add(nil, in: .documents)
        SyncTombstones.add("", in: .documents)
        XCTAssertTrue(SyncTombstones.ids(in: .documents).isEmpty)
    }

    func testAddedIdIsRememberedPerTable() {
        SyncTombstones.add("doc-1", in: .documents)
        XCTAssertTrue(SyncTombstones.ids(in: .documents).contains("doc-1"))
        XCTAssertFalse(SyncTombstones.ids(in: .vitals).contains("doc-1"))
    }

    func testAddingTwiceStoresOnce() {
        SyncTombstones.add("doc-1", in: .documents)
        SyncTombstones.add("doc-1", in: .documents)
        XCTAssertEqual(UserDefaults.standard.stringArray(forKey: key(.documents))?.count, 1)
    }

    func testListIsCappedAtFiveThousandDroppingTheOldest() {
        let seeded = (0..<5000).map { "old-\($0)" }
        UserDefaults.standard.set(seeded, forKey: key(.vitals))
        SyncTombstones.add("new", in: .vitals)
        let ids = SyncTombstones.ids(in: .vitals)
        XCTAssertEqual(ids.count, 5000)
        XCTAssertTrue(ids.contains("new"))
        XCTAssertFalse(ids.contains("old-0"))
        XCTAssertTrue(ids.contains("old-1"))
    }
}
