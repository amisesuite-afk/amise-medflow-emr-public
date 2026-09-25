import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Front-desk iPad questionnaire: the lifestyle questions (fasting, complementary treatments).
/// Wording parity with lib/triage-engine/src/lifestyle-questions.ts is checked from the web side
/// (artifacts/dashboard/src/lib/__tests__/lifestyle-questions-ios-parity.test.ts).
@MainActor
final class LifestyleQuestionsTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    func testNoIsExclusiveAndTimingFollowsAFast() {
        var a = LifestyleQuestionnaireAnswers()
        a.setFasting(["ramadan"])
        XCTAssertTrue(a.asksTiming)
        a.timing = "now"
        a.setFasting(["ramadan", "none"])
        XCTAssertEqual(a.fasting, ["none"])
        XCTAssertFalse(a.asksTiming)
        XCTAssertNil(a.timing)
        a.setFasting(["none", "daniel_fast"])
        XCTAssertEqual(a.fasting, ["daniel_fast"])

        a.setTherapies(["yoga", "cupping"])
        a.setTherapies(["yoga", "cupping", "none"])
        XCTAssertEqual(a.therapies, ["none"])
    }

    func testLinesMatchTheWebAndNoGivesNoLine() {
        var a = LifestyleQuestionnaireAnswers()
        XCTAssertEqual(a.lines, [])
        a.setFasting(["none"])
        a.setTherapies(["none"])
        XCTAssertEqual(a.lines, [])

        a.setFasting(["daniel_fast", "ramadan"])
        a.timing = "within_month"
        a.setTherapies(["detox_cleanse", "acupuncture"])
        XCTAssertEqual(a.lines, [
            "Fasting (patient-reported): Ramadan, Daniel Fast",
            "Fasting timing (patient-reported): Planning to fast within the next month",
            "Complementary treatments (patient-reported): Acupuncture, Detox or cleanse programmes (including detox teas)",
        ])
    }

    func testAnswersAreLastInPmhNotesAndReadBack() {
        var answers = EncounterAnswers()
        answers.medications = "Metformin"
        answers.lifestyle.setFasting(["ramadan"])
        answers.lifestyle.timing = "now"
        answers.lifestyle.setTherapies(["iv_vitamin_drips"])
        let text = answers.pmhxText
        XCTAssertTrue(text.hasSuffix("Complementary treatments (patient-reported): Vitamin drips"))
        XCTAssertTrue(text.contains("ALCOHOL: None\nFasting (patient-reported): Ramadan"))

        let p = Patient(fullName: "Lifestyle Questionnaire")
        context.insert(p)
        p.pmhNotes = text
        let reported = p.patientReportedLifestyle
        XCTAssertEqual(reported?.fasting, ["ramadan"])
        XCTAssertEqual(reported?.timing, "now")
        XCTAssertEqual(reported?.therapies, ["iv_vitamin_drips"])

        p.pmhNotes = "CONDITIONS: Hypertension"
        XCTAssertNil(p.patientReportedLifestyle)
    }

    func testFillingOnlyFillsWhatIsNotRecorded() {
        var a = LifestyleQuestionnaireAnswers()
        a.setFasting(["ramadan", "time_restricted"])
        a.timing = "within_month"
        a.setTherapies(["yoga"])

        let filled = a.filling(LifestyleHistory())
        XCTAssertEqual(filled.fasting, [.ramadan, .timeRestricted])
        XCTAssertEqual(filled.fastingStatus, .planned)
        XCTAssertEqual(filled.fastingWhen, "Within the next month")
        XCTAssertEqual(filled.therapies, [.yoga])

        // A clinician-recorded record is never changed.
        var recorded = LifestyleHistory()
        recorded.fasting = [.notFasting]
        recorded.therapies = [.cupping]
        XCTAssertEqual(a.filling(recorded), recorded)

        // "Not sure" leaves the status unrecorded; "No" therapies records nothing.
        var b = LifestyleQuestionnaireAnswers()
        b.setFasting(["other"])
        b.timing = "not_sure"
        b.setTherapies(["none"])
        let fb = b.filling(LifestyleHistory())
        XCTAssertEqual(fb.fasting, [.other])
        XCTAssertNil(fb.fastingStatus)
        XCTAssertEqual(fb.therapies, [])
    }
}
