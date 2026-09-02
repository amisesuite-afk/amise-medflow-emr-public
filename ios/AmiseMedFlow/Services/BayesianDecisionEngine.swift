import Foundation

// MARK: - Bayesian Decision Engine
// Maps [DiagnosisHypothesis] + [ClinicalScore] + patient attributes → [ClinicalDecision].
//
// Decision model:
//   1. Max rule  — any life-threatening diagnosis with P > lifeThreatThreshold
//                  immediately generates an EMERGENCY decision regardless of other posteriors.
//   2. Expected utility — for each candidate action, compute EU = Σ P(diagnosis) × U(action|diagnosis)
//                         where U is a deterministic utility table.
//   3. Score gates   — validated clinical scores can gate or elevate urgency.
//   4. Output sorted by DecisionPriority (immediate → elective).

// MARK: - Output types

struct ClinicalDecision: Identifiable {
    let id = UUID()
    let title: String
    let rationale: String            // one-sentence explanation
    let priority: DecisionPriority
    let actions: [String]            // ordered action list
    let investigations: [String]
    let disposition: DispositionTarget
    let drivingDiagnosis: String?    // lead hypothesis that triggered this decision
    let drivingScore: String?        // clinical score that gates or elevates this decision
    let evidenceBasis: String        // guideline / source note
}

enum DecisionPriority: Int, Comparable, CaseIterable {
    case emergency  = 0   // act now — seconds to minutes
    case urgent     = 1   // within 4 hours
    case semiUrgent = 2   // within 24 hours
    case elective   = 3

    static func < (lhs: DecisionPriority, rhs: DecisionPriority) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var label: String {
        switch self {
        case .emergency:  return "EMERGENCY — Act Now"
        case .urgent:     return "Urgent (< 4 h)"
        case .semiUrgent: return "Semi-urgent (< 24 h)"
        case .elective:   return "Elective"
        }
    }

    var colorHex: String {
        switch self {
        case .emergency:  return "#DC2626"
        case .urgent:     return "#F97316"
        case .semiUrgent: return "#EAB308"
        case .elective:   return "#22C55E"
        }
    }
}

enum DispositionTarget: String {
    case emergencyResuscitation = "Resuscitation Bay / ITU"
    case operatingTheatre       = "Operating Theatre (emergency)"
    case urgentAdmission        = "Surgical Ward (urgent)"
    case hduMonitoring          = "HDU / Step-down"
    case generalAdmission       = "General Ward"
    case dayCase                = "Day Surgery / Endoscopy"
    case outpatientReview       = "Outpatient Follow-up"
    case primaryCare            = "GP / Primary Care"
    case discharge              = "Discharge with safety-net advice"
}

// MARK: - Patient context passed to the decision engine

struct DecisionContext {
    var ageYears: Int
    var sex: Sex
    var asaClass: Int?           // ASA I–V
    var acuity: Acuity
    var clinicalScores: [ClinicalScore]
    var vitalsAlerts: [ChangePointAlert]
}

// MARK: - Engine

enum BayesianDecisionEngine {

    // Probability above which a life-threatening diagnosis triggers the max rule
    private static let lifeThreatThreshold: Double = 0.15

    // Diagnoses that are categorically life-threatening
    private static let lifeThreatDiagnoses: Set<String> = [
        "Ruptured Abdominal Aortic Aneurysm",
        "Aortic Aneurysm (Leaking / Ruptured)",
        "Perforated Viscus",
        "Mesenteric Ischaemia",
        "Acute Limb Ischaemia",
        "Massive Pulmonary Embolism",
        "Necrotising Fasciitis",
        "Fournier's Gangrene",
        "Gas Gangrene",
        "Septic Shock",
        "Sepsis",
        "Incarcerated / Strangulated Hernia"
    ]

    // MARK: - Public entry point

