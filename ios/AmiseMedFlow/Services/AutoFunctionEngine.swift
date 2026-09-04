import Foundation

// MARK: - AutoFunction Engine
// Deterministic action generator. Reads the full PatientStateVector (which by
// this point carries hypotheses, decisions, trajectories, change-point alerts,
// and VoI-ranked information items) and emits a prioritised list of concrete
// AutoActions the UI surfaces to the clinician.
//
// Functions implemented:
//   ask       — missing history elements needed to confirm/exclude diagnosis
//   order     — investigations with highest EVPI not yet obtained
//   calculate — validated clinical scores not yet computed for this patient
//   document  — generate specific documentation objects (SOAP, op note, discharge)
//   compare   — flag results that should be trended against a prior value
//   alert     — CUSUM/NEWS2 deterioration, life-threatening thresholds
//   schedule  — time-sensitive follow-up or theatre booking
//   prepare   — materials needed for imminent procedures (consent, WHO checklist)

// MARK: - Output types

struct AutoAction: Identifiable {
    let id = UUID()
    let function: AutoFunction
    let title: String
    let detail: String
    let urgency: AutoUrgency
    let targetSection: AppSection?    // which tab to navigate to
    let payload: AutoPayload?         // pre-populated data to hand to the target UI
}

enum AutoFunction: String {
    case ask       = "Ask"
    case order     = "Order"
    case calculate = "Calculate"
    case document  = "Document"
    case compare   = "Compare"
    case alert     = "Alert"
    case schedule  = "Schedule"
    case prepare   = "Prepare"

    var icon: String {
        switch self {
        case .ask:       return "questionmark.bubble"
        case .order:     return "flask"
        case .calculate: return "function"
        case .document:  return "doc.text"
        case .compare:   return "arrow.left.arrow.right"
        case .alert:     return "exclamationmark.triangle.fill"
        case .schedule:  return "calendar.badge.plus"
        case .prepare:   return "checklist"
        }
    }
}

enum AutoUrgency: Int, Comparable {
    case critical  = 0
    case urgent    = 1
    case standard  = 2
    case elective  = 3
    static func < (lhs: AutoUrgency, rhs: AutoUrgency) -> Bool { lhs.rawValue < rhs.rawValue }

    var colorHex: String {
        switch self {
        case .critical: return "#DC2626"
        case .urgent:   return "#F97316"
        case .standard: return "#2563EB"
        case .elective: return "#22C55E"
        }
    }
}

enum AppSection: String {
    case history      = "History"
    case examination  = "Examination"
    case investigations = "Investigations"
    case scores       = "Scores"
    case management   = "Management"
    case documents    = "Documents"
    case alerts       = "Alerts"
    case schedule     = "Schedule"
    case consents     = "Consents"
    case perioperative = "Perioperative"
}

// Pre-populated data handed to the target UI section
enum AutoPayload {
    case scoreInput(scoreAbbreviation: String)
    case investigationOrder(name: String, urgency: String)
    case documentTemplate(type: DocumentTemplateType)
    case scheduleBooking(description: String, within: String)
    case consentFor(procedure: String)
    case historyPrompt(question: String)
}

enum DocumentTemplateType: String {
    case soapNote       = "SOAP Note"
    case operativeNote  = "Operative Note"
    case dischargeSummary = "Discharge Summary"
    case referralLetter = "Referral Letter"
    case endoscopyReport = "Endoscopy Report"
    case clinicalLetter = "Clinical Letter"
}

// MARK: - Engine

enum AutoFunctionEngine {

    static func generate(from psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []

        actions += generateAlerts(psv)
        actions += generateAsk(psv)
        actions += generateOrder(psv)
        actions += generateCalculate(psv)
        actions += generateDocument(psv)
        actions += generateCompare(psv)
        actions += generateSchedule(psv)
        actions += generatePrepare(psv)

        // De-duplicate by title, keep highest urgency
        let deduped = deduplicate(actions)
        return deduped.sorted { $0.urgency < $1.urgency }
    }

    // MARK: - ALERT

