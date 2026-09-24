import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Patient identity: duplicate grouping, which copy is kept, and the per-device
/// "different people" / "deleted" memory in PatientIdentityStore.
@MainActor
final class DeduplicationTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    // PatientIdentityStore writes to UserDefaults.standard; save and restore what was there so the
    // tests start clean and leave the host app's settings untouched.
    // The deleted-ids key is private in PatientIdentityStore; this string must match it.
    private let deletedKey = "amf.patients.deletedRemoteIds"
    private var savedDistinct: Any?
    private var savedDeleted: Any?

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext

        let defaults = UserDefaults.standard
        savedDistinct = defaults.object(forKey: PatientIdentityStore.distinctKey)
        savedDeleted = defaults.object(forKey: deletedKey)
        defaults.removeObject(forKey: PatientIdentityStore.distinctKey)
        defaults.removeObject(forKey: deletedKey)
    }

    override func tearDown() async throws {
        restore(savedDistinct, forKey: PatientIdentityStore.distinctKey)
        restore(savedDeleted, forKey: deletedKey)
    }

    private func restore(_ value: Any?, forKey key: String) {
        if let value = value {
            UserDefaults.standard.set(value, forKey: key)
        } else {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    // MARK: - Helpers

    private func date(_ y: Int, _ m: Int, _ d: Int, hour: Int = 12) -> Date {
        Calendar.current.date(from: DateComponents(year: y, month: m, day: d, hour: hour))!
    }

    /// `order` sets createdAt so "oldest first" is deterministic.
    @discardableResult
    private func patient(_ name: String, dob: Date? = nil, order: Int = 0) -> Patient {
        let p = Patient(fullName: name)
        p.dateOfBirth = dob
        p.createdAt = Date(timeIntervalSince1970: 1_700_000_000 + Double(order) * 60)
        context.insert(p)
        return p
    }

    // MARK: - Name normalisation and identity key

    func testNormalizeIgnoresCaseAndSpacing() {
        XCTAssertEqual(Patient.normalize("  Jane   DOE "), "jane doe")
        XCTAssertEqual(Patient.normalize("Jane\tDoe"), "jane doe")
        XCTAssertEqual(Patient.normalize("   "), "")
    }

    func testDedupKeyPrefersRemoteIdThenManualMRN() {
        let p = patient("Key Test")
        XCTAssertEqual(p.dedupKey, p.id.uuidString)
        p.mrn = "AMF-2025-000001"           // auto-generated: says nothing about identity
        XCTAssertEqual(p.dedupKey, p.id.uuidString)
        p.mrn = "H-12345"                   // manually entered hospital number
        XCTAssertEqual(p.dedupKey, "H-12345")
        p.remoteId = "remote-1"
        XCTAssertEqual(p.dedupKey, "remote-1")
    }

    // MARK: - possibleDuplicateGroups

    func testSameNameConflictingDOBIsNotGrouped() {
        let patients = [patient("Jane Doe", dob: date(1970, 1, 1), order: 0),
                        patient("jane  doe", dob: date(1980, 5, 5), order: 1)]
        XCTAssertTrue(patients.possibleDuplicateGroups().isEmpty)
    }

    func testSameNameWithMissingDOBIsGrouped() {
        let a = patient("Jane Doe", dob: date(1970, 1, 1), order: 0)
        let b = patient("JANE DOE", dob: nil, order: 1)
        let groups = [b, a].possibleDuplicateGroups()
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups.first?.map(\.id), [a.id, b.id], "group is oldest first")
    }

    func testSameNameSameDayDOBIsGrouped() {
        let a = patient("Sam Joseph", dob: date(1990, 3, 4, hour: 8), order: 0)
        let b = patient("Sam Joseph", dob: date(1990, 3, 4, hour: 20), order: 1)
        XCTAssertEqual([a, b].possibleDuplicateGroups().count, 1)
    }

    func testDifferentNamesAreNotGrouped() {
        let patients = [patient("Sam Joseph", order: 0), patient("Sam Josephs", order: 1)]
        XCTAssertTrue(patients.possibleDuplicateGroups().isEmpty)
    }

    func testMissingDOBDoesNotBridgeTwoConflictingDOBs() {
        // A (1970) and C (1980) are different people; B (no DOB) may match either but must not
        // pull C into A's group.
        let a = patient("Lee Pierre", dob: date(1970, 1, 1), order: 0)
        let b = patient("Lee Pierre", dob: nil, order: 1)
        let c = patient("Lee Pierre", dob: date(1980, 1, 1), order: 2)
        let groups = [a, b, c].possibleDuplicateGroups()
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(Set(groups[0].map(\.id)), [a.id, b.id])
        XCTAssertFalse(groups[0].contains { $0.id == c.id })
    }

    func testRecordsNotInAStoreAreIgnored() {
        let a = patient("Ann Charles", order: 0)
        let detached = Patient(fullName: "Ann Charles")   // never inserted: not live
        XCTAssertFalse(detached.isLive)
        XCTAssertTrue([a, detached].possibleDuplicateGroups().isEmpty)
    }

    func testPairsMarkedDistinctAreNotGrouped() {
        let a = patient("John Baptiste", order: 0)
        let b = patient("John Baptiste", order: 1)
        XCTAssertEqual([a, b].possibleDuplicateGroups().count, 1)
        PatientIdentityStore.markDistinct([a, b])
        XCTAssertTrue([a, b].possibleDuplicateGroups().isEmpty)
    }

    // MARK: - hasClinicalData / duplicateKeeper

    func testEmptyRecordHasNoClinicalData() {
        let p = patient("Empty Record")
        XCTAssertFalse(p.hasClinicalData)
        p.hpi = "   \n "
        XCTAssertFalse(p.hasClinicalData, "whitespace is not clinical data")
    }

    func testEachNarrativeFieldCountsAsClinicalData() {
        let setters: [(String, (Patient) -> Void)] = [
            ("hpi",              { $0.hpi = "Two days of RIF pain" }),
            ("assessmentText",   { $0.assessmentText = "Likely appendicitis" }),
            ("managementPlan",   { $0.managementPlan = "Admit, NBM" }),
            ("workingDiagnosis", { $0.workingDiagnosis = "Acute appendicitis" }),
            ("examGeneral",      { $0.examGeneral = "Unwell" }),
            ("examAbdo",         { $0.examAbdo = "Tender RIF" }),
        ]
        for (label, apply) in setters {
            let p = patient("Field \(label)")
            apply(p)
            XCTAssertTrue(p.hasClinicalData, label)
        }
    }

    func testVitalsCountAsClinicalData() throws {
        let p = patient("Has Vitals")
        let v = VitalsEntry(patient: p)
        v.heartRate = 80
        context.insert(v)
        try context.save()
        if !p.vitalsEntries.contains(where: { $0.id == v.id }) { p.vitalsEntries.append(v) }
        XCTAssertTrue(p.hasClinicalData)
    }

    func testKeeperIsTheRecordWithClinicalData() {
        let empty = patient("Rose Emmanuel", order: 0)
        let charted = patient("Rose Emmanuel", order: 1)
        charted.hpi = "Epigastric pain"
        XCTAssertEqual([empty, charted].duplicateKeeper.id, charted.id)
    }

    func testKeeperFallsBackToFirstWhenNoneHaveClinicalData() {
        let first = patient("Rose Emmanuel", order: 0)
        let second = patient("Rose Emmanuel", order: 1)
        XCTAssertEqual([first, second].duplicateKeeper.id, first.id)
    }

    func testKeeperIsFirstChartedRecordWhenSeveralHaveData() {
        let a = patient("Rose Emmanuel", order: 0)
        let b = patient("Rose Emmanuel", order: 1)
        a.hpi = "Older history"
        b.hpi = "Newer history"
        XCTAssertEqual([a, b].duplicateKeeper.id, a.id)
    }

    // MARK: - deduped (list view)

    func testDedupedHidesEmptySameNameCopy() {
        let empty = patient("Carl White", order: 0)
        let charted = patient("Carl White", dob: date(1965, 6, 6), order: 1)
        charted.examAbdo = "Soft, non-tender"
        let shown = [empty, charted].deduped()
        XCTAssertEqual(shown.map(\.id), [charted.id])
    }

    func testDedupedNeverHidesACopyWithClinicalData() {
        let a = patient("Carl White", order: 0)
        let b = patient("Carl White", order: 1)
        a.hpi = "History on device A"
        b.hpi = "History on device B"
        XCTAssertEqual(Set([a, b].deduped().map(\.id)), [a.id, b.id])
    }

    func testDedupedKeepsSameNameDifferentDOB() {
        let a = patient("Carl White", dob: date(1965, 6, 6), order: 0)
        let b = patient("Carl White", dob: date(1999, 9, 9), order: 1)
        XCTAssertEqual([a, b].deduped().count, 2)
    }

    func testDedupedCollapsesSameManualMRN() {
        let older = patient("Anne Brown", order: 0)
        let newer = patient("Anne Brown", order: 1)
        older.mrn = "H-100"
        newer.mrn = "H-100"
        let shown = [older, newer].deduped()
        XCTAssertEqual(shown.count, 1)
        XCTAssertEqual(shown.first?.id, newer.id, "equal richness keeps the newer copy")
    }

    // MARK: - registeredMatches (new-registration check)

    func testRegisteredMatches() {
        let existing = [patient("John Smith", dob: date(1960, 2, 2))]
        XCTAssertEqual(existing.registeredMatches(name: " john   SMITH ", dateOfBirth: date(1960, 2, 2, hour: 9)).count, 1)
        XCTAssertEqual(existing.registeredMatches(name: "John Smith", dateOfBirth: nil).count, 1)
        XCTAssertTrue(existing.registeredMatches(name: "John Smith", dateOfBirth: date(1961, 2, 2)).isEmpty)
        XCTAssertTrue(existing.registeredMatches(name: "John Smyth", dateOfBirth: nil).isEmpty)
        XCTAssertTrue(existing.registeredMatches(name: "   ", dateOfBirth: nil).isEmpty)
    }

    func testRegisteredMatchesWhenExistingRecordHasNoDOB() {
        let existing = [patient("Mary Joseph", dob: nil)]
        XCTAssertEqual(existing.registeredMatches(name: "Mary Joseph", dateOfBirth: date(1980, 1, 1)).count, 1)
    }

    // MARK: - PatientIdentityStore

    func testPairKeyIsOrderIndependent() {
        let a = patient("Pair A")
        let b = patient("Pair B")
        XCTAssertEqual(PatientIdentityStore.pairKey(a, b), PatientIdentityStore.pairKey(b, a))
        XCTAssertTrue(PatientIdentityStore.pairKey(a, b).contains(a.syncCode))
        XCTAssertTrue(PatientIdentityStore.pairKey(a, b).contains(b.syncCode))
    }

    func testMarkDistinctRecordsEveryPairInTheGroup() {
        let a = patient("Distinct A")
        let b = patient("Distinct B")
        let c = patient("Distinct C")
        let other = patient("Not Marked")
        XCTAssertFalse(PatientIdentityStore.markedDistinct(a, b))
        PatientIdentityStore.markDistinct([a, b, c])
        XCTAssertTrue(PatientIdentityStore.markedDistinct(a, b))
        XCTAssertTrue(PatientIdentityStore.markedDistinct(b, a))
        XCTAssertTrue(PatientIdentityStore.markedDistinct(a, c))
        XCTAssertTrue(PatientIdentityStore.markedDistinct(b, c))
        XCTAssertFalse(PatientIdentityStore.markedDistinct(a, other))
        XCTAssertEqual(PatientIdentityStore.distinctPairSet().count, 3)
    }

    func testMarkDeletedRemembersRemoteIdAndSyncCode() {
        let p = patient("Deleted Record")
        p.remoteId = "deleted-remote-\(UUID().uuidString)"
        XCTAssertFalse(PatientIdentityStore.isDeleted(p.remoteId))
        PatientIdentityStore.markDeleted(p)
        XCTAssertTrue(PatientIdentityStore.isDeleted(p.remoteId))
        XCTAssertTrue(PatientIdentityStore.isDeleted(p.syncCode))
        XCTAssertFalse(PatientIdentityStore.isDeleted(nil))
        XCTAssertFalse(PatientIdentityStore.isDeleted(""))
    }

    func testMarkDeletedKeepsIdStillHeldByASurvivingCopy() {
        let shared = "shared-remote-\(UUID().uuidString)"
        let removed = patient("Two Copies")
        removed.remoteId = shared
        let survivor = Patient(fullName: "Two Copies")   // not inserted: remoteId is unique in the store
        survivor.remoteId = shared
        PatientIdentityStore.markDeleted(removed, survivors: [survivor])
        XCTAssertFalse(PatientIdentityStore.isDeleted(shared), "the surviving copy must keep syncing")
        XCTAssertTrue(PatientIdentityStore.isDeleted(removed.syncCode))
    }
}