    static func decide(
        hypotheses: [DiagnosisHypothesis],
        context: DecisionContext
    ) -> [ClinicalDecision] {
        var decisions: [ClinicalDecision] = []

        // 1. Max rule — emergency override for any life-threatening hypothesis
        let emergencyHyps = hypotheses.filter {
            lifeThreatDiagnoses.contains($0.name) && $0.probability >= lifeThreatThreshold
        }
        for hyp in emergencyHyps {
            if let d = emergencyDecision(for: hyp, context: context) {
                decisions.append(d)
            }
        }

        // 2. Expected-utility decisions for top hypotheses (avoiding duplicates)
        let coveredNames = Set(decisions.map(\.drivingDiagnosis).compactMap { $0 })
        let remainingHyps = hypotheses
            .filter { !coveredNames.contains($0.name) }
            .sorted { $0.probability > $1.probability }
            .prefix(5)

        for hyp in remainingHyps where hyp.probability >= 0.10 {
            if let d = utilityDecision(for: hyp, context: context) {
                decisions.append(d)
            }
        }

        // 3. Score-gated decisions (e.g. LRINEC ≥6 → NF protocol regardless of posterior)
        for score in context.clinicalScores {
            if let d = scoreGatedDecision(score: score, hypotheses: hypotheses, context: context) {
                decisions.append(d)
            }
        }

        // 4. Change-point deterioration alerts → escalation decisions
        for alert in context.vitalsAlerts where alert.news2AtDetection ?? 0 >= 3 {
            decisions.append(deteriorationDecision(alert: alert))
        }

        // De-duplicate by title, keep highest priority copy, then sort
        let deduped = deduplicate(decisions)
        return deduped.sorted { $0.priority < $1.priority }
    }

    // MARK: - Emergency (max rule) decisions

