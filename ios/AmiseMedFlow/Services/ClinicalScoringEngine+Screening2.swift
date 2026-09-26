// ClinicalScoringEngine+Screening2.swift
// Stone CT features score (local, 0–6; NOT the STONE score), Centor/McIsaac (pharyngitis), IPSS (prostate).
// The STONE score of Moore et al. (BMJ 2014) is ClinicalScoringEngine+DecisionRules2.swift.
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - Stone CT features score (local composite, 0–6)
    // Relabelled 2026-09-26 (ios-outcomes-calculators): this was shown as "STONE Score" and cited
    // Moore et al. 2014, but it scores stone size, UVJ narrowing, obstruction, nausea and haematuria —
    // not the published STONE items (sex, timing, origin, nausea, erythrocytes; 0–13). The formula is
    // unchanged; only its name, range and note. It is not decision-rule evidence (decision-rules.json
    // `stone` maps to stoneUreteric). The type name is kept for the stored form state.
    struct STONEInput: Equatable {
        var sizeMm: Int = 0          // Stone size on CT (mm): 1–5mm=2, 6–10mm=1, >10mm=0
        var toUreters: Int = 0       // Tightness at ureter/UVJ: yes=1, no=0
        var obstruction: Bool = false // Hydronephrosis/ureteric dilation: yes=1
        var nausea: Bool = false      // Nausea/vomiting: yes=1
        var erythrocytes: Bool = false // Haematuria: yes=1
    }
    static func stone(_ i: STONEInput) -> ClinicalScore {
        // Size: >10mm=0, 6–10mm=1, 1–5mm=2, <1mm=0
        let sizeScore: Int
        switch i.sizeMm {
        case 1...5:    sizeScore = 2
        case 6...10:   sizeScore = 1
        default:       sizeScore = 0
        }
        let total = sizeScore + i.toUreters + (i.obstruction ? 1 : 0) +
                    (i.nausea ? 1 : 0) + (i.erythrocytes ? 1 : 0)
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...1:
            interp = "Low probability of ureteric colic"
            risk   = .low
            recs   = ["Consider alternative diagnoses (MSK, GI)",
                      "CT KUB if clinical suspicion persists despite low score",
                      "Urine dipstick and urinalysis; analgesia"]
        case 2...3:
            interp = "Intermediate probability of ureteric colic"
            risk   = .moderate
            recs   = ["CT KUB (unenhanced) recommended to confirm stone and size",
                      "Urinalysis, FBC, U&E, CRP",
                      "Analgesia (NSAIDs first-line unless contraindicated)",
                      "Alpha-blocker (tamsulosin) for distal ureteric stones ≤10 mm",
                      "Urology review if stone ≥6 mm, obstruction, or infection"]
        default:
            interp = "High probability of ureteric colic"
            risk   = .high
            recs   = ["CT KUB urgent to characterise stone; check for infection or solitary kidney",
                      "If infected obstructed system: urgent urology — percutaneous nephrostomy or ureteric stent",
                      "Analgesia: diclofenac 75 mg IM or rectal + IV morphine if required",
                      "U&E, FBC, CRP, urine MC&S",
                      "Admit if: stone ≥10 mm, obstruction, infection, uncontrolled pain, solitary kidney"]
        }
        return ClinicalScore(
            name:          "Stone CT Features Score (not STONE)",
            score:         Double(total),
            maxScore:      6,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Local composite of CT and clinical features, 0–6: stone size on CT (1–5 mm 2, 6–10 mm 1, otherwise 0), narrowing at the ureterovesical junction (+1), obstruction (hydronephrosis or ureteric dilatation, +1), nausea or vomiting (+1), haematuria (+1). Not externally validated and NOT the STONE score of Moore CL et al. (BMJ 2014;348:g2191: sex, timing, origin, nausea, erythrocytes; 0–13), which is the separate 'STONE Score (Ureteric Stone)' calculator. Its bands are local and it is not used as decision-rule evidence."
        )
    }

    // MARK: - Centor / McIsaac Score (Group A Streptococcal Pharyngitis)
    struct CentorInput: Equatable {
        var tonsillarExudate: Bool = false  // Tonsillar swelling or exudate
        var tenderAnteriorCervical: Bool = false // Tender anterior cervical lymphadenopathy
        var feverHistory: Bool = false      // History of fever or temperature > 38°C
        var noCough: Bool = false           // Absence of cough (+1)
        var ageGroup: Int = 1              // 0=<15yr(+1), 1=15–44yr(0), 2=≥45yr(-1)
    }
    static func centor(_ i: CentorInput) -> ClinicalScore {
        var total = (i.tonsillarExudate ? 1 : 0) +
                    (i.tenderAnteriorCervical ? 1 : 0) +
                    (i.feverHistory ? 1 : 0) +
                    (i.noCough ? 1 : 0)
        switch i.ageGroup {
        case 0: total += 1   // <15 yr
        case 2: total -= 1   // ≥45 yr
        default: break
        }
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case ..<1:
            interp = "Score ≤0 — Group A Strep very unlikely (<10%)"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic treatment: analgesia, throat lozenges, adequate hydration",
                      "Advise likely viral aetiology; reassure and safety-net"]
        case 1:
            interp = "Score 1 — GAS probability ~10%"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic management only",
                      "Rapid antigen test (RADT) only if clinical uncertainty persists"]
        case 2:
            interp = "Score 2 — GAS probability ~17%"
            risk   = .low
            recs   = ["Consider RADT before prescribing",
                      "If RADT positive or unavailable and symptoms severe: phenoxymethylpenicillin 500 mg TDS × 10 days",
                      "If RADT negative: no antibiotic"]
        case 3:
            interp = "Score 3 — GAS probability ~35%"
            risk   = .moderate
            recs   = ["RADT recommended; treat if positive",
                      "If RADT unavailable: empirical antibiotic appropriate",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (or amoxicillin 500 mg BD × 10 days)",
                      "If penicillin allergy: clarithromycin 250 mg BD × 5 days"]
        default:
            interp = "Score ≥4 — GAS probability ~50–60%"
            risk   = .high
            recs   = ["Prescribe antibiotic without awaiting RADT",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (first-line per SIGN/NICE)",
                      "Consider throat swab for culture in immunocompromised patients",
                      "If no improvement in 48–72 h: review and culture",
                      "Admit if peritonsillar abscess (quinsy) suspected: trismus, unilateral uvular deviation"]
        }
        return ClinicalScore(
            name:          "Centor / McIsaac",
            score:         Double(total),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Centor RM et al. Med Decis Making 1981;1:239–246; McIsaac WJ et al. CMAJ 1998;158:75–83. Modified Centor: 4 clinical criteria + age adjustment (−1 if ≥45; +1 if <15). Score ≥4 = 50–60% GAS probability. NICE NG84 and SIGN 160 recommend against routine antibiotic prescribing for scores ≤1 and RADT-guided therapy for scores 2–3."
        )
    }

    // MARK: - IPSS (International Prostate Symptom Score)
    struct IPSSInput: Equatable {
        // 7 items 0–5 each + QoL 0–6
        var incompleteEmptying: Int = 0  // Q1
        var frequency: Int = 0          // Q2
        var intermittency: Int = 0      // Q3
        var urgency: Int = 0            // Q4
        var weakStream: Int = 0         // Q5
        var straining: Int = 0          // Q6
        var nocturia: Int = 0           // Q7 (0–5)
        var qualityOfLife: Int = 0      // QoL 0=delighted, 6=terrible
    }
    static func ipss(_ i: IPSSInput) -> ClinicalScore {
        let symptomTotal = i.incompleteEmptying + i.frequency + i.intermittency + i.urgency +
                           i.weakStream + i.straining + i.nocturia
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch symptomTotal {
        case 0...7:
            interp = "Mild LUTS (Score 0–7)"
            risk   = .low
            recs   = ["Watchful waiting appropriate if QoL acceptable",
                      "Lifestyle advice: fluid management, reduce caffeine/alcohol, bladder training",
                      "Annual review with IPSS reassessment",
                      "PSA and DRE if not done within 12 months"]
        case 8...19:
            interp = "Moderate LUTS (Score 8–19)"
            risk   = .moderate
            recs   = ["Medical treatment indicated if QoL affected (QoL ≥3)",
                      "Alpha-blocker (tamsulosin 400 mcg daily) — first-line for voiding symptoms",
                      "5-alpha-reductase inhibitor (finasteride) if prostate >30 mL on USS",
                      "Combination therapy for large prostate with bothersome LUTS",
                      "Uroflowmetry and post-void residual assessment",
                      "Urology referral if trial of treatment ineffective at 3 months"]
        default:
            interp = "Severe LUTS (Score 20–35)"
            risk   = .high
            recs   = ["Urology referral for surgical evaluation",
                      "Consider TURP, HoLEP, or minimally invasive therapy",
                      "Rule out acute/chronic retention: US bladder for post-void residual",
                      "Urgent catheterisation if retention present",
                      "PSA + DRE mandatory; MRI prostate if PSA elevated",
                      "Assess for neurological cause if obstructive symptoms disproportionate"]
        }
        let qolLabel = ["Delighted","Pleased","Mostly satisfied","Mixed","Mostly dissatisfied","Unhappy","Terrible"][min(i.qualityOfLife, 6)]
        var finalRecs = recs
        if i.qualityOfLife >= 4 {
            finalRecs.insert("QoL '\(qolLabel)' (≥4) — symptoms significantly impacting life; escalate treatment", at: 0)
        }
        return ClinicalScore(
            name:          "IPSS",
            score:         Double(symptomTotal),
            maxScore:      35,
            risk:          risk,
            interpretation: "\(interp) | QoL: \(i.qualityOfLife)/6 (\(qolLabel))",
            recommendations: finalRecs,
            evidenceNote:  "Barry MJ et al. J Urol 1992;148:1549–1557. 7 symptom questions + 1 QoL question; each 0–5 = total 0–35. AUA/EAU endorsed. Mild 0–7, Moderate 8–19, Severe 20–35. QoL 0=Delighted, 6=Terrible; QoL ≥4 warrants treatment escalation regardless of symptom score."
        )
    }

}
