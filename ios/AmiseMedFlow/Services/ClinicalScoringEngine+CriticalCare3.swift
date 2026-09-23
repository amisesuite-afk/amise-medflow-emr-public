// ClinicalScoringEngine+CriticalCare3.swift
// SOFA Score and APACHE II scoring (sepsis/critical care).

import Foundation


extension ClinicalScoringEngine {

    // MARK: - SOFA (Sequential Organ Failure Assessment)

    static func sofa(_ i: SOFAInput) -> ClinicalScore {
        let total = i.respiration + i.coagulation + i.liver + i.cardiovascular + i.cns + i.renal
        let items: [ScoredItem] = [
            ScoredItem(label: "Respiratory — PaO₂/FiO₂", points: Double(i.respiration), present: i.respiration > 0),
            ScoredItem(label: "Coagulation — Platelets", points: Double(i.coagulation), present: i.coagulation > 0),
            ScoredItem(label: "Liver — Bilirubin", points: Double(i.liver), present: i.liver > 0),
            ScoredItem(label: "Cardiovascular — MAP/vasopressors", points: Double(i.cardiovascular), present: i.cardiovascular > 0),
            ScoredItem(label: "CNS — GCS", points: Double(i.cns), present: i.cns > 0),
            ScoredItem(label: "Renal — Creatinine/UO", points: Double(i.renal), present: i.renal > 0)
        ]
        let (risk, interpretation, recs, redFlags) = sofaRisk(total)
        return ClinicalScore(
            systemName: "Sequential Organ Failure Assessment",
            abbreviation: "SOFA \(total)",
            score: Double(total), maxScore: 24,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Singer M et al, JAMA 2016 (Sepsis-3). Vincent JL et al, ICM 1996. SOFA ≥2 with suspected infection = sepsis. 0–6: <10% mortality, 7–9: ~20%, 10–12: ~45%, ≥13: >50%."
        )
    }

