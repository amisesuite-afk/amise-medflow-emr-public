// DiagnosisScoreMapper+Mappings.swift
// ICD-10 prefix → score mapping and chief complaint augmentation tables.

import Foundation


extension DiagnosisScoreMapper {

    // MARK: - ICD-10 prefix mapping

    static func icdRecommendations(_ icd: String) -> [DiagnosisScoreRecommendation] {
        let code = icd.uppercased().trimmingCharacters(in: .whitespaces)
        var r: [DiagnosisScoreRecommendation] = []

        func add(_ score: ActiveScore, _ rationale: String, _ priority: Int) {
            r.append(DiagnosisScoreRecommendation(score: score, rationale: rationale, priority: priority))
        }

        // K35–K37: Appendicitis
        if code.hasPrefix("K35") || code.hasPrefix("K36") || code.hasPrefix("K37") {
            add(.alvarado, "Alvarado — appendicitis severity (ICD \(code))", 1)
            add(.airScore, "AIR Score — admission vs discharge guidance", 2)
            add(.ripasa,   "RIPASA — appendicitis probability score", 3)
        }
        // K80–K83: Biliary
        if code.hasPrefix("K80") || code.hasPrefix("K81") || code.hasPrefix("K82") || code.hasPrefix("K83") {
            add(.tokyoChole,   "Tokyo cholecystitis grading (ICD \(code))", 1)
            add(.tokyoCholang, "Tokyo cholangitis grading", 2)
        }
        // K85–K86: Pancreatitis
        if code.hasPrefix("K85") || code.hasPrefix("K86") {
            add(.bisap,   "BISAP severity (ICD \(code))", 1)
            add(.ranson,  "Ranson criteria", 2)
            add(.glasgow, "Glasgow score", 3)
        }
        // K57: Diverticular disease
        if code.hasPrefix("K57") {
            add(.hinchey, "Hinchey classification (ICD \(code))", 1)
        }
        // K92: GI Haemorrhage
        if code.hasPrefix("K92") {
            add(.blatchford, "Blatchford — pre-endoscopy risk (ICD \(code))", 1)
            add(.rockall,    "Rockall — post-endoscopy risk", 2)
        }
        // I26: PE
        if code.hasPrefix("I26") {
            add(.wellsPE, "Wells PE probability (ICD \(code))", 1)
            add(.spesi,   "sPESI 30-day mortality", 2)
        }
        // I80/I82: DVT
        if code.hasPrefix("I82") || code.hasPrefix("I80") {
            add(.wellsDVT, "Wells DVT probability (ICD \(code))", 1)
        }
        // I21/I22: Acute MI
        if code.hasPrefix("I21") || code.hasPrefix("I22") {
            add(.heart,      "HEART score — MACE risk stratification (ICD \(code))", 1)
            add(.timi,       "TIMI — UA/NSTEMI risk (ICD \(code))", 2)
            add(.grace,      "GRACE — ACS mortality prediction", 3)
            add(.news2,      "NEWS2 — continuous monitoring post-MI", 4)
            add(.shockIndex, "Shock Index — cardiogenic shock flag", 5)
        }
        // I48: AF
        if code.hasPrefix("I48") {
            add(.cha2ds2vasc, "CHA₂DS₂-VASc stroke risk (ICD \(code))", 1)
            add(.hasBled,     "HAS-BLED bleeding risk", 2)
            add(.dasi,        "DASI — functional capacity", 3)
            add(.news2,       "NEWS2 — rate monitoring", 4)
        }
        // I50: Heart failure
        if code.hasPrefix("I50") {
            add(.news2,      "NEWS2 — decompensation monitoring (ICD \(code))", 1)
            add(.mews,       "MEWS — early warning score", 2)
            add(.cci,        "Charlson Comorbidity Index — mortality adjustment", 3)
            add(.ckdEpi,     "CKD-EPI eGFR — cardiorenal syndrome screening", 4)
            add(.shockIndex, "Shock Index — acute decompensation flag", 5)
        }
        // K70/K74/K72: Liver disease
        if code.hasPrefix("K70") || code.hasPrefix("K74") || code.hasPrefix("K72") {
            add(.childPugh, "Child-Pugh liver reserve (ICD \(code))", 1)
            add(.meld,      "MELD-Na severity", 2)
        }
        // A41/A40: Sepsis
        if code.hasPrefix("A41") || code.hasPrefix("A40") {
            add(.qsofa, "qSOFA sepsis screen (ICD \(code))", 1)
            add(.sofa,  "SOFA organ failure", 2)
        }
        // N20: Kidney stone
        if code.hasPrefix("N20") || code.hasPrefix("N21") {
            add(.stoneUreteric, "STONE score — probability of an uncomplicated ureteric stone (ICD \(code))", 1)
            add(.stone,  "Stone CT features (local 0–6 score, not STONE)", 3)
            add(.ckdEpi, "CKD-EPI baseline eGFR", 3)
        }
        // N17: AKI
        if code.hasPrefix("N17") {
            add(.kdigo,  "KDIGO AKI staging (ICD \(code))", 1)
            add(.ckdEpi, "CKD-EPI eGFR", 2)
        }

        return r
    }

    // MARK: - Chief complaint augmentation

    static func ccAugmentations(_ cc: String) -> [DiagnosisScoreRecommendation] {
        var r: [DiagnosisScoreRecommendation] = []

        func add(_ score: ActiveScore, _ rationale: String, _ priority: Int) {
            r.append(DiagnosisScoreRecommendation(score: score, rationale: rationale, priority: priority))
        }

        // Baseline monitoring for any acute presentation
        if cc.contains("fever") || cc.contains("unwell") || cc.contains("pain") ||
           cc.contains("emergency") || cc.contains("admitted") {
            add(.news2, "NEWS2 — recommended for all acute admissions", 10)
            add(.mews,  "MEWS — modified early warning score", 11)
        }
        // VTE prophylaxis for surgical admissions
        if cc.contains("surg") || cc.contains("operat") || cc.contains("laparoscop") ||
           cc.contains("appendicectomy") || cc.contains("cholecystectomy") ||
           cc.contains("hernia repair") {
            add(.caprini, "Caprini VTE risk — perioperative prophylaxis decision", 9)
        }
        // Weight loss / anaemia — nutritional / oncology risk
        if cc.contains("weight loss") || cc.contains("anaemia") || cc.contains("anemia") {
            add(.must, "MUST — malnutrition universal screening tool", 10)
            add(.cci,  "CCI — comorbidity index for survival context", 12)
        }

        return r
    }

}