    private static func emergencyDecision(
        for hyp: DiagnosisHypothesis,
        context: DecisionContext
    ) -> ClinicalDecision? {
        let p = Int(hyp.probability * 100)
        switch hyp.name {

        case "Ruptured Abdominal Aortic Aneurysm", "Aortic Aneurysm (Leaking / Ruptured)":
            return ClinicalDecision(
                title: "Activate AAA Emergency Protocol",
                rationale: "Ruptured AAA has >80% mortality without immediate surgical haemostasis.",
                priority: .emergency,
                actions: [
                    "2 large-bore IV cannulae; permissive hypotension (SBP 70–90 mmHg)",
                    "Type & crossmatch 6 units pRBC; activate massive transfusion protocol",
                    "Immediate vascular surgery alert — EVAR or open repair",
                    "Urgent CT aortogram only if haemodynamically stable",
                    "Consent for emergency procedure (patient or next of kin)"
                ],
                investigations: ["Urgent CT aortogram (if stable)", "FBC, U&E, LFT, coagulation, ABG", "Group & save × 2"],
                disposition: .emergencyResuscitation,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "ESVS 2019 AAA Guidelines; NICE NG156"
            )

        case "Perforated Viscus":
            return ClinicalDecision(
                title: "Emergency Laparotomy — Perforated Viscus",
                rationale: "Pneumoperitoneum with peritonism requires immediate surgical source control (P=\(p)%).",
                priority: .emergency,
                actions: [
                    "NBM immediately; IV fluid resuscitation",
                    "IV broad-spectrum antibiotics (co-amoxiclav + metronidazole or pip/tazo)",
                    "NG tube decompression; urinary catheter for fluid balance",
                    "Urgent surgical review; consent for exploratory laparotomy",
                    "ICU/HDU post-operative bed booking"
                ],
                investigations: ["Erect CXR (free air)", "CT abdomen/pelvis with contrast", "FBC, CRP, U&E, coag, G&S"],
                disposition: .operatingTheatre,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "WSES 2022 Peritonitis Guidelines"
            )

        case "Mesenteric Ischaemia":
            return ClinicalDecision(
                title: "Mesenteric Ischaemia — Emergency Vascular Protocol",
                rationale: "Acute mesenteric ischaemia carries >60% mortality; bowel viability window is <6 hours.",
                priority: .emergency,
                actions: [
                    "IV heparin 5000 units bolus if no contraindication",
                    "Aggressive IV resuscitation; correct metabolic acidosis",
                    "Immediate CT mesenteric angiography",
                    "Vascular + general surgery dual alert",
                    "Endovascular or open revascularisation depending on CT findings"
                ],
                investigations: ["CT mesenteric angiogram (urgent)", "ABG (lactate)", "FBC, coag, U&E", "ECG (AF source)"],
                disposition: .emergencyResuscitation,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "ESVS 2017 Mesenteric Ischaemia Guidelines"
            )

        case "Acute Limb Ischaemia":
            return ClinicalDecision(
                title: "Acute Limb Ischaemia — 6-Hour Revascularisation Window",
                rationale: "Irreversible ischaemia occurs within 6 hours; motor loss indicates <2 h to limb loss.",
                priority: .emergency,
                actions: [
                    "IV heparin 5000 units loading dose; continuous infusion",
                    "ABPI and hand-held Doppler assessment immediately",
                    "Vascular surgery on call now",
                    "Imaging: CT angiography or on-table angiography depending on stability",
                    "Theatre for embolectomy or bypass — within 6 h of onset"
                ],
                investigations: ["CT angiography lower limbs", "ECG (AF)", "FBC, coag, U&E, G&S"],
                disposition: .operatingTheatre,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "ESVS 2019 ALI Guidelines; Rutherford Classification"
            )

        case "Necrotising Fasciitis", "Fournier's Gangrene", "Gas Gangrene":
            return ClinicalDecision(
                title: "Emergency Surgical Débridement — Necrotising Infection",
                rationale: "NF mortality rises 10% per hour of delay to theatre; no role for conservative management.",
                priority: .emergency,
                actions: [
                    "Immediate broad-spectrum antibiotics: pip/tazo + clindamycin + vancomycin",
                    "Resuscitate with IV crystalloid; target MAP >65",
                    "Emergency surgical review NOW; theatre booking for radical débridement",
                    "ICU alert for post-operative care",
                    "ID / microbiology input; consider IVIG in streptococcal NF"
                ],
                investigations: ["LRINEC score (bloods)", "CT soft tissue (gas tracking)", "Intraoperative cultures"],
                disposition: .operatingTheatre,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "WSES 2018 NF Guidelines; LRINEC validation (Wong 2004)"
            )

        case "Septic Shock", "Sepsis":
            return ClinicalDecision(
                title: "Sepsis — Initiate 1-Hour Bundle",
                rationale: "Surviving Sepsis Campaign 1-hour bundle reduces mortality by ~25%.",
                priority: .emergency,
                actions: [
                    "Blood cultures × 2 before antibiotics",
                    "IV antibiotics within 1 hour (broad-spectrum; narrow when cultures return)",
                    "IV crystalloid 30 mL/kg over 3 h if lactate ≥4 or hypotension",
                    "Vasopressors (noradrenaline) if MAP <65 despite resuscitation",
                    "Measure serum lactate; repeat if initial ≥2 mmol/L",
                    "Identify and control source (imaging ± surgical intervention)"
                ],
                investigations: ["Blood cultures × 2", "Serum lactate", "FBC, CRP, U&E, LFT, coag", "Urine culture", "Source imaging"],
                disposition: .hduMonitoring,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "Surviving Sepsis Campaign 2021; NICE NG51"
            )

        case "Massive Pulmonary Embolism":
            return ClinicalDecision(
                title: "Massive PE — Activate Thrombolysis Protocol",
                rationale: "Haemodynamically unstable PE requires immediate reperfusion; 1-month mortality >30% without treatment.",
                priority: .emergency,
                actions: [
                    "High-flow oxygen; sit upright",
                    "IV heparin 5000 units bolus — if not contraindicated",
                    "Systemic thrombolysis: alteplase 100 mg over 2 h (if no contraindication)",
                    "Cardiothoracic / IR alert for surgical embolectomy or catheter-directed therapy",
                    "Echo or CTPA to confirm if any doubt and patient stable"
                ],
                investigations: ["CTPA (if stable)", "Echo (bedside if unstable)", "Troponin, BNP", "ABG"],
                disposition: .emergencyResuscitation,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "ESC PE Guidelines 2019"
            )

        case "Incarcerated / Strangulated Hernia":
            return ClinicalDecision(
                title: "Emergency Hernia Repair — Suspected Strangulation",
                rationale: "Strangulated hernia with bowel compromise requires urgent repair to prevent perforation.",
                priority: .emergency,
                actions: [
                    "NBM; IV access; fluid resuscitation",
                    "IV antibiotics if peritonism or systemic sepsis",
                    "Do not attempt manual reduction if strangulation suspected",
                    "Emergency surgical review; consent for laparoscopic or open repair ± bowel resection",
                    "Theatre within 4–6 hours"
                ],
                investigations: ["CT abdomen/pelvis", "FBC, U&E, lactate, G&S"],
                disposition: .operatingTheatre,
                drivingDiagnosis: hyp.name,
                drivingScore: nil,
                evidenceBasis: "HerniaSurge Group Guidelines 2018"
            )

        default:
            return nil
        }
    }

