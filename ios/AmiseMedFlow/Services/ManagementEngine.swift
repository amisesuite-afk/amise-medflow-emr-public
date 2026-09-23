// ManagementEngine.swift
// Deterministic evidence-based management pathways for surgical conditions.
// No AI, no network calls — HIPAA-safe.
// Sources: NICE, WSES, EAST, Tokyo 2018, BSG, ACS TQIP, SIGN, Uptodate guidelines.

import Foundation

// MARK: - Output types

struct ManagementPlan: Identifiable {
    let id = UUID()
    let diagnosis: String
    let icdCode: String
    let urgency: Urgency
    let immediateActions: [String]      // Do NOW
    let investigations: [String]        // Order
    let medicalManagement: [String]     // Non-surgical treatment
    let surgicalIndications: [String]   // When to operate
    let surgicalProcedure: String?      // What operation
    let disposition: String             // Admit / HDU / Theatre / Discharge
    let followUp: String?
    let keyPitfalls: [String]           // Common errors / don't-miss points
    let redFlags: [String]              // Escalation triggers
    let guidelines: String?             // Source
}

enum Urgency: String, Comparable {
    case immediate   = "Immediate (now)"      // Theatre / ICU NOW
    case urgent      = "Urgent (<4 hours)"    // Theatre / HDU today
    case semiUrgent  = "Semi-urgent (<24 h)"  // Admit + plan
    case elective    = "Elective"             // Outpatient / planned

    static func < (lhs: Urgency, rhs: Urgency) -> Bool {
        let order: [Urgency] = [.immediate, .urgent, .semiUrgent, .elective]
        return (order.firstIndex(of: lhs) ?? 3) < (order.firstIndex(of: rhs) ?? 3)
    }

    var colorHex: String {
        switch self {
        case .immediate:  return "#DC2626"
        case .urgent:     return "#F97316"
        case .semiUrgent: return "#EAB308"
        case .elective:   return "#22C55E"
        }
    }
}

// MARK: - ManagementEngine

enum ManagementEngine {

    // MARK: - Lookup by diagnosis keyword / ICD prefix

    /// Returns management plan(s) matching the diagnosis name or ICD prefix.
    /// Case-insensitive. Returns top 1–3 most relevant plans.
    static func plans(forDiagnosis name: String) -> [ManagementPlan] {
        let query = name.lowercased()
        return allPlans.filter { plan in
            plan.diagnosis.lowercased().contains(query) ||
            plan.icdCode.lowercased().hasPrefix(query) ||
            query.contains(plan.icdCode.lowercased())
        }
    }

    static func plan(forICD icd: String) -> ManagementPlan? {
        allPlans.first { $0.icdCode == icd }
    }

    // MARK: - Lab-aware lookup

    /// Returns management plans adjusted for critical lab findings.
    /// Upgrades urgency and prepends lab-specific immediate actions
    /// when laboratory values indicate organ failure or shock physiology.
    static func plans(forDiagnosis name: String, withLab lab: LabPanel) -> [ManagementPlan] {
        plans(forDiagnosis: name).map { labAdjusted($0, lab: lab) }
    }

    // MARK: - Lab urgency modulation (internal)

