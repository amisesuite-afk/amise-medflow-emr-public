import Foundation

// MARK: - Value of Information (VoI) Engine
// Computes the Expected Value of Perfect Information (EVPI) for each candidate
// investigation or question that has not yet been obtained.
//
// EVPI(e) = H(prior) − E_e[H(posterior | e)]
//
// Where:
//   H(p)    = Shannon entropy = -Σ p_i × log₂(p_i)
//   E_e[H]  = P(e=+) × H(post | e=+) + P(e=−) × H(post | e=−)
//   P(e=+)  = Σ_j P(hypothesis_j) × P(e=1 | hypothesis_j)    — marginal P of positive result
//
// P(e=1 | hypothesis_j) comes from the LogLR table:
//   logLR = log P(e=1|H_j) / P(e=1|¬H_j)
//   → P(e=1|H_j) = baseProbability × exp(logLR) / (baseProbability × exp(logLR) + (1-baseProbability))
//
// Output: ranked list of InformationItem (investigation or question) ordered by EVPI descending.

// MARK: - Output types

struct InformationItem: Identifiable {
    let id = UUID()
    let name: String             // "Serum Lipase", "CT Abdomen/Pelvis", "Murphy's Sign"
    let category: InfoCategory
    let evpi: Double             // bits — entropy reduction expected
    let targetDiagnoses: [String]// diagnoses this most discriminates
    let priority: InfoPriority
    let timeToResult: String     // "Immediate", "30 min", "4–6 hours", "24 hours"
    let clinicalNote: String?    // why this matters now
}

enum InfoCategory: String, CaseIterable {
    case physicalExam      = "Physical Examination"
    case bedside           = "Bedside Investigation"
    case labBlood          = "Blood Test"
    case labUrine          = "Urine Test"
    case imaging           = "Imaging"
    case specialised       = "Specialised Test"
    case historyClarify    = "History Clarification"
}

enum InfoPriority: Int, Comparable {
    case immediate  = 0
    case urgent     = 1
    case routine    = 2
    static func < (lhs: InfoPriority, rhs: InfoPriority) -> Bool { lhs.rawValue < rhs.rawValue }
    var label: String { ["Immediate", "Urgent", "Routine"][rawValue] }
}

// MARK: - Candidate evidence catalogue
// Each entry describes a piece of evidence not yet in the PatientStateVector
// and its likelihood ratios per named diagnosis.

private struct CandidateEvidence {
    let key: String
    let name: String
    let category: InfoCategory
    let timeToResult: String
    let priority: InfoPriority
    // Approx LR+ for each named diagnosis (positive result)
    let lr: [String: Double]     // diagnosisName → LR+ (positive test)
    // Base rate in undifferentiated surgical population
    let baseProbPositive: Double
}

