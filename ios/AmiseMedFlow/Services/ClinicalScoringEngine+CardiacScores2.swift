// ClinicalScoringEngine+CardiacScores2.swift
// TIMI Risk Score (UA/NSTEMI), HEART Score, 4T Score (HIT) scoring logic.

import Foundation


extension ClinicalScoringEngine {

    // MARK: - TIMI Risk Score (UA/NSTEMI)

    static func timi(_ i: TIMIInput) -> ClinicalScore {
        var total = 0
        if i.ageOver65 { total += 1 }
        if i.threeOrMoreRiskFactors { total += 1 }
        if i.priorCoronaryArteryStenosis { total += 1 }
        if i.stDeviationOnECG { total += 1 }
        if i.twoOrMoreAnginalEvents { total += 1 }
        if i.aspirinUseInLast7Days { total += 1 }
        if i.elevatedCardiacMarkers { total += 1 }

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...2:
            (.low, "Low risk — 14-day composite event rate ~8%",
             ["Conservative management; serial troponins (0, 3, 6 h)",
              "Non-invasive stress testing before discharge if troponins negative",
              "Dual antiplatelet therapy and anticoagulation per ACS pathway",
              "Cardiology follow-up within 72 h"],
             [])
        case 3...4:
            (.moderate, "Intermediate risk — 14-day composite event rate ~13–20%",
             ["Hospital admission; cardiology review",
              "Inpatient stress testing or early invasive strategy depending on clinical context",
              "Dual antiplatelet + anticoagulation; consider GP IIb/IIIa inhibitor if high-risk features",
              "Echocardiography to assess LV function"],
             [])
        default:
            (.high, "High risk — 14-day composite event rate ~26–40%",
             ["Early invasive strategy (coronary angiography within 24–48 h)",
              "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
              "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
              "Continuous cardiac monitoring; cardiology on-call review urgently",
              "Glycoprotein IIb/IIIa inhibitor if refractory ischaemia or catheter lab planned"],
             ["High TIMI score — early invasive strategy strongly recommended"])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Age ≥65",                           points: 1, present: i.ageOver65),
            ScoredItem(label: "≥3 CAD risk factors",              points: 1, present: i.threeOrMoreRiskFactors),
            ScoredItem(label: "Prior coronary stenosis ≥50%",     points: 1, present: i.priorCoronaryArteryStenosis),
            ScoredItem(label: "ST deviation on ECG",              points: 1, present: i.stDeviationOnECG),
            ScoredItem(label: "≥2 anginal events in prior 24 h",  points: 1, present: i.twoOrMoreAnginalEvents),
            ScoredItem(label: "Aspirin use in prior 7 days",      points: 1, present: i.aspirinUseInLast7Days),
            ScoredItem(label: "Elevated cardiac markers",         points: 1, present: i.elevatedCardiacMarkers)
        ]