    private static func labAdjusted(_ plan: ManagementPlan, lab: LabPanel) -> ManagementPlan {
        var extra: [String] = []
        var escalateToImmediate = false
        var escalateToUrgent = false

        // Lactate ≥4 = refractory septic shock / tissue failure → immediate
        if let lac = lab.lactate, lac.value >= 4.0 {
            extra.append("⚠ Lactate \(String(format:"%.1f",lac.value)) mmol/L (≥4): Septic shock physiology — target MAP >65, start vasopressors if fluid-unresponsive; ICU/HDU NOW")
            escalateToImmediate = true
        } else if let lac = lab.lactate, lac.value >= 2.0 {
            extra.append("Lactate \(String(format:"%.1f",lac.value)) mmol/L: Tissue hypoperfusion — aggressive IV resuscitation, reassess in 2 h")
            escalateToUrgent = true
        }

        // Troponin elevation — ACS / myocardial injury
        if let trop = lab.troponin, trop.value > 52 {
            extra.append("⚠ Troponin \(String(format:"%.0f",trop.value)) ng/L (>52): Significant myocardial injury — urgent cardiology review; ECG, serial troponins, ACS protocol")
            escalateToImmediate = true
        } else if let trop = lab.troponin, trop.value > 14 {
            extra.append("Troponin \(String(format:"%.0f",trop.value)) ng/L (14–52): Myocardial injury — ECG, serial troponins q3h; cardiology input before elective surgery")
            escalateToUrgent = true
        }

        // Critical hyperkalaemia
        if let k = lab.potassium, k.value >= 6.5 {
            extra.append("⚠ K⁺ \(String(format:"%.1f",k.value)) mmol/L (≥6.5): Critical hyperkalaemia — 10 mL 10% calcium gluconate IV, insulin/dextrose, salbutamol nebulisation; URGENT ECG")
            escalateToImmediate = true
        } else if let k = lab.potassium, k.value >= 6.0 {
            extra.append("K⁺ \(String(format:"%.1f",k.value)) mmol/L: Hyperkalaemia — ECG, treat medically before anaesthetic")
            escalateToUrgent = true
        }

        // Critical hyponatraemia / hypernatraemia
        if let na = lab.sodium, na.value < 120 {
            extra.append("⚠ Na⁺ \(Int(na.value)) mmol/L (<120): Severe hyponatraemia — limit correction to 6–8 mmol/L/day; neurology input if symptomatic")
            escalateToImmediate = true
        } else if let na = lab.sodium, na.value > 160 {
            extra.append("⚠ Na⁺ \(Int(na.value)) mmol/L (>160): Severe hypernatraemia — cautious free water repletion; correct ≤0.5 mmol/L/h")
            escalateToUrgent = true
        }

        // Severe anaemia
        if let hb = lab.haemoglobin, hb.value < 7.0 {
            extra.append("⚠ Hb \(String(format:"%.1f",hb.value)) g/dL (<70 g/L): Severe anaemia — transfuse pRBC; group & screen, crossmatch; transfusion trigger in this setting")
            escalateToUrgent = true
        } else if let hb = lab.haemoglobin, hb.value < 8.0 {
            extra.append("Hb \(String(format:"%.1f",hb.value)) g/dL: Anaemia — consider transfusion pre-operatively; G&S")
        }

        // Critical INR / coagulopathy
        if let inr = lab.inr, inr.value > 3.0 {
            extra.append("⚠ INR \(String(format:"%.1f",inr.value)) (>3.0): Severe coagulopathy — 4-factor PCC or FFP; vitamin K IV; check for anticoagulant use; haematology input")
            escalateToUrgent = true
        } else if let inr = lab.inr, inr.value > 2.0 {
            extra.append("INR \(String(format:"%.1f",inr.value)): Coagulopathy — FFP pre-operatively; check anticoagulants; haematology input if not on warfarin")
        }

        // Severe thrombocytopenia
        if let plt = lab.platelets, plt.value < 50 {
            extra.append("⚠ Plt \(Int(plt.value)) ×10⁹/L (<50): Severe thrombocytopenia — platelet transfusion pre-op; haematology input")
            escalateToUrgent = true
        }

        // Obstructive jaundice / hepatic failure
        if let bil = lab.bilirubin, bil.value > 200 {
            extra.append("⚠ Bilirubin \(Int(bil.value)) µmol/L (>200): Deep jaundice — hepatic failure risk; correct coagulopathy; hepatology/liver unit input")
            escalateToUrgent = true
        }

        // Severe AKI
        if let cr = lab.creatinine, cr.value > 400 {
            extra.append("⚠ Creatinine \(Int(cr.value)) µmol/L (>400): Severe AKI / potential renal failure — nephrology input; avoid nephrotoxins; fluid optimisation; consider RRT")
            escalateToUrgent = true
        }

        // Critical hypocalcaemia (e.g. post-thyroid / post-pancreatectomy)
        if let ca = lab.calcium, ca.value < 1.75 {
            extra.append("⚠ Ca²⁺ \(String(format:"%.2f",ca.value)) mmol/L (<1.75): Critical hypocalcaemia — 10 mL 10% calcium gluconate IV over 10 min; continuous ECG monitoring")
            escalateToUrgent = true
        }

        // Critical hyperglycaemia
        if let glu = lab.glucose, glu.value > 20.0 {
            extra.append("⚠ Glucose \(String(format:"%.1f",glu.value)) mmol/L (>20): Possible DKA/HHS — check ketones, HCO₃, osmolality; variable rate insulin infusion")
            escalateToUrgent = true
        }

        // No lab escalation needed — return original plan
        if extra.isEmpty { return plan }

        let newUrgency: Urgency
        if escalateToImmediate {
            newUrgency = .immediate
        } else if escalateToUrgent && plan.urgency > .urgent {
            newUrgency = .urgent
        } else {
            newUrgency = plan.urgency
        }

        return ManagementPlan(
            diagnosis: plan.diagnosis,
            icdCode:   plan.icdCode,
            urgency:   newUrgency,
            immediateActions:   extra + plan.immediateActions,
            investigations:     plan.investigations,
            medicalManagement:  plan.medicalManagement,
            surgicalIndications: plan.surgicalIndications,
            surgicalProcedure:  plan.surgicalProcedure,
            disposition:        plan.disposition,
            followUp:           plan.followUp,
            keyPitfalls:        plan.keyPitfalls,
            redFlags:           plan.redFlags,
            guidelines:         plan.guidelines
        )
    }

    // MARK: - All plans

    static let allPlans: [ManagementPlan] = [
        acuteAppendicitis,
        perforatedAppendicitis,
        acuteCholecystitis,
        cholangitisObstructiveJaundice,
        acutePancreatitis,
        severePancreatitis,
        smallBowelObstruction,
        incarceratedHernia,
        ugib,
        lowerGIBleeding,
        separateDiverticulitis,
        perforatedViscus,
        sepsisAbdominal,
        mesentericIschaemia,
        aaa,
        necrotizingFasciitis,
        dvt,
        pulmonaryEmbolism,
        acuteLimbIschaemia,
    ]
}
