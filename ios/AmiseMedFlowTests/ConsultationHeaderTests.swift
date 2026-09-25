import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Consultation patient identity (UX review M1).
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
}
