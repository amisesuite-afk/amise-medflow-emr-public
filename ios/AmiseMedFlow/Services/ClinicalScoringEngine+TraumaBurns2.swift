// ClinicalScoringEngine+TraumaBurns2.swift
// Parkland formula, paediatric trauma score, and related burn/trauma scoring.

import Foundation


extension ClinicalScoringEngine {

    // MARK: - Parkland Formula (Burns Fluid Resuscitation)
    struct ParklandInput: Equatable {
        var weightKg: Double = 70     // body weight in kilograms
        var tbsaPercent: Double = 20  // total body surface area burned (%)
        var hasInhalationInjury: Bool = false
    }

    static func parkland(_ i: ParklandInput) -> ClinicalScore {
        // Parkland: 4 mL × kg × TBSA% in 24 h (adults)
        // Modified Brooke (commonly used): 2 mL × kg × TBSA%
        // Using Parkland (4 mL/kg/%TBSA) — the established UK/Caribbean standard
        let totalVol = 4.0 * i.weightKg * i.tbsaPercent
        let firstHalf = totalVol / 2     // first 8 h from time of burn
        let secondHalf = totalVol / 2    // next 16 h
        let rateFirst8h = firstHalf / 8
        let rateNext16h = secondHalf / 16

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        switch i.tbsaPercent {
        case ..<15:
            risk = .low
            interp = "Minor burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL over 24 h. May be managed with oral fluids if alert. IV access recommended."
            flags = []
        case 15..<25:
            risk = .moderate
            interp = "Moderate burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL over 24 h. IV resuscitation mandatory."
            flags = []
        case 25..<40:
            risk = .high
            interp = "Major burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL. Risk of burn shock — aggressive resuscitation and ICU admission."
            flags = ["Major burn ≥25% TBSA — burn shock risk: strict fluid monitoring required"]
        default:
            risk = .critical
            interp = "Critical burn (TBSA \(Int(i.tbsaPercent))%). Total Parkland volume: \(Int(totalVol)) mL. Life-threatening — burns unit, early intubation if inhalation injury."
            flags = ["Critical burn ≥40% TBSA — mortality risk >50%; burns centre transfer if available"]
        }
        let inhalationNote = i.hasInhalationInjury ? " Inhalation injury: early intubation strongly recommended — airway oedema peaks at 8–12 h." : ""
        return ClinicalScore(
            systemName: "Parkland Formula (Burns Fluid)",
            abbreviation: "Parkland \(Int(totalVol)) mL",
            score: totalVol,
            maxScore: 4 * 100 * 100,
            risk: risk,
            interpretation: interp + inhalationNote,
            recommendations: [
                "Parkland formula: 4 mL × \(Int(i.weightKg)) kg × \(Int(i.tbsaPercent))% TBSA = \(Int(totalVol)) mL Hartmann's/Ringer's lactate over 24 h",
                "First half (\(Int(firstHalf)) mL) in first 8 h from TIME OF BURN (not from arrival) — at \(Int(rateFirst8h)) mL/h",
                "Second half (\(Int(secondHalf)) mL) over next 16 h — at \(Int(rateNext16h)) mL/h",
                "Target urine output: 0.5–1.0 mL/kg/h (adult) — titrate infusion rate accordingly",
                "Urinary catheter mandatory — strict fluid balance; avoid under- and over-resuscitation",
                "Do NOT include colloid in first 12 h (Parkland protocol)",
                "Add colloid (albumin 5%) from 12–24 h if resuscitation requirements excessive",
                i.hasInhalationInjury ? "INHALATION INJURY: early anaesthetic/ICU review for intubation before oedema develops" : "Analgesia: IV morphine + anti-emetic; oral if minor burn",
                "Wound care: cool running water for 20 min if <3 h post-burn; non-adherent dressings",
                "Transfer to regional burns unit if: TBSA >15% adult, full-thickness, face/hands/perineum/circumferential"
            ],
            items: [
                ScoredItem(label: "Weight (\(Int(i.weightKg)) kg)", points: i.weightKg, present: true),
                ScoredItem(label: "TBSA burned (\(Int(i.tbsaPercent))%)", points: i.tbsaPercent, present: true),
                ScoredItem(label: "Total 24 h volume: \(Int(totalVol)) mL Hartmann's", points: totalVol, present: true),
                ScoredItem(label: "First 8 h: \(Int(firstHalf)) mL at \(Int(rateFirst8h)) mL/h", points: firstHalf, present: true),
                ScoredItem(label: "Next 16 h: \(Int(secondHalf)) mL at \(Int(rateNext16h)) mL/h", points: secondHalf, present: true),
                ScoredItem(label: "Inhalation injury (+additional airway management)", points: 0, present: i.hasInhalationInjury)
            ],
            redFlags: flags,
            evidenceNote: "Baxter CR, Shires T. Ann N Y Acad Sci 1968;150:874–894. Parkland formula: 4 mL/kg/%TBSA Hartmann's in 24 h. Standard in UK (ISBI, NICE). The formula is a guide — adjust rate to urine output 0.5–1 mL/kg/h. Over-resuscitation causes abdominal compartment syndrome and pulmonary oedema; under-resuscitation causes burn shock. Reassess fluid rate hourly."
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
