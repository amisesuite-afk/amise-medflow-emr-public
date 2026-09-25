import XCTest
import SwiftData
import EventKit
@testable import AmiseMedFlow

/// "Communicate seamlessly" UX work: consultation Tools menu, one iPad consultation entry, the
/// review-and-complete sheet, the header safety strip, the draft-button labels and Today's
/// "Added today" group (docs/clinical-validation/UX-REPORT.md).
@MainActor
final class ConsultationSeamlessTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    // MARK: - Tools menu

    func testToolsMenuOffersScoresVitalsAndPrescriptions() {
        XCTAssertEqual(ConsultTool.allCases.map(\.rawValue), ["scores", "vitals", "prescriptions"])
        XCTAssertEqual(ConsultTool.scores.menuIdentifier, "consult.tools.scores")
        XCTAssertEqual(Set(ConsultTool.allCases.map(\.menuIdentifier)).count, ConsultTool.allCases.count)
        for tool in ConsultTool.allCases {
            XCTAssertFalse(tool.title.isEmpty)
            XCTAssertFalse(tool.systemImage.isEmpty)
        }
    }

    // MARK: - iPad: one consultation entry

    func testIPadHasOneConsultationEntryAndElevenStepTargets() {
        let steps = PatientDetailSection.allCases.filter(\.isConsultationStep)
        XCTAssertEqual(steps.count, 11, "CC … Plan are jump targets, not section-bar items")
        XCTAssertFalse(PatientDetailSection.consultation.isConsultationStep)
        XCTAssertNil(PatientDetailSection.consultation.consultTab)
        XCTAssertEqual(PatientDetailSection.hpi.consultTab, .hpi)
        // Every role that could open a consultation step still gets the one entry.
        XCTAssertTrue(UserRole.nurse.visiblePatientSections.contains(.consultation))
        XCTAssertTrue(UserRole.doctor.visiblePatientSections.contains(.consultation))
        XCTAssertFalse(UserRole.frontDesk.visiblePatientSections.contains(.consultation))
    }

    // MARK: - Header safety strip

    func testAllergySummaryListsEveryAllergyNotOnlySevereOnes() {
        let state = RecordSafetySummary.allergyState(
            recorded: [("Penicillin", "Severe"), ("Latex", "Mild"), ("  ", "Mild")], hasNKDAMarker: false)
        XCTAssertEqual(state, .allergies(["Penicillin (Severe)", "Latex (Mild)"]))
        XCTAssertEqual(RecordSafetySummary.allergyText(state), "Allergies: Penicillin (Severe), Latex (Mild)")
        XCTAssertEqual(RecordSafetySummary.allergyText(.allergies(["Codeine"])), "Allergy: Codeine")
    }

    func testAllergySummaryNeverTurnsNotRecordedIntoNKDA() {
        XCTAssertEqual(RecordSafetySummary.allergyState(recorded: [], hasNKDAMarker: false), .notRecorded)
        XCTAssertEqual(RecordSafetySummary.allergyText(.notRecorded), "Allergies not recorded")
        XCTAssertEqual(RecordSafetySummary.allergyState(recorded: [], hasNKDAMarker: true), .noKnownAllergies)
        XCTAssertEqual(RecordSafetySummary.allergyText(.noKnownAllergies), "NKDA (recorded)")
        // A real allergy wins over a stale NKDA marker.
        XCTAssertEqual(RecordSafetySummary.allergyState(recorded: [("Iodine", "")], hasNKDAMarker: true),
                       .allergies(["Iodine"]))
    }

    func testAntithromboticNamesTheDrugsOnce() {
        XCTAssertNil(RecordSafetySummary.antithromboticText(drugs: []))
        XCTAssertEqual(RecordSafetySummary.antithromboticText(drugs: ["Warfarin", "warfarin ", "Aspirin"]),
                       "Antithrombotic: Warfarin, Aspirin")
    }

    func testVitalsAgeSaysHowOldTheNEWS2Is() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(RecordSafetySummary.vitalsAge(recordedAt: now, now: now), "just now")
        XCTAssertEqual(RecordSafetySummary.vitalsAge(recordedAt: now.addingTimeInterval(-25 * 60), now: now), "25 min ago")
        XCTAssertEqual(RecordSafetySummary.vitalsAge(recordedAt: now.addingTimeInterval(-3 * 3600), now: now), "3 h ago")
        XCTAssertEqual(RecordSafetySummary.vitalsAge(recordedAt: now.addingTimeInterval(-50 * 3600), now: now), "2 d ago")
        // A future timestamp (clock skew) is not negative.
        XCTAssertEqual(RecordSafetySummary.vitalsAge(recordedAt: now.addingTimeInterval(600), now: now), "just now")
    }

    // MARK: - Review and complete

    private func review(missing: [String] = [],
                        allergy: RecordSafetySummary.AllergyState = .noKnownAllergies,
                        conflict: Bool = false,
                        hpi: String? = "Three days of RUQ pain.",
                        exam: [(label: String, text: String?)] = [],
                        drafts: [String] = [],
                        dx: String? = nil, icd: String? = nil) -> EncounterCompletionReview {
        EncounterCompletionReview.build(missingSteps: missing, allergyState: allergy, allergyConflict: conflict,
                                        hpi: hpi, examFields: exam, uneditedDrafts: drafts,
                                        diagnosis: dx, icd: icd, investigations: ["LFTs", " "],
                                        prescriptions: ["Paracetamol 1 g"])
    }

    func testReviewListsMissingStepsAndAllergyGaps() {
        let r = review(missing: ["PMH", "Social"], allergy: .notRecorded)
        XCTAssertEqual(r.missingSteps, ["PMH", "Social"])
        XCTAssertTrue(r.allergyNeedsAttention)
        XCTAssertEqual(r.allergyText, "Allergies not recorded")
        XCTAssertFalse(r.hasNoGaps)
        XCTAssertEqual(r.investigations, ["LFTs"])
        XCTAssertEqual(r.prescriptions, ["Paracetamol 1 g"])
    }

    func testReviewFlagsNKDAConflict() {
        let r = review(allergy: .allergies(["Penicillin (Severe)"]), conflict: true)
        XCTAssertTrue(r.allergyNeedsAttention)
        XCTAssertTrue(r.allergyText.contains("reconcile"))
    }

    func testReviewFlagsUneditedTemplateExamOnly() {
        let r = review(exam: [("General", ConsultTemplateText.draftGeneral),
                              ("CVS", "  " + ConsultTemplateText.allNormalCVS + "\n"),
                              ("Abdomen", ConsultTemplateText.draftAbdo + " Murphy's sign positive."),
                              ("Resp", nil)])
        XCTAssertEqual(r.unconfirmed, ["Examination: template text not edited (General, CVS)"])
        XCTAssertTrue(ConsultTemplateText.isUneditedExamTemplate(ConsultTemplateText.legacyDraftGeneral))
    }

    func testTheExamTemplateNoLongerAssertsAfebrile() {
        XCTAssertFalse(ConsultTemplateText.draftGeneral.contains("Afebrile"))
    }

    func testReviewFlagsQuestionnaireHPIAndUneditedDrafts() {
        let r = review(hpi: "SITE: Right upper quadrant\nONSET: Sudden (3h ago)\nRADIATION: none",
                       drafts: ["Plan"])
        XCTAssertEqual(r.unconfirmed, ["HPI: still the patient's questionnaire answers (patient-reported)",
                                       "Plan: template draft not edited"])
        XCTAssertFalse(ConsultTemplateText.isQuestionnaireHPI("Site: RUQ, onset yesterday."))
    }

    func testReviewDiagnosisText() {
        XCTAssertEqual(review(dx: "Acute cholecystitis", icd: "K81.0").diagnosis, "Acute cholecystitis (K81.0)")
        XCTAssertEqual(review(dx: "Biliary colic", icd: " ").diagnosis, "Biliary colic")
        XCTAssertNil(review(dx: "  ").diagnosis)
    }

    func testReviewWithNoGaps() {
        XCTAssertTrue(review().hasNoGaps)
        XCTAssertTrue(EncounterCompletionReview.attestation.hasPrefix("I have reviewed"))
        XCTAssertTrue(EncounterCompletionReview.actionsExplanation.contains("Save snapshot"))
        XCTAssertTrue(EncounterCompletionReview.actionsExplanation.contains("Complete"))
    }

    // MARK: - Draft buttons

    func testDraftButtonsNeverSayAIWhileAIIsOff() {
        XCTAssertFalse(DraftButtonText.aiDraftingEnabled)
        for section in ["HPI", "Examination", "Plan"] {
            XCTAssertEqual(DraftButtonText.title(section: section), "Draft from template")
            XCTAssertFalse(DraftButtonText.accessibilityLabel(section: section).contains("AI"))
        }
        XCTAssertNotEqual(DraftButtonText.systemImage(), "sparkles")
    }

    // MARK: - Today: Added today

    func testWalkInAddedTodayWithNoDateIsOnToday() {
        let walkIn = Patient(fullName: "Taylor Newpatient")
        let booked = Patient(fullName: "Booked Tomorrow")
        booked.operationDate = Date().addingTimeInterval(86_400)
        let ward = Patient(fullName: "Ward Patient", setting: .inpatient)
        let old = Patient(fullName: "Old Record")
        old.createdAt = Date().addingTimeInterval(-3 * 86_400)
        [walkIn, booked, ward, old].forEach { context.insert($0) }

        let added = TodayBoard.addedToday([walkIn, booked, ward, old],
                                          isToday: { $0.map { Calendar.current.isDateInToday($0) } ?? false })
        XCTAssertEqual(added.map(\.fullName), ["Taylor Newpatient"])

        let board = TodayBoard(patients: [walkIn, booked, ward, old], events: [], calendar: .current)
        XCTAssertTrue(board.addedToday.contains { $0.fullName == "Taylor Newpatient" })
        XCTAssertTrue(board.allToday.contains { $0.fullName == "Taylor Newpatient" })
    }
}
