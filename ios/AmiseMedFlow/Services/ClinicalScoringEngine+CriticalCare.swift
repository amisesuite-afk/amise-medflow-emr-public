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

    static func news2(_ i: NEWS2Input) -> ClinicalScore {
        // Respiratory rate
        let rrPoints: Int
        switch i.respiratoryRate {
        case ..<9:    rrPoints = 3
        case 9...11:  rrPoints = 1
        case 12...20: rrPoints = 0
        case 21...24: rrPoints = 2
        default:      rrPoints = 3
        }

        // SpO2 scoring — Scale 2 when on supplemental O2, Scale 1 otherwise
        let spo2Points: Int
        if i.onSupplementalO2 {
            // Scale 2
            switch i.spo2 {
            case ..<88:   spo2Points = 3
            case 88...92: spo2Points = 0
            case 93...94: spo2Points = 1
            case 95...96: spo2Points = 2
            default:      spo2Points = 3
            }
        } else {
            // Scale 1
            switch i.spo2 {
            case ..<92:   spo2Points = 3
            case 92...93: spo2Points = 2
            case 94...95: spo2Points = 1
            default:      spo2Points = 0
            }
        }

        let o2Points = i.onSupplementalO2 ? 2 : 0

        let sbpPoints: Int
        switch i.systolicBP {
        case ..<91:     sbpPoints = 3
        case 91...100:  sbpPoints = 2
        case 101...110: sbpPoints = 1
        case 111...219: sbpPoints = 0
        default:        sbpPoints = 3
        }

        let hrPoints: Int
        switch i.heartRate {
        case ..<41:     hrPoints = 3
        case 41...50:   hrPoints = 1
        case 51...90:   hrPoints = 0
        case 91...110:  hrPoints = 1
        case 111...130: hrPoints = 2
        default:        hrPoints = 3
        }

        let tempPoints: Int
        switch i.temperatureCelsius {
        case ..<35.1:  tempPoints = 3
        case 35.1..<36.1: tempPoints = 1
        case 36.1..<38.1: tempPoints = 0
        case 38.1..<39.1: tempPoints = 1
        default:       tempPoints = 2
        }

        let avpuPoints = i.avpu.news2Points
        let hasRedFlag = rrPoints >= 3 || spo2Points >= 3 || sbpPoints >= 3 || hrPoints >= 3 || tempPoints >= 3 || avpuPoints >= 3

        let total = Double(rrPoints + spo2Points + o2Points + sbpPoints + hrPoints + tempPoints + avpuPoints)

        let (risk, interp, recs) = news2Risk(total, hasRedFlag: hasRedFlag)
        let items: [ScoredItem] = [
            .init(label: "Respiratory rate", points: Double(rrPoints), present: rrPoints > 0),
            .init(label: "SpO₂ (\(i.onSupplementalO2 ? "Scale 2" : "Scale 1"))", points: Double(spo2Points), present: spo2Points > 0),
            .init(label: "Supplemental O₂", points: Double(o2Points), present: o2Points > 0),
            .init(label: "Systolic BP", points: Double(sbpPoints), present: sbpPoints > 0),
            .init(label: "Heart rate", points: Double(hrPoints), present: hrPoints > 0),
            .init(label: "Temperature", points: Double(tempPoints), present: tempPoints > 0),
            .init(label: "AVPU consciousness", points: Double(avpuPoints), present: avpuPoints > 0),
        ]
        var redFlags: [String] = []
        if total >= 7 { redFlags.append("NEWS2 ≥7: continuous monitoring, immediate senior review") }
        if hasRedFlag { redFlags.append("Single parameter score 3: escalate per local protocol") }
        return ClinicalScore(
            systemName: "National Early Warning Score 2",
            abbreviation: "NEWS2 \(Int(total))",
            score: total, maxScore: 20,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Royal College of Physicians 2017. NEWS2 validated for acutely ill adults."
        )
    }

    private static func news2Risk(_ s: Double, hasRedFlag: Bool) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0:
            return (.low, "NEWS2 0/20 — Minimum: routine monitoring",
                    ["Routine obs (minimum 12-hourly)"])
        case 1...4 where !hasRedFlag:
            return (.low, "NEWS2 \(Int(s))/20 — Low: ward-level response",
                    ["Minimum 4–6 hourly obs", "Inform nurse in charge if deteriorating"])
        case 1...4 where hasRedFlag, 5...6:
            return (.moderate, "NEWS2 \(Int(s))/20 — Medium: urgent review",
                    ["Increase obs to 1 hourly", "Inform bedside nurse immediately",
                     "Urgent review by competent clinician within 30 min",
                     "Consider ABG, bloods, ECG"])
        default:
            return (.critical, "NEWS2 \(Int(s))/20 — High: emergency response",
                    ["Continuous monitoring", "Immediate senior review or emergency response",
                     "Consider HDU/ICU transfer", "IV access, bloods, ABG, ECG now",
                     "Escalate to registrar or consultant"])
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
