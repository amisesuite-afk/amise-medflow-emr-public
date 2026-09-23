// ClinicalScoringEngine+CriticalCare2.swift
// Mannheim Peritonitis Index, NUTRIC Score, SAPS II
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - Mannheim Peritonitis Index (MPI)

    static func mpi(_ i: MPIInput) -> ClinicalScore {
        var score = 0
        func add(_ pts: Int, _ cond: Bool) { if cond { score += pts } }
        add(5, i.ageOver50)
        add(5, i.femaleSex)
        add(7, i.organFailure)
        add(4, i.malignancy)
        add(4, i.durationOver24h)
        add(4, i.nonColonicOrigin)
        add(6, i.generalizedPeritonitis)
        score += i.exudate

        let exLabel: String = switch i.exudate {
        case 6:  "Cloudy / purulent exudate"
        case 12: "Faecal / faeculent exudate"
        default: "Clear / serous exudate"
        }
        let items: [ScoredItem] = [
            ScoredItem(label: "Age >50 years",                              points: 5,  present: i.ageOver50),
            ScoredItem(label: "Female sex",                                 points: 5,  present: i.femaleSex),
            ScoredItem(label: "Organ failure (BP <80 / Cr >177 / resp)",    points: 7,  present: i.organFailure),
            ScoredItem(label: "Malignancy",                                 points: 4,  present: i.malignancy),
            ScoredItem(label: "Duration of peritonitis >24 h pre-op",       points: 4,  present: i.durationOver24h),
            ScoredItem(label: "Non-colonic origin (gastric/duodenal/SB)",   points: 4,  present: i.nonColonicOrigin),
            ScoredItem(label: "Diffuse generalised peritonitis",            points: 6,  present: i.generalizedPeritonitis),
            ScoredItem(label: exLabel,                                      points: Double(i.exudate), present: i.exudate > 0),
        ]
        let (risk, interpretation, recs, redFlags) = mpiRisk(score)
        return ClinicalScore(
            systemName: "Mannheim Peritonitis Index",
            abbreviation: "MPI \(score)",
            score: Double(score), maxScore: 47,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Wacha H & Linder MM, Theor Surg 1983. Score <21 = low risk (<9% mortality); 21–29 = intermediate (~29%); ≥30 = high (>60%). Validated across general surgical populations. Guides laparotomy strategy, ICU admission, and goals-of-care discussions."
        )
    }

    private static func mpiRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case ..<21:
            return (.low,
                    "MPI \(s) — low-risk peritonitis (predicted mortality <9%)",
                    ["Standard perioperative care",
                     "Source-control surgery — primary repair / anastomosis appropriate",
                     "Document score for surgical audit"],
                    [])
        case 21..<30:
            return (.moderate,
                    "MPI \(s) — intermediate peritonitis risk (predicted mortality ~29%)",
                    ["Optimise resuscitation before theatre",
                     "ICU or high-dependency admission post-operatively",
                     "Consider damage-control strategy if haemodynamically unstable",
                     "Planned relook at 48 h if contamination was extensive"],
                    ["MPI 21–29: significant predicted mortality — HDU/ICU review required"])
        default:  // ≥30
            return (.critical,
                    "MPI \(s) — high-risk peritonitis (predicted mortality >60%)",
                    ["Aggressive resuscitation — septic shock protocol",
                     "Damage-control laparotomy; defer definitive reconstruction",
                     "Planned open-abdomen / relook strategy",
                     "Mandatory ICU admission",
                     "Early goals-of-care discussion with patient and family"],
                    ["MPI ≥30: predicted mortality >60% — urgent multi-disciplinary decision required"])
        }
    }

    // MARK: - NUTRIC Score (Nutritional Risk in Critically Ill)
    struct NUTRICInput: Equatable {
        var age: Int = 50              // years
        var apacheII: Int = 10         // APACHE II score at ICU admission
        var sofa: Int = 4              // SOFA score at ICU admission
        var comorbidities: Int = 0     // number of comorbidities (0, 1, ≥2)
        var daysHospitalToICU: Int = 0 // days from hospital admission to ICU (0=same day; 1=1 day; 2=≥2 days)
        // IL-6 excluded (high-NUTRIC version not widely used)
    }

    static func nutric(_ i: NUTRICInput) -> ClinicalScore {
        var pts = 0
        // Age
        switch i.age {
        case ..<50: pts += 0
        case 50..<75: pts += 1
        case 75...: pts += 2
        default: break
        }
        // APACHE II
        switch i.apacheII {
        case ..<15: pts += 0
        case 15..<20: pts += 1
        case 20..<28: pts += 2
        case 28...: pts += 3
        default: break
        }
        // SOFA
        switch i.sofa {
        case ..<6: pts += 0
        case 6..<10: pts += 1
        case 10...: pts += 2
        default: break
        }
        // Comorbidities
        pts += min(2, i.comorbidities)
        // Days hospital → ICU
        switch i.daysHospitalToICU {
        case 0: pts += 0
        case 1: pts += 1
        case 2...: pts += 2
        default: break
        }
        let score = Double(pts)
        let (risk, interp): (ScoreRisk, String)
        switch score {
        case ..<5:  (risk, interp) = (.low,      "NUTRIC \(pts): Low nutritional risk. Standard nutritional targets. Monitor for change.")
        case 5..<6: (risk, interp) = (.moderate, "NUTRIC \(pts): Moderate nutritional risk. Consider enhanced protein delivery and close dietitian review.")
        default:    (risk, interp) = (.high,     "NUTRIC \(pts): High nutritional risk (≥6). Aggressive nutritional support associated with improved outcomes. Dietitian-led plan essential.")
        }
        let flags = score >= 6 ? ["NUTRIC ≥6 — high risk; early dietitian involvement and enhanced protein targets (1.5–2 g/kg/day) recommended"] : []
        return ClinicalScore(
            systemName: "NUTRIC Score",
            abbreviation: "NUTRIC \(pts)",
            score: score,
            maxScore: 9,
            risk: risk,
            interpretation: interp,
            recommendations: score >= 6 ? [
                "Dietitian review within 24 hours of ICU admission",
                "High-protein target: 1.5–2.0 g/kg/day actual body weight",
                "Early enteral nutrition within 24–48 h if haemodynamically stable",
                "Monitor tolerance: gastric residual volumes, abdominal distension",
                "Consider supplemental parenteral nutrition if enteral target not met by day 3–7",
                "Daily reassessment of nutritional adequacy"
            ] : [
                "Standard protein target: 1.2–1.5 g/kg/day",
                "Enteral nutrition preferred route; start within 24–48 h",
                "Monitor nutritional adequacy daily",
                "Reassess NUTRIC if clinical status changes"
            ],
            items: [
                ScoredItem(label: "Age \(i.age) yrs", points: i.age >= 75 ? 2.0 : i.age >= 50 ? 1.0 : 0.0, present: i.age >= 50),
                ScoredItem(label: "APACHE II \(i.apacheII)", points: i.apacheII >= 28 ? 3.0 : i.apacheII >= 20 ? 2.0 : i.apacheII >= 15 ? 1.0 : 0.0, present: i.apacheII >= 15),
                ScoredItem(label: "SOFA \(i.sofa)", points: i.sofa >= 10 ? 2.0 : i.sofa >= 6 ? 1.0 : 0.0, present: i.sofa >= 6),
                ScoredItem(label: "Comorbidities (\(i.comorbidities))", points: Double(min(2, i.comorbidities)), present: i.comorbidities > 0),
                ScoredItem(label: "Days hospital→ICU (\(i.daysHospitalToICU))", points: min(2, Double(i.daysHospitalToICU)), present: i.daysHospitalToICU > 0)
            ],
            redFlags: flags,
            evidenceNote: "Heyland DK et al. JPEN 2011;35:596–605. NUTRIC ≥6 (without IL-6) predicts benefit from high-protein enteral nutrition. Validated in mechanically ventilated ICU patients."
        )
    }

    // MARK: - SAPS II (Simplified Acute Physiology Score II)
    struct SAPSIIInput: Equatable {
        // Age
        var ageYears: Int = 0
        // Vitals (worst in first 24 h ICU)
        var heartRateMax: Int = 0       // bpm
        var sbpMin: Int = 0             // systolic, mmHg
        var tempMax: Double = 37.0      // °C
        // Oxygenation
        var pao2FiO2: Int = 0           // mmHg (for non-ventilated use actual PaO₂; 0=on ventilator)
        var onVentilator: Bool = false
        // Labs
        var urineOutputML: Int = 0      // mL/24 h
        var bunMmolL: Double = 0        // mmol/L (× 2.8 to get mg/dL)
        var wbc: Double = 0             // × 10⁹/L
        var sodiumMmolL: Int = 0        // mmol/L
        var potassiumMmolL: Double = 0  // mmol/L
        var bicarbonateMmolL: Int = 0   // mmol/L
        var bilirubinUmolL: Double = 0  // μmol/L
        // Neuro (GCS)
        var gcsScore: Int = 15
        // Admission type
        var scheduledSurgical: Bool = false
        var unscheduledSurgical: Bool = false
        // Chronic disease
        var metastaticCancer: Bool = false
        var haematologicalMalignancy: Bool = false
        var aids: Bool = false
    }
    static func sapsII(_ i: SAPSIIInput) -> ClinicalScore {
        var points = 0
        // Age
        switch i.ageYears {
        case ..<40:  points += 0
        case 40...59: points += 7
        case 60...69: points += 12
        case 70...74: points += 15
        case 75...79: points += 16
        default:     points += 18
        }
        // Heart rate
        switch i.heartRateMax {
        case ..<40:         points += 11
        case 40...69:       points += 2
        case 70...119:      points += 0
        case 120...159:     points += 4
        default:            points += 7
        }
        // Systolic BP (use minimum)
        switch i.sbpMin {
        case ..<70:         points += 13
        case 70...99:       points += 5
        case 100...199:     points += 0
        default:            points += 2
        }
        // Temperature (use maximum)
        if i.tempMax >= 39.0 { points += 3 }
        // PaO₂/FiO₂ (only if ventilated)
        if i.onVentilator {
            switch i.pao2FiO2 {
            case ..<100:   points += 11
            case 100...199: points += 9
            default:       points += 6
            }
        }
        // Urine output
        switch i.urineOutputML {
        case ..<500:        points += 11
        case 500...999:     points += 4
        default:            points += 0
        }
        // BUN (mg/dL equivalent: mmol/L × 2.8)
        let bunMgDL = i.bunMmolL * 2.8
        switch bunMgDL {
        case ..<28:         points += 0
        case 28...83:       points += 6
        default:            points += 10
        }
        // WBC
        switch i.wbc {
        case ..<1.0:        points += 12
        case 1.0...19.9:    points += 0
        default:            points += 3
        }
        // Sodium
        switch i.sodiumMmolL {
        case ..<125:        points += 5
        case 125...144:     points += 0
        default:            points += 1
        }
        // Potassium
        if i.potassiumMmolL < 3.0 || i.potassiumMmolL >= 5.0 { points += 3 }
        // Bicarbonate
        switch i.bicarbonateMmolL {
        case ..<15:         points += 6
        case 15...19:       points += 3
        default:            points += 0
        }
        // Bilirubin (μmol/L; 68.4 = 4 mg/dL, 102.6 = 6 mg/dL)
        switch i.bilirubinUmolL {
        case ..<68.4:       points += 0
        case 68.4...102.5:  points += 4
        default:            points += 9
        }
        // GCS
        switch i.gcsScore {
        case ..<6:          points += 26
        case 6...8:         points += 13
        case 9...10:        points += 7
        case 11...13:       points += 5
        default:            points += 0
        }
        // Admission type
        if i.scheduledSurgical        { points += 0 }
        else if i.unscheduledSurgical { points += 8 }
        else                          { points += 6 } // medical
        // Chronic disease
        if i.metastaticCancer              { points += 9 }
        if i.haematologicalMalignancy      { points += 10 }
        if i.aids                          { points += 17 }
        // Probability of hospital mortality: ln(p/1-p) = −7.7631 + 0.0737×SAPS + 0.9971×ln(SAPS+1)
        let s = Double(points)
        let logit = -7.7631 + 0.0737 * s + 0.9971 * log(s + 1)
        let mortalityPct = (exp(logit) / (1 + exp(logit)) * 100).rounded()
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch points {
        case 0...29:
            interp = "Low severity (predicted mortality ~10%)"
            risk   = .low
            recs   = ["Standard ICU monitoring protocol",
                      "Early mobilisation and rehabilitation planning",
                      "Daily goal-directed fluid strategy"]
        case 30...59:
            interp = "Moderate severity (predicted mortality ~30%)"
            risk   = .moderate
            recs   = ["Intensify monitoring: hourly vitals, 6-hourly labs",
                      "Senior ICU review twice daily",
                      "Consider early subspecialty involvement (renal, respiratory)",
                      "ICU duration expected 5–10 days — communicate to family"]
        case 60...89:
            interp = "High severity (predicted mortality ~60%)"
            risk   = .high
            recs   = ["Consultant-led daily ICU round mandatory",
                      "Goals-of-care discussion with patient and family",
                      "Optimise organ support: vasopressors, renal replacement as indicated",
                      "Avoid further major surgery unless life-saving"]
        default:
            interp = "Very high severity (predicted mortality >80%)"
            risk   = .high
            recs   = ["Urgent goals-of-care and ceiling-of-treatment discussion",
                      "Palliative/comfort-measures pathway should be formally considered",
                      "Any invasive interventions require consultant and family agreement",
                      "Document DNACPR decision if appropriate after discussion"]
        }
        return ClinicalScore(
            name:          "SAPS II",
            score:         Double(points),
            maxScore:      163,
            risk:          risk,
            interpretation: "\(interp)\nEstimated hospital mortality: \(Int(mortalityPct))%",
            recommendations: recs,
            evidenceNote:  "Le Gall JR et al. JAMA 1993;270:2957–2963. Simplified Acute Physiology Score II; 17 variables scored from worst values in first 24 h of ICU admission. Calibrated for hospital mortality prediction across mixed ICU populations. SAPS II ≥40 correlates with >30% hospital mortality."
        )
    }

}
