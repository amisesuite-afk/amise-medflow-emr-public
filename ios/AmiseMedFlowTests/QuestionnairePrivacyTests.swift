import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Front-desk questionnaire privacy rule (QuestionnairePatientSearch): no patient names until
/// staff type a real search — 3+ characters of a name, or an MRN — and never more than 5.
@MainActor
final class QuestionnairePrivacyTests: XCTestCase {

    private struct Candidate: Equatable {
        let name: String
        let mrn: String?
    }

    private func search(_ query: String, _ candidates: [Candidate]) -> [Candidate] {
        QuestionnairePatientSearch.matches(query: query, in: candidates,
                                           name: { $0.name }, mrn: { $0.mrn })
    }

    private let roster: [Candidate] = [
        Candidate(name: "Marie Joseph",    mrn: "AMF-2025-000047"),
        Candidate(name: "Joseph Alexander", mrn: "AMF-2025-000048"),
        Candidate(name: "Anne-Marie Louis", mrn: "AMF-2026-000001"),
        Candidate(name: "Kevin St Rose",    mrn: nil),
        Candidate(name: "Josephine Charles", mrn: "LEGACY-99"),
    ]

    // MARK: - Nothing without a real search

    func testEmptyQueryReturnsNothing() {
        XCTAssertEqual(search("", roster), [])
    }

    func testWhitespaceOnlyQueryReturnsNothing() {
        XCTAssertEqual(search("   \n ", roster), [])
    }

    func testOneAndTwoCharacterNameQueriesReturnNothing() {
        XCTAssertEqual(search("J", roster), [])
        XCTAssertEqual(search("Jo", roster), [])
        XCTAssertEqual(search(" Jo ", roster), [], "surrounding spaces do not count towards the minimum")
    }

    func testThreeCharacterNameQueryMatches() {
        XCTAssertEqual(QuestionnairePatientSearch.minimumNameLength, 3)
        let hits = search("jos", roster)
        XCTAssertEqual(hits.map(\.name), ["Marie Joseph", "Joseph Alexander", "Josephine Charles"])
    }

    func testNameMatchIsCaseAndAccentInsensitive() {
        let people = [Candidate(name: "Zoë Éloi", mrn: nil)]
        XCTAssertEqual(search("ZOE", people).count, 1)
        XCTAssertEqual(search("eloi", people).count, 1)
    }

    func testUnmatchedNameReturnsNothing() {
        XCTAssertEqual(search("Smith", roster), [])
    }

    // MARK: - Cap

    func testResultsAreCappedAtFive() {
        XCTAssertEqual(QuestionnairePatientSearch.maxResults, 5)
        let many = (1...12).map { Candidate(name: "Patient Smith \($0)", mrn: nil) }
        let hits = search("smith", many)
        XCTAssertEqual(hits.count, 5)
        XCTAssertEqual(hits.first?.name, "Patient Smith 1", "input order is kept")
    }

    func testMRNMatchesAlsoCappedAtFive() {
        // Same sequence number in several years.
        let many = (2020...2029).map { Candidate(name: "Year \($0)", mrn: "AMF-\($0)-000007") }
        XCTAssertEqual(search("7", many).count, 5)
    }

    // MARK: - MRN

    func testFullMRNMatchesExactlyOnePatient() {
        XCTAssertEqual(search("AMF-2025-000047", roster).map(\.name), ["Marie Joseph"])
    }

    func testFullMRNIsCaseInsensitiveAndTrimmed() {
        XCTAssertEqual(search("  amf-2025-000048 ", roster).map(\.name), ["Joseph Alexander"])
    }

    func testMRNSequenceNumberMatches() {
        XCTAssertEqual(search("47", roster).map(\.name), ["Marie Joseph"])
        XCTAssertEqual(search("000047", roster).map(\.name), ["Marie Joseph"])
        XCTAssertEqual(search("1", roster).map(\.name), ["Anne-Marie Louis"],
                       "a short MRN number is allowed: it identifies a record, it does not browse")
    }

    func testNonAMFMRNMatchesOnlyInFull() {
        XCTAssertEqual(search("LEGACY-99", roster).map(\.name), ["Josephine Charles"])
        XCTAssertEqual(search("99", roster), [])
    }

    func testPartialMRNIsNotABrowse() {
        // "AMF" is 3 characters but matches no name; a partial MRN must not list every record.
        XCTAssertEqual(search("AMF", roster), [])
        XCTAssertEqual(search("AMF-2025", roster), [])
    }

    func testMRNMatchesComeBeforeNameMatches() {
        let people = [
            Candidate(name: "Ann 123 Name", mrn: nil),
            Candidate(name: "Bob", mrn: "AMF-2025-000123"),
        ]
        XCTAssertEqual(search("123", people).map(\.name), ["Bob", "Ann 123 Name"])
    }

    func testMRNMatchesHelper() {
        XCTAssertTrue(QuestionnairePatientSearch.mrnMatches(query: "AMF-2025-000047", mrn: "AMF-2025-000047"))
        XCTAssertTrue(QuestionnairePatientSearch.mrnMatches(query: "47", mrn: "AMF-2025-000047"))
        XCTAssertFalse(QuestionnairePatientSearch.mrnMatches(query: "48", mrn: "AMF-2025-000047"))
        XCTAssertFalse(QuestionnairePatientSearch.mrnMatches(query: "", mrn: "AMF-2025-000047"))
        XCTAssertFalse(QuestionnairePatientSearch.mrnMatches(query: "47", mrn: nil))
        XCTAssertFalse(QuestionnairePatientSearch.mrnMatches(query: "47", mrn: ""))
    }

    // MARK: - Patient overload (SwiftData)

    func testPatientOverloadAppliesSameRuleToLiveRecords() throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema,
                                           configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let context = container.mainContext

        var patients: [Patient] = []
        for i in 1...8 {
            let p = Patient(fullName: "Privacy Test \(i)")
            p.mrn = MRNGenerator.formatted(year: 2025, sequence: 900 + i)
            context.insert(p)
            patients.append(p)
        }

        XCTAssertEqual(QuestionnairePatientSearch.matches(query: "", in: patients).count, 0)
        XCTAssertEqual(QuestionnairePatientSearch.matches(query: "Pr", in: patients).count, 0)
        XCTAssertEqual(QuestionnairePatientSearch.matches(query: "privacy", in: patients).count, 5)
        XCTAssertEqual(QuestionnairePatientSearch.matches(query: "AMF-2025-000903", in: patients)
                        .map(\.fullName), ["Privacy Test 3"])

        // A record that is not in a context (not live) is never returned.
        let detached = Patient(fullName: "Privacy Detached")
        XCTAssertEqual(QuestionnairePatientSearch.matches(query: "Privacy Detached", in: [detached]).count, 0)
    }
}
