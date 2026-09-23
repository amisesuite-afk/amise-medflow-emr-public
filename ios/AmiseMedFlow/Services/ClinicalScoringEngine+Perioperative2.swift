// ClinicalScoringEngine+Perioperative2.swift
// NRS-2002, Clavien-Dindo Classification, Modified Aldrete Recovery Score, ECOG/WHO Performance Status
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - NRS-2002 (Nutritional Risk Screening 2002)

    static func nrs2002(_ i: NRS2002Input) -> ClinicalScore {
        let total = i.nutritionalStatus + i.diseaseSeverity + (i.ageOver70 ? 1 : 0)
        let (risk, interp, recs, flags) = nrs2002Risk(total)
        let nsLabels = ["0 — Normal nutritional status",
                        "1 — Mild: weight loss 5–10% in 3 months, or intake 50–75% of requirement",
                        "2 — Moderate: weight loss 5% in 2 months, or BMI 18.5–20.5 with impaired general condition, or intake 25–60%",
                        "3 — Severe: weight loss >5% in 1 month / >15% in 3 months, BMI <18.5, or intake <25%"]
        let dsLabels = ["0 — No disease",
                        "1 — Minor stress: hip fracture, chronic disease with complications, chemotherapy",
                        "2 — Moderate stress: major abdominal surgery, stroke, haematological malignancy, ICU APACHE <10",
                        "3 — Severe stress: head injury, bone marrow transplant, ICU APACHE ≥10"]
        var items: [ScoredItem] = []
        items.append(ScoredItem(
            label: i.nutritionalStatus < nsLabels.count ? nsLabels[i.nutritionalStatus] : "Nutritional status \(i.nutritionalStatus)",
            points: Double(i.nutritionalStatus), present: i.nutritionalStatus > 0))
        items.append(ScoredItem(
            label: i.diseaseSeverity < dsLabels.count ? dsLabels[i.diseaseSeverity] : "Disease severity \(i.diseaseSeverity)",
            points: Double(i.diseaseSeverity), present: i.diseaseSeverity > 0))
        items.append(ScoredItem(label: "Age ≥70 years", points: 1, present: i.ageOver70))
        return ClinicalScore(
            systemName: "NRS-2002",
            abbreviation: "NRS \(total)",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Kondrup J et al. Clin Nutr 2003; 22:415–421. Validated in 128 RCTs."
        )
    }

    private static func nrs2002Risk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        if s < 3 {
            return (.low, "Not at nutritional risk (score \(s))",
                    ["Routine dietary intake; re-screen weekly if inpatient",
                     "Document baseline weight and BMI",
                     "Re-screen if clinical condition deteriorates"],
                    [])
        } else if s < 5 {
            return (.moderate, "Nutritional risk (score \(s)) — intervention indicated",
                    ["Refer to dietitian for formal nutritional assessment within 24–48 h",
                     "Set individualised nutritional goals (25–35 kcal/kg/day; 1.2–1.5 g protein/kg/day)",
                     "Oral nutritional supplements or enhanced catering as first-line",
                     "Consider enteral nutrition if oral intake insufficient",
                     "Monitor weight, biochemistry (electrolytes, albumin, pre-albumin) regularly"],
                    [])
        } else {
            return (.high, "High nutritional risk (score \(s)) — urgent intervention",
                    ["Immediate dietitian review",
                     "Initiate nutritional support within 24 h; enteral route preferred",
                     "Parenteral nutrition only if enteral route is not feasible",
                     "Monitor for refeeding syndrome: check and correct phosphate, potassium, magnesium",
                     "Weekly formal reassessment; optimise pre-operatively if elective surgery planned"],
                    ["NRS-2002 ≥5 — high risk of peri-operative complications; discuss with nutrition team before surgery"])
        }
    }

    private static func ctsiRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case ..<4:
            return (.low, "Mild — CTSI \(s): low complication risk",
                    ["Supportive management; CT surveillance not routinely required",
                     "Oral nutrition as tolerated",
                     "Monitor for clinical deterioration"],
                    [])
        case 4..<7:
            return (.moderate, "Moderate — CTSI \(s): ~30–50% complication rate",
                    ["HDU monitoring; NPO + IV fluids",
                     "Repeat CT at 48–72 h if not improving clinically",
                     "Surgical / HPB team review",
                     "Consider percutaneous drainage if fluid collection enlarges"],
                    [])
        default:
            return (.critical, "Severe — CTSI \(s): ~50–90% complication rate",
                    ["ICU-level care",
                     "Multi-disciplinary HPB / intensive-care team",
                     "Percutaneous or endoscopic drainage of necrotic collections",
                     "Delayed surgical debridement (step-up approach preferred)",
                     "Parenteral or jejunal nutrition support"],
                    ["CTSI ≥7 — predicted mortality 17%+ and complication rate >50%"])
        }
    }

    // MARK: - Clavien-Dindo Classification (Surgical Complication Grading)

    struct ClavienDindoInput: Equatable {
        // 0=None, 1=Grade I, 2=Grade II, 3=Grade IIIa, 4=Grade IIIb,
        // 5=Grade IVa, 6=Grade IVb, 7=Grade V
        var grade: Int = 0
    }

    static func clavienDindo(_ i: ClavienDindoInput) -> ClinicalScore {
        let gradeStrings = ["None", "I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"]
        let gradeStr = i.grade < gradeStrings.count ? gradeStrings[i.grade] : "?"
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var flags: [String] = []

        switch i.grade {
        case 0:
            risk = .low
            interpretation = "No complication — uneventful postoperative course"
        case 1:
            risk = .low
            interpretation = "Grade I — Minor deviation; bedside management only"
            recs = ["Antiemetics, antipyretics, analgesia, diuretics, or electrolytes as needed",
                    "Physiotherapy permitted",
                    "Wound drainage at bedside is included in this grade"]
        case 2:
            risk = .moderate
            interpretation = "Grade II — Pharmacological treatment beyond Grade I allowances"
            recs = ["Blood transfusion or total parenteral nutrition if indicated",
                    "Antimicrobials for organ-space infection",
                    "Document drug name, dose, and indication"]
            flags = ["Complication requiring drug therapy beyond simple analgesia/antiemetic"]
        case 3:
            risk = .high
            interpretation = "Grade IIIa — Surgical/endoscopic/radiological intervention; no general anaesthesia"
            recs = ["Proceed to indicated intervention under local/regional anaesthesia",
                    "Obtain informed consent; document indication and technique",
                    "Radiological drainage, bedside washout, or flexible endoscopy as appropriate"]
            flags = ["Procedural intervention required (no GA)"]
        case 4:
            risk = .high
            interpretation = "Grade IIIb — Surgical/endoscopic/radiological intervention; general anaesthesia"
            recs = ["Return to theatre or interventional suite under GA",
                    "Anaesthetic review and pre-operative optimisation",
                    "Inform next of kin; consent for return to theatre"]
            flags = ["Return to theatre required — GA", "Anaesthetic review needed"]
        case 5:
            risk = .critical
            interpretation = "Grade IVa — Life-threatening complication; single organ dysfunction"
            recs = ["Immediate ICU admission",
                    "Single organ support (e.g. renal replacement, mechanical ventilation)",
                    "Senior surgeon and intensivist co-management",
                    "Daily MDT review; family meeting within 24 h"]
            flags = ["Life-threatening — ICU required", "Single organ failure"]
        case 6:
            risk = .critical
            interpretation = "Grade IVb — Life-threatening complication; multiorgan dysfunction"
            recs = ["Immediate ICU admission with multiorgan support",
                    "Senior surgeon, intensivist, and relevant specialist co-management",
                    "Consider goals-of-care discussion with family",
                    "Daily MDT review; detailed documentation of trajectory"]
            flags = ["Life-threatening — ICU required", "Multiorgan failure", "Consider goals-of-care discussion"]
        default:
            risk = .critical
            interpretation = "Grade V — Death"
            recs = ["Complete incident documentation and mortality review",
                    "M&M case registration",
                    "Coroner notification per local jurisdiction if required"]
            flags = ["Fatal complication — mortality review mandatory"]
        }

        return ClinicalScore(
            systemName: "Clavien-Dindo Classification",
            abbreviation: "Clavien-Dindo \(gradeStr)",
            score: Double(i.grade), maxScore: 7,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [ScoredItem(label: "Complication grade: \(gradeStr)", points: Double(i.grade), present: i.grade > 0)],
            redFlags: flags,
            evidenceNote: "Dindo D, Demartines N, Clavien PA. Ann Surg 2004;240:205–213. Dindo D et al. World J Surg 2010. Standard surgical complication classification used in ACS NSQIP and ESCP audits."
        )
    }

    // MARK: - Modified Aldrete Recovery Score (PACU Discharge Readiness)

    struct AldreteInput: Equatable {
        var activity: Int = 0       // 0=No movement; 1=Moves 2 limbs; 2=Moves all limbs
        var respiration: Int = 0    // 0=Apnoeic; 1=Dyspnoea/shallow; 2=Deep/coughs freely
        var circulation: Int = 0    // 0=BP >±50 mmHg pre-op; 1=±20–50 mmHg; 2=±20 mmHg
        var consciousness: Int = 0  // 0=Unresponsive; 1=Arousable on calling; 2=Fully awake
        var oxygenSat: Int = 0      // 0=<90% on O₂; 1=Needs O₂ to maintain ≥90%; 2=≥92% RA
    }

    static func aldrete(_ i: AldreteInput) -> ClinicalScore {
        let total = i.activity + i.respiration + i.circulation + i.consciousness + i.oxygenSat
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String] = []

        switch total {
        case 9...10:
            risk = .low
            interpretation = "Score \(total)/10 — Fit for discharge from PACU"
            recs = ["Transfer to ward when pain and nausea controlled",
                    "Confirm vital signs stable ≥15 min before transfer",
                    "Hand over written PACU summary to ward nurse"]
        case 7..<9:
            risk = .moderate
            interpretation = "Score \(total)/10 — Continued PACU observation; reassess in 30 min"
            recs = ["Identify and address limiting parameters",
                    "Oxygen supplementation if SpO₂ <92% on air",
                    "Anti-emetics and analgesia as required",
                    "Anaesthetist review if score not improving at 60 min"]
        default:
            risk = .high
            interpretation = "Score \(total)/10 — Not fit for transfer; active management required"
            recs = ["Ongoing PACU monitoring with anaesthetist review",
                    "Active management of circulatory, respiratory, or neurological deficiencies",
                    "Consider ICU/HDU referral if score ≤4 or not improving"]
            if i.circulation == 0 { flags.append("Haemodynamic instability — BP >50 mmHg from baseline") }
            if i.respiration == 0 { flags.append("Apnoea — airway management required") }
            if i.consciousness == 0 { flags.append("Unresponsive — anaesthetic review urgent") }
            if i.oxygenSat == 0    { flags.append("Hypoxaemia on supplemental O₂") }
        }

        return ClinicalScore(
            systemName: "Modified Aldrete Recovery Score",
            abbreviation: "Aldrete \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Activity",          points: Double(i.activity),      present: i.activity > 0),
                ScoredItem(label: "Respiration",       points: Double(i.respiration),   present: i.respiration > 0),
                ScoredItem(label: "Circulation",       points: Double(i.circulation),   present: i.circulation > 0),
                ScoredItem(label: "Consciousness",     points: Double(i.consciousness), present: i.consciousness > 0),
                ScoredItem(label: "Oxygen saturation", points: Double(i.oxygenSat),     present: i.oxygenSat > 0)
            ],
            redFlags: flags,
            evidenceNote: "Aldrete JA, Kroulik D. Anesth Analg 1970;49:924–934. Aldrete JA. J Clin Anesth 1995;7:89–91 (modified). Score ≥9/10 = fit for PACU discharge."
        )
    }

    // MARK: - ECOG / WHO Performance Status
    struct ECOGInput: Equatable {
        var grade: Int = 0   // 0=fully active; 1=restricted; 2=ambulatory/self-care; 3=limited; 4=bedbound
    }

    static func ecog(_ i: ECOGInput) -> ClinicalScore {
        let g = min(max(i.grade, 0), 4)
        let (risk, desc): (ScoreRisk, String)
        switch g {
        case 0: (risk, desc) = (.low,      "ECOG 0 — Fully active. No restriction on pre-illness activities. Fit for all treatment modalities.")
        case 1: (risk, desc) = (.low,      "ECOG 1 — Restricted in strenuous activity; ambulatory and capable of light work. Fit for most therapies.")
        case 2: (risk, desc) = (.moderate, "ECOG 2 — Ambulatory; capable of all self-care but unable to work. Up >50% of waking hours. Reduced tolerance for aggressive therapy.")
        case 3: (risk, desc) = (.high,     "ECOG 3 — Limited self-care. Confined to bed or chair >50% of waking hours. Palliative intent typically favoured.")
        default:(risk, desc) = (.high,     "ECOG 4 — Completely disabled. No self-care. Entirely confined to bed or chair. Surgery extremely high-risk.")
        }
        let flags: [String] = g >= 3 ? ["ECOG ≥3: major elective surgery carries prohibitive risk — multidisciplinary team discussion essential"] :
                              g >= 2 ? ["ECOG 2: reduced surgical fitness — optimise before elective procedures"] : []
        return ClinicalScore(
            systemName: "ECOG Performance Status",
            abbreviation: "ECOG \(g)",
            score: Double(g),
            maxScore: 4,
            risk: risk,
            interpretation: desc,
            recommendations: g >= 3 ? [
                "Multidisciplinary team discussion before any elective surgery",
                "Palliative intent should be considered as primary management approach",
                "Nutritional support and rehabilitation assessment recommended"
            ] : g >= 2 ? [
                "Anaesthetic pre-assessment and cardiopulmonary exercise testing (CPET) if surgery planned",
                "Pre-operative optimisation: nutrition, physiotherapy, anaemia treatment",
                "Consider less invasive surgical approaches (laparoscopic, endoscopic)"
            ] : [
                "Standard pre-operative assessment",
                "Document baseline functional status in surgical consent documentation"
            ],
            items: [ScoredItem(label: "Performance grade \(g)", points: Double(g), present: true)],
            redFlags: flags,
            evidenceNote: "Oken MM et al. Am J Clin Oncol 1982;5:649–655. WHO/Eastern Cooperative Oncology Group. Standard metric for functional reserve in oncology and surgical fitness."
        )
    }

}
