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
