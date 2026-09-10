import Foundation

// MARK: - AI generation stub
//
// AI generation is intentionally disabled pending HIPAA compliance review.
// All method signatures are preserved so call sites continue to compile.
// Re-enable by replacing the throw AIError.disabled bodies with the network
// implementation once a BAA is in place and a formal risk assessment is complete.
//
// Offline clinical intelligence (BayesianDiagnosisEngine, ClinicalScoringEngine,
// ManagementEngine) remains fully operational — those engines are deterministic
// and make no network calls.

@MainActor
final class AIService: ObservableObject {
    @Published var isGenerating = false
    @Published var error: String?

    // MARK: - Clinical context builder (pure — no network calls)

    func clinicalContext(_ patient: Patient) -> String {
        var lines: [String] = []
        lines.append("Patient: \(patient.fullName), \(patient.ageYears)y, \(patient.sex.rawValue)")
        lines.append("Setting: \(patient.setting.rawValue) — \(patient.location.rawValue)")
        if let cc = patient.chiefComplaint { lines.append("Chief complaint: \(cc)") }
        if let dx = patient.workingDiagnosis {
            lines.append("Working diagnosis: \(dx)\(patient.workingDiagnosisICD.map { " (\($0))" } ?? "")")
        }
        if let hpi = patient.hpi, !hpi.isEmpty { lines.append("HPI: \(hpi)") }
        if let pmh = patient.pmhNotes, !pmh.isEmpty { lines.append("Past medical history: \(pmh)") }
        if let sx = patient.surgicalHistory, !sx.isEmpty { lines.append("Surgical history: \(sx)") }
        if let fh = patient.familyHistoryNotes, !fh.isEmpty { lines.append("Family history: \(fh)") }
        if let social = patient.socialHistory, !social.isEmpty { lines.append("Social history: \(social)") }

        let allergies = patient.allergies
        if allergies.isEmpty {
            lines.append("Allergies: None documented")
        } else {
            let list = allergies.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; ")
            lines.append("ALLERGIES: \(list)")
        }

        let rxs = patient.prescriptions
        if !rxs.isEmpty {
            lines.append("Active medications: \(rxs.map { $0.displayLine }.joined(separator: ", "))")
        }

        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            var vLine = "Latest vitals: NEWS2 \(v.news2Score) (\(v.news2Risk))"
            if let bp = v.bpString { vLine += ", BP \(bp) mmHg" }
            if let hr = v.heartRate { vLine += ", HR \(hr) bpm" }
            if let temp = v.temperatureCelsius { vLine += String(format: ", Temp %.1f°C", temp) }
            if let spo = v.spo2 { vLine += ", SpO₂ \(spo)%" }
            lines.append(vLine)
        }

        let examParts: [(String, String?)] = [
            ("General", patient.examGeneral), ("CVS", patient.examCVS),
            ("Resp", patient.examResp), ("Abdomen", patient.examAbdo), ("Neuro", patient.examNeuro)
        ]
        let examFilled = examParts.compactMap { label, val -> String? in
            guard let v = val, !v.isEmpty else { return nil }
            return "\(label): \(v)"
        }
        if !examFilled.isEmpty {
            lines.append("Examination: \(examFilled.joined(separator: "; "))")
        }

        let invs = patient.investigations
        if !invs.isEmpty {
            let ordered  = invs.filter { $0.status == .ordered || $0.status == .pending }.map { $0.name }
            let resulted = invs.filter { $0.status == .resulted }
                               .map { "\($0.name): \($0.result.isEmpty ? "result pending" : $0.result)" }
            if !ordered.isEmpty  { lines.append("Investigations ordered: \(ordered.joined(separator: ", "))") }
            if !resulted.isEmpty { lines.append("Investigation results: \(resulted.joined(separator: "; "))") }
        }

        if let assessment = patient.assessmentText, !assessment.isEmpty {
            lines.append("Assessment: \(assessment)")
        }
        if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append("Management plan: \(plan)")
        }

        return lines.joined(separator: "\n")
    }

    // MARK: - Stubbed generation methods

    func generate(systemPrompt: String, userMessage: String) async throws -> String {
        throw AIError.disabled
    }

    func generateSOAP(patient: Patient, noteType: NoteType) async throws -> (s: String, o: String, a: String, p: String) {
        throw AIError.disabled
    }

    func generateFreeText(patient: Patient, noteType: NoteType) async throws -> String {
        throw AIError.disabled
    }

    func generateFirstVisitLetter(patient: Patient) async throws -> String {
        throw AIError.disabled
    }

    func generateOpNote(patient: Patient, procedure: String, findings: String) async throws -> String {
        throw AIError.disabled
    }

    func summariseDocument(fileName: String, extractedText: String, patient: Patient) async throws -> String {
        throw AIError.disabled
    }

    func analyseResultImage(_ imageData: Data, patient: Patient) async throws -> String {
        throw AIError.disabled
    }

    func generateReferral(patient: Patient, toSpecialty: String, reason: String) async throws -> String {
        throw AIError.disabled
    }

    func generateClinicalReasoning(patient: Patient) async throws -> String {
        throw AIError.disabled
    }

    func generateDischargeSummary(patient: Patient, treatment: String, followUp: String) async throws -> String {
        throw AIError.disabled
    }

    func generateClinicalSummary(patient: Patient) async throws -> String {
        throw AIError.disabled
    }

    struct OperativeTechniqueResult {
        var indication: String
        var findingsIntraoperative: String
        var incision: String
        var procedureDescription: String
        var closure: String
        var postOpOrders: String
    }

    func generateOperativeTechnique(
        patient: Patient,
        procedureName: String,
        position: String,
        anaesthesiaType: String
    ) async throws -> OperativeTechniqueResult {
        throw AIError.disabled
    }

    struct EndoscopyReportResult {
        var oesophagusNotes: String
        var stomachNotes: String
        var duodenumNotes: String
        var impression: String
        var recommendations: String
    }

    func generateOGDReport(
        patient: Patient,
        indications: [String],
        indicationOther: String
    ) async throws -> EndoscopyReportResult {
        throw AIError.disabled
    }

    struct ERCPReportResult {
        var impression: String
        var recommendations: String
    }

    func generateERCPReport(
        patient: Patient,
        indications: [String],
        indicationOther: String
    ) async throws -> ERCPReportResult {
        throw AIError.disabled
    }

    func draftDiagnosisPlan(patient: Patient) async throws -> String {
        throw AIError.disabled
    }
}

// MARK: - Error types

enum AIError: LocalizedError {
    case disabled
    case apiError(String)

    var errorDescription: String? {
        switch self {
        case .disabled:
            return "AI generation is not available at this time."
        case .apiError(let msg):
            return "AI error: \(msg)"
        }
    }
}
