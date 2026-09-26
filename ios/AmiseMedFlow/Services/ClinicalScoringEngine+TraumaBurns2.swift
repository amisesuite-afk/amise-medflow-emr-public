// ClinicalScoringEngine+TraumaBurns2.swift
// Parkland formula, paediatric trauma score, and related burn/trauma scoring.

import Foundation


extension ClinicalScoringEngine {

    // MARK: - Parkland Formula (Burns Fluid Resuscitation)
    struct ParklandInput: Equatable {
        var weightKg: Double = 70     // body weight in kilograms
        var tbsaPercent: Double = 20  // total body surface area burned (%)
        var hasInhalationInjury: Bool = false
        /// Hours since the burn (the first half is due within 8 h of the BURN, not of arrival).
        var hoursSinceBurn: Double = 0
        /// Crystalloid already given since the burn (pre-hospital, referring unit), mL.
        var fluidGivenMl: Double = 0
        /// Under 16: formal fluids from 10% TBSA, urine output target 1 mL/kg/h, add maintenance.
        var isChild: Bool = false
        /// Electrical (high-voltage) injury: IV fluids whatever the visible TBSA.
        var isElectrical: Bool = false
    }

    /// Formal IV resuscitation threshold used across the app (acuity engine, burns card, this
    /// calculator): ≥15% TBSA adults, ≥10% children. The ≥ / > choice and its source are logged for
    /// surgeon sign-off (SURGEON-DECISIONS D2); ≥ is the conservative reading.
    static func burnFluidThreshold(isChild: Bool) -> Double { isChild ? 10 : 15 }