    private static func generateAlerts(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []

        // CUSUM / NEWS2 deterioration
        for alert in psv.changePointAlerts {
            let n2 = alert.news2AtDetection ?? 0
            let urgency: AutoUrgency = n2 >= 7 ? .critical : (n2 >= 5 ? .urgent : .standard)
            actions.append(AutoAction(
                function: .alert,
                title: "⚠︎ \(alert.metric.rawValue) \(alert.direction.rawValue) — NEWS2 \(n2)",
                detail: alert.recommendations.first ?? "Escalate to senior clinician",
                urgency: urgency,
                targetSection: .alerts,
                payload: nil
            ))
        }

        // Emergency trajectories
        for traj in psv.trajectories {
            if let da = traj.deteriorationAlert {
                actions.append(AutoAction(
                    function: .alert,
                    title: "⚠︎ \(traj.diseaseName) — Trajectory Alert",
                    detail: da.message,
                    urgency: da.priority == .emergency ? .critical : .urgent,
                    targetSection: .alerts,
                    payload: nil
                ))
            }
        }

        // Critical lab thresholds
        let labs = psv.labs
        if let lactate = labs.lactate?.value, lactate >= 4.0 {
            actions.append(AutoAction(function: .alert, title: "Lactate ≥4 mmol/L — Critical", detail: "Activate vasopressor protocol; ICU alert; repeat in 2 h.", urgency: .critical, targetSection: .alerts, payload: nil))
        } else if let lactate = labs.lactate?.value, lactate >= 2.0 {
            actions.append(AutoAction(function: .alert, title: "Lactate 2–4 mmol/L — Elevated", detail: "Aggressive fluid resuscitation; repeat in 2 h; assess organ perfusion.", urgency: .urgent, targetSection: .alerts, payload: nil))
        }
        if (labs.wbc?.value ?? 5) > 20 { actions.append(AutoAction(function: .alert, title: "WBC >20 — Severe Leukocytosis", detail: "Severe infection or haematological cause — blood cultures, LRINEC if soft tissue involvement.", urgency: .urgent, targetSection: .investigations, payload: nil)) }
        if (labs.creatinine?.value ?? 80) > 300 { actions.append(AutoAction(function: .alert, title: "Creatinine >300 — AKI", detail: "Stop nephrotoxic drugs; IV fluid challenge; nephrology review; hourly UO.", urgency: .urgent, targetSection: .investigations, payload: nil)) }

        // Life-threatening decisions
        for decision in psv.decisions where decision.priority == .emergency {
            actions.append(AutoAction(
                function: .alert,
                title: "EMERGENCY: \(decision.title)",
                detail: decision.actions.first ?? decision.rationale,
                urgency: .critical,
                targetSection: .management,
                payload: nil
            ))
        }

        return actions
    }

    // MARK: - ASK

