import XCTest
import SwiftData
@testable import AmiseMedFlow

/// SOAPDraftEngine is the deterministic pre-fill used on ward round. Every section must be non-empty,
/// chart content must appear, and sections must not mention things that were never recorded.
@MainActor
final class SOAPDraftEngineTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    /// Deliberately matches nothing in the surgical vademecum, so the draft holds chart content only.
    private let unmatchedDiagnosis = "Test diagnosis zq-417"

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func patient(acuity: Acuity = .routine) -> Patient {
        let p = Patient(fullName: "SOAP Test Patient", sex: .female, acuity: acuity)
        context.insert(p)
        return p
    }

    private func addVitals(to p: Patient, _ configure: (VitalsEntry) -> Void) throws {
        let v = VitalsEntry(patient: p)
        configure(v)
        context.insert(v)
        try context.save()
        if !p.vitalsEntries.contains(where: { $0.id == v.id }) { p.vitalsEntries.append(v) }
    }

    // MARK: - Empty chart

    func testEmptyChartGivesNonEmptySectionsWithoutInventedContent() {
        let p = patient()
        let d = SOAPDraftEngine.draft(patient: p)

        for (label, section) in [("S", d.s), ("O", d.o), ("A", d.a), ("P", d.p)] {
            XCTAssertFalse(section.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "\(label) is empty")
        }
        XCTAssertEqual(d.o, "Examination not yet documented.")
        XCTAssertEqual(d.a, "Acuity: Routine.")
        XCTAssertEqual(d.p, "Routine follow-up as arranged.")

        for absent in ["Presents with", "PMH:", "Surgical history:", "Medications:",
                       "Family history:", "Social:", "Associated symptoms:"] {
            XCTAssertFalse(d.s.contains(absent), "S mentions \(absent) with nothing recorded")
        }
        // Allergy status is always stated, and an empty list is never reported as NKDA.
        XCTAssertTrue(d.s.contains("Allergies: not recorded."), d.s)
        XCTAssertFalse(d.s.contains("NKDA"), "no allergies recorded must not be reported as NKDA")
        for absent in ["Vitals:", "NEWS2", "BMI", "Labs:", "Awaiting:"] {
            XCTAssertFalse(d.o.contains(absent), "O mentions \(absent) with nothing recorded")
        }
    }

    // MARK: - Chart content is carried through

    func testChartContentAppearsInTheRightSections() {
        let p = patient()
        p.chiefComplaint = "Right iliac fossa pain"
        p.hpi = "Pain for 36 hours, migrated from the umbilicus."
        p.allergies = [AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")]
        p.examAbdo = "Tender RIF with guarding"
        p.workingDiagnosis = unmatchedDiagnosis
        p.workingDiagnosisICD = "R69"
        p.managementPlan = "Analgesia, repeat bloods in the morning"

        let d = SOAPDraftEngine.draft(patient: p)

        XCTAssertTrue(d.s.hasPrefix("Female"))
        XCTAssertTrue(d.s.contains("Presents with right iliac fossa pain."))
        XCTAssertTrue(d.s.contains("Pain for 36 hours, migrated from the umbilicus."))
        XCTAssertTrue(d.s.contains("Allergies: Penicillin (Anaphylaxis) — Severe."))
        XCTAssertFalse(d.s.contains("NKDA"), "recorded allergy must not be reported as NKDA")

        XCTAssertTrue(d.o.contains("Examination: Abdo: Tender RIF with guarding."))

        XCTAssertTrue(d.a.contains("\(unmatchedDiagnosis) [R69]."))
        XCTAssertTrue(d.a.contains("Acuity: Routine."))
        XCTAssertFalse(d.a.contains("Differential diagnosis"))
        XCTAssertFalse(d.a.contains("Surgical classification"))

        XCTAssertTrue(d.p.contains("Analgesia, repeat bloods in the morning"))
        XCTAssertFalse(d.p.contains("Investigations:"))
        XCTAssertFalse(d.p.contains("Surgical pearls"))
    }

    // MARK: - Allergy status

    func testExplicitNKDAIsReportedAsNKDA() {
        let p = patient()
        p.allergies = [Patient.nkdaMarkerEntry()]
        let s = SOAPDraftEngine.draft(patient: p).s
        XCTAssertTrue(s.contains("Allergies: NKDA."), s)
        XCTAssertFalse(s.contains("not recorded"))
        XCTAssertFalse(s.contains("NKDA (None)"), "the NKDA marker is not listed as an allergen")
    }

    func testRecordedAllergyWithNKDAMarkerAsksToReconcile() {
        let p = patient()
        p.allergies = [Patient.nkdaMarkerEntry(),
                       AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")]
        let s = SOAPDraftEngine.draft(patient: p).s
        XCTAssertTrue(s.contains("Allergies: Penicillin (Anaphylaxis) — Severe."), s)
        XCTAssertTrue(s.contains("please reconcile"), s)
        XCTAssertFalse(s.contains("Allergies: NKDA"))
    }

    func testAllergyStatusHelpers() {
        let p = patient()
        XCTAssertFalse(p.hasExplicitNKDA)
        XCTAssertEqual(p.noAllergyStatusText, "not recorded")
        p.allergies = [Patient.nkdaMarkerEntry()]
        XCTAssertTrue(p.hasExplicitNKDA)
        XCTAssertTrue(p.recordedAllergies.isEmpty)
        XCTAssertEqual(p.noAllergyStatusText, "NKDA")
        p.allergies = [AllergyEntry(name: "Latex", severity: "Moderate", reaction: "Rash")]
        XCTAssertFalse(p.hasExplicitNKDA)
        XCTAssertEqual(p.recordedAllergies.map(\.name), ["Latex"])
    }

    func testOnlyRecordedVitalsAreListed() throws {
        let p = patient()
        try addVitals(to: p) { v in
            v.heartRate = 88
            v.respiratoryRate = 16
        }
        let o = SOAPDraftEngine.draft(patient: p).o
        // Unrecorded observations are not listed as values; the NEWS2 is marked as partial and
        // names what is missing (the number itself is unchanged: missing parameters count as 0).
        XCTAssertTrue(o.contains(
            "Vitals: NEWS2 0 (Low — incomplete: SpO₂, BP, Temp not recorded), HR 88 bpm, RR 16/min."), o)
        XCTAssertFalse(o.contains("BP 1"), "BP was not recorded")
        XCTAssertFalse(o.contains("°C"), "temperature was not recorded")
        XCTAssertFalse(o.contains("SpO₂ 9"), "SpO2 was not recorded")
    }

    func testCompleteVitalsAreNotMarkedIncomplete() throws {
        let p = patient()
        try addVitals(to: p) { v in
            v.respiratoryRate = 16
            v.spo2 = 98
            v.bpSystolic = 120
            v.bpDiastolic = 80
            v.heartRate = 72
            v.temperatureCelsius = 36.8
        }
        let o = SOAPDraftEngine.draft(patient: p).o
        XCTAssertTrue(o.contains("Vitals: NEWS2 0 (Low), BP 120/80"), o)
        XCTAssertFalse(o.contains("incomplete"))
    }

    func testLatestVitalsAreUsed() throws {
        let p = patient()
        try addVitals(to: p) { v in
            v.recordedAt = Date(timeIntervalSince1970: 1_700_000_000)
            v.heartRate = 120
        }
        try addVitals(to: p) { v in
            v.recordedAt = Date(timeIntervalSince1970: 1_700_003_600)
            v.heartRate = 76
        }
        let o = SOAPDraftEngine.draft(patient: p).o
        XCTAssertTrue(o.contains("HR 76 bpm"))
        XCTAssertFalse(o.contains("HR 120 bpm"))
    }

    func testOnlyOrderedInvestigationsAreListedAsAwaited() {
        let p = patient()
        p.investigations = [
            InvestigationEntry(name: "CT abdomen", category: .imaging, status: .ordered),
            InvestigationEntry(name: "MRCP", category: .imaging, status: .suggested),
            InvestigationEntry(name: "Lipase", category: .blood, status: .cancelled),
        ]
        let d = SOAPDraftEngine.draft(patient: p)
        XCTAssertTrue(d.o.contains("Awaiting: CT abdomen."))
        XCTAssertTrue(d.p.contains("Await: CT abdomen."))
        XCTAssertFalse(d.o.contains("MRCP"), "a suggestion is not an order")
        XCTAssertFalse(d.p.contains("MRCP"), "a suggestion is not an order")
        XCTAssertFalse(d.o.contains("Lipase"))
        XCTAssertFalse(d.p.contains("Lipase"))
    }

    // MARK: - Follow-up by acuity (no vademecum match)

    func testFollowUpFollowsAcuity() {
        let expected: [(Acuity, String)] = [
            (.emergency, "Urgent surgical review — same day."),
            (.urgent,    "Review within 24–48 hours."),
            (.priority,  "Review within 1 week."),
            (.routine,   "Routine follow-up as arranged."),
        ]
        for (acuity, text) in expected {
            let p = patient(acuity: acuity)
            XCTAssertEqual(SOAPDraftEngine.buildFollowUp(p), text)
            XCTAssertTrue(SOAPDraftEngine.draft(patient: p).a.contains("Acuity: \(acuity.label)."))
        }
    }

    // MARK: - Note assembly

    func testFullNoteHasSectionsInOrder() {
        let p = patient()
        p.hpi = "History text"
        let note = SOAPDraftEngine.draft(patient: p).fullNote
        XCTAssertTrue(note.contains("History text"))
        guard let s = note.range(of: "S: "), let o = note.range(of: "O: "),
              let a = note.range(of: "A: "), let pl = note.range(of: "P: ") else {
            return XCTFail("a section header is missing:\n\(note)")
        }
        XCTAssertLessThan(s.lowerBound, o.lowerBound)
        XCTAssertLessThan(o.lowerBound, a.lowerBound)
        XCTAssertLessThan(a.lowerBound, pl.lowerBound)
    }
}