    static func parkland(_ i: ParklandInput) -> ClinicalScore {
        // Parkland 4 mL × kg × %TBSA over 24 h from the time of burn — the practice's current,
        // conservative default. ATLS 10 / ABA starting rates (2 mL adults, 3 mL children, 4 mL
        // electrical) are shown as a note (SURGEON-DECISIONS D1, sign-off pending).
        let totalVol = 4.0 * i.weightKg * i.tbsaPercent
        let firstHalf = totalVol / 2     // first 8 h from time of burn
        let secondHalf = totalVol / 2    // next 16 h
        let hours = max(0, min(i.hoursSinceBurn, 24))
        let given = max(0, i.fluidGivenMl)
        // Rate now: what is still due in the first 8 h, over the hours left of those 8 h; after
        // 8 h, what is still due of the 24 h volume over the hours left.
        let rateNow: Double
        let rateNowText: String
        if hours < 8 {
            let due = max(0, firstHalf - given)
            let hoursLeft = 8 - hours
            rateNow = due / hoursLeft
            rateNowText = "First 8 h from the TIME OF BURN: \(Int(due)) mL still due over the remaining \(String(format: "%.1f", hoursLeft)) h — run at \(Int(rateNow)) mL/h now (burn \(String(format: "%.1f", hours)) h ago, \(Int(given)) mL already given)"
        } else {
            let due = max(0, totalVol - given)
            let hoursLeft = max(24 - hours, 1)
            rateNow = due / hoursLeft
            rateNowText = "More than 8 h since the burn: \(Int(due)) mL of the 24 h volume still due over \(Int(hoursLeft)) h — \(Int(rateNow)) mL/h, titrated to urine output"
        }
        let rateNext16h = secondHalf / 16
        let threshold = burnFluidThreshold(isChild: i.isChild)
        let uoTarget = i.isElectrical ? "1–1.5 mL/kg/h until pigmented urine clears (electrical injury)"
            : (i.isChild ? "1 mL/kg/h (child)" : "0.5 mL/kg/h (adult)")

        let (risk, interp): (ScoreRisk, String)
        var flags: [String] = []
        if i.isElectrical {
            risk = i.tbsaPercent >= 25 ? .critical : .high
            interp = "Electrical injury (visible TBSA \(Int(i.tbsaPercent))%). Visible burn size underestimates deep injury: IV fluids and a urine-output target of \(uoTarget) REGARDLESS of visible TBSA (ABA; BBA)."
            flags = ["Electrical injury — IV fluids and urine output target regardless of visible TBSA; ECG monitoring, CK, compartments"]
        } else if i.tbsaPercent < threshold {
            risk = .low
            interp = "Burn \(Int(i.tbsaPercent))% TBSA — below the formal IV resuscitation threshold (≥\(Int(threshold))% \(i.isChild ? "child" : "adult")). Oral fluids may be adequate if alert and drinking; IV fluids if not. Parkland volume for reference: \(Int(totalVol)) mL over 24 h."
        } else if i.tbsaPercent < 25 {
            risk = .moderate
            interp = "Burn \(Int(i.tbsaPercent))% TBSA — formal IV resuscitation required (≥\(Int(threshold))% \(i.isChild ? "child" : "adult")). Parkland volume: \(Int(totalVol)) mL over 24 h from the time of burn."
        } else if i.tbsaPercent < 40 {
            risk = .high
            interp = "Major burn (TBSA \(Int(i.tbsaPercent))%). Parkland volume: \(Int(totalVol)) mL over 24 h from the time of burn. Risk of burn shock — ICU / burns centre."
            flags = ["Major burn ≥25% TBSA — burn shock risk: strict fluid monitoring required"]
        } else {
            risk = .critical
            interp = "Critical burn (TBSA \(Int(i.tbsaPercent))%). Parkland volume: \(Int(totalVol)) mL. Life-threatening — burns centre, early intubation if inhalation injury."
            flags = ["Critical burn ≥40% TBSA — mortality risk >50%; burns centre transfer if available"]
        }
        let inhalationNote = i.hasInhalationInjury ? " Inhalation injury: early intubation strongly recommended — airway oedema peaks at 8–12 h." : ""
        var recs = [
            "Parkland formula: 4 mL × \(Int(i.weightKg)) kg × \(Int(i.tbsaPercent))% TBSA = \(Int(totalVol)) mL Hartmann's over 24 h FROM THE TIME OF BURN",
            rateNowText,
            "Second half (\(Int(secondHalf)) mL) over the following 16 h — \(Int(rateNext16h)) mL/h, titrated to urine output",
            "Target urine output: \(uoTarget) — adjust the rate hourly (over-resuscitation causes compartment syndromes)",
            "Note — ATLS 10 / ABA starting rates: 2 mL/kg/%TBSA adults, 3 mL/kg/%TBSA children, 4 mL/kg/%TBSA electrical injury (practice default remains Parkland pending surgeon sign-off)",
            "Urinary catheter; strict fluid balance",
            i.hasInhalationInjury ? "INHALATION INJURY: early anaesthetic/ICU review for intubation before oedema develops" : "Analgesia: IV opioid + anti-emetic; oral if minor burn",
            "Wound care: cool running water for 20 min if <3 h post-burn; cling film / non-adherent dressings",
            "Refer to a burns service: any full-thickness burn, partial thickness >10% adults (>5% children), face / hands / feet / genitalia / perineum / major joints, circumferential, inhalation, electrical, chemical, pregnancy, comorbidity, concomitant trauma, suspected non-accidental injury (National Burn Care Referral Guidance)",
        ]
        if i.isChild {
            recs.append("Child: add maintenance fluid with glucose on top of the resuscitation volume — weight-based dosing — calculate per BNFc / APLS")
        }
        return ClinicalScore(
            systemName: "Parkland Formula (Burns Fluid)",
            abbreviation: "Parkland \(Int(totalVol)) mL",
            score: totalVol,
            maxScore: 4 * 100 * 100,
            risk: risk,
            interpretation: interp + inhalationNote,
            recommendations: recs,
            items: [
                ScoredItem(label: "Weight (\(Int(i.weightKg)) kg)", points: i.weightKg, present: true),
                ScoredItem(label: "TBSA burned (\(Int(i.tbsaPercent))%)", points: i.tbsaPercent, present: true),
                ScoredItem(label: "Total 24 h volume: \(Int(totalVol)) mL Hartmann's", points: totalVol, present: true),
                ScoredItem(label: "Rate now: \(Int(rateNow)) mL/h (\(String(format: "%.1f", hours)) h since burn, \(Int(given)) mL given)", points: rateNow, present: true),
                ScoredItem(label: "Next 16 h: \(Int(secondHalf)) mL at \(Int(rateNext16h)) mL/h", points: secondHalf, present: true),
                ScoredItem(label: "Inhalation injury (+additional airway management)", points: 0, present: i.hasInhalationInjury),
                ScoredItem(label: "Electrical injury (fluids regardless of TBSA)", points: 0, present: i.isElectrical)
            ],
            redFlags: flags,
            evidenceNote: "Baxter CR, Shires T. Ann N Y Acad Sci 1968;150:874–894 (Parkland 4 mL/kg/%TBSA). ATLS 10th ed. (2018) and ABA start at 2 mL/kg/%TBSA (adults), 3 mL (children), 4 mL (electrical). Half is due within 8 h of the BURN, so a late start needs a higher rate. Formal fluids from 15% TBSA adults / 10% children (≥, conservative; source to be confirmed — SURGEON-DECISIONS D2). Adjust to urine output."
        )
    }

