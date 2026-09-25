// SurgicalRiskEngine.swift
// Deterministic surgical risk stratification.
// Pure rules — no AI, no network. Based on NICE CG3, ACS NSQIP, SORT, SIGN guidelines.
//
// Architecture: hybrid deductive + inductive
//   Deductive  — single-factor implication   (steroid use → adrenal suppression risk)
//   Inductive  — multi-factor convergence    (DM + steroids + malnutrition → CRITICAL)
//   The combined band is always >= the strongest single-factor band.

import Foundation

// MARK: - Output types

struct SurgicalRiskAlert: Identifiable {
    let id = UUID()

    enum Domain: String {
        case infection   = "Infection Risk"
        case healing     = "Wound Healing"
        case frailty     = "Frailty"
        case nutrition   = "Nutritional Risk"
        case periop      = "Perioperative"
        case anticoag    = "Anticoagulation"
        case anaesthetic = "Anaesthetic"

        var icon: String {
            switch self {
            case .infection:   "microbe"
            case .healing:     "bandage"
            case .frailty:     "figure.walk"
            case .nutrition:   "fork.knife"
            case .periop:      "heart.text.square"
            case .anticoag:    "drop.triangle"
            case .anaesthetic: "lungs"
            }
        }
    }

    enum Band: Int, Comparable {
        case advisory  = 1   // teal
        case moderate  = 2   // amber
        case high      = 3   // orange-red
        case critical  = 4   // red, pulsing

        static func < (lhs: Band, rhs: Band) -> Bool { lhs.rawValue < rhs.rawValue }

        var label: String {
            switch self {
            case .advisory:  "Advisory"
            case .moderate:  "Moderate"
            case .high:      "High"
            case .critical:  "Critical"
            }
        }
    }

    let domain: Domain
    let band: Band
    let title: String
    let detail: String
    let action: String
}

// MARK: - Input struct

struct SurgicalRiskInputs {
    let pmh: Set<String>
    let medicationNames: [String]   // drug names, lowercased externally for matching
    let ageYears: Int
    let bmiKgM2: Double?
    let socialChips: Set<String>
    var labs: LabPanel? = nil       // objective lab values from resulted investigations

    // MARK: PMH helpers
    var hasDM:              Bool { pmh.contains("T2DM") || pmh.contains("T1DM") }
    var hasT1DM:            Bool { pmh.contains("T1DM") }
    var hasIHD:             Bool { pmh.contains("Ischaemic heart disease") }
    var hasHF:              Bool { pmh.contains("Heart failure") }
    var hasCardiac:         Bool { hasIHD || hasHF }
    var hasAF:              Bool { pmh.contains("Atrial fibrillation") }
    var hasDVTPE:           Bool { pmh.contains("DVT / PE") }
    var hasStroke:          Bool { pmh.contains("Stroke / TIA") }
    var hasCKD:             Bool { pmh.contains("CKD") }
    var hasCOPD:            Bool { pmh.contains("COPD") }
    var hasAsthma:          Bool { pmh.contains("Asthma") }
    var hasLiver:           Bool { pmh.contains("Liver disease / Cirrhosis") }
    var hasPUD:             Bool { pmh.contains("Peptic ulcer disease") }
    var hasOSA:             Bool { pmh.contains("OSA") }
    var hasAnaemia:         Bool { pmh.contains("Anaemia") }
    var hasMalignancy:      Bool { pmh.contains("Malignancy") }
    var hasIBD:             Bool { pmh.contains("IBD (Crohn's / UC)") }
    var hasRA:              Bool { pmh.contains("Rheumatoid arthritis") }
    var hasOsteoporosis:    Bool { pmh.contains("Osteoporosis") }
    var hasEpilepsy:        Bool { pmh.contains("Epilepsy") }

    var hasImmunocompromised: Bool {
        pmh.contains("Immunocompromised") || hasMalignancy || hasIBD ||
        meds(anyOf: ["azathioprine","methotrexate","infliximab","mycophenolate",
                     "ciclosporin","tacrolimus","adalimumab","rituximab"])
    }

    var hasSteroids: Bool {
        pmh.contains("Immunocompromised") ||
        meds(anyOf: ["prednisolone","dexamethasone","hydrocortisone",
                     "methylprednisolone","budesonide","betamethasone"])
    }

    var hasAnticoag: Bool {
        meds(anyOf: ["warfarin","apixaban","rivaroxaban","dabigatran","edoxaban","enoxaparin"])
    }

    var hasAntiplatelet: Bool {
        meds(anyOf: ["aspirin","clopidogrel","ticagrelor","prasugrel","dipyridamole"])
    }