        return ClinicalScore(
            systemName: "TIMI Risk Score (UA/NSTEMI)",
            abbreviation: "TIMI",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: "TIMI \(total)/7 — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Antman EM et al. JAMA 2000;284:835–842."
        )
    }

    // MARK: - HEART Score (chest pain risk stratification)

    static func heart(_ i: HEARTInput) -> ClinicalScore {
        let total = i.history + i.ecg + i.ageScore + i.riskFactors + i.troponin
        let (risk, interp, recs, flags) = heartRisk(total)
        let items: [ScoredItem] = [
            ScoredItem(label: "History",      points: Double(i.history),     present: i.history > 0),
            ScoredItem(label: "ECG",          points: Double(i.ecg),         present: i.ecg > 0),
            ScoredItem(label: "Age",          points: Double(i.ageScore),    present: i.ageScore > 0),
            ScoredItem(label: "Risk factors", points: Double(i.riskFactors), present: i.riskFactors > 0),
            ScoredItem(label: "Troponin",     points: Double(i.troponin),    present: i.troponin > 0)
        ]
        return ClinicalScore(
            systemName: "HEART Score",
            abbreviation: "HEART",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "HEART \(total)/10 — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Backus BE et al. Neth Heart J 2010;18:422–428. Six AJ et al. Heart 2008;94:1509–1513. Mahler SA et al. Crit Pathw Cardiol 2015;14:1–8."
        )
    }

    private static func heartRisk(_ score: Int) -> (ScoreRisk, String, [String], [String]) {
        switch score {
        case 0...3:
            return (.low,
                    "Low risk — MACE probability <2% at 6 weeks",
                    ["Discharge from ED with outpatient follow-up if clinically stable",
                     "Serial troponins (0 h and 3 h) to confirm negative before discharge",
                     "Aspirin and early outpatient cardiology review",
                     "Discharge instructions: return if symptoms recur"],
                    [])
        case 4...6:
            return (.moderate,
                    "Moderate risk — MACE probability ~12–25% at 6 weeks",
                    ["Hospital observation with serial troponins (0, 3, 6 h)",
                     "Non-invasive stress testing (exercise ECG or stress echo)",
                     "Cardiology review before discharge",
                     "Antiplatelet therapy; consider anticoagulation if ACS confirmed"],
                    [])
        default:
            return (.high,
                    "High risk — MACE probability ~50–65% at 6 weeks",
                    ["Urgent cardiology review and inpatient monitoring",
                     "Early invasive strategy (coronary angiography within 24–48 h)",
                     "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
                     "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
                     "Continuous cardiac monitoring; prepare for intervention"],
                    ["High HEART score — early invasive strategy strongly recommended"])
        }
    }

    // MARK: - 4T Score (Heparin-Induced Thrombocytopenia)

    struct FourTInput: Equatable {
        // Each domain 0–2
        var thrombocytopenia: Int = 0   // 0=<30% fall or nadir<10; 1=30–50% or nadir 10–19; 2=≥50% fall and nadir≥20
        var timing: Int = 0             // 0=<4 days without recent heparin; 1=consistent but not clear; 2=5–10 days or ≤1 day if prior heparin within 30 days
        var thrombosis: Int = 0         // 0=none; 1=progressive/recurrent or erythematous skin lesions; 2=new thrombosis, skin necrosis, or acute systemic reaction after IV heparin bolus
        var otherCause: Int = 0         // 0=definite other cause; 1=possible other cause; 2=no other cause evident
    }

    static func fourT(_ i: FourTInput) -> ClinicalScore {
        let total = i.thrombocytopenia + i.timing + i.thrombosis + i.otherCause
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...3:
            risk = .low
            interpretation = "4T Score \(total) — Low probability of HIT (<5%)"
            recs = ["HIT unlikely; continue heparin if clinically indicated",
                    "No need for HIT-specific antibody testing based on score alone",
                    "Monitor platelet count per clinical indication"]
            flags = []
        case 4...5:
            risk = .moderate
            interpretation = "4T Score \(total) — Intermediate probability of HIT (~10–30%)"
            recs = ["Discontinue all heparin products (including flushes and LMWH) pending investigation",
                    "Send anti-PF4/heparin ELISA antibody assay urgently",
                    "Switch to alternative non-heparin anticoagulant (argatroban, fondaparinux, or danaparoid) if anticoagulation required",
                    "Haematology review",
                    "Do NOT give warfarin until platelet count has recovered to ≥150 × 10⁹/L"]
            flags = ["Intermediate HIT probability — stop heparin and test anti-PF4 antibodies",
                     "Risk of venous and arterial limb-threatening thrombosis"]
        default:
            risk = .critical
            interpretation = "4T Score \(total) — High probability of HIT (>80%)"
            recs = ["Immediately discontinue ALL heparin-containing products",
                    "Initiate non-heparin anticoagulation urgently (argatroban or bivalirudin for HIT with thrombosis)",
                    "Send anti-PF4/heparin ELISA and serotonin release assay (SRA)",
                    "Urgent haematology consult",
                    "Doppler ultrasound to exclude DVT/thrombosis",
                    "Do NOT give warfarin, platelet transfusions, or LMWH",
                    "Anticoagulate for minimum 4 weeks after platelet recovery"]
            flags = ["HIGH probability HIT — immediate heparin cessation mandatory",
                     "Life-threatening thrombotic complication risk",
                     "Urgent haematology review required"]
        }

        return ClinicalScore(
            systemName: "4T Score",
            abbreviation: "4T \(total)/8",
            score: Double(total), maxScore: 8,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Thrombocytopenia",     points: Double(i.thrombocytopenia), present: i.thrombocytopenia > 0),
                ScoredItem(label: "Timing of platelet fall", points: Double(i.timing),        present: i.timing > 0),
                ScoredItem(label: "Thrombosis / skin necrosis", points: Double(i.thrombosis), present: i.thrombosis > 0),
                ScoredItem(label: "Other cause",           points: Double(i.otherCause),       present: i.otherCause > 0)
            ],
            redFlags: flags,
            evidenceNote: "Warkentin TE et al. Thromb Haemost 2003;90:759–765. Lo GK et al. J Thromb Haemost 2006;4:759–765. Validated pre-test probability tool for HIT diagnosis; positive predictive value ~50–80% at high scores."
        )
    }

}