    // MARK: - #105 Paediatric Trauma Score (PTS)

    struct PTSInput: Equatable {
        var weight: Int          // 0 = >20 kg (+2), 1 = 10–20 kg (+1), 2 = <10 kg (−1)
        var airway: Int          // 0 = normal (+2), 1 = maintainable (+1), 2 = unmaintainable (−1)
        var systolicBP: Int      // 0 = >90 mmHg (+2), 1 = 50–90 mmHg (+1), 2 = <50 mmHg (−1)
        var cns: Int             // 0 = awake (+2), 1 = obtunded (+1), 2 = comatose (−1)
        var openWound: Int       // 0 = none (+2), 1 = minor (+1), 2 = major/penetrating (−1)
        var fracture: Int        // 0 = none (+2), 1 = closed (+1), 2 = open/multiple (−1)
    }

    static func pts(_ i: PTSInput) -> ClinicalScore {
        let points: [[Int: Int]] = [
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1],
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1],
            [0: 2, 1: 1, 2: -1], [0: 2, 1: 1, 2: -1]
        ]
        let vals = [i.weight, i.airway, i.systolicBP, i.cns, i.openWound, i.fracture]
        var score = 0
        for (j, v) in vals.enumerated() {
            switch v {
            case 0:  score += points[j][0] ?? 0
            case 1:  score += points[j][1] ?? 0
            default: score += points[j][2] ?? 0
            }
        }
        score = max(-6, min(12, score))

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 9...12:
            risk  = .low
            interp = "PTS \(score) — Minor/no major trauma. Low mortality risk."
            recs  = ["Standard paediatric assessment and monitoring",
                     "Reassess if clinical condition changes"]
        case 6...8:
            risk  = .moderate
            interp = "PTS \(score) — Moderate paediatric trauma. Potential for significant injury."
            recs  = ["Secondary survey for occult injuries",
                     "IV access, fluid resuscitation if haemodynamically compromised",
                     "Urgent paediatric surgical review",
                     "CT trauma protocol as clinically indicated"]
        case 0...5:
            risk  = .high
            interp = "PTS \(score) — Major paediatric trauma. High risk of significant morbidity and mortality."
            recs  = ["Immediate trauma team activation",
                     "Primary ABCDE survey — airway management priority",
                     "IV/IO access, blood transfusion protocol activation",
                     "CT trauma protocol (head, C-spine, chest, abdomen, pelvis)",
                     "Paediatric surgery + neurosurgery review",
                     "Consider transfer to paediatric major trauma centre"]
            flags = ["PTS ≤8: triage to a paediatric trauma centre when available"]
        default:
            risk  = .critical
            interp = "PTS \(score) — Critical paediatric trauma. Immediate resuscitation required."
            recs  = ["Immediate life-saving interventions (airway, haemorrhage control, decompression)",
                     "Full trauma team response",
                     "Massive transfusion protocol consideration",
                     "Urgent neurosurgical consultation if head injury",
                     "Immediate transfer to paediatric trauma centre"]
            flags = ["PTS ≤0: critical — immediate resuscitation and trauma centre transfer"]
        }

        return ClinicalScore(
            name:          "Paediatric Trauma Score (PTS)",
            score:         Double(score),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Tepas JJ et al. J Pediatr Surg 1987;22(1):14. PTS assesses weight, airway, systolic BP, CNS, open wound, fracture: each parameter scored +2/+1/−1. Range −6 to +12. Score ≤8 = major trauma requiring paediatric trauma centre; used as triage criterion. Comparable in predictive accuracy to the Revised Trauma Score (RTS) for paediatric populations. PTS ≤0 = 100% mortality in original series."
        )
    }

}
