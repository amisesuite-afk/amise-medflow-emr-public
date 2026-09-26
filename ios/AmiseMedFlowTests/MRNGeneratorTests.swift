import XCTest
import SwiftData
@testable import AmiseMedFlow

/// MRN format (AMF-YYYY-NNNNNN) and the rule that a new MRN continues above every AMF number this
/// device knows about, so two devices do not issue the same number.
@MainActor
final class MRNGeneratorTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    // MRNGenerator keeps its counter in UserDefaults.standard under this (private) key.
    private let sequenceKey = "amf.mrn.lastSequence"

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private var year: Int { Calendar.current.component(.year, from: .now) }

    /// Runs `body` with the device counter set to `start`, then puts the real counter back.
    private func withCounter(_ start: Int, _ body: () throws -> Void) rethrows {
        let defaults = UserDefaults.standard
        let saved = defaults.object(forKey: sequenceKey)
        defaults.set(start, forKey: sequenceKey)
        defer {
            if let saved = saved {
                defaults.set(saved, forKey: sequenceKey)
            } else {
                defaults.removeObject(forKey: sequenceKey)
            }
        }
        try body()
    }

    private func patient(mrn: String?) -> Patient {
        let p = Patient(fullName: "MRN Test \(UUID().uuidString.prefix(6))")
        p.mrn = mrn
        context.insert(p)
        return p
    }

    // MARK: - Format

    func testFormatIsZeroPaddedToSixDigits() {
        XCTAssertEqual(MRNGenerator.formatted(year: 2025, sequence: 47), "AMF-2025-000047")
        XCTAssertEqual(MRNGenerator.formatted(year: 2026, sequence: 1), "AMF-2026-000001")
        XCTAssertEqual(MRNGenerator.formatted(year: 2026, sequence: 123456), "AMF-2026-123456")
    }

    func testSequenceParsing() {
        XCTAssertEqual(MRNGenerator.sequence(of: "AMF-2025-000047"), 47)
        XCTAssertEqual(MRNGenerator.sequence(of: MRNGenerator.formatted(year: 2030, sequence: 999)), 999)
        XCTAssertNil(MRNGenerator.sequence(of: "H-12345"))
        XCTAssertNil(MRNGenerator.sequence(of: "AMF-2025"))
        XCTAssertNil(MRNGenerator.sequence(of: "AMF-2025-abc"))
        XCTAssertNil(MRNGenerator.sequence(of: "XYZ-2025-000047"))
        XCTAssertNil(MRNGenerator.sequence(of: ""))
    }

    // MARK: - Next number

    func testNextAdvancesTheDeviceCounter() {
        withCounter(41) {
            let first = MRNGenerator.next()
            XCTAssertEqual(first, MRNGenerator.formatted(year: year, sequence: 42))
            XCTAssertEqual(UserDefaults.standard.integer(forKey: sequenceKey), 42)
            let second = MRNGenerator.next()
            XCTAssertEqual(second, MRNGenerator.formatted(year: year, sequence: 43))
            XCTAssertNotEqual(first, second)
        }
    }

    func testNextNeverRepeatsAcrossManyCalls() {
        withCounter(0) {
            let issued = (0..<50).map { _ in MRNGenerator.next() }
            XCTAssertEqual(Set(issued).count, issued.count)
            XCTAssertTrue(issued.allSatisfy { $0.hasPrefix("AMF-\(year)-") && $0.count == 15 })
        }
    }

    func testNextContinuesAboveHighestKnownMRN() {
        // Another device already issued 500 (in an earlier year); this device's counter is at 10.
        withCounter(10) {
            let existing = [patient(mrn: "AMF-2020-000500"), patient(mrn: "AMF-2021-000120")]
            XCTAssertEqual(MRNGenerator.next(existing: existing),
                           MRNGenerator.formatted(year: year, sequence: 501))
        }
    }

    func testNextKeepsDeviceCounterWhenItIsAhead() {
        withCounter(900) {
            let existing = [patient(mrn: "AMF-2020-000500")]
            XCTAssertEqual(MRNGenerator.next(existing: existing),
                           MRNGenerator.formatted(year: year, sequence: 901))
        }
    }

    func testManualMRNsDoNotAffectTheSequence() {
        withCounter(5) {
            let existing = [patient(mrn: "H-99999"), patient(mrn: nil), patient(mrn: "")]
            XCTAssertEqual(MRNGenerator.next(existing: existing),
                           MRNGenerator.formatted(year: year, sequence: 6))
        }
    }

    func testNextInContextReadsEveryStoredPatient() {
        withCounter(3) {
            _ = patient(mrn: "AMF-2019-000077")
            try? context.save()
            XCTAssertEqual(MRNGenerator.next(in: context),
                           MRNGenerator.formatted(year: year, sequence: 78))
        }
    }

    // MARK: - Back-fill

    func testBackfillOnlyFillsMissingMRN() {
        withCounter(20) {
            let keep = patient(mrn: "H-1")
            MRNGenerator.backfillIfNeeded(keep)
            XCTAssertEqual(keep.mrn, "H-1")

            let missing = patient(mrn: nil)
            MRNGenerator.backfillIfNeeded(missing)
            XCTAssertEqual(missing.mrn, MRNGenerator.formatted(year: year, sequence: 21))

            let blank = patient(mrn: "")
            MRNGenerator.backfillIfNeeded(blank)
            XCTAssertEqual(blank.mrn, MRNGenerator.formatted(year: year, sequence: 22))
        }
    }
}