    private static func generateAsk(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []
        guard let lead = psv.hypotheses.sorted(by: { $0.probability > $1.probability }).first else { return [] }

        // Missing SOCRATES elements that are high-value for the lead diagnosis
        let collected = Set(psv.socratesSelections.keys)

        if lead.name.contains("cholecystitis") || lead.name.contains("biliary") || lead.name.contains("pancreatitis") {
            if !collected.contains("radiation_shoulder") && !collected.contains("radiation_back") {
                actions.append(AutoAction(function: .ask, title: "Ask: radiation of pain", detail: "Does the pain radiate to the right shoulder/scapula (biliary) or straight through to the back (pancreatitis)?", urgency: .urgent, targetSection: .history, payload: .historyPrompt(question: "Does the pain radiate to your shoulder or back?")))
            }
            if !collected.contains("relieved_by_leaning") && lead.name.contains("pancreatitis") {
                actions.append(AutoAction(function: .ask, title: "Ask: lean-forward relief", detail: "Pain relief on leaning forward is highly specific for acute pancreatitis (LR+ 5.0).", urgency: .urgent, targetSection: .history, payload: .historyPrompt(question: "Is the pain better when you lean forward?")))
            }
        }

        if lead.name.contains("appendicitis") {
            if !collected.contains("associations") {
                actions.append(AutoAction(function: .ask, title: "Ask: anorexia/nausea", detail: "Anorexia (LR+ 1.8) and nausea/vomiting (LR+ 1.5) contribute to the Alvarado score.", urgency: .standard, targetSection: .history, payload: .historyPrompt(question: "Have you lost your appetite? Any nausea or vomiting?")))
            }
        }

        if lead.name.contains("embol") || lead.name.contains("ischaem") {
            if !collected.contains("af_history") && !psv.pmh.atrialFibrillation {
                actions.append(AutoAction(function: .ask, title: "Ask: atrial fibrillation history", detail: "AF is the source in 70% of arterial emboli. LR+ = 6.0 for arterial embolism.", urgency: .urgent, targetSection: .history, payload: .historyPrompt(question: "Have you been diagnosed with an irregular heartbeat or atrial fibrillation?")))
            }
        }

        if lead.name.contains("dvt") || lead.name.contains("pulmonary embol") {
            if !collected.contains("prior_dvt_pe") && !psv.pmh.dvtOrPE {
                actions.append(AutoAction(function: .ask, title: "Ask: prior DVT/PE", detail: "Previous VTE raises Wells PE score +1.5; prior DVT/PE raises Wells DVT score +1.5.", urgency: .urgent, targetSection: .history, payload: .historyPrompt(question: "Have you ever had a blood clot in your leg or lung before?")))
            }
        }

        if lead.name.contains("necrotis") || lead.name.contains("fasciitis") {
            if !collected.contains("onset") {
                actions.append(AutoAction(function: .ask, title: "Ask: speed of onset", detail: "Rapid onset over hours is a hallmark of NF vs. slower cellulitis onset. Affects LRINEC interpretation.", urgency: .urgent, targetSection: .history, payload: .historyPrompt(question: "How quickly did the redness and pain spread — over hours or days?")))
            }
        }

        return actions
    }

    // MARK: - ORDER

    private static func generateOrder(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []
        let collected = Set(psv.socratesSelections.keys)
        let voiItems = ValueOfInformationEngine.rank(from: psv).prefix(8)

        for item in voiItems where item.evpi >= 0.10 {
            let urgency: AutoUrgency
            switch item.priority {
            case .immediate: urgency = .critical
            case .urgent:    urgency = .urgent
            case .routine:   urgency = .standard
            }
            actions.append(AutoAction(
                function: .order,
                title: "Order: \(item.name)",
                detail: item.clinicalNote ?? "EVPI \(String(format: "%.2f", item.evpi)) bits — discriminates \(item.targetDiagnoses.prefix(2).joined(separator: " vs "))",
                urgency: urgency,
                targetSection: .investigations,
                payload: .investigationOrder(name: item.name, urgency: item.priority.label)
            ))
        }
        _ = collected  // suppresses unused-variable warning
        return actions
    }

    // MARK: - CALCULATE

    private static func generateCalculate(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []
        let calculated = Set(psv.clinicalScores.map(\.abbreviation))
        let lead = psv.hypotheses.sorted { $0.probability > $1.probability }.prefix(3).map(\.name)

        let scoreMap: [(diag: String, abbrev: String, label: String)] = [
            ("appendicitis",   "Alvarado",   "Alvarado Score"),
            ("cholecystitis",  "Tokyo Cholecystitis", "Tokyo Grade (Cholecystitis)"),
            ("cholangitis",    "Tokyo Cholangitis",   "Tokyo Grade (Cholangitis)"),
            ("pancreatitis",   "Glasgow",    "Glasgow Pancreatitis Score"),
            ("pancreatitis",   "Ranson",     "Ranson's Criteria"),
            ("gi bleed",       "Rockall",    "Rockall Score (UGIB)"),
            ("sepsis",         "qSOFA",      "qSOFA Score"),
            ("necrotis",       "LRINEC",     "LRINEC Score"),
            ("dvt",            "Wells DVT",  "Wells DVT Score"),
            ("pulmonary embol","Wells PE",   "Wells PE Score"),
            ("tia",            "ABCD2",      "ABCD2 Score"),
            ("liver",          "Child-Pugh", "Child-Pugh Score"),
            ("cardiac risk",   "RCRI",       "Revised Cardiac Risk Index"),
            ("thromboprophyl", "Caprini",    "Caprini VTE Risk Score")
        ]

        for item in scoreMap {
            let matchesDiag = lead.contains(where: { $0.lowercased().contains(item.diag) })
            let alreadyCalc = calculated.contains(item.abbrev)
            if matchesDiag && !alreadyCalc {
                actions.append(AutoAction(
                    function: .calculate,
                    title: "Calculate: \(item.label)",
                    detail: "Relevant to \(lead.first(where: { $0.lowercased().contains(item.diag) }) ?? item.diag) — use validated score to guide management.",
                    urgency: .standard,
                    targetSection: .scores,
                    payload: .scoreInput(scoreAbbreviation: item.abbrev)
                ))
            }
        }

        // Always suggest NEWS2 if vitals are present and NEWS2 not yet calculated
        if !psv.vitalsTrend.isEmpty && !calculated.contains("NEWS2") {
            actions.append(AutoAction(function: .calculate, title: "Calculate: NEWS2", detail: "National Early Warning Score 2 — standardised track-and-trigger for physiological deterioration.", urgency: .standard, targetSection: .scores, payload: .scoreInput(scoreAbbreviation: "NEWS2")))
        }

        return actions
    }