private let candidateEvidenceTable: [CandidateEvidence] = [
    // --- Physical examination ---
    CandidateEvidence(key: "murphy_sign",   name: "Murphy's Sign",          category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Cholecystitis": 2.8], baseProbPositive: 0.15),
    CandidateEvidence(key: "rovsing_sign",  name: "Rovsing's Sign",         category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Appendicitis": 2.5], baseProbPositive: 0.12),
    CandidateEvidence(key: "rebound",       name: "Rebound Tenderness",     category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Perforated Viscus": 3.1, "Acute Appendicitis": 2.4, "Acute Peritonitis": 4.2], baseProbPositive: 0.18),
    CandidateEvidence(key: "guarding",      name: "Abdominal Guarding",     category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Perforated Viscus": 2.8, "Acute Appendicitis": 1.9], baseProbPositive: 0.22),
    CandidateEvidence(key: "rigidity",      name: "Board-like Rigidity",    category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Perforated Viscus": 5.2, "Generalised Peritonitis": 6.0], baseProbPositive: 0.06),
    CandidateEvidence(key: "crepitus",      name: "Subcutaneous Crepitus",  category: .physicalExam, timeToResult: "Immediate", priority: .immediate, lr: ["Necrotising Fasciitis": 8.0, "Gas Gangrene": 10.0], baseProbPositive: 0.03),
    CandidateEvidence(key: "pulses",        name: "Peripheral Pulses (Doppler)", category: .bedside, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Limb Ischaemia": 12.0, "Arterial Embolism": 10.0], baseProbPositive: 0.05),

    // --- Bedside ---
    CandidateEvidence(key: "ecg",           name: "12-lead ECG",            category: .bedside, timeToResult: "5 min",     priority: .urgent,    lr: ["Massive Pulmonary Embolism": 1.8, "Arterial Embolism": 3.5], baseProbPositive: 0.20),
    CandidateEvidence(key: "urine_bhcg",    name: "Urine β-hCG",            category: .bedside, timeToResult: "5 min",     priority: .immediate, lr: ["Ectopic Pregnancy": 30.0], baseProbPositive: 0.05),
    CandidateEvidence(key: "urine_dip",     name: "Urine Dipstick",         category: .bedside, timeToResult: "5 min",     priority: .urgent,    lr: ["Urosepsis": 3.2, "Renal Colic": 2.5], baseProbPositive: 0.30),
    CandidateEvidence(key: "fingerprick_glucose", name: "Fingerprick Glucose", category: .bedside, timeToResult: "2 min",  priority: .urgent,    lr: ["Diabetic Ketoacidosis": 8.0], baseProbPositive: 0.15),

    // --- Blood tests ---
    CandidateEvidence(key: "wbc",           name: "Full Blood Count (WBC)", category: .labBlood, timeToResult: "30 min",   priority: .urgent,    lr: ["Acute Appendicitis": 2.0, "Acute Cholecystitis": 2.2, "Ascending Cholangitis": 3.0, "Sepsis": 2.8, "Necrotising Fasciitis": 2.5], baseProbPositive: 0.35),
    CandidateEvidence(key: "crp",           name: "C-Reactive Protein",     category: .labBlood, timeToResult: "60 min",   priority: .urgent,    lr: ["Acute Appendicitis": 2.5, "Ascending Cholangitis": 3.2, "Necrotising Fasciitis": 4.0, "Sepsis": 3.0], baseProbPositive: 0.40),
    CandidateEvidence(key: "amylase",       name: "Serum Amylase",          category: .labBlood, timeToResult: "30 min",   priority: .urgent,    lr: ["Acute Pancreatitis": 6.0, "Perforated Peptic Ulcer": 2.0], baseProbPositive: 0.10),
    CandidateEvidence(key: "lipase",        name: "Serum Lipase",           category: .labBlood, timeToResult: "30 min",   priority: .urgent,    lr: ["Acute Pancreatitis": 8.5], baseProbPositive: 0.09),
    CandidateEvidence(key: "lactate",       name: "Serum Lactate",          category: .labBlood, timeToResult: "15 min",   priority: .immediate, lr: ["Septic Shock": 5.0, "Mesenteric Ischaemia": 6.0, "Strangulated Bowel": 4.5, "Acute Limb Ischaemia": 4.0], baseProbPositive: 0.12),
    CandidateEvidence(key: "lft",           name: "Liver Function Tests",   category: .labBlood, timeToResult: "60 min",   priority: .urgent,    lr: ["Ascending Cholangitis": 5.0, "Acute Cholecystitis": 2.5, "Acute Pancreatitis": 2.0], baseProbPositive: 0.20),
    CandidateEvidence(key: "d_dimer",       name: "D-Dimer",                category: .labBlood, timeToResult: "30 min",   priority: .urgent,    lr: ["Pulmonary Embolism": 2.0, "Proximal DVT": 2.2], baseProbPositive: 0.25),
    CandidateEvidence(key: "troponin",      name: "High-Sensitivity Troponin", category: .labBlood, timeToResult: "60 min", priority: .urgent,   lr: ["Massive Pulmonary Embolism": 3.5], baseProbPositive: 0.08),
    CandidateEvidence(key: "blood_culture", name: "Blood Cultures × 2",    category: .labBlood, timeToResult: "48 h",     priority: .urgent,    lr: ["Sepsis": 4.0, "Ascending Cholangitis": 3.5, "Urosepsis": 3.8], baseProbPositive: 0.18),
    CandidateEvidence(key: "lrinec_labs",   name: "LRINEC Panel (FBC/CRP/Na/Cr/Glucose)", category: .labBlood, timeToResult: "60 min", priority: .immediate, lr: ["Necrotising Fasciitis": 6.0, "Fournier's Gangrene": 6.0], baseProbPositive: 0.05),

    // --- Imaging ---
    CandidateEvidence(key: "erect_cxr",     name: "Erect CXR",             category: .imaging, timeToResult: "30 min",    priority: .urgent,    lr: ["Perforated Viscus": 12.0, "Perforated Peptic Ulcer": 10.0], baseProbPositive: 0.08),
    CandidateEvidence(key: "us_abdomen",    name: "USS Abdomen / RUQ",     category: .imaging, timeToResult: "30–60 min", priority: .urgent,    lr: ["Acute Cholecystitis": 6.5, "Biliary Colic": 5.0, "Ascending Cholangitis": 4.5, "Acute Pancreatitis": 2.0], baseProbPositive: 0.30),
    CandidateEvidence(key: "ct_abdomen",    name: "CT Abdomen/Pelvis",     category: .imaging, timeToResult: "60–90 min", priority: .urgent,    lr: ["Acute Appendicitis": 10.0, "Perforated Viscus": 15.0, "Bowel Obstruction": 12.0, "Mesenteric Ischaemia": 9.0, "Renal Colic": 14.0], baseProbPositive: 0.35),
    CandidateEvidence(key: "ct_angiogram",  name: "CT Angiogram",          category: .imaging, timeToResult: "90 min",   priority: .immediate, lr: ["Acute Limb Ischaemia": 18.0, "Ruptured AAA": 20.0, "Mesenteric Ischaemia": 14.0], baseProbPositive: 0.10),
    CandidateEvidence(key: "ctpa",          name: "CTPA",                  category: .imaging, timeToResult: "60–90 min", priority: .urgent,   lr: ["Pulmonary Embolism": 22.0, "Massive Pulmonary Embolism": 25.0], baseProbPositive: 0.12),
    CandidateEvidence(key: "duplex_leg",    name: "Duplex USS Lower Limb", category: .imaging, timeToResult: "30–60 min", priority: .urgent,    lr: ["Proximal DVT": 16.0, "Acute Limb Ischaemia": 8.0], baseProbPositive: 0.10),
    CandidateEvidence(key: "ct_soft_tissue",name: "CT Soft Tissue (NF gas)", category: .imaging, timeToResult: "60 min",priority: .immediate, lr: ["Necrotising Fasciitis": 10.0, "Gas Gangrene": 12.0], baseProbPositive: 0.04),

    // --- History clarification ---
    CandidateEvidence(key: "radiation_shoulder", name: "Pain radiating to shoulder/scapula", category: .historyClarify, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Cholecystitis": 3.5, "Biliary Colic": 3.0, "Perforated Viscus": 2.0], baseProbPositive: 0.12),
    CandidateEvidence(key: "radiation_back",     name: "Pain radiating to back",             category: .historyClarify, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Pancreatitis": 4.5, "Ruptured AAA": 3.0], baseProbPositive: 0.15),
    CandidateEvidence(key: "relieved_by_leaning",name: "Pain relieved leaning forward",      category: .historyClarify, timeToResult: "Immediate", priority: .immediate, lr: ["Acute Pancreatitis": 5.0], baseProbPositive: 0.05),
    CandidateEvidence(key: "prior_dvt_pe",       name: "Prior DVT or PE",                    category: .historyClarify, timeToResult: "Immediate", priority: .urgent,    lr: ["Pulmonary Embolism": 4.0, "Proximal DVT": 3.5], baseProbPositive: 0.08),
    CandidateEvidence(key: "af_history",         name: "History of Atrial Fibrillation",     category: .historyClarify, timeToResult: "Immediate", priority: .urgent,    lr: ["Arterial Embolism": 6.0, "Mesenteric Ischaemia": 4.0], baseProbPositive: 0.10)
]

// MARK: - Engine

enum ValueOfInformationEngine {

    // How many bits of entropy change are clinically meaningful
    private static let minEVPI: Double = 0.05

    // Main function: compute EVPI for each candidate evidence item not yet collected
    static func rank(
        hypotheses: [DiagnosisHypothesis],
        alreadyCollected collectedKeys: Set<String>
    ) -> [InformationItem] {
        guard !hypotheses.isEmpty else { return [] }

        let priorEntropy = shannonEntropy(hypotheses.map(\.probability))
        var results: [InformationItem] = []

        for candidate in candidateEvidenceTable {
            guard !collectedKeys.contains(candidate.key) else { continue }

            let evpi = computeEVPI(
                candidate: candidate,
                hypotheses: hypotheses,
                priorEntropy: priorEntropy
            )
            guard evpi >= minEVPI else { continue }

            // Determine which diagnoses this test most discriminates
            let targetDiags = candidate.lr
                .filter { (_, lr) in lr >= 3.0 }
                .sorted { $0.value > $1.value }
                .prefix(3)
                .map(\.key)

            results.append(InformationItem(
                name: candidate.name,
                category: candidate.category,
                evpi: evpi,
                targetDiagnoses: targetDiags,
                priority: candidate.priority,
                timeToResult: candidate.timeToResult,
                clinicalNote: note(for: candidate, hypotheses: hypotheses, evpi: evpi)
            ))
        }

        return results.sorted { $0.evpi > $1.evpi }
    }

    // Convenience overload using PatientStateVector
    static func rank(from psv: PatientStateVector) -> [InformationItem] {
        let collected = Set(psv.socratesSelections.keys)
        return rank(hypotheses: psv.hypotheses, alreadyCollected: collected)
    }

    // MARK: - EVPI calculation

    private static func computeEVPI(
        candidate: CandidateEvidence,
        hypotheses: [DiagnosisHypothesis],
        priorEntropy: Double
    ) -> Double {
        // P(test positive) = Σ_j P(H_j) × P(e=1 | H_j)
        var pPositive = 0.0
        for h in hypotheses {
            let lr = candidate.lr[h.name] ?? 1.0
            // P(e=1 | H_j): derive from LR+ and base rate
            let p0 = candidate.baseProbPositive
            let odds0 = p0 / (1 - p0)
            let odds1 = odds0 * lr
            let pPos_given_H = odds1 / (1 + odds1)
            pPositive += h.probability * pPos_given_H
        }
        let pNegative = 1.0 - pPositive

        // Posterior beliefs given positive result
        let postPositive = bayesUpdate(hypotheses: hypotheses, candidate: candidate, positive: true)
        // Posterior beliefs given negative result
        let postNegative = bayesUpdate(hypotheses: hypotheses, candidate: candidate, positive: false)

        let hPos = shannonEntropy(postPositive)
        let hNeg = shannonEntropy(postNegative)
        let expectedPostEntropy = pPositive * hPos + pNegative * hNeg

        return max(0, priorEntropy - expectedPostEntropy)
    }

    private static func bayesUpdate(
        hypotheses: [DiagnosisHypothesis],
        candidate: CandidateEvidence,
        positive: Bool
    ) -> [Double] {
        var updated = hypotheses.map { h -> Double in
            let lr = candidate.lr[h.name] ?? 1.0
            let p0 = candidate.baseProbPositive
            let odds0 = p0 / (1 - p0)
            let odds1 = odds0 * lr
            let pPos_H = odds1 / (1 + odds1)
            let pEvid_H = positive ? pPos_H : (1 - pPos_H)
            return h.probability * pEvid_H
        }
        let sum = updated.reduce(0, +)
        guard sum > 0 else { return updated }
        return updated.map { $0 / sum }
    }

    private static func shannonEntropy(_ probs: [Double]) -> Double {
        probs.reduce(0.0) { acc, p in
            p > 0 ? acc - p * log2(p) : acc
        }
    }

    // MARK: - Clinical note generator

    private static func note(
        for candidate: CandidateEvidence,
        hypotheses: [DiagnosisHypothesis],
        evpi: Double
    ) -> String? {
        let leadHyp = hypotheses.sorted { $0.probability > $1.probability }.first
        let lead = leadHyp?.name ?? "leading diagnosis"
        let pct = Int((leadHyp?.probability ?? 0) * 100)
        return "\(candidate.name) reduces diagnostic uncertainty by \(String(format: "%.1f", evpi)) bits. Strongest discriminator for \(lead) (P=\(pct)%)."
    }
}
