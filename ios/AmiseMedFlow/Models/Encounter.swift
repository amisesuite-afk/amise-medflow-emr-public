import Foundation
import SwiftData

// MARK: - Encounter
//
// A frozen snapshot of one clinical visit. The Patient model holds the
// live "working" fields that are actively edited during a consultation;
// when the clinician closes an encounter, those fields are snapshotted
// here and linked to the patient. This gives a longitudinal timeline
// without discarding or overwriting any data.

@Model
final class Encounter {

    // MARK: - Identity
    var id: UUID
    var encounterDate: Date
    var visitType: VisitType
    var acuity: Acuity
    var setting: ClinicalSetting
    var location: ClinicalLocation
    var isComplete: Bool            // true once formally closed
    var createdAt: Date
    var syncCode: String            // stable peer-sync ID

    // MARK: - Presenting problem
    var chiefComplaint: String?
    var hpi: String?
    /// Serialised [String: [String]] (dimension id → selected chip labels)
    var socratesJson: String?

    // MARK: - History at time of encounter
    var pmhNotes: String?
    var surgicalHistory: String?

    // MARK: - Examination snapshot
    var examGeneral: String?
    var examCVS: String?
    var examResp: String?
    var examAbdo: String?
    var examNeuro: String?
    var examMSK: String?
    var examSkin: String?
    var examOther: String?

    // MARK: - Investigations ordered in this encounter (JSON: [InvestigationEntry])
    var investigationsJson: String?

    // MARK: - Assessment & plan
    var workingDiagnosis: String?
    var workingDiagnosisICD: String?
    var assessmentText: String?
    var managementPlan: String?

    // MARK: - Bayesian differential frozen at close (JSON: [BayesianSnapshotEntry])
    var bayesianSnapshotJson: String?

    // MARK: - Clinician free-text summary (optional, for letter / handover)
    var clinicianSummary: String?

    // MARK: - Pathway forms at time of visit (burns, ward round, screening) — readable text
    var pathwaySummary: String?

    // MARK: - Back-reference to owning patient
    var patient: Patient?

    // MARK: - Init

    init(
        visitType: VisitType = .newConsult,
        acuity: Acuity = .routine,
        setting: ClinicalSetting = .outpatient,
        location: ClinicalLocation = .rodney_bay
    ) {
        self.id = UUID()
        self.syncCode = UUID().uuidString
        self.encounterDate = .now
        self.visitType = visitType
        self.acuity = acuity
        self.setting = setting
        self.location = location
        self.isComplete = false
        self.createdAt = .now
    }
}

// MARK: - Snapshot from Patient working fields

extension Encounter {

    /// Populate all clinical snapshot fields from the current working state
    /// of a Patient. Does not modify the Patient itself.
    func snapshot(
        from patient: Patient,
        socratesSelections: [String: Set<String>],
        bayesianDx: [BayesianDiagnosisEngine.DiagnosisResult]
    ) {
        chiefComplaint = patient.chiefComplaint
        hpi = patient.hpi

        // PMH — prefer structured entries; fall back to free-text notes
        let pmhList = patient.pmhEntries
        if !pmhList.isEmpty {
            pmhNotes = pmhList.map { e in
                e.yearText.isEmpty ? e.condition : "\(e.condition) (\(e.yearText))"
            }.joined(separator: "; ")
        } else {
            pmhNotes = patient.pmhNotes
        }

        // PSHx — prefer structured entries; fall back to free-text
        let pshxList = patient.pshxEntries
        if !pshxList.isEmpty {
            surgicalHistory = pshxList.map { e in
                var s = e.procedure
                if !e.yearText.isEmpty { s += " (\(e.yearText))" }
                if !e.anaesthetic.isEmpty { s += " [\(e.anaesthetic)]" }
                return s
            }.joined(separator: "; ")
        } else {
            surgicalHistory = patient.surgicalHistory
        }
        examGeneral = patient.examGeneral
        examCVS = patient.examCVS
        examResp = patient.examResp
        examAbdo = patient.examAbdo
        examNeuro = patient.examNeuro
        examMSK = patient.examMSK
        examSkin = patient.examSkin
        examOther = patient.examOther
        investigationsJson = patient.investigationsJson
        workingDiagnosis = patient.workingDiagnosis
        workingDiagnosisICD = patient.workingDiagnosisICD
        assessmentText = patient.assessmentText
        managementPlan = patient.managementPlan
        visitType = patient.visitType ?? .newConsult
        acuity = patient.acuity
        setting = patient.setting
        location = patient.location

        pathwaySummary = patient.pathwaySummaryForVisit

        // Encode SOCRATES selections: Set<String> → [String]
        let serialisable = socratesSelections.mapValues { Array($0) }
        if let data = try? JSONEncoder().encode(serialisable) {
            socratesJson = String(data: data, encoding: .utf8)
        }

        // Freeze Bayesian differential
        let snap = bayesianDx.map { BayesianSnapshotEntry(from: $0) }
        if let data = try? JSONEncoder().encode(snap) {
            bayesianSnapshotJson = String(data: data, encoding: .utf8)
        }
    }

    // MARK: - Decoded helpers

    var decodedSOCRATES: [String: [String]] {
        guard let json = socratesJson,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return decoded
    }

    var decodedBayesianSnapshot: [BayesianSnapshotEntry] {
        guard let json = bayesianSnapshotJson,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([BayesianSnapshotEntry].self, from: data)
        else { return [] }
        return decoded
    }

    var decodedInvestigations: [InvestigationEntry] {
        guard let json = investigationsJson,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([InvestigationEntry].self, from: data)
        else { return [] }
        return decoded
    }

    // MARK: - Summary line for history list

    var summaryLine: String {
        var parts: [String] = []
        if let dx = workingDiagnosis { parts.append(dx) }
        else if let cc = chiefComplaint { parts.append(cc) }
        if let plan = managementPlan?.prefix(60) { parts.append(String(plan)) }
        return parts.isEmpty ? "No summary" : parts.joined(separator: " · ")
    }
}

// MARK: - BayesianSnapshotEntry

/// Codable mirror of BayesianDiagnosisEngine.DiagnosisResult for persistence.
struct BayesianSnapshotEntry: Codable {
    let name: String
    let icdCode: String
    let probability: Int
    let evidence: [String]
    let confidence: String   // "High" / "Moderate" / "Low"

    init(from result: BayesianDiagnosisEngine.DiagnosisResult) {
        self.name = result.name
        self.icdCode = result.icdCode
        self.probability = result.probability
        self.evidence = result.evidence
        self.confidence = result.confidence.label
    }
}