    private static func sofaRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...1:
            return (.low,
                    "SOFA \(s) — no significant organ dysfunction",
                    ["Standard monitoring", "Reassess if clinical deterioration"],
                    [])
        case 2...6:
            return (.low,
                    "SOFA \(s) — organ dysfunction; Sepsis-3 criteria met if infection suspected",
                    ["Blood cultures × 2 and serum lactate", "IV antibiotics within 1h if sepsis",
                     "IV fluid 30 mL/kg crystalloid if lactate ≥4 mmol/L or hypoperfused",
                     "Repeat SOFA in 24h to track trajectory"],
                    ["SOFA ≥2: organ dysfunction — Sepsis-3 criteria met if infection suspected"])
        case 7...9:
            return (.moderate,
                    "SOFA \(s) — significant multi-organ dysfunction; ~15–20% in-hospital mortality",
                    ["Urgent senior/ICU review", "Source control if septic focus identified",
                     "Vasopressors if MAP <65 mmHg after 30 mL/kg crystalloid",
                     "Hourly urine output monitoring", "Repeat SOFA in 12–24h"],
                    ["SOFA 7–9: significant organ failure — ICU assessment urgently"])
        case 10...12:
            return (.high,
                    "SOFA \(s) — severe multi-organ failure; ~40–50% in-hospital mortality",
                    ["ICU admission required", "Vasopressor titration to MAP ≥65 mmHg",
                     "Renal replacement therapy if AKI KDIGO stage 3",
                     "Mechanical ventilation if P:F <200 with respiratory failure",
                     "Surviving Sepsis Campaign 1h bundle"],
                    ["SOFA 10–12: severe organ failure — ICU admission required"])
        default:
            return (.critical,
                    "SOFA \(s) — critical multi-organ failure; >50% in-hospital mortality",
                    ["Emergency ICU admission", "Full organ support: vasopressors, RRT, mechanical ventilation",
                     "Immediate intensivist review", "Goals-of-care discussion with family",
                     "Surviving Sepsis Campaign — all bundle elements within 1h"],
                    ["SOFA ≥13: critical — mortality >50%; emergency ICU escalation"])
        }
    }

    // MARK: - APACHE II

    static func apacheII(_ i: APACHEIIInput) -> ClinicalScore {
        let gcsPts = 15 - max(3, min(15, i.gcs))
        let aps = i.tempPoints + i.mapPoints + i.hrPoints + i.rrPoints +
                  i.oxyPoints + i.pHPoints + i.sodiumPoints + i.potassiumPoints +
                  i.creatininePoints + i.haematocritPoints + i.wbcPoints + gcsPts
        let total = aps + i.agePoints + i.chronicHealthPoints

        func si(_ label: String, _ pts: Int) -> ScoredItem {
            ScoredItem(label: label, points: Double(pts), present: pts > 0)
        }
        let items: [ScoredItem] = [
            si("Temperature",        i.tempPoints),
            si("Mean Arterial Pressure", i.mapPoints),
            si("Heart Rate",         i.hrPoints),
            si("Respiratory Rate",   i.rrPoints),
            si("Oxygenation",        i.oxyPoints),
            si("Arterial pH",        i.pHPoints),
            si("Serum Sodium",       i.sodiumPoints),
            si("Serum Potassium",    i.potassiumPoints),
            si("Creatinine",         i.creatininePoints),
            si("Haematocrit",        i.haematocritPoints),
            si("White Cell Count",   i.wbcPoints),
            si("GCS (15 − \(i.gcs))", gcsPts),
            si("Age",                i.agePoints),
            si("Chronic Health",     i.chronicHealthPoints),
        ]
        let (risk, interpretation, recs, redFlags) = apacheIIRisk(total)
        return ClinicalScore(
            systemName: "APACHE II Score",
            abbreviation: "APACHE II \(total)",
            score: Double(total), maxScore: 71,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Knaus WA et al, Crit Care Med 1985. Validated in 5030 ICU admissions. Predicted ICU mortality: <5=~4%, 10–14=~15%, 15–19=~25%, 20–24=~40%, 25–29=~55%, ≥30=~85%. Widely used for pancreatitis (Imrie criteria augment) and post-op ICU prognostication."
        )
    }

    private static func apacheIIRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...4:
            return (.low,
                    "APACHE II \(s) — low severity; predicted ICU mortality ~4%",
                    ["Standard monitoring; reassess if clinical course deteriorates",
                     "Serial APACHE II at 24 h improves prognostic accuracy"],
                    [])
        case 5...9:
            return (.low,
                    "APACHE II \(s) — mild severity; predicted ICU mortality ~8%",
                    ["Close monitoring of vital signs and organ function",
                     "Daily APACHE II re-scoring recommended"],
                    [])
        case 10...14:
            return (.moderate,
                    "APACHE II \(s) — moderate severity; predicted ICU mortality ~15%",
                    ["Consider ICU admission if not already in place",
                     "Optimise fluid resuscitation, oxygenation, and antimicrobials",
                     "Identify and reverse underlying cause"],
                    [])
        case 15...19:
            return (.high,
                    "APACHE II \(s) — high severity; predicted ICU mortality ~25%",
                    ["ICU care indicated",
                     "Senior clinician review urgently",
                     "Discuss goals of care with patient and family",
                     "Organ support (vasopressors, ventilation) as clinically indicated"],
                    ["APACHE II ≥15: ~25% predicted mortality — escalate care now"])
        case 20...24:
            return (.high,
                    "APACHE II \(s) — very high severity; predicted ICU mortality ~40%",
                    ["Full ICU support — vasopressors, mechanical ventilation if required",
                     "Urgent senior specialist review",
                     "Early goals-of-care discussion",
                     "Surgical/source control for sepsis"],
                    ["APACHE II ≥20: ~40% predicted mortality — urgent escalation required"])
        default: // ≥25
            return (.critical,
                    "APACHE II \(s) — critical severity; predicted ICU mortality ≥55%",
                    ["Maximal ICU support with close re-evaluation",
                     "Immediate senior and specialist review",
                     "Formal goals-of-care discussion with family",
                     "Consider palliative pathway if refractory to maximal treatment"],
                    ["APACHE II ≥25: predicted mortality >55% — critical — immediate review"])
        }
    }

}
