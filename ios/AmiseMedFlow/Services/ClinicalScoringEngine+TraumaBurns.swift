// ClinicalScoringEngine+TraumaBurns.swift
// Trauma / Burns / Acute Injury scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: LRINEC Score (Necrotising Fasciitis)

    static func lrinec(_ i: LRINECInput) -> ClinicalScore {
        var pts: Double = 0
        var items: [ScoredItem] = []

        // CRP
        let crpPts: Double = i.crpOver150 ? 4 : 0
        items.append(.init(label: "CRP >150 mg/L", points: 4, present: i.crpOver150))
        pts += crpPts

        // WBC
        let wbcPts: Double = i.wbcOver25 ? 2 : (i.wbc15to25 ? 1 : 0)
        items.append(.init(label: "WBC 15–25 ×10⁹/L (+1) or >25 (+2)", points: wbcPts, present: wbcPts > 0))
        pts += wbcPts

        // Hb
        let hbPts: Double = i.hbBelow11 ? 2 : (i.hb11to13_5 ? 1 : 0)
        items.append(.init(label: "Hb 11–13.5 g/dL (+1) or <11 (+2)", points: hbPts, present: hbPts > 0))
        pts += hbPts

        // Sodium
        let naPts: Double = i.sodiumBelow135 ? 2 : 0
        items.append(.init(label: "Sodium <135 mmol/L", points: 2, present: i.sodiumBelow135))
        pts += naPts

        // Creatinine
        let crPts: Double = i.creatinineOver177 ? 4 : (i.creatinine141to177 ? 2 : 0)
        items.append(.init(label: "Creatinine 141–177 μmol/L (+2) or >177 (+4)", points: crPts, present: crPts > 0))
        pts += crPts

        // Glucose
        let glucPts: Double = i.glucoseOver10 ? 1 : 0
        items.append(.init(label: "Glucose >10 mmol/L", points: 1, present: i.glucoseOver10))
        pts += glucPts

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch pts {
        case ..<6:
            risk = .low
            interpretation = "LRINEC \(Int(pts))/17 — Low probability of NF; consider cellulitis"
            recs = ["IV antibiotics for cellulitis (flucloxacillin + metronidazole)",
                    "Elevate and mark erythema margins", "Repeat clinical exam in 12–24 h",
                    "If rapidly spreading or systemic toxicity → reassess for NF"]
        case 6...7:
            risk = .moderate
            interpretation = "LRINEC \(Int(pts))/17 — Moderate concern; thorough surgical evaluation essential"
            redFlags = ["LRINEC 6–7: increased risk of NF — surgical assessment mandatory"]
            recs = ["Urgent surgical review", "MRI soft tissue (if available) — most sensitive for NF",
                    "IV broad-spectrum antibiotics (meropenem + clindamycin + fluconazole if candida risk)",
                    "If clinical picture convincing → proceed to theatre without waiting for MRI",
                    "Finger test / incision and inspection at bedside to confirm diagnosis"]
        default:
            risk = .critical
            interpretation = "LRINEC \(Int(pts))/17 — High probability of Necrotising Fasciitis (PPV ~92%)"
            redFlags = ["LRINEC ≥8 — NECROTISING FASCIITIS LIKELY. LIFE-THREATENING SURGICAL EMERGENCY.",
                        "Delay to surgery is the primary determinant of mortality",
                        "Every hour of delay increases mortality by ~10%"]
            recs = ["IMMEDIATE surgical debridement — no delays",
                    "Wide excision of all necrotic tissue (Finger test: necrotic fascia, no bleeding, gas)",
                    "IV meropenem 1 g TDS + clindamycin 600 mg TDS + fluconazole 400 mg OD",
                    "ICU post-operatively",
                    "Second-look surgery at 24–48 h (planned relook)",
                    "Consider hyperbaric oxygen if available",
                    "Plastic surgery / reconstructive team involvement early",
                    "Inform next of kin — mortality 20–40% even with early surgery"]
        }

        return ClinicalScore(
            systemName: "LRINEC Score",
            abbreviation: "LRINEC",
            score: pts, maxScore: 17,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Wong 2004. Score ≥6: NF risk. ≥8: high probability (PPV 92%). PPV falls if used non-selectively."
        )
    }

    // MARK: - Revised Trauma Score (RTS)
    struct RTSInput: Equatable {
        var glasgowComaScore: Int = 15    // 3–15
        var systolicBP: Int = 120         // mmHg
        var respiratoryRate: Int = 16     // breaths/min
    }

    static func rts(_ i: RTSInput) -> ClinicalScore {
        func gcsCoded(_ v: Int) -> Int {
            if v >= 13 { return 4 }; if v >= 9 { return 3 }; if v >= 6 { return 2 }
            if v >= 4 { return 1 }; return 0
        }
        func sbpCoded(_ v: Int) -> Int {
            if v > 89  { return 4 }; if v >= 76 { return 3 }; if v >= 50 { return 2 }
            if v >  0  { return 1 }; return 0
        }
        func rrCoded(_ v: Int) -> Int {
            if v >= 10 && v <= 29 { return 4 }; if v >= 6 { return 3 }
            if v >= 1 { return 2 }; if v > 29 { return 4 }; return 0
        }
        let gcs = gcsCoded(max(3, min(15, i.glasgowComaScore)))
        let sbp = sbpCoded(max(0, i.systolicBP))
        let rr  = rrCoded(max(0, i.respiratoryRate))
        // Weighted RTS (Triage Revised Trauma Score: 0–7.84)
        let rtsScore = 0.9368 * Double(gcs) + 0.7326 * Double(sbp) + 0.2908 * Double(rr)
        let (risk, interp): (ScoreRisk, String)
        switch rtsScore {
        case 7...:  (risk, interp) = (.low,      "RTS \(String(format: "%.2f", rtsScore)) — Minor injury. Predicted survival ~98%. Standard triage.")
        case 4...:  (risk, interp) = (.moderate, "RTS \(String(format: "%.2f", rtsScore)) — Moderate-severe injury. Predicted survival ~60–75%. Priority triage.")
        case 1...:  (risk, interp) = (.high,     "RTS \(String(format: "%.2f", rtsScore)) — Critical injury. Predicted survival ~25–50%. Immediate triage.")
        default:    (risk, interp) = (.high,     "RTS \(String(format: "%.2f", rtsScore)) — Unsurvivable / expectant. Predicted survival <5%.")
        }
        let flags: [String] = rtsScore < 4 ? ["RTS <4: activate major trauma protocol; immediate senior trauma surgeon and anaesthesia"] : []
        return ClinicalScore(
            systemName: "Revised Trauma Score",
            abbreviation: "RTS \(String(format: "%.2f", rtsScore))",
            score: rtsScore,
            maxScore: 7.84,
            risk: risk,
            interpretation: interp,
            recommendations: rtsScore < 4 ? [
                "Activate major trauma protocol immediately",
                "Airway management priority — consider early intubation",
                "Haemorrhage control — transfusion protocol activation",
                "Immediate CT trauma survey if patient stable for transport",
                "Notify operating theatre for emergency damage-control surgery"
            ] : rtsScore < 7 ? [
                "Priority assessment — full trauma workup",
                "Repeat vitals and GCS every 15 minutes",
                "IV access ×2, analgesia, splintage of long-bone fractures"
            ] : [
                "Standard trauma assessment",
                "Analgesia and appropriate wound management"
            ],
            items: [
                ScoredItem(label: "GCS coded (\(i.glasgowComaScore) → \(gcs))", points: Double(gcs), present: true),
                ScoredItem(label: "SBP coded (\(i.systolicBP) mmHg → \(sbp))",  points: Double(sbp), present: true),
                ScoredItem(label: "RR coded (\(i.respiratoryRate) bpm → \(rr))",  points: Double(rr),  present: true)
            ],
            redFlags: flags,
            evidenceNote: "Champion HR et al. J Trauma 1989;29:623–629. Weighted RTS; ISS complement for TRISS survival probability. Coded GCS + SBP + RR."
        )
    }

    // MARK: - KDIGO AKI Staging (Acute Kidney Injury)
    struct KDIGOInput: Equatable {
        var stage: Int = 0           // 0=No AKI; 1=Stage1; 2=Stage2; 3=Stage3
        var creatinineRise: Int = 0  // 0=<1.5×base; 1=1.5–1.9×; 2=2.0–2.9×; 3=≥3× or >354µmol/L
        var urineOutput: Int = 0     // 0=normal; 1=<0.5mL/kg/h ×6h; 2=<0.5mL/kg/h ×12h; 3=<0.3mL/kg/h ×24h or anuria ×12h
        var requiresRRT: Bool = false
    }

    static func kdigo(_ i: KDIGOInput) -> ClinicalScore {
        let stage = i.requiresRRT ? 3 : max(i.creatinineRise, i.urineOutput)
        let (risk, interp): (ScoreRisk, String)
        switch stage {
        case 0: (risk, interp) = (.low,      "No KDIGO AKI criteria met. Monitor renal function in high-risk perioperative patients.")
        case 1: (risk, interp) = (.moderate, "KDIGO AKI Stage 1 — 1.5–1.9× creatinine rise OR UO <0.5 mL/kg/h for ≥6 h. Risk of progression to Stage 2–3 ~30%.")
        case 2: (risk, interp) = (.high,     "KDIGO AKI Stage 2 — 2.0–2.9× creatinine rise OR UO <0.5 mL/kg/h for ≥12 h. CKD risk high; nephrology input recommended.")
        default:(risk, interp) = (.high,     "KDIGO AKI Stage 3 — ≥3× creatinine rise or ≥354 µmol/L, OR UO <0.3 mL/kg/h ×24 h/anuria ×12 h, OR RRT required. Mortality ≥50% in ICU context.")
        }
        let flags: [String] = stage >= 3 ? ["KDIGO Stage 3 / RRT required — urgent nephrology referral; ICU-level monitoring essential"] :
                              stage >= 2 ? ["KDIGO Stage 2 — nephrology input; avoid nephrotoxins; optimise haemodynamics"] : []
        return ClinicalScore(
            systemName: "KDIGO AKI Staging",
            abbreviation: "KDIGO AKI Stage \(stage)",
            score: Double(stage),
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: stage >= 3 ? [
                "Urgent nephrology referral for RRT assessment",
                "Strict fluid balance and daily weights",
                "Avoid all nephrotoxins (NSAIDs, aminoglycosides, contrast)",
                "Review and renally-adjust all drug dosages",
                "Plan for renal recovery — consider renal biopsy if diagnosis unclear"
            ] : stage >= 2 ? [
                "Nephrology review within 24 hours",
                "Optimise cardiac output and renal perfusion pressure",
                "Bladder catheterisation for accurate urine output monitoring",
                "Avoid nephrotoxins; adjust drug doses for eGFR"
            ] : stage == 1 ? [
                "Monitor creatinine and urine output closely (4-hourly)",
                "Identify and treat reversible causes: hypovolaemia, obstruction, nephrotoxins",
                "Optimise fluid status — target euvolaemia"
            ] : [
                "Monitor renal function in high-risk patients (major surgery, sepsis, contrast exposure)",
                "Baseline creatinine documented for perioperative comparison"
            ],
            items: [
                ScoredItem(label: "Creatinine rise (\(["<1.5×", "1.5–1.9×", "2.0–2.9×", "≥3×/354+"][min(i.creatinineRise,3)])", points: Double(i.creatinineRise), present: i.creatinineRise > 0),
                ScoredItem(label: "Urine output criterion (\(["normal", "<0.5 ×6h", "<0.5 ×12h", "<0.3 ×24h"][min(i.urineOutput,3)])", points: Double(i.urineOutput), present: i.urineOutput > 0),
                ScoredItem(label: "Renal replacement therapy required", points: i.requiresRRT ? 3.0 : 0.0, present: i.requiresRRT)
            ],
            redFlags: flags,
            evidenceNote: "KDIGO AKI Work Group. Kidney Int Suppl 2012;2:1–138. Stage based on highest criterion met (creatinine rise or urine output). RRT requirement automatically stage 3."
        )
    }

    // MARK: - Baux Score (Burn Mortality)
    struct BauxInput: Equatable {
        var age: Int = 40               // years
        var tbsa: Int = 20              // % total body surface area burned
        var hasInhalationInjury: Bool = false
    }

    static func baux(_ i: BauxInput) -> ClinicalScore {
        // Baux = age + TBSA; revised Baux adds 17 for inhalation injury
        let rawBaux = i.age + i.tbsa
        let score = Double(i.hasInhalationInjury ? rawBaux + 17 : rawBaux)
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<40:  (risk, interp) = (.low,      "Baux \(Int(score)): Expected mortality <5% in a specialist burns unit.")
        case 40..<80:(risk, interp) = (.moderate, "Baux \(Int(score)): Expected mortality 5–40%. Burns unit admission mandatory.")
        case 80..<120:(risk,interp) = (.high,     "Baux \(Int(score)): Expected mortality 40–80%. ICU-level burns care required.")
        default:     (risk, interp) = (.critical, "Baux \(Int(score)): Expected mortality >80%. Discuss goals of care with family.")
        }
        let flags = score >= 120 ? ["Baux ≥120 — mortality >80%; early goals-of-care discussion"] :
                    score >= 100 ? ["Baux ≥100 — mortality >60%; palliative pathway consideration"] : []
        return ClinicalScore(
            systemName: "Baux Score (Revised)",
            abbreviation: "Baux \(Int(score))",
            score: score,
            maxScore: 200,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 80 ? [
                "Immediate transfer to specialist burns unit / ICU",
                "Early intubation if inhalation injury — don't delay for oedema progression",
                "Formal fluid resuscitation: Parkland formula (4 mL × kg × %TBSA) — first 50% in 8 h",
                "Escharotomy assessment within 2 hours for circumferential full-thickness burns",
                "Burns surgery: early excision and grafting within 48–72 h",
                "Multidisciplinary team: burns surgeon, ICU, nutrition, physiotherapy, psychology"
            ] : score >= 40 ? [
                "Burns unit admission",
                "Fluid resuscitation per Parkland formula",
                "Wound care: silver sulfadiazine / biosynthetic dressing",
                "Early nutritional support — burns have extreme hypermetabolic demand",
                "Analgesia and sedation protocol"
            ] : [
                "Wound assessment and dressing",
                "Tetanus prophylaxis",
                "Analgesia",
                "Outpatient burns review if <15% TBSA, no face/hand/genitalia involvement"
            ],
            items: [
                ScoredItem(label: "Age (\(i.age) years)", points: Double(i.age), present: true),
                ScoredItem(label: "% TBSA burned (\(i.tbsa)%)", points: Double(i.tbsa), present: true),
                ScoredItem(label: "Inhalation injury (+17)", points: 17.0, present: i.hasInhalationInjury)
            ],
            redFlags: flags,
            evidenceNote: "Baux AC. Rev Chir 1961;10:3–10. Revised Baux adds 17 for inhalation injury (Ryan CM et al. J Burn Care Rehabil 1998). Correlates with la Lund–Browder chart TBSA estimate."
        )
    }

    // MARK: - Injury Severity Score (ISS)
    struct ISSInput: Equatable {
        // AIS severity 0–5 for six body regions. 6 = unsurvivable (auto-scores 75).
        var head: Int = 0          // head/neck (including cervical spine)
        var face: Int = 0          // face
        var chest: Int = 0         // chest (including thoracic spine)
        var abdomen: Int = 0       // abdomen/pelvic contents (including lumbar spine)
        var extremity: Int = 0     // extremity/pelvis (including pelvic girdle)
        var external: Int = 0      // external (burns, lacerations, crush)
    }

    static func iss(_ i: ISSInput) -> ClinicalScore {
        let regions = [i.head, i.face, i.chest, i.abdomen, i.extremity, i.external]
        let regionNames = ["Head/Neck", "Face", "Chest", "Abdomen/Pelvis", "Extremity/Pelvis", "External"]
        // If any region AIS=6 → ISS=75 (maximum, non-survivable)
        if regions.contains(6) {
            return ClinicalScore(
                systemName: "Injury Severity Score",
                abbreviation: "ISS 75",
                score: 75,
                maxScore: 75,
                risk: .critical,
                interpretation: "ISS 75 (AIS 6 region): Injury deemed non-survivable. Goals-of-care discussion essential.",
                recommendations: ["Immediate trauma team activation", "Goals-of-care discussion with next of kin", "Palliative care consult"],
                items: zip(regionNames, regions).map { ScoredItem(label: "\($0.0) AIS \($0.1)", points: Double($0.1 * $0.1), present: $0.1 > 0) },
                redFlags: ["AIS 6 — non-survivable injury"],
                evidenceNote: "Baker SP et al. J Trauma 1974;14:187–196."
            )
        }
        // Top 3 AIS squared summed
        let top3 = regions.sorted(by: >).prefix(3)
        let score = Double(top3.reduce(0) { $0 + $1 * $1 })
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<9:   (risk, interp) = (.low,      "ISS \(Int(score)): Minor injury. Standard trauma management.")
        case 9..<16: (risk, interp) = (.moderate, "ISS \(Int(score)): Moderate injury. Trauma team review recommended.")
        case 16..<25:(risk, interp) = (.high,     "ISS \(Int(score)): Severe injury. Trauma centre activation; ICU admission likely.")
        default:     (risk, interp) = (.critical, "ISS \(Int(score)): Critical injury. Mortality risk significant; trauma centre mandatory.")
        }
        let flags = score >= 25 ? ["ISS ≥25 — major trauma; activate major trauma protocol"] : []
        return ClinicalScore(
            systemName: "Injury Severity Score",
            abbreviation: "ISS \(Int(score))",
            score: score,
            maxScore: 75,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 25 ? [
                "Major trauma centre transfer if not already there",
                "Full primary and secondary ATLS survey",
                "CT trauma series (head, C-spine, thorax, abdomen, pelvis)",
                "Massive haemorrhage protocol if haemodynamically unstable",
                "Damage control surgery: haemorrhage control first, definitive repair delayed",
                "Activate trauma team: surgery, orthopaedics, neurosurgery, anaesthesia"
            ] : score >= 16 ? [
                "Trauma team activation",
                "Systematic ATLS primary survey with resuscitation",
                "Targeted imaging per clinical findings",
                "ICU admission planning",
                "Orthopaedic and specialist review as indicated"
            ] : [
                "ATLS primary survey",
                "Appropriate imaging and monitoring",
                "Consider trauma team notification",
                "Discharge with clear head-injury/fracture advice if criteria met"
            ],
            items: zip(regionNames, regions).map { ScoredItem(label: "\($0.0) AIS \($0.1)", points: Double($0.1 * $0.1), present: $0.1 > 0) },
            redFlags: flags,
            evidenceNote: "Baker SP et al. J Trauma 1974;14:187–196. ISS = sum of squares of top 3 AIS body regions. ISS ≥16 = major trauma. AIS 6 auto-scores 75."
        )
    }

}
