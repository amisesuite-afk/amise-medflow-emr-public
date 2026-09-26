import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Front-desk patient push and the refused-record list (no network).
///
/// Migration 89 lets front desk change only the admin and patient-reported intake columns of
/// `patients` (enforce_front_desk_patient_columns). A front-desk push therefore leaves every other
/// column out of the UPDATE (PatientUpdateRow with frontDeskOnly), so a stale local copy of a
/// clinical field cannot get the whole update refused. A refused record (42501) is remembered in
/// SyncRefusals until the next sign-in.
@MainActor
final class FrontDeskSyncTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        SyncRefusals.clearAll()
    }

    override func tearDown() async throws {
        SyncRefusals.clearAll()
    }

    // MARK: - Helpers

    /// A patient with admin, intake AND clinician-only fields all set.
    private func fullPatient() -> Patient {
        let p = Patient(fullName: "Test Patient", sex: .female, setting: .outpatient,
                        location: .rodney_bay, acuity: .urgent)
        context.insert(p)
        p.phone = "758-000-0000"
        p.nokName = "NOK"
        p.chiefComplaint = "RUQ pain"
        p.pmhNotes = "HTN\nMEDICATIONS: amlodipine"
        p.familyHistoryNotes = "CRC"
        p.surgicalHistory = "Appendicectomy"
        p.allergiesJson = "[]"
        p.heightCm = 170
        p.visitType = .newConsult
        p.hpi = "Clinician HPI"
        p.assessmentText = "Assessment"
        p.workingDiagnosis = "Biliary colic"
        p.workingDiagnosisICD = "K80.2"
        p.managementPlan = "Plan"
        p.examAbdo = "Soft"
        p.socialHistory = "Non-smoker"
        p.investigationsJson = "[]"
        p.ward = "Ward 3"
        p.bedNumber = "4"
        p.mallampatiScore = 2
        p.ogdDataJson = "{}"
        return p
    }

    private func encodedKeys(_ row: PatientUpdateRow) throws -> Set<String> {
        let data = try JSONEncoder().encode(row)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        return Set(object.keys)
    }

    // MARK: - PatientUpdateRow

    func testFrontDeskRowSendsOnlyAllowListedColumns() throws {
        let keys = try encodedKeys(PatientUpdateRow(fullPatient(), frontDeskOnly: true))

        XCTAssertTrue(keys.isSubset(of: FrontDeskPatientColumns.allowed),
                      "not allowed for front desk: \(keys.subtracting(FrontDeskPatientColumns.allowed).sorted())")
        for intake in ["chief_complaint", "pmh_notes", "family_history_notes", "surgical_history",
                       "allergies_json", "height_cm", "visit_type", "phone", "nok_name"] {
            XCTAssertTrue(keys.contains(intake), "front desk still sends \(intake)")
        }
        for clinical in ["hpi", "assessment_text", "working_diagnosis", "working_diagnosis_icd",
                         "management_plan", "exam_abdo", "social_history", "investigations_json",
                         "ward", "bed_number", "mallampati_score", "ogd_data_json", "acuity"] {
            XCTAssertFalse(keys.contains(clinical), "front desk must not send \(clinical)")
        }
    }

    func testClinicianRowSendsClinicalColumns() throws {
        let keys = try encodedKeys(PatientUpdateRow(fullPatient(), frontDeskOnly: false))
        for clinical in ["hpi", "working_diagnosis", "exam_abdo", "acuity", "ogd_data_json",
                         "chief_complaint", "phone"] {
            XCTAssertTrue(keys.contains(clinical), "a clinician push sends \(clinical)")
        }
    }

    func testNilValueIsLeftOutNotSentAsNull() throws {
        let p = Patient(fullName: "No Phone")
        context.insert(p)
        let keys = try encodedKeys(PatientUpdateRow(p, frontDeskOnly: false))
        XCTAssertFalse(keys.contains("phone"))
        XCTAssertTrue(keys.contains("full_name"))
    }

    // MARK: - SyncRefusals

    func testRefusalsAreRememberedPerKindUntilCleared() {
        let id = UUID()
        SyncRefusals.mark(id, as: .patient)
        SyncRefusals.mark(id, as: .patient)   // idempotent
        XCTAssertEqual(SyncRefusals.ids(.patient), [id.uuidString])
        XCTAssertTrue(SyncRefusals.ids(.clinicalNote).isEmpty)

        SyncRefusals.clearAll()               // sign-in / app launch
        XCTAssertTrue(SyncRefusals.ids(.patient).isEmpty)
    }

    func testNoticeHasNoPatientData() {
        XCTAssertNil(SyncRefusals.notice(count: 0))
        XCTAssertEqual(SyncRefusals.notice(count: 1), "1 change not permitted for your role")
        XCTAssertEqual(SyncRefusals.notice(count: 3), "3 changes not permitted for your role")
    }

    func testTransportErrorIsNotARefusal() {
        XCTAssertFalse(SyncRefusals.isPermissionRefusal(URLError(.notConnectedToInternet)))
    }
}