    // MARK: Social helpers
    var isSmoker:       Bool { socialChips.contains { $0.hasPrefix("Smoking:") && !$0.contains("Non-smoker") } }
    var isHeavySmoker:  Bool { socialChips.contains { $0.contains("Heavy smoker") } }
    var isHeavyDrinker: Bool { socialChips.contains { $0.contains("Heavy (>21 units") } }
    var livesAlone:     Bool { socialChips.contains("Lives alone") }
    var isCareHome:     Bool { socialChips.contains("Care home resident") }
    var isSedentary:    Bool { socialChips.contains("Sedentary lifestyle") || socialChips.contains("Sedentary / desk work") }

    // MARK: BMI
    enum BMICategory {
        case unknown
        case severelyUnderweight   // <16
        case underweight           // 16–18.5
        case normal                // 18.5–25
        case overweight            // 25–30
        case obeseI                // 30–35
        case obeseII               // 35–40
        case morbidlyObese         // ≥40

        var isMalnourished: Bool { self == .severelyUnderweight || self == .underweight }
        var isObese:        Bool { [.obeseI, .obeseII, .morbidlyObese].contains(self) }
        var isMorbidlyObese: Bool { self == .morbidlyObese }
        var isHighObese:    Bool { self == .obeseII || self == .morbidlyObese }
    }

    var bmiCategory: BMICategory {
        guard let bmi = bmiKgM2 else { return .unknown }
        switch bmi {
        case ..<16.0:    return .severelyUnderweight
        case 16..<18.5:  return .underweight
        case 18.5..<25:  return .normal
        case 25..<30:    return .overweight
        case 30..<35:    return .obeseI
        case 35..<40:    return .obeseII
        default:         return .morbidlyObese
        }
    }

    var chronicConditionCount: Int { pmh.count }

    // MARK: Helpers
    private func meds(anyOf targets: [String]) -> Bool {
        let lower = medicationNames.map { $0.lowercased() }
        return targets.contains { t in lower.contains { $0.contains(t) } }
    }
}

// MARK: - Engine

enum SurgicalRiskEngine {

    static func assess(_ inputs: SurgicalRiskInputs) -> [SurgicalRiskAlert] {
        var alerts: [SurgicalRiskAlert] = []
        infectRules(inputs, &alerts)
        healingRules(inputs, &alerts)
        frailtyRules(inputs, &alerts)
        nutritionRules(inputs, &alerts)
        periopRules(inputs, &alerts)
        anticoagRules(inputs, &alerts)
        anaestheticRules(inputs, &alerts)
        labRules(inputs, &alerts)
        // Highest band first, then alphabetical domain
        return alerts.sorted { $0.band == $1.band ? $0.domain.rawValue < $1.domain.rawValue : $0.band > $1.band }
    }

    // MARK: Lab-derived risk rules

    private static func labRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        guard let labs = i.labs else { return }

        // Anaemia — increases cardiac demand, impairs wound healing
        if let hb = labs.haemoglobin?.value {
            if hb < 8.0 {
                out.append(SurgicalRiskAlert(
                    domain: .healing, band: .critical,
                    title: "Severe anaemia — Hb \(String(format: "%.1f", hb)) g/dL",
                    detail: "Hb <8 g/dL significantly increases cardiac stress, impairs tissue oxygenation, and raises transfusion requirement perioperatively.",
                    action: "Transfuse to Hb ≥8 g/dL pre-op (or ≥10 g/dL for cardiac cases). Investigate cause. Consider IV iron if elective case. Delay non-urgent surgery."))
            } else if hb < 10.0 {
                out.append(SurgicalRiskAlert(
                    domain: .healing, band: .high,
                    title: "Anaemia — Hb \(String(format: "%.1f", hb)) g/dL",
                    detail: "Hb <10 g/dL elevates transfusion risk and slows wound healing.",
                    action: "IV iron if ferritin <30 µg/L and elective case ≥4 weeks away. Group & save. Anaesthetic review."))
            }
        }

