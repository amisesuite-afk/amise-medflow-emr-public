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
        // Highest band first, then alphabetical domain
        return alerts.sorted { $0.band == $1.band ? $0.domain.rawValue < $1.domain.rawValue : $0.band > $1.band }
    }

    // MARK: Infection

    private static func infectRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        // Critical: DM + steroids + malnutrition — all three axes impaired
        if i.hasDM && i.hasSteroids && i.bmiCategory.isMalnourished {
            out.append(SurgicalRiskAlert(
                domain: .infection, band: .critical,
                title: "Critical infection risk",
                detail: "DM, corticosteroids, and malnutrition converge to abolish neutrophil function, cellular immunity, and barrier integrity.",
                action: "Optimise glucose periop (<10 mmol/L). Nutritional prehabilitation ≥7 days. Extended prophylaxis. Daily wound surveillance."))
            return
        }
        // High: DM + (steroids or immunocompromised)
        if i.hasDM && (i.hasSteroids || i.hasImmunocompromised) {
            out.append(SurgicalRiskAlert(
                domain: .infection, band: .high,
                title: "High infection risk — DM + immunosuppression",
                detail: "Hyperglycaemia impairs phagocytosis; combined with immunosuppression this markedly raises SSI risk.",
                action: "Periop glucose 6–10 mmol/L (VRIII if NBM >1 meal). Extended antibiotic prophylaxis per local protocol. Daily wound review."))
            return
        }
        // High: any immunocompromised state
        if i.hasImmunocompromised {
            out.append(SurgicalRiskAlert(
                domain: .infection, band: .high,
                title: "Immunocompromised — elevated infection risk",
                detail: "Malignancy, biologic therapy, or IBD immunosuppression significantly impairs surgical site infection response.",
                action: "Extended prophylaxis. If on biologics, MDT review re: optimal hold period pre-op. PCP prophylaxis if lymphopenic."))
            return
        }
        // Moderate: DM alone or RA (DMARD-dependent)
        if i.hasDM || i.hasRA {
            out.append(SurgicalRiskAlert(
                domain: .infection, band: .moderate,
                title: "Moderate infection risk",
                detail: i.hasDM
                    ? "Hyperglycaemia impairs neutrophil chemotaxis and oxidative burst, increasing SSI risk."
                    : "DMARDs and systemic inflammation in RA increase susceptibility to postoperative infection.",
                action: "Standard prophylaxis. Periop glucose monitoring. Wound inspection at 48 h and day 7."))
        }
    }

    // MARK: Healing

    private static func healingRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        var factors: [String] = []
        if i.hasDM              { factors.append("DM") }
        if i.hasSteroids        { factors.append("corticosteroids") }
        if i.bmiCategory.isMalnourished { factors.append("malnutrition") }
        if i.isSmoker           { factors.append("smoking") }
        if i.hasCKD             { factors.append("CKD") }
        if i.hasAnaemia         { factors.append("anaemia") }
        if i.hasRA              { factors.append("RA / DMARDs") }
        guard !factors.isEmpty else { return }

        let listStr = factors.joined(separator: ", ")
        let n = factors.count
        let isDMAndSteroids    = i.hasDM && i.hasSteroids
        let isDMAndMalnutrition = i.hasDM && i.bmiCategory.isMalnourished

        if n >= 3 || isDMAndSteroids || isDMAndMalnutrition {
            out.append(SurgicalRiskAlert(
                domain: .healing, band: .high,
                title: "High wound healing risk (\(n) factors)",
                detail: "Multiple factors impair collagen synthesis, angiogenesis, and epithelialisation: \(listStr).",
                action: "Nutritional optimisation pre-op. Strict glucose control. Smoking cessation ≥4 weeks. Consider delayed primary closure or vacuum-assisted closure for high-risk wounds."))
        } else if n == 2 {
            out.append(SurgicalRiskAlert(
                domain: .healing, band: .moderate,
                title: "Moderate healing risk (\(n) factors)",
                detail: "Impaired wound healing factors: \(listStr).",
                action: "Pre-op optimisation of modifiable factors. Smoking cessation strongly recommended."))
        } else {
            out.append(SurgicalRiskAlert(
                domain: .healing, band: .advisory,
                title: "Healing risk — advisory",
                detail: "Factor present: \(listStr).",
                action: i.isSmoker
                    ? "Smoking cessation ≥4 weeks pre-op reduces SSI risk ~50%."
                    : "Monitor wound closely post-operatively."))
        }
    }

    // MARK: Frailty

    private static func frailtyRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        let age     = i.ageYears
        let chronic = i.chronicConditionCount
        let isolated = i.livesAlone || i.isCareHome
        let sedentary = i.isSedentary || isolated

        if age >= 80 || (age >= 75 && chronic >= 4) || (age >= 70 && chronic >= 5 && isolated) {
            out.append(SurgicalRiskAlert(
                domain: .frailty, band: .high,
                title: "High frailty risk",
                detail: "Age \(age), \(chronic) chronic conditions\(isolated ? ", social isolation" : ""). Clinical Frailty Scale (CFS) assessment required before elective surgery.",
                action: "Comprehensive Geriatric Assessment. SORT score calculation. Discuss operative vs conservative options with patient and family. Shared decision-making documentation."))
        } else if age >= 70 && (chronic >= 3 || isolated) {
            out.append(SurgicalRiskAlert(
                domain: .frailty, band: .moderate,
                title: "Moderate frailty risk",
                detail: "Age \(age) with \(chronic) chronic conditions\(isolated ? " and social isolation" : ""). Pre-operative functional assessment warranted.",
                action: "Timed Up and Go test. Grip strength or 4-metre walk if available. Nutritional screen (MUST). Anaesthetic pre-assessment."))
        } else if age >= 65 && (chronic >= 3 || sedentary) {
            out.append(SurgicalRiskAlert(
                domain: .frailty, band: .advisory,
                title: "Frailty — advisory",
                detail: "Age \(age) with \(chronic) comorbidities\(sedentary ? " and sedentary lifestyle" : ""). Baseline functional status should be documented.",
                action: "Document ADLs and exercise tolerance. Note any recent unintentional weight loss or falls in history."))
        }
    }

    // MARK: Nutrition / BMI

    private static func nutritionRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        switch i.bmiCategory {
        case .severelyUnderweight:
            out.append(SurgicalRiskAlert(
                domain: .nutrition, band: .critical,
                title: "Severe malnutrition (BMI <16)",
                detail: "Severe protein-energy malnutrition substantially increases postoperative mortality, anastomotic leak, and wound breakdown.",
                action: "Urgent dietitian referral. Minimum 7–14 days nutritional prehabilitation before elective surgery. Albumin + prealbumin. Consider NG/NJ feeding if oral intake insufficient."))
        case .underweight:
            out.append(SurgicalRiskAlert(
                domain: .nutrition, band: .high,
                title: "Underweight — malnutrition risk (BMI <18.5)",
                detail: "Reduced immune function, impaired wound tensile strength, and increased length of stay.",
                action: "MUST screening score. Dietary supplements or NG if MUST ≥2. Delay elective surgery if nutritional optimisation is feasible."))
        case .morbidlyObese:
            out.append(SurgicalRiskAlert(
                domain: .nutrition, band: .high,
                title: "Morbid obesity (BMI ≥40)",
                detail: "Increases operative difficulty, DVT/PE risk, respiratory compromise, wound complications, and anaesthetic complexity.",
                action: "Mandatory anaesthetic pre-assessment. Weight-adjusted LMWH for VTE prophylaxis. Consider bariatric pre-op pathway for elective surgery. Surgical instruments and retractors."))
        case .obeseII:
            out.append(SurgicalRiskAlert(
                domain: .nutrition, band: .moderate,
                title: "Obese class II (BMI 35–40)",
                detail: "Elevated SSI, VTE, and pulmonary complication risk. Altered tissue planes.",
                action: "Weight-adjusted DVT prophylaxis. Lung recruitment protocol post-op. Document BMI in operative note."))
        case .obeseI:
            out.append(SurgicalRiskAlert(
                domain: .nutrition, band: .advisory,
                title: "Obese class I (BMI 30–35)",
                detail: "Modest increase in SSI and VTE risk.",
                action: "Standard VTE prophylaxis. Document in operative note."))
        default:
            break
        }
    }

    // MARK: Perioperative / metabolic

    private static func periopRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        // Steroid stress-dose — HPA axis suppression
        if i.hasSteroids {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: .high,
                title: "Steroid-dependent — adrenal stress-dose required",
                detail: "Chronic corticosteroids suppress the HPA axis. Surgery without cortisol cover risks Addisonian crisis (refractory hypotension, cardiovascular collapse).",
                action: "Hydrocortisone IV at induction: 25 mg (minor), 50 mg (moderate), 100 mg (major surgery) + 6-hourly for 24–48 h. Do not omit morning oral steroid dose."))
        }

        // Diabetic perioperative glucose management
        if i.hasDM {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: .moderate,
                title: "Diabetic perioperative glucose protocol",
                detail: "Perioperative hyperglycaemia (>10 mmol/L) independently increases SSI, anastomotic dehiscence, and 30-day mortality.",
                action: "VRIII if NBM >1 meal or T1DM. Hold metformin 24–48 h pre-op if major surgery or contrast. Target glucose 6–10 mmol/L intraoperatively. Endocrine review for T1DM."))
        }

        // Liver disease — Child-Pugh / MELD
        if i.hasLiver {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: .high,
                title: "Liver disease — high operative risk",
                detail: "Cirrhosis impairs coagulation (clotting factors, platelet function), drug metabolism, wound healing, and immune defence.",
                action: "LFTs, INR, albumin, bilirubin, platelet count. Child-Pugh and MELD-Na scores. Hepatology review for major cases. Avoid hepatotoxic drugs and nephrotoxic analgesics."))
        }

        // CKD
        if i.hasCKD {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: .moderate,
                title: "CKD — drug dosing and contrast caution",
                detail: "Reduced renal clearance alters pharmacokinetics of antibiotics, analgesics, and contrast agents. Hyperkalaemia and fluid overload risk.",
                action: "eGFR-adjusted drug dosing. Avoid NSAIDs. IV hydration pre- and post-contrast. U&E morning of surgery. Nephrology input if eGFR <30."))
        }

        // Epilepsy — antiepileptic interactions
        if i.hasEpilepsy {
            out.append(SurgicalRiskAlert(
                domain: .periop, band: .advisory,
                title: "Epilepsy — antiepileptic continuity",
                detail: "Missed antiepileptic doses perioperatively risk breakthrough seizures. Many antiepileptics interact with anaesthetic agents.",
                action: "Administer antiepileptics on the morning of surgery with a sip of water. IV equivalents available for those who cannot swallow. Inform anaesthetist."))
        }
    }

    // MARK: Anticoagulation

    private static func anticoagRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        if i.hasAnticoag {
            let detail = "Patient is on therapeutic anticoagulation. Interruption carries thrombotic risk; continuation carries bleeding risk. Requires formal perioperative anticoagulation plan."
            out.append(SurgicalRiskAlert(
                domain: .anticoag, band: .high,
                title: "Anticoagulation — bridging assessment required",
                detail: detail,
                action: "CHA₂DS₂-VASc for AF. Warfarin: target INR <1.5 for surgery; LMWH bridging per haematology. DOAC: apixaban/rivaroxaban hold 24–48 h; dabigatran by CrCl (48–96 h). Check thrombotic risk before deciding to bridge."))
        } else if i.hasDVTPE || i.hasAF || i.hasStroke {
            out.append(SurgicalRiskAlert(
                domain: .anticoag, band: .moderate,
                title: "Thromboembolic history — perioperative plan needed",
                detail: "History of DVT/PE, AF, or stroke increases thrombotic risk if anticoagulation is withheld or if prophylaxis is inadequate.",
                action: "Document current anticoagulation status. Confirm prophylactic LMWH dose and timing. Extended VTE prophylaxis post-op (28 days for major abdominal/pelvic cancer surgery)."))
        }
        if i.hasAntiplatelet && i.hasAnticoag {
            out.append(SurgicalRiskAlert(
                domain: .anticoag, band: .high,
                title: "Dual antiplatelet + anticoagulation",
                detail: "Concurrent antiplatelet and anticoagulant therapy carries very high bleeding risk perioperatively.",
                action: "Haematology / cardiology input mandatory. Do not stop antiplatelet within 12 months of coronary stent without cardiology review."))
        }
    }

    // MARK: Anaesthetic

    private static func anaestheticRules(_ i: SurgicalRiskInputs, _ out: inout [SurgicalRiskAlert]) {
        // OSA + obesity — highest airway/respiratory risk combination
        if i.hasOSA && i.bmiCategory.isHighObese {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .high,
                title: "OSA + significant obesity — high anaesthetic risk",
                detail: "This combination markedly increases difficult airway, peri-extubation desaturation, and CPAP dependency risk.",
                action: "Mandatory anaesthetic pre-assessment. CPAP availability in recovery room. Awake fibreoptic intubation if Mallampati 3–4. Opioid-sparing technique. HDU post-op if major surgery."))
        } else if i.hasOSA {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .moderate,
                title: "OSA — anaesthetic alert",
                detail: "OSA increases peri-extubation desaturation, respiratory depression with opioids, and CPAP dependency in recovery.",
                action: "Confirm CPAP adherence and bring machine to hospital. CPAP in recovery. Opioid-sparing anaesthetic (regional where possible)."))
        }

        // Cardiac
        if i.hasCardiac {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .moderate,
                title: "Cardiac disease — anaesthetic complexity",
                detail: "IHD or heart failure increases perioperative MI, arrhythmia, and haemodynamic instability risk.",
                action: "ECG and echo if not performed in past 12 months. Cardiology clearance for intermediate-high risk surgery. Goal-directed fluid therapy. Avoid hypotension."))
        }

        // COPD / Asthma
        if i.hasCOPD || (i.hasAsthma && i.isHeavySmoker) {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .moderate,
                title: "Obstructive airway disease — respiratory risk",
                detail: "COPD or poorly controlled asthma increases postoperative pulmonary complications, prolonged ventilation, and ICU admission.",
                action: "Optimise bronchodilators. Peak flow or spirometry. Chest physiotherapy pre-op if FEV1 <50%. Avoid airway irritation at intubation (use bronchodilator premedication)."))
        }

        // Heavy smoking
        if i.isHeavySmoker {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .advisory,
                title: "Heavy smoker — respiratory risk",
                detail: "Heavy smoking increases airway reactivity, secretions, laryngospasm, and postoperative pulmonary complications.",
                action: "Smoking cessation ≥4 weeks pre-op (reduces pulmonary complications ~50%). Chest physio referral if COPD. Incentive spirometry post-op."))
        }

        // Heavy alcohol
        if i.isHeavyDrinker {
            out.append(SurgicalRiskAlert(
                domain: .anaesthetic, band: .moderate,
                title: "Heavy alcohol use — perioperative risk",
                detail: "Increased anaesthetic drug tolerance, hepatic dysfunction, coagulopathy, and alcohol withdrawal risk (onset 6–72 h post-admission).",
                action: "AUDIT-C score. LFTs + clotting screen. Thiamine 100 mg IV pre-op prophylaxis. Withdrawal protocol if inpatient (CIWA-Ar scale). Inform anaesthetist."))
        }
    }
}
