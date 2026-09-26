// ClinicalScoringEngine+Cardiovascular2.swift
// CHA₂DS₂-VASc Score cardiovascular risk scoring.

import Foundation


extension ClinicalScoringEngine {

    // MARK: CHA₂DS₂-VASc

    static func cha2ds2vasc(_ i: CHA2DS2VAScInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure))
        if i.congestiveHeartFailure { score += 1 }
        items.append(.init(label: "Hypertension", points: 1, present: i.hypertension))
        if i.hypertension { score += 1 }
        if i.ageOver75 {
            items.append(.init(label: "Age ≥75 years", points: 2, present: true))
            score += 2
        } else {
            items.append(.init(label: "Age 65–74 years", points: 1, present: i.age65to74))
            if i.age65to74 { score += 1 }
        }
        items.append(.init(label: "Diabetes mellitus", points: 1, present: i.diabetes))
        if i.diabetes { score += 1 }
        items.append(.init(label: "Stroke / TIA / thromboembolism", points: 2, present: i.strokeOrTIA))
        if i.strokeOrTIA { score += 2 }
        items.append(.init(label: "Vascular disease (MI, PAD, aortic plaque)", points: 1, present: i.vascularDisease))
        if i.vascularDisease { score += 1 }
        items.append(.init(label: "Female sex", points: 1, present: i.femaleSex))
        if i.femaleSex { score += 1 }

        let (risk, interp, recs) = cha2ds2vascRisk(score, female: i.femaleSex)
        let redFlags: [String] = score >= 2 ? ["CHA₂DS₂-VASc ≥2 (male) or ≥3 (female): anticoagulation recommended by ESC/AHA"] : []
        return ClinicalScore(
            systemName: "CHA₂DS₂-VASc Score",
            abbreviation: "CHA₂DS₂-VASc \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Lip 2010, ESC 2020 AF guidelines. For non-valvular AF only. Score ≥2 (male) or ≥3 (female): OAC recommended."
        )
    }

    static func cha2ds2vascRisk(_ s: Double, female: Bool) -> (ScoreRisk, String, [String]) {
        let threshold = female ? 3.0 : 2.0
        switch s {
        case 0: return (.low, "CHA₂DS₂-VASc 0 (male) — Very low stroke risk (~0%/yr)", ["No anticoagulation needed", "Reassess annually"])
        case 1: return (female ? .low : .moderate, "CHA₂DS₂-VASc 1 — Annual stroke risk ~1.3%", ["Consider anticoagulation (male)", "Female sex alone does not require OAC", "Individualise risk–benefit"])
        case _ where s >= threshold:
            let annualRisk = s >= 6 ? ">10" : s >= 4 ? "4–8" : "2–3"
            return (.high, "CHA₂DS₂-VASc \(Int(s)) — Annual stroke risk ~\(annualRisk)%",
                    ["Anticoagulation recommended (OAC preferred over aspirin)", "DOAC first-line unless contraindicated (e.g. mechanical valve, moderate–severe mitral stenosis → warfarin)", "Check HAS-BLED score before prescribing", "Baseline renal function, LFTs, FBC"])
        default:
            return (.moderate, "CHA₂DS₂-VASc \(Int(s))", ["Individualise anticoagulation decision"])
        }
    }

    // MARK: HAS-BLED

    static func hasBled(_ i: HASBLEDInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "H — Hypertension (uncontrolled, SBP >160)", points: 1, present: i.hypertensionUncontrolled))
        if i.hypertensionUncontrolled { score += 1 }
        items.append(.init(label: "A — Abnormal renal function", points: 1, present: i.renalDysfunction))
        if i.renalDysfunction { score += 1 }
        items.append(.init(label: "A — Abnormal liver function", points: 1, present: i.liverDysfunction))
        if i.liverDysfunction { score += 1 }
        items.append(.init(label: "S — Stroke history", points: 1, present: i.strokeHistory))
        if i.strokeHistory { score += 1 }
        items.append(.init(label: "B — Bleeding predisposition / history", points: 1, present: i.priorBleeding))
        if i.priorBleeding { score += 1 }
        items.append(.init(label: "L — Labile INR (TTR <60%)", points: 1, present: i.labileINR))
        if i.labileINR { score += 1 }
        items.append(.init(label: "E — Elderly (age >65)", points: 1, present: i.ageOver65))
        if i.ageOver65 { score += 1 }
        items.append(.init(label: "D — Drugs (antiplatelets/NSAIDs)", points: 1, present: i.drugsOrAlcohol))
        if i.drugsOrAlcohol { score += 1 }
        items.append(.init(label: "D — Alcohol (≥8 units/wk)", points: 1, present: i.alcoholUse))
        if i.alcoholUse { score += 1 }

        let (risk, interp, recs) = hasBledRisk(score)
        let redFlags: [String] = score >= 3 ? ["HAS-BLED ≥3: high bleeding risk — review modifiable factors before anticoagulation"] : []
        return ClinicalScore(
            systemName: "HAS-BLED Bleeding Risk Score",
            abbreviation: "HAS-BLED \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Pisters 2010. Predicts 1-year major bleeding risk in patients on anticoagulation for AF. Used alongside CHA₂DS₂-VASc."
        )
    }

    static func hasBledRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...1: return (.low, "HAS-BLED \(Int(s)): Low bleeding risk (~1%/yr)", ["Anticoagulation appropriate if CHA₂DS₂-VASc indicates", "Routine monitoring"])
        case 2:     return (.moderate, "HAS-BLED 2: Moderate bleeding risk (~1.9%/yr)", ["Anticoagulation can be considered — weigh against stroke risk", "Address modifiable risk factors (BP control, avoid NSAIDs)", "Frequent INR monitoring if on warfarin"])
        default:    return (.high, "HAS-BLED \(Int(s)): High bleeding risk (≥3%/yr)", ["Does NOT mean anticoagulation is contraindicated — stroke risk often still exceeds bleeding risk", "Address ALL modifiable factors: hypertension, labile INR, alcohol, NSAIDs", "Consider DOAC over warfarin", "Regular review; involve haematology if complex"])
        }
    }

    // MARK: - Padua Prediction Score (Medical VTE Risk)

    static func padua(_ i: PaduaInput) -> ClinicalScore {
        var score = 0
        var items: [ScoredItem] = []
        func add(_ label: String, _ flag: Bool, pts: Int) {
            if flag { score += pts }
            items.append(ScoredItem(label: label, points: Double(flag ? pts : 0), present: flag))
        }
        add("Active/recent cancer (≤6 months or metastatic)", i.activeOrRecentCancer, pts: 3)
        add("Previous VTE (excl. superficial thrombosis)", i.previousVTE, pts: 3)
        add("Reduced mobility ≥3 days (anticipated bed rest)", i.reducedMobility, pts: 3)
        add("Known thrombophilia (inherited or acquired)", i.thrombophilia, pts: 3)
        add("Recent trauma or surgery (≤1 month)", i.recentTraumaOrSurgery, pts: 2)
        add("Age ≥70 years", i.ageOver70, pts: 1)
        add("Heart failure or respiratory failure", i.heartOrRespiratoryFailure, pts: 1)
        add("Acute MI or ischaemic stroke", i.acuteMIOrIschaemicStroke, pts: 1)
        add("Acute infection or inflammatory condition", i.acuteInfectionOrInflammatory, pts: 1)
        add("BMI ≥30 (obese)", i.obese, pts: 1)
        add("Ongoing hormonal treatment (OCP, HRT)", i.ongoingHormonalTreatment, pts: 1)

        let isHighRisk = score >= 4
        let risk: ScoreRisk = isHighRisk ? .high : .low
        let interpretation = isHighRisk
            ? "Padua \(score) — HIGH VTE risk; pharmacological prophylaxis recommended"
            : "Padua \(score) — LOW VTE risk; mechanical prophylaxis sufficient"
        let recs: [String] = isHighRisk
            ? ["Low molecular weight heparin (LMWH) prophylaxis — start immediately",
               "Enoxaparin 40 mg SC OD (CrCl ≥30 mL/min) or fondaparinux 2.5 mg SC OD",
               "Continue until patient is fully mobile (minimum 14 days in high-risk)",
               "Renal dose-adjust if CrCl <30 mL/min",
               "Combine with compression stockings or IPC device",
               "Review and restart prophylaxis if surgery is planned"]
            : ["Graduated compression stockings (class 2)",
               "Intermittent pneumatic compression (IPC) if stockings contraindicated",
               "Early mobilisation — key non-pharmacological intervention",
               "Reassess daily; escalate if score increases to ≥4"]
        let redFlags: [String] = isHighRisk
            ? ["Padua ≥4: high VTE risk — LMWH prophylaxis required unless contraindicated"]
            : []
        return ClinicalScore(
            systemName: "Padua Prediction Score",
            abbreviation: "Padua \(score)",
            score: Double(score), maxScore: 20,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Barbar S et al, J Thromb Haemost 2010. Validated in 1180 medical inpatients. Score ≥4 = high risk (11% VTE without prophylaxis vs 2.2% with LMWH). Complements Caprini for surgical patients."
        )
    }

}