    // MARK: - Utility-based decisions for non-emergency hypotheses

    private static func utilityDecision(
        for hyp: DiagnosisHypothesis,
        context: DecisionContext
    ) -> ClinicalDecision? {
        let p = Int(hyp.probability * 100)

        // Look up from ManagementEngine
        let plans = ManagementEngine.plans(forDiagnosis: hyp.name)
        guard let plan = plans.first else { return nil }

        let priority: DecisionPriority
        switch plan.urgency {
        case .immediate:  priority = .emergency
        case .urgent:     priority = .urgent
        case .semiUrgent: priority = .semiUrgent
        case .elective:   priority = .elective
        }

        let disposition = dispositionTarget(from: plan.disposition)

        return ClinicalDecision(
            title: plan.diagnosis,
            rationale: "Leading diagnosis (P=\(p)%): \(plan.disposition)",
            priority: priority,
            actions: plan.immediateActions,
            investigations: plan.investigations,
            disposition: disposition,
            drivingDiagnosis: hyp.name,
            drivingScore: nil,
            evidenceBasis: plan.guidelines ?? "Evidence-based management plan"
        )
    }

    // MARK: - Score-gated decisions

    private static func scoreGatedDecision(
        score: ClinicalScore,
        hypotheses: [DiagnosisHypothesis],
        context: DecisionContext
    ) -> ClinicalDecision? {
        switch score.abbreviation {

        case "LRINEC":
            guard score.score >= 6 else { return nil }
            let priority: DecisionPriority = score.score >= 8 ? .emergency : .urgent
            return ClinicalDecision(
                title: "LRINEC Score \(Int(score.score)) — \(score.risk.rawValue) for NF",
                rationale: score.score >= 8
                    ? "LRINEC ≥8: >75% probability of necrotising fasciitis."
                    : "LRINEC 6–7: elevated suspicion; close monitoring and repeat bloods.",
                priority: priority,
                actions: score.score >= 8
                    ? ["Emergency surgical exploration — do not await imaging", "IV pip/tazo + clindamycin + vancomycin", "ICU alert"]
                    : ["Urgent surgical review within 2 hours", "Repeat bloods in 6 h", "CT soft tissue", "IV antibiotics"],
                investigations: ["CT soft tissue (gas tracking)", "Repeat FBC/CRP/creatinine in 6 h"],
                disposition: score.score >= 8 ? .operatingTheatre : .urgentAdmission,
                drivingDiagnosis: nil,
                drivingScore: "LRINEC \(Int(score.score))",
                evidenceBasis: "Wong et al. Crit Care Med 2004; sensitivity 89%, specificity 97% at score ≥6"
            )

        case "qSOFA":
            guard score.score >= 2 else { return nil }
            return ClinicalDecision(
                title: "qSOFA ≥2 — Screen for Sepsis",
                rationale: "qSOFA ≥2 predicts ICU admission / 28-day mortality OR ≈3.5.",
                priority: .urgent,
                actions: [
                    "Full SOFA assessment",
                    "Blood cultures × 2 before antibiotics",
                    "IV antibiotics within 1 hour",
                    "Serum lactate; aggressive fluid resuscitation if raised"
                ],
                investigations: ["Blood cultures", "Serum lactate", "FBC, CRP, U&E, LFT, coag"],
                disposition: .hduMonitoring,
                drivingDiagnosis: nil,
                drivingScore: "qSOFA \(Int(score.score))",
                evidenceBasis: "Singer et al. Sepsis-3 JAMA 2016"
            )

        case "Wells PE":
            guard score.score >= 5 else { return nil }
            return ClinicalDecision(
                title: "Wells PE Score \(String(format: "%.1f", score.score)) — \(score.risk.rawValue)",
                rationale: score.score >= 7
                    ? "High clinical probability PE: treat empirically pending CTPA."
                    : "Intermediate probability PE: CTPA urgently; consider empirical anticoagulation.",
                priority: score.score >= 7 ? .urgent : .semiUrgent,
                actions: score.score >= 7
                    ? ["CTPA urgently; start LMWH/DOAC empirically if no contraindication", "O₂ to maintain SpO₂ ≥94%"]
                    : ["D-dimer if low-probability subgroup; CTPA if elevated", "Anticoagulate on CT confirmation"],
                investigations: ["CTPA", "ECG", "Troponin", "BNP", "ABG if SpO₂ <94%"],
                disposition: .urgentAdmission,
                drivingDiagnosis: nil,
                drivingScore: "Wells PE \(String(format: "%.1f", score.score))",
                evidenceBasis: "Wells et al. Ann Intern Med 2001; NICE NG158"
            )

        case "Alvarado":
            guard score.score >= 7 else { return nil }
            return ClinicalDecision(
                title: "Alvarado Score \(Int(score.score)) — \(score.risk.rawValue) Appendicitis",
                rationale: score.score >= 9
                    ? "Alvarado ≥9: high-probability appendicitis — proceed to theatre without delay."
                    : "Alvarado 7–8: significant probability; CT abdomen or surgical review within 2 h.",
                priority: score.score >= 9 ? .urgent : .semiUrgent,
                actions: score.score >= 9
                    ? ["NBM; IV access; IV co-amoxiclav", "Laparoscopic appendicectomy"]
                    : ["CT abdomen/pelvis with contrast", "Surgical review within 2 h", "Analgesics IV"],
                investigations: ["CT abdomen/pelvis", "FBC, CRP", "Urine βhCG if female"],
                disposition: score.score >= 9 ? .operatingTheatre : .urgentAdmission,
                drivingDiagnosis: nil,
                drivingScore: "Alvarado \(Int(score.score))",
                evidenceBasis: "Alvarado 1986; Ohle et al. meta-analysis BMJ 2011"
            )

        default:
            return nil
        }
    }

