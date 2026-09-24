// ClinicalScoringEngine+CriticalCare.swift
// Sepsis / ICU / Early Warning scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: SIRS Criteria (Sepsis)

    static func sirs(_ i: SIRSInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Temp >38°C or <36°C", points: 1, present: i.tempAbove38OrBelow36),
            .init(label: "Heart rate >90 bpm", points: 1, present: i.heartRateOver90),
            .init(label: "RR >20/min or PaCO₂ <32 mmHg", points: 1, present: i.rrOver20OrPaCO2Below32),
            .init(label: "WBC >12,000, <4,000 or >10% bands", points: 1, present: i.wbcOver12kOrBelow4kOr10PctBands),
        ]
        let score = Double(items.filter(\.present).count)
        let hasSepsis = score >= 2 && i.suspectedInfection

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasSepsis && i.positiveBloodCulture {
            risk = .critical
            interpretation = "SIRS \(Int(score))/4 — Sepsis with confirmed bacteraemia"
            redFlags = ["Confirmed bacteraemia — target 1-hour bundle completion",
                        "Reassess for septic shock (SBP <90 or MAP <65 mmHg)"]
            recs = ["IV antibiotics within 1 h (blood cultures FIRST)",
                    "IV fluid bolus 30 mL/kg crystalloid over 3 h if MAP <65 or lactate ≥4",
                    "Vasopressors (noradrenaline) if MAP <65 despite fluids",
                    "ICU referral", "Source identification and control",
                    "Repeat lactate if initial ≥2 mmol/L"]
        } else if hasSepsis {
            risk = .high
            interpretation = "SIRS \(Int(score))/4 + suspected infection = Sepsis"
            redFlags = ["Sepsis — time-critical. Start 1-hour bundle"]
            recs = ["Blood cultures × 2 (peripheral + any indwelling line) before antibiotics",
                    "IV antibiotics within 1 h of recognition (co-amoxiclav + gentamicin or tazocin)",
                    "IV crystalloid 30 mL/kg if lactate ≥4 or haemodynamically unstable",
                    "Serum lactate, FBC, U&E, LFT, coagulation, blood gas",
                    "HDU / ITU referral if organ dysfunction (creatinine ↑, bilirubin ↑, platelets ↓)"]
        } else if score >= 2 {
            risk = .moderate
            interpretation = "SIRS \(Int(score))/4 — Systemic inflammatory response (infection not yet confirmed)"
            recs = ["Assess for source of infection (urine, chest, abdomen, wound)",
                    "Blood cultures before empirical antibiotics if infection suspected",
                    "Monitor closely — reassess within 1–2 h"]
        } else {
            risk = .low
            interpretation = "SIRS \(Int(score))/4 — SIRS criteria not met"
            recs = ["Continue monitoring", "Reassess clinically"]
        }

        return ClinicalScore(
            systemName: "SIRS Criteria",
            abbreviation: "SIRS",
            score: score, maxScore: 4,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Bone 1992. ≥2 SIRS criteria + infection = Sepsis. Now supplemented by Sepsis-3 qSOFA."
        )
    }

    // MARK: qSOFA (Sepsis quick screen)

    static func qsofa(_ i: QSOFAInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Altered mentation (GCS <15)", points: 1, present: i.alteredMentation),
            .init(label: "Respiratory rate ≥22/min", points: 1, present: i.rrOver22),
            .init(label: "SBP ≤100 mmHg", points: 1, present: i.sbpUnder100),
        ]
        let score = Double(items.filter(\.present).count)
        let highRisk = score >= 2 && i.suspectedInfection

        var redFlags: [String] = []
        if highRisk { redFlags = ["qSOFA ≥2 + infection — high risk of organ dysfunction (Sepsis-3)"] }

        return ClinicalScore(
            systemName: "qSOFA Score",
            abbreviation: "qSOFA",
            score: score, maxScore: 3,
            risk: (score == 3 && i.suspectedInfection) ? .critical : (highRisk ? .high : (score == 1 ? .moderate : .low)),
            interpretation: score >= 2
                ? "qSOFA \(Int(score))/3 — HIGH risk of organ dysfunction if infection present"
                : "qSOFA \(Int(score))/3 — Lower risk, but reassess if clinical status changes",
            recommendations: score >= 2
                ? ["Urgent clinical review", "Blood cultures + IV antibiotics within 1 h",
                   "Serum lactate, FBC, CRP, U&E", "ICU / HDU referral",
                   "1-hour sepsis bundle: cultures → antibiotics → fluids → lactate"]
                : ["Monitor closely", "Reassess in 1–2 h if clinical concern remains"],
            items: items,
            redFlags: redFlags,
            evidenceNote: "Singer 2016 (Sepsis-3). ≥2 qSOFA points with infection = probable sepsis."
        )
    }

    // MARK: MEWS (Modified Early Warning Score)

    static func mews(_ i: MEWSInput) -> ClinicalScore {
        var rrPoints = 0
        switch i.respiratoryRate {
        case ..<9:   rrPoints = 2
        case 9...14: rrPoints = 0
        case 15...20: rrPoints = 1
        case 21...29: rrPoints = 2
        default:     rrPoints = 3
        }
        var spo2Points = 0
        switch i.oxygenSaturation {
        case ..<85:  spo2Points = 3
        case 85...89: spo2Points = 2
        case 90...93: spo2Points = 1
        default:     spo2Points = 0
        }
        var hrPoints = 0
        switch i.heartRate {
        case ..<40:  hrPoints = 2
        case 40...50: hrPoints = 1
        case 51...100: hrPoints = 0
        case 101...110: hrPoints = 1
        case 111...130: hrPoints = 2
        default:     hrPoints = 3
        }
        var sbpPoints = 0
        switch i.systolicBP {
        case ..<70:  sbpPoints = 3
        case 70...80: sbpPoints = 2
        case 81...100: sbpPoints = 1
        case 101...199: sbpPoints = 0
        default:     sbpPoints = 2
        }
        var tempPoints = 0
        switch i.temperature {
        case ..<35.0:  tempPoints = 2
        case 35.0..<36.0: tempPoints = 1
        case 36.0..<38.0: tempPoints = 0
        case 38.0..<38.5: tempPoints = 1
        default:       tempPoints = 2
        }
        let avpuPoints = i.consciousnessAVPU.rawValue
        let urinePoints = i.urineOutput.rawValue
        let total = Double(rrPoints + spo2Points + hrPoints + sbpPoints + tempPoints + avpuPoints + urinePoints)

        let (risk, interp, recs) = mewsRisk(total)
        let items: [ScoredItem] = [
            .init(label: "Respiratory rate", points: Double(rrPoints), present: rrPoints > 0),
            .init(label: "SpO₂", points: Double(spo2Points), present: spo2Points > 0),
            .init(label: "Heart rate", points: Double(hrPoints), present: hrPoints > 0),
            .init(label: "Systolic BP", points: Double(sbpPoints), present: sbpPoints > 0),
            .init(label: "Temperature", points: Double(tempPoints), present: tempPoints > 0),
            .init(label: "AVPU consciousness", points: Double(avpuPoints), present: avpuPoints > 0),
            .init(label: "Urine output", points: Double(urinePoints), present: urinePoints > 0),
        ]
        let redFlags = total >= 5 ? ["MEWS ≥5: immediate senior review and consider ICU referral"] : []
        return ClinicalScore(
            systemName: "Modified Early Warning Score",
            abbreviation: "MEWS \(Int(total))",
            score: total, maxScore: 14,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Subbe 2001. MEWS ≥5 associated with significantly increased risk of ICU admission and death."
        )
    }

    private static func mewsRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...1: return (.low, "MEWS \(Int(s))/14 — Stable: routine monitoring", ["Routine obs 4–6 hourly"])
        case 2...3: return (.moderate, "MEWS \(Int(s))/14 — Increased risk: enhanced monitoring", ["Increase obs to 1–2 hourly", "Inform nurse in charge", "Review hydration and medications"])
        case 4...5: return (.high, "MEWS \(Int(s))/14 — Urgent: senior review needed", ["Immediate nursing review", "Contact junior doctor", "Consider bloods + ABG", "Increase obs to hourly"])
        default:    return (.critical, "MEWS \(Int(s))/14 — Critical: immediate intervention required", ["Immediate senior/ICU review", "Activate rapid response/MET", "IV access, bloods, ABG now", "Consider resuscitation protocol"])
        }
    }

    // MARK: NEWS2 (National Early Warning Score 2, RCP 2017)
    // Points and bands come from NEWS2Chart, shared with VitalsEntry, so the Scores screen and
    // the ward/patient views always agree on both the number and the risk band.

    static func news2(_ i: NEWS2Input) -> ClinicalScore {
        let r = NEWS2Chart.evaluate(respiratoryRate: i.respiratoryRate,
                                    spo2: i.spo2,
                                    onOxygen: i.onSupplementalO2,
                                    useSpO2Scale2: i.useSpO2Scale2,
                                    systolicBP: i.systolicBP,
                                    heartRate: i.heartRate,
                                    temperatureCelsius: i.temperatureCelsius,
                                    avpu: i.avpu)
        let total = Double(r.total)

        let (interp, recs) = news2Interpretation(r)
        let items: [ScoredItem] = [
            .init(label: "Respiratory rate", points: Double(r.respirationPoints), present: r.respirationPoints > 0),
            .init(label: "SpO₂ (\(i.useSpO2Scale2 ? "Scale 2 — hypercapnic RF" : "Scale 1"))",
                  points: Double(r.spo2Points), present: r.spo2Points > 0),
            .init(label: "Supplemental O₂", points: Double(r.oxygenPoints), present: r.oxygenPoints > 0),
            .init(label: "Systolic BP", points: Double(r.systolicBPPoints), present: r.systolicBPPoints > 0),
            .init(label: "Heart rate", points: Double(r.heartRatePoints), present: r.heartRatePoints > 0),
            .init(label: "Temperature", points: Double(r.temperaturePoints), present: r.temperaturePoints > 0),
            .init(label: "AVPU consciousness", points: Double(r.consciousnessPoints), present: r.consciousnessPoints > 0),
        ]
        var redFlags: [String] = []
        if r.total >= 7 { redFlags.append("NEWS2 ≥7: emergency response — continuous monitoring, immediate senior review") }
        if r.hasSingleParameterScore3 {
            redFlags.append("Single parameter score 3: urgent ward-based response — inform the medical team")
        }
        return ClinicalScore(
            systemName: "National Early Warning Score 2",
            abbreviation: "NEWS2 \(r.total)",
            score: total, maxScore: 20,
            risk: r.band.scoreRisk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Royal College of Physicians 2017 (NEWS2). 0–4 low; a 3 in any single parameter "
                + "low-medium (urgent ward-based response); 5–6 medium (urgent response); ≥7 high "
                + "(emergency response). SpO₂ Scale 2 only for confirmed hypercapnic respiratory failure."
        )
    }

    /// RCP NEWS2 clinical response per band (NEWS2 report 2017, chart 4).
    private static func news2Interpretation(_ r: NEWS2Result) -> (String, [String]) {
        let s = r.total
        switch r.band {
        case .low where s == 0:
            return ("NEWS2 0/20 — Low: routine monitoring",
                    ["Minimum 12-hourly observations"])
        case .low:
            return ("NEWS2 \(s)/20 — Low: ward-based response",
                    ["Minimum 4–6-hourly observations",
                     "Registered nurse to assess and decide whether to increase monitoring or escalate"])
        case .lowMedium:
            return ("NEWS2 \(s)/20 — Low-medium (single parameter scoring 3): URGENT ward-based response",
                    ["Minimum 1-hourly observations",
                     "Registered nurse to inform the medical team caring for the patient",
                     "Urgent review by a clinician to decide whether escalation of care is needed"])
        case .medium:
            return ("NEWS2 \(s)/20 — Medium: URGENT response threshold",
                    ["Minimum 1-hourly observations",
                     "Registered nurse to inform the medical team immediately",
                     "Urgent assessment by a clinician competent in the care of acutely ill patients",
                     "Care in an environment with monitoring facilities",
                     "Consider ABG, bloods, ECG"])
        case .high:
            return ("NEWS2 \(s)/20 — High: EMERGENCY response",
                    ["Continuous monitoring of vital signs",
                     "Registered nurse to inform the medical team immediately — at least registrar level",
                     "Emergency assessment by a team with critical-care competencies",
                     "Consider HDU/ICU transfer",
                     "IV access, bloods, ABG, ECG now"])
        }
    }

    // MARK: GCS (Glasgow Coma Scale)

    static func gcs(_ i: GCSInput) -> ClinicalScore {
        let total = Double(i.eyeOpening.rawValue + i.verbalResponse.rawValue + i.motorResponse.rawValue)
        let eyeLabel: String
        switch i.eyeOpening {
        case .spontaneous: eyeLabel = "Spontaneous (4)"
        case .toVoice:     eyeLabel = "To voice (3)"
        case .toPain:      eyeLabel = "To pain (2)"
        case .none:        eyeLabel = "None (1)"
        }
        let verbalLabel: String
        switch i.verbalResponse {
        case .oriented:            verbalLabel = "Oriented (5)"
        case .confused:            verbalLabel = "Confused (4)"
        case .inappropriateWords:  verbalLabel = "Inappropriate words (3)"
        case .sounds:              verbalLabel = "Incomprehensible sounds (2)"
        case .none:                verbalLabel = "None (1)"
        }
        let motorLabel: String
        switch i.motorResponse {
        case .obeys:          motorLabel = "Obeys commands (6)"
        case .localises:      motorLabel = "Localises pain (5)"
        case .withdraws:      motorLabel = "Withdraws (4)"
        case .abnormalFlexion: motorLabel = "Abnormal flexion (3)"
        case .extension_:     motorLabel = "Extension (2)"
        case .none:           motorLabel = "None (1)"
        }
        let items: [ScoredItem] = [
            .init(label: "Eye opening — \(eyeLabel)", points: Double(i.eyeOpening.rawValue), present: i.eyeOpening != .spontaneous),
            .init(label: "Verbal — \(verbalLabel)", points: Double(i.verbalResponse.rawValue), present: i.verbalResponse != .oriented),
            .init(label: "Motor — \(motorLabel)", points: Double(i.motorResponse.rawValue), present: i.motorResponse != .obeys),
        ]
        let (risk, interp, recs) = gcsRisk(total)
        let redFlags: [String] = total <= 8 ? ["GCS ≤8: protect airway — intubation threshold reached"] : []
        return ClinicalScore(
            systemName: "Glasgow Coma Scale",
            abbreviation: "GCS \(Int(total))/15",
            score: total, maxScore: 15,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Teasdale & Jennett 1974. Revised 2014. GCS ≤8: airway at risk. Normal = 15."
        )
    }

    private static func gcsRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 14...15: return (.low, "GCS \(Int(s))/15 — Normal or minimal impairment", ["Document baseline", "Monitor for deterioration"])
        case 9...13:  return (.moderate, "GCS \(Int(s))/15 — Moderate impairment", ["Senior review", "CT head if trauma or focal deficit", "Monitored environment", "Neurological obs every 30 min"])
        case 3...8:   return (.critical, "GCS \(Int(s))/15 — Severe impairment: airway at risk", ["Immediate senior/anaesthetic review", "RSI intubation if GCS ≤8 or falling", "CT head urgently", "ICU referral", "Neurosurgical review if trauma"])
        default:      return (.critical, "GCS \(Int(s))/15 — Severe impairment", ["Immediate resuscitation"])
        }
    }

}
