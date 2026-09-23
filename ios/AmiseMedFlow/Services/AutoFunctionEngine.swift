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
    let targetSection: ClinicalTab?    // which tab to navigate to
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

enum ClinicalTab: String {
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
        if let trop = labs.troponin?.value, trop > 52 { actions.append(AutoAction(function: .alert, title: "Troponin >52 ng/L — ACS", detail: "High-sensitivity troponin elevated above MI threshold. Immediate cardiology/medical review; aspirin 300 mg; serial ECG; repeat troponin at 1–3 h.", urgency: .critical, targetSection: .alerts, payload: nil)) }
        if labs.calciumCritical {
            if let ca = labs.calcium?.value, ca < 1.75 {
                actions.append(AutoAction(function: .alert, title: "Ca \(String(format: "%.2f", ca)) mmol/L — Critical Hypocalcaemia", detail: "IV calcium gluconate 10 mL 10% over 10 min; continuous cardiac monitoring; recheck in 1 h.", urgency: .critical, targetSection: .alerts, payload: nil))
            } else if let ca = labs.calcium?.value, ca > 3.0 {
                actions.append(AutoAction(function: .alert, title: "Ca \(String(format: "%.2f", ca)) mmol/L — Hypercalcaemia Crisis", detail: "IV fluid 1–2 L NS; IV bisphosphonate if malignancy-related; urgent endocrine/oncology referral.", urgency: .critical, targetSection: .alerts, payload: nil))
            }
        }
        if let glu = labs.glucose?.value, glu < 3.0 { actions.append(AutoAction(function: .alert, title: "Glucose \(String(format: "%.1f", glu)) mmol/L — Hypoglycaemia", detail: "Immediate IV dextrose 50 mL 50% or oral glucose; recheck in 15 min; identify cause.", urgency: .critical, targetSection: .alerts, payload: nil)) }
        if let inr = labs.inr?.value, inr > 2.5 { actions.append(AutoAction(function: .alert, title: "INR \(String(format: "%.1f", inr)) — Coagulopathy", detail: "Assess bleeding risk; consider vitamin K IV; discuss FFP if active bleeding or surgery planned; review anticoagulant medications.", urgency: .urgent, targetSection: .alerts, payload: nil)) }
        if let hb = labs.haemoglobin?.value, hb < 8.0 { actions.append(AutoAction(function: .alert, title: "Hb \(String(format: "%.1f", hb)) g/dL — Critical Anaemia", detail: "Consider transfusion; crossmatch 2–4 units; identify bleeding source; haematology input if non-haemorrhagic.", urgency: .critical, targetSection: .alerts, payload: nil)) }
        if let plt = labs.platelets?.value, plt < 50 { actions.append(AutoAction(function: .alert, title: "Plt \(Int(plt)) ×10⁹/L — Critical Thrombocytopaenia", detail: "Review antiplatelet agents; haematology review; platelet transfusion if active bleeding or <20 ×10⁹/L; avoid IM injections.", urgency: .urgent, targetSection: .alerts, payload: nil)) }

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

}