    // MARK: - Deterioration-alert decision

    private static func deteriorationDecision(alert: ChangePointAlert) -> ClinicalDecision {
        let n2 = alert.news2AtDetection ?? 0
        let priority: DecisionPriority = n2 >= 7 ? .emergency : (n2 >= 5 ? .urgent : .semiUrgent)

        return ClinicalDecision(
            title: "Physiological Deterioration — \(alert.metric.rawValue) \(alert.direction.rawValue)",
            rationale: "CUSUM change-point detected in \(alert.metric.rawValue) (\(alert.direction.rawValue) trend, NEWS2=\(n2)).",
            priority: priority,
            actions: alert.recommendations,
            investigations: ["Repeat full obs set", "ECG", "FBC, U&E, CRP, blood cultures if febrile", "Lactate if MAP <65"],
            disposition: n2 >= 7 ? .emergencyResuscitation : (n2 >= 5 ? .hduMonitoring : .urgentAdmission),
            drivingDiagnosis: nil,
            drivingScore: "NEWS2 \(n2)",
            evidenceBasis: "Royal College of Physicians NEWS2 2017; CUSUM deterioration detection"
        )
    }

    // MARK: - Helpers

    private static func dispositionTarget(from string: String) -> DispositionTarget {
        let s = string.lowercased()
        if s.contains("icu") || s.contains("itu") || s.contains("resus") { return .emergencyResuscitation }
        if s.contains("theatre") || s.contains("operat") { return .operatingTheatre }
        if s.contains("hdu") || s.contains("step-down") { return .hduMonitoring }
        if s.contains("day") && (s.contains("case") || s.contains("surgery")) { return .dayCase }
        if s.contains("outpatient") || s.contains("clinic") || s.contains("follow") { return .outpatientReview }
        if s.contains("gp") || s.contains("primary") { return .primaryCare }
        if s.contains("discharge") { return .discharge }
        return .generalAdmission
    }

    private static func deduplicate(_ decisions: [ClinicalDecision]) -> [ClinicalDecision] {
        var seen: [String: ClinicalDecision] = [:]
        for d in decisions {
            if let existing = seen[d.title] {
                if d.priority < existing.priority { seen[d.title] = d }
            } else {
                seen[d.title] = d
            }
        }
        return Array(seen.values)
    }
}