    // MARK: - DOCUMENT

    private static func generateDocument(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []
        let lead = psv.hypotheses.sorted { $0.probability > $1.probability }.first

        // Operative note if surgery imminent
        let surgeryDecision = psv.decisions.first(where: { $0.disposition == .operatingTheatre })
        if surgeryDecision != nil {
            actions.append(AutoAction(function: .document, title: "Prepare: Operative Note Template", detail: "Theatre decision made — pre-populate operative note with diagnosis and planned procedure.", urgency: .urgent, targetSection: .documents, payload: .documentTemplate(type: .operativeNote)))
        }

        // Referral letter if outpatient decision
        let referralDecision = psv.decisions.first(where: { $0.disposition == .outpatientReview || $0.disposition == .primaryCare })
        if referralDecision != nil {
            actions.append(AutoAction(function: .document, title: "Draft: Referral Letter", detail: "Outpatient referral — draft letter to receiving clinician with working diagnosis and relevant findings.", urgency: .standard, targetSection: .documents, payload: .documentTemplate(type: .referralLetter)))
        }

        // Discharge summary if discharge
        let dischargeDecision = psv.decisions.first(where: { $0.disposition == .discharge })
        if dischargeDecision != nil {
            actions.append(AutoAction(function: .document, title: "Draft: Discharge Summary", detail: "Patient for discharge — generate summary with diagnosis, treatment, medications, and follow-up.", urgency: .standard, targetSection: .documents, payload: .documentTemplate(type: .dischargeSummary)))
        }

        // SOAP note always available
        if let lead {
            actions.append(AutoAction(function: .document, title: "Draft: SOAP Note", detail: "Working diagnosis: \(lead.name) (P=\(Int(lead.probability * 100))%) — auto-populate from collected history and exam.", urgency: .elective, targetSection: .documents, payload: .documentTemplate(type: .soapNote)))
        }

        return actions
    }

    // MARK: - COMPARE

    private static func generateCompare(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []

        // Flag labs with prior values for trending
        if psv.labs.crp != nil {
            actions.append(AutoAction(function: .compare, title: "Trend CRP vs. prior", detail: "Compare current CRP with previous result to assess treatment response / progression.", urgency: .standard, targetSection: .investigations, payload: nil))
        }
        if psv.labs.amylase != nil || psv.labs.lipase != nil {
            actions.append(AutoAction(function: .compare, title: "Trend amylase/lipase", detail: "Serial amylase or lipase — falling trend indicates resolving pancreatitis.", urgency: .standard, targetSection: .investigations, payload: nil))
        }
        if psv.labs.lactate?.value ?? 0 >= 2.0 {
            actions.append(AutoAction(function: .compare, title: "Repeat lactate in 2 h", detail: "Lactate ≥2 — clearance target ≥10% per hour in sepsis resuscitation.", urgency: .urgent, targetSection: .investigations, payload: .investigationOrder(name: "Repeat Serum Lactate", urgency: "Urgent")))
        }

        // NEWS2 trending
        if psv.vitalsTrend.count >= 2 {
            actions.append(AutoAction(function: .compare, title: "NEWS2 trend chart", detail: "Plot NEWS2 trajectory over \(psv.vitalsTrend.count) observation sets.", urgency: .standard, targetSection: .alerts, payload: nil))
        }

        return actions
    }

