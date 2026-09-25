import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Consultation identity, allergy banner and NEWS2 header text (UX review M1–M3).
@MainActor
final class ConsultationHeaderTests: XCTestCase {

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

    private func patient(_ name: String = "Avery Sample", sex: Sex = .female) -> Patient {
        let p = Patient(fullName: name, sex: sex)
        context.insert(p)
        return p
    }

    // MARK: - M1: patient identity

    func testTitleIsThePatientsNameNeverConsultation() {
        XCTAssertEqual(ConsultationHeader.title(fullName: "Avery Sample"), "Avery Sample")
        XCTAssertEqual(ConsultationHeader.title(fullName: "  Avery Sample \n"), "Avery Sample")
        XCTAssertEqual(ConsultationHeader.title(fullName: "   "), "Unnamed patient")
        XCTAssertNotEqual(patient().consultationTitle, "Consultation")
    }

    func testSubtitleShowsAgeSexAndMRN() {
        XCTAssertEqual(ConsultationHeader.subtitle(ageDisplay: "46y", sex: .female, mrn: "AM-2026-0001"),
                       "46y · Female · MRN AM-2026-0001")
        XCTAssertEqual(ConsultationHeader.subtitle(ageDisplay: nil, sex: .male, mrn: nil), "Male")
        XCTAssertEqual(ConsultationHeader.subtitle(ageDisplay: "8y", sex: .unspecified, mrn: "  "), "8y")
        XCTAssertEqual(ConsultationHeader.subtitle(ageDisplay: nil, sex: .unspecified, mrn: nil), "")
    }

    func testPatientSubtitleUsesTheRecord() {
        let p = patient()
        p.mrn = "AM-2026-0042"
        p.dateOfBirth = Calendar.current.date(byAdding: .year, value: -46, to: .now)
            .flatMap { Calendar.current.date(byAdding: .day, value: -3, to: $0) }
        XCTAssertEqual(p.consultationSubtitle, "46y · Female · MRN AM-2026-0042")
    }

    func testAccessibilityTextNamesThePatient() {
        XCTAssertEqual(ConsultationHeader.accessibilityText(title: "Avery Sample", subtitle: "46y · Female"),
                       "Consultation for Avery Sample, 46y · Female")
        XCTAssertEqual(ConsultationHeader.accessibilityText(title: "Avery Sample", subtitle: ""),
                       "Consultation for Avery Sample")
    }

    // MARK: - M2: allergy banner

    func testNKDAIsANeutralLineNotAnAlert() {
        let p = patient()
        p.allergies = [Patient.nkdaMarkerEntry()]
        XCTAssertEqual(p.consultationAllergyBanner, .noKnownAllergies)
        XCTAssertEqual(ConsultationHeader.noKnownAllergiesText, "No known drug allergies")
    }

    func testEmptyAllergiesAreNotRecordedNotNKDA() {
        XCTAssertEqual(patient().consultationAllergyBanner, .notRecorded)
    }

    func testRealAllergiesRaiseTheAlertWithoutTheNKDAMarker() {
        let p = patient()
        p.allergies = [Patient.nkdaMarkerEntry(),
                       AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")]
        XCTAssertEqual(p.consultationAllergyBanner, .alert(["Penicillin"]))
        XCTAssertEqual(ConsultationHeader.allergyBanner(recorded: ["Latex"], hasNKDAMarker: false), .alert(["Latex"]))
    }

    // MARK: - M3: NEWS2 header text

    func testNEWS2TextCarriesTheIncompleteMarker() {
        XCTAssertEqual(ConsultationHeader.news2Text(score: 5, risk: "Medium", incomplete: false), "NEWS2 5 · Medium")
        XCTAssertEqual(ConsultationHeader.news2Text(score: 3, risk: "Low-medium", incomplete: true),
                       "NEWS2 3 · Low-medium · incomplete")
        XCTAssertEqual(ConsultationHeader.news2Text(score: nil, risk: nil, incomplete: false), "No vitals")
    }

    func testNEWS2TextFromRecordedVitals() throws {
        let p = patient()
        let v = VitalsEntry(patient: p)
        v.heartRate = 135          // NEWS2 3 for HR ≥ 131; other parameters not recorded
        context.insert(v)
        let n = News2Snapshot(v)
        let text = ConsultationHeader.news2Text(score: n.score, risk: n.risk, incomplete: !n.isComplete)
        XCTAssertTrue(text.hasPrefix("NEWS2 \(n.score)"), text)
        XCTAssertTrue(text.hasSuffix("· incomplete"), text)
    }
}