        // Thrombocytopenia — bleeding risk
        if let plt = labs.platelets?.value {
            if plt < 50 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .critical,
                    title: "Severe thrombocytopenia — platelets \(Int(plt))×10⁹/L",
                    detail: "Platelet count <50 ×10⁹/L is associated with major surgical haemorrhage risk.",
                    action: "Haematology review before surgery. Platelet transfusion target ≥50 (≥100 for neurosurgery/eye). Investigate cause."))
            } else if plt < 100 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .high,
                    title: "Thrombocytopenia — platelets \(Int(plt))×10⁹/L",
                    detail: "Platelet count <100 ×10⁹/L increases intraoperative bleeding risk.",
                    action: "Haematology opinion. Aim platelets ≥80 before major surgery. Avoid NSAIDs."))
            }
        }

        // AKI / renal impairment
        if let cr = labs.creatinine?.value {
            if cr > 300 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .critical,
                    title: "Severe renal impairment — creatinine \(Int(cr)) µmol/L",
                    detail: "Creatinine >300 µmol/L — volume management, nephrotoxin avoidance, and HDU/nephrology input are essential.",
                    action: "Nephrology review. Avoid nephrotoxins (NSAIDs, aminoglycosides, contrast). Adjust drug dosing. Post-op hourly UO monitoring. HDU level care."))
            } else if cr > 150 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .moderate,
                    title: "Renal impairment — creatinine \(Int(cr)) µmol/L",
                    detail: "Elevated creatinine requires careful fluid management and avoidance of nephrotoxins perioperatively.",
                    action: "Avoid NSAIDs and nephrotoxic antibiotics. IV fluids with hourly UO monitoring. Consider nephrology input."))
            }
        }

        // Hypoalbuminaemia — nutritional risk and wound healing
        if let alb = labs.albumin?.value {
            if alb < 25 {
                out.append(SurgicalRiskAlert(
                    domain: .nutrition, band: .high,
                    title: "Hypoalbuminaemia — albumin \(String(format: "%.0f", alb)) g/L",
                    detail: "Albumin <25 g/L is a strong independent predictor of surgical complications, anastomotic leak, and poor wound healing.",
                    action: "Dietitian referral urgently. Nutritional support ≥7–14 days pre-op for elective cases. Consider NG/NJ feeding if oral intake insufficient. Repeat albumin after optimisation."))
            } else if alb < 35 {
                out.append(SurgicalRiskAlert(
                    domain: .nutrition, band: .moderate,
                    title: "Low albumin — \(String(format: "%.0f", alb)) g/L",
                    detail: "Albumin 25–35 g/L suggests nutritional compromise and raises risk of poor healing.",
                    action: "Dietitian referral. High-protein supplementation. Nutritional prehabilitation if elective case."))
            }
        }

        // Coagulopathy
        if let inr = labs.inr?.value, inr > 1.5 {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: inr > 2.5 ? .critical : .high,
                title: "Coagulopathy — INR \(String(format: "%.1f", inr))",
                detail: "INR \(inr > 2.5 ? ">" : "1.5–2.5") — increased surgical haemorrhage risk.",
                action: inr > 2.5 ?
                    "Vitamin K IV + FFP if urgent. Delay elective surgery until INR <1.5. Haematology review. Identify cause." :
                    "Review anticoagulation. Vitamin K if not therapeutically anticoagulated. Haematology input if unexplained."))
        }

        // Bilirubin — hepatic synthetic failure, jaundice-related surgical risk
        if let bil = labs.bilirubin?.value {
            if bil > 200 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .critical,
                    title: "Severe jaundice — bilirubin \(Int(bil)) µmol/L",
                    detail: "Bilirubin >200 µmol/L indicates severe hepatic dysfunction or biliary obstruction. Major operative mortality is substantially increased.",
                    action: "Hepatobiliary/HPB surgeon review. Child-Pugh/MELD-Na score. Correct coagulopathy. Biliary drainage (ERCP/PTC) before elective surgery if obstructive. Nephrology input — hepatorenal syndrome risk."))
            } else if bil > 50 {
                out.append(SurgicalRiskAlert(
                    domain: .periop, band: .moderate,
                    title: "Jaundice — bilirubin \(Int(bil)) µmol/L",
                    detail: "Bilirubin 50–200 µmol/L raises operative risk: impaired drug metabolism, coagulopathy risk, and wound healing compromise.",
                    action: "Identify cause (obstructive vs hepatocellular). LFTs, coag, albumin. Consider biliary decompression if obstructive. Anaesthetic review for major cases."))
            }
        }

        // Troponin — perioperative cardiac risk
        if let trop = labs.troponin?.value, trop > 14 {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: trop > 52 ? .critical : .high,
                title: "Troponin \(String(format: "%.0f", trop)) ng/L — Cardiac Risk",
                detail: trop > 52 ?
                    "Troponin >52 ng/L (MI threshold) — active myocardial injury. Elective surgery must be deferred. Emergency surgery requires intensive cardiac monitoring." :
                    "Troponin 14–52 ng/L (elevated but below MI threshold) — may indicate myocardial stress or NSTEMI. Risk-stratify before surgery.",
                action: trop > 52 ?
                    "Defer elective surgery. Cardiology review urgently. Serial ECG + troponin. Aspirin 300 mg if ACS confirmed. HDU post-op if surgery unavoidable." :
                    "Cardiology review. Serial ECG. Repeat troponin at 3 h. Risk-stratify with HEART or GRACE score before proceeding."))
        }

        // HbA1c — glycaemic control and surgical infection risk
        if let hba = labs.hba1c?.value, hba > 7.5 {
            out.append(SurgicalRiskAlert(
                domain: .infection, band: hba > 10.0 ? .high : .moderate,
                title: "HbA1c \(String(format: "%.1f", hba))% — Poor Glycaemic Control",
                detail: hba > 10.0 ?
                    "HbA1c >10%: very poor long-term control significantly increases SSI, anastomotic leak, and impaired wound healing risk." :
                    "HbA1c 7.5–10%: suboptimal control raises infection and healing risk perioperatively.",
                action: hba > 10.0 ?
                    "Delay elective surgery. Optimise glucose with endocrine review (VRIII, GLP-1 agonist, or insulin adjustment). Recheck HbA1c in 6–8 weeks. Target <8.5% before major elective surgery." :
                    "Extended antibiotic prophylaxis. Periop glucose monitoring. VRIII if NBM >1 meal. Endocrine review if T1DM or poorly controlled T2DM."))
        }

        // Sodium — electrolyte risk for anaesthesia
        if let na = labs.sodium?.value {
            if na < 125 || na > 155 {
                out.append(SurgicalRiskAlert(
                    domain: .anaesthetic, band: .critical,
                    title: "Sodium \(Int(na)) mmol/L — Critical Electrolyte Imbalance",
                    detail: na < 125 ?
                        "Severe hyponatraemia (<125 mmol/L) — cerebral oedema risk, seizures, and haemodynamic instability under general anaesthesia." :
                        "Severe hypernatraemia (>155 mmol/L) — CNS risk, increased mortality under GA.",
                    action: "Correct sodium at ≤8–10 mmol/L per 24 h (hyponatraemia) to avoid central pontine myelinolysis. Defer elective surgery. Anaesthetic review mandatory."))
            } else if na < 130 || na > 150 {
                out.append(SurgicalRiskAlert(
                    domain: .anaesthetic, band: .moderate,
                    title: "Sodium \(Int(na)) mmol/L — Electrolyte Abnormality",
                    detail: "Sodium outside 130–150 mmol/L range requires correction before elective surgery to reduce anaesthetic risk.",
                    action: "Identify and treat cause. Correct cautiously. Anaesthetic review if urgent surgery required."))
            }
        }

        // Potassium — arrhythmia risk under anaesthesia
        if let k = labs.potassium?.value {
            if k < 2.8 || k > 6.0 {
                out.append(SurgicalRiskAlert(
                    domain: .anaesthetic, band: .critical,
                    title: "Potassium \(String(format: "%.1f", k)) mmol/L — Critical",
                    detail: k < 2.8 ?
                        "Severe hypokalaemia (<2.8 mmol/L) — life-threatening arrhythmias under GA; prolonged QT, ventricular fibrillation risk." :
                        "Severe hyperkalaemia (>6.0 mmol/L) — cardiac arrest risk under anaesthesia.",
                    action: k < 2.8 ?
                        "IV potassium replacement (max 10 mmol/h peripheral, 20 mmol/h central). Continuous ECG. Defer elective surgery until K+ >3.0 mmol/L." :
                        // UKKA 2023 bands (web-last-gaps parity): nebulised salbutamol is an adjunct from 6.5 mmol/L only.
                        "Calcium gluconate IV if ECG changes (cardiac membrane stabilisation). Insulin/dextrose.\(k >= 6.5 ? " Salbutamol (adjunct, UKKA 2023)." : "") Urgent nephrology/medical review. Defer elective surgery."))
            } else if k < 3.2 || k > 5.5 {
                out.append(SurgicalRiskAlert(
                    domain: .anaesthetic, band: .moderate,
                    title: "Potassium \(String(format: "%.1f", k)) mmol/L — Electrolyte Abnormality",
                    detail: "Potassium outside 3.2–5.5 mmol/L range raises arrhythmia risk perioperatively.",
                    action: "Correct before elective surgery. Anaesthetic review. ECG monitoring."))
            }
        }

        // Glucose — perioperative glycaemic risk (objective value, not just DM history)
        if let glu = labs.glucose?.value {
            if glu > 14.0 {
                out.append(SurgicalRiskAlert(
                    domain: .infection, band: .high,
                    title: "Glucose \(String(format: "%.1f", glu)) mmol/L — Perioperative Hyperglycaemia",
                    detail: "Random glucose >14 mmol/L at assessment — significantly impairs neutrophil function and increases SSI, anastomotic leak, and healing complications.",
                    action: "VRIII insulin infusion if NBM or glucose persistently >12 mmol/L. Target 6–10 mmol/L. Endocrine/diabetes team input. Delay non-urgent surgery."))
            } else if glu > 10.0 {
                out.append(SurgicalRiskAlert(
                    domain: .infection, band: .moderate,
                    title: "Glucose \(String(format: "%.1f", glu)) mmol/L — Elevated",
                    detail: "Glucose 10–14 mmol/L — moderate hyperglycaemia increases infection risk perioperatively.",
                    action: "Optimise glucose perioperatively. Sliding scale if NBM. Target 6–10 mmol/L."))
            }
        }
    }

}