    // MARK: - SCHEDULE

    private static func generateSchedule(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []

        for decision in psv.decisions {
            switch decision.priority {
            case .emergency:
                if decision.disposition == .operatingTheatre {
                    actions.append(AutoAction(function: .schedule, title: "Book Emergency Theatre", detail: decision.title, urgency: .critical, targetSection: .schedule, payload: .scheduleBooking(description: decision.title, within: "Now")))
                }
            case .urgent:
                actions.append(AutoAction(function: .schedule, title: "Schedule: \(decision.title.prefix(40))", detail: "Required within 4 hours — \(decision.disposition.rawValue).", urgency: .urgent, targetSection: .schedule, payload: .scheduleBooking(description: String(decision.title.prefix(50)), within: "4 hours")))
            case .semiUrgent:
                actions.append(AutoAction(function: .schedule, title: "Schedule: \(decision.title.prefix(40))", detail: "Required within 24 hours — \(decision.disposition.rawValue).", urgency: .standard, targetSection: .schedule, payload: .scheduleBooking(description: String(decision.title.prefix(50)), within: "24 hours")))
            case .elective:
                break
            }
        }

        // Post-operative surveillance scheduling
        if let traj = psv.trajectories.first, traj.currentState.urgency == .urgent {
            actions.append(AutoAction(function: .schedule, title: "Schedule: repeat obs in 2 h", detail: "Monitor \(traj.diseaseName) — current state: \(traj.currentState.name). Recheck vitals and labs in 2 hours.", urgency: .urgent, targetSection: .schedule, payload: .scheduleBooking(description: "Repeat obs + lactate: \(traj.diseaseName)", within: "2 hours")))
        }

        return actions
    }

    // MARK: - PREPARE

    private static func generatePrepare(_ psv: PatientStateVector) -> [AutoAction] {
        var actions: [AutoAction] = []

        let theatreDecision = psv.decisions.first(where: { $0.disposition == .operatingTheatre })
        guard let decision = theatreDecision else { return [] }

        // Consent form
        let procedure = decision.drivingDiagnosis ?? decision.title
        actions.append(AutoAction(function: .prepare, title: "Prepare: Surgical Consent Form", detail: "Consent for \(procedure) — include standard and procedure-specific risks.", urgency: .urgent, targetSection: .consents, payload: .consentFor(procedure: procedure)))

        // WHO checklist
        actions.append(AutoAction(function: .prepare, title: "Prepare: WHO Surgical Safety Checklist", detail: "Complete sign-in, time-out, and sign-out checklist before \(procedure).", urgency: .urgent, targetSection: .perioperative, payload: nil))

        // Pre-op bloods if not done
        if psv.labs.wbc == nil || psv.labs.creatinine == nil || psv.labs.inr == nil {
            actions.append(AutoAction(function: .prepare, title: "Prepare: Pre-op bloods", detail: "FBC, U&E, LFT, coagulation, group & save required before emergency surgery.", urgency: .urgent, targetSection: .investigations, payload: .investigationOrder(name: "Pre-op bloods (FBC, U&E, coag, G&S)", urgency: "Urgent")))
        }

        // VTE prophylaxis
        if psv.ageYears >= 40 && theatreDecision != nil {
            actions.append(AutoAction(function: .prepare, title: "Prepare: VTE prophylaxis", detail: "LMWH (enoxaparin 40 mg SC) and TED stockings per perioperative VTE protocol.", urgency: .standard, targetSection: .perioperative, payload: nil))
        }

        return actions
    }

    // MARK: - De-duplicate

    private static func deduplicate(_ actions: [AutoAction]) -> [AutoAction] {
        var seen: [String: AutoAction] = [:]
        for a in actions {
            if let existing = seen[a.title] {
                if a.urgency < existing.urgency { seen[a.title] = a }
            } else {
                seen[a.title] = a
            }
        }
        return Array(seen.values)
    }
}
