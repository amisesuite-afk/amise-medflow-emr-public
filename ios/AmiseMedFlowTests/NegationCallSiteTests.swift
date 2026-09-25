import XCTest
@testable import AmiseMedFlow

/// Free-text finding detection on the consultation path goes through NegationMatcher: a documented
/// negative is not the finding. One test per call site, each with a positive control.
final class NegationCallSiteTests: XCTestCase {

    // MARK: - ClinicalPathwayEngine (CC / PMH red flags and escalation)

    func testNegatedJaundiceInTheComplaintDoesNotEscalate() {
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Epigastric pain, no jaundice").suggestedAcuity, .routine)
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Epigastric pain with jaundice").suggestedAcuity, .urgent)
    }

    func testNegatedHistoryIsNotAnEmergencyRedFlag() {
        let r = ClinicalPathwayEngine.assess(chiefComplaint: "Abdominal pain",
                                             pmh: "No history of perforation or peritonitis")
        XCTAssertTrue(r.redFlags.isEmpty, "\(r.redFlags)")
        XCTAssertNotEqual(r.suggestedAcuity, .emergency)
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Generalised peritonitis").suggestedAcuity, .emergency)
    }

    func testNoWeightLossIsNotAColorectalRedFlag() {
        let negative = ClinicalPathwayEngine.assess(chiefComplaint: "Change in bowel habit, no weight loss")
        XCTAssertEqual(negative.pathway, "Colorectal Screening Pathway")
        XCTAssertTrue(negative.redFlags.isEmpty, "\(negative.redFlags)")
        XCTAssertEqual(negative.suggestedAcuity, .routine)
        let positive = ClinicalPathwayEngine.assess(chiefComplaint: "Change in bowel habit and weight loss")
        XCTAssertEqual(positive.suggestedAcuity, .priority)
    }

    // MARK: - PatientStateVector PMH flags (pipeline questions)

    func testPMHFlagsIgnoreNegatedHistory() {
        let flags = PMHFlags.parse(from: "No history of DVT or PE. Hypertension.")
        XCTAssertFalse(flags.dvtOrPE)
        XCTAssertTrue(flags.hypertension)
        XCTAssertTrue(PMHFlags.parse(from: "Previous DVT 2019").dvtOrPE)
    }

    // MARK: - BayesianDiagnosisEngine scoring (exam / PMH free text)

    private let candidate = BayesianDiagnosisEngine.Candidate(
        name: "Test candidate", icd: "X00", logPrior: 0,
        features: [
            .init(key: "exam", value: "crepitus", logLR: 20, evidenceLabel: "Crepitus"),
            .init(key: "exam", value: "murphy", logLR: 20, evidenceLabel: "Murphy's sign"),
            .init(key: "exam", value: "absent pulse", logLR: 20, evidenceLabel: "Absent pulse"),
            .init(key: "pmh", value: "diabetes", logLR: 20, evidenceLabel: "Diabetes"),
        ])

    private func findings(exam: String, pmh: String = "") -> [String] {
        BayesianDiagnosisEngine.score(candidates: [candidate], socrates: [:], pmh: pmh, pshx: "",
                                      examAbdo: exam, examGeneral: "", investigations: [],
                                      age: 50, sex: .male).first?.pathognomicFindings ?? []
    }

    func testNegatedExamFindingsDoNotScore() {
        let f = findings(exam: "Soft. No crepitus. Murphy's sign negative.", pmh: "No diabetes")
        XCTAssertFalse(f.contains("Crepitus"))
        XCTAssertFalse(f.contains("Murphy's sign"))
        XCTAssertFalse(f.contains("Diabetes"))
    }

    func testAffirmedExamFindingsStillScore() {
        let f = findings(exam: "Crepitus over the thigh. Murphy's sign positive.", pmh: "Type 2 diabetes")
        XCTAssertTrue(f.contains("Crepitus"))
        XCTAssertTrue(f.contains("Murphy's sign"))
        XCTAssertTrue(f.contains("Diabetes"))
    }

    func testAFeatureWrittenAsANegativeStillMatches() {
        // "absent pulse": the absence is the finding; its words must not be negated by "absent".
        XCTAssertTrue(findings(exam: "Cold left foot, absent pulses below the femoral").contains("Absent pulse"))
        XCTAssertTrue(findings(exam: "Foot pulses absent").contains("Absent pulse"))
    }
}
