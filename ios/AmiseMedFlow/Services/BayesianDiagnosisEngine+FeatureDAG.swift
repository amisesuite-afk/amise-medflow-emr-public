// BayesianDiagnosisEngine+Featuredag.swift
// Feature key/value → Bayesian DAG node ID mapping.

import Foundation

extension BayesianDiagnosisEngine {

    // MARK: - Feature → DAG node ID mapping
    // Maps (feature key, value) pairs to BayesianFeatureNetwork node IDs so CPT-based
    // discounting fires when correlated features co-occur in the same candidate scoring pass.

    static func featureNetworkID(key: String, value: String) -> String? {
        let v = value.lowercased()
        switch key {
        case "associations",
             "associated":  // synonym — same DAG mapping
            if v.contains("raised wbc") || v.contains("elevated wbc") || v.contains("leukocytosis") { return "wbc_elevated" }
            if v.contains("elevated crp") || v.contains("raised crp") { return "crp_elevated" }
            if v.contains("elevated lactate") || v.contains("raised lactate") { return "lactate_raised" }
            if v.contains("fever") || v.contains("pyrexia") { return "fever" }
            if v.contains("tachycardia") { return "tachycardia" }
            if v.contains("hypotension") { return "hypotension" }
            if v.contains("haemoptysis") || v.contains("hemoptysis") { return "haemoptysis" }
            if v.contains("dyspnoea") || v.contains("dyspnea") || v.contains("shortness of breath") { return "dyspnoea" }
            if v.contains("pleuritic") { return "pleuritic_pain" }
            if v.contains("dark urine") { return "dark_urine" }
            if v.contains("pale stool") || v.contains("clay stool") { return "pale_stool" }
            if v.contains("jaundice") { return "jaundice" }
            if v.contains("paraesthesia") || v.contains("paresthesia") || v.contains("numbness") { return "paresthesia" }
        case "exam",
             "exam_general",  // synonym keys — same physical-exam DAG mapping
             "exam_abdo",
             "exam_cvs":
            if v.contains("guarding") { return "guarding" }
            if v.contains("rebound") { return "rebound" }
            if v.contains("rigidity") { return "rigidity" }
            if v.contains("pallor") && !v.contains("limb") && !v.contains("leg") && !v.contains("arm") { return "pallor" }
            if v.contains("cold") && (v.contains("limb") || v.contains("extremit") || v.contains("foot") || v.contains("leg")) { return "cold_limb" }
            if v.contains("absent pulse") || v.contains("pulse absent") || v.contains("pulseless") { return "pulselessness" }
            if v.contains("murphy") { return "murphy_sign" }
            if v.contains("jaundice") { return "jaundice" }
        case "onset", "character",
             "socrates_character":  // synonym — same onset/character mapping
            if v.contains("pleuritic") { return "pleuritic_pain" }
            if v.contains("dyspnoea") || v.contains("dyspnea") { return "dyspnoea" }
        case "site",
             "socrates_site":  // synonym
            if v.contains("right upper") || v.contains("ruq") { return "ruq_pain" }
        default:
            break
        }
        return nil
    }


}
