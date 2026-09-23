// ClinicalScoringEngine+Hepatic.swift
// Hepatic / Liver disease scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: Child-Pugh Score (Liver / Cirrhosis)

    static func childPugh(_ i: ChildPughInput) -> ClinicalScore {
        // Bilirubin (μmol/L)
        let bilPts: Double
        if i.bilirubinUmolL < 34 { bilPts = 1 }
        else if i.bilirubinUmolL <= 51 { bilPts = 2 }
        else { bilPts = 3 }

        // Albumin (g/dL)
        let albPts: Double
        if i.albuminGdL > 3.5 { albPts = 1 }
        else if i.albuminGdL >= 2.8 { albPts = 2 }
        else { albPts = 3 }

        // PT/INR
        let inrPts: Double
        if i.ptINR < 1.7 { inrPts = 1 }
        else if i.ptINR <= 2.3 { inrPts = 2 }
        else { inrPts = 3 }

        let score = Double(i.ascites.rawValue + i.encephalopathy.rawValue) + bilPts + albPts + inrPts

        let (classLabel, risk, mortality1yr, mortality2yr) = childPughClass(score)

        var recs: [String] = []
        var redFlags: [String] = []
        switch classLabel {
        case "A":
            recs = ["Well-compensated cirrhosis", "6-monthly surveillance: AFP + USS",
                    "Variceal surveillance OGD every 2–3 years", "Avoid NSAIDs and nephrotoxins",
                    "Nutritional optimisation before elective surgery"]
        case "B":
            recs = ["Decompensated cirrhosis — assess for liver transplant",
                    "OGD for variceal band ligation if not done within 1 year",
                    "Spironolactone + furosemide for ascites management",
                    "Avoid elective surgery if score ≥8; high perioperative mortality",
                    "Hepatology input mandatory before any operation"]
            redFlags = ["Child-Pugh B — surgical mortality 30–40% for major surgery"]
        default:
            recs = ["Severe decompensation — urgent hepatology / transplant referral",
                    "Treat precipitating factor (SBP, GI bleed, sepsis, drugs)",
                    "Avoid all elective surgery (mortality >80%)",
                    "Lactulose ± rifaximin for encephalopathy",
                    "Monitor for hepatorenal syndrome"]
            redFlags = ["Child-Pugh C — surgical mortality >80%; surgery contraindicated unless life-saving"]
        }

        let items: [ScoredItem] = [
            .init(label: "Bilirubin: \(Int(i.bilirubinUmolL)) μmol/L", points: bilPts, present: true),
            .init(label: "Albumin: \(String(format: "%.1f", i.albuminGdL)) g/dL", points: albPts, present: true),
            .init(label: "PT INR: \(String(format: "%.1f", i.ptINR))", points: inrPts, present: true),
            .init(label: "Ascites: \(ascitesLabel(i.ascites))", points: Double(i.ascites.rawValue), present: true),
            .init(label: "Encephalopathy: \(encephLabel(i.encephalopathy))", points: Double(i.encephalopathy.rawValue), present: true),
        ]

        return ClinicalScore(
            systemName: "Child-Pugh Score",
            abbreviation: "Child-Pugh \(classLabel)",
            score: score, maxScore: 15,
            risk: risk,
            interpretation: "Child-Pugh Class \(classLabel) (score \(Int(score))/15) — 1-year mortality ~\(mortality1yr)%, 2-year ~\(mortality2yr)%",
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Child 1964, Pugh 1973. Class A: 5–6; B: 7–9; C: 10–15. Used for surgical risk in liver disease."
        )
    }

    private static func childPughClass(_ s: Double) -> (String, ScoreRisk, Int, Int) {
        if s <= 6 { return ("A", .low, 15, 21) }
        if s <= 9 { return ("B", .high, 40, 60) }
        return ("C", .critical, 72, 82)
    }

    private static func ascitesLabel(_ a: ChildPughInput.AscitesGrade) -> String {
        switch a { case .none: "None"; case .controlled: "Controlled"; case .refractory: "Refractory" }
    }
    private static func encephLabel(_ e: ChildPughInput.EncephalopathyGrade) -> String {
        switch e { case .none: "None"; case .grade1to2: "Grade 1–2"; case .grade3to4: "Grade 3–4" }
    }

    // MARK: MELD Score (MELD-Na)

    static func meld(_ i: MELDInput) -> ClinicalScore {
        let cr = i.onDialysis ? 4.0 : min(i.creatinineMgDL, 4.0)
        let bili = max(i.bilirubinMgDL, 1.0)
        let inr = max(i.inrValue, 1.0)
        let rawMELD = 3.78 * log(bili) + 11.2 * log(inr) + 9.57 * log(cr) + 6.43
        let meldScore = max(6.0, rawMELD)
        // MELD-Na correction
        let na = max(125.0, min(i.sodiumMmolL, 137.0))
        let meldNa = meldScore + 1.32 * (137 - na) - (0.033 * meldScore * (137 - na))
        let finalScore = max(meldScore, meldNa)

        let items: [ScoredItem] = [
            .init(label: "Bilirubin \(String(format: "%.1f", i.bilirubinMgDL)) mg/dL", points: 3.78 * log(bili), present: i.bilirubinMgDL > 1),
            .init(label: "INR \(String(format: "%.2f", i.inrValue))", points: 11.2 * log(inr), present: i.inrValue > 1),
            .init(label: "Creatinine \(String(format: "%.1f", cr)) mg/dL\(i.onDialysis ? " (dialysis)" : "")", points: 9.57 * log(cr), present: cr > 1),
            .init(label: "Sodium \(Int(i.sodiumMmolL)) mmol/L (MELD-Na adjustment)", points: meldNa - meldScore, present: i.sodiumMmolL < 137),
        ]
        let (risk, interp, recs) = meldRisk(finalScore)
        let redFlags: [String] = finalScore >= 20 ? ["MELD ≥20: discuss liver transplant listing with hepatology"] : []
        return ClinicalScore(
            systemName: "MELD-Na Score",
            abbreviation: "MELD-Na \(Int(finalScore.rounded()))",
            score: finalScore.rounded(), maxScore: 40,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Kamath 2001, Kim 2008 (MELD-Na). 90-day transplant waiting list mortality. Used for surgical risk in cirrhosis."
        )
    }

    private static func meldRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case ..<10: return (.low, "MELD-Na \(Int(s.rounded())): 90-day mortality ~1.9%", ["Elective surgery generally safe with optimisation", "Standard anaesthetic risk", "Monitor LFTs post-op"])
        case 10..<20: return (.moderate, "MELD-Na \(Int(s.rounded())): 90-day mortality ~6%", ["Hepatology input pre-operatively", "Optimise nutrition, coagulopathy, renal function", "Avoid hepatotoxic drugs", "Post-op HDU consideration"])
        case 20..<25: return (.high, "MELD-Na \(Int(s.rounded())): 90-day mortality ~20–25%", ["High surgical risk — consider non-operative management if possible", "Hepatology + transplant surgery review", "ICU post-op planning", "Detailed consent with documented mortality risk"])
        default:     return (.critical, "MELD-Na \(Int(s.rounded())): 90-day mortality >50%", ["Surgery contraindicated unless life-saving", "Transplant evaluation urgently", "Palliative care discussion if appropriate", "ICU-level perioperative support required"])
        }
    }

    // MARK: - FIB-4 (Liver Fibrosis Index)

    static func fib4(_ i: FIB4Input) -> ClinicalScore {
        guard i.platelet10_9L > 0, i.altIUL > 0 else {
            return ClinicalScore(
                systemName: "FIB-4 Liver Fibrosis Index", abbreviation: "FIB-4 —",
                score: 0, maxScore: 10, risk: .low,
                interpretation: "Incomplete — platelet count and ALT required",
                recommendations: ["Enter platelet count (×10⁹/L) and ALT (IU/L) to calculate"],
                items: [], redFlags: [],
                evidenceNote: "Sterling RK et al, Hepatology 2006."
            )
        }
        let fib4Val = Double(i.age) * i.astIUL / (i.platelet10_9L * sqrt(i.altIUL))
        let items: [ScoredItem] = [
            ScoredItem(label: "Age (years)", points: Double(i.age), present: true),
            ScoredItem(label: "AST (IU/L)", points: i.astIUL, present: true),
            ScoredItem(label: "Platelets (×10⁹/L)", points: i.platelet10_9L, present: true),
            ScoredItem(label: "ALT (IU/L)", points: i.altIUL, present: true)
        ]
        let (risk, interpretation, recs, redFlags) = fib4Risk(fib4Val)
        return ClinicalScore(
            systemName: "FIB-4 Liver Fibrosis Index",
            abbreviation: String(format: "FIB-4 %.2f", fib4Val),
            score: fib4Val, maxScore: 10,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Sterling RK et al, Hepatology 2006; EASL 2021. (Age × AST) ÷ (Platelets × √ALT). <1.30: F0–F1, 90% NPV; 1.30–2.67: indeterminate; >2.67: F2–F4, 80% PPV."
        )
    }

    private static func fib4Risk(_ f: Double) -> (ScoreRisk, String, [String], [String]) {
        switch f {
        case ..<1.30:
            return (.low,
                    String(format: "FIB-4 %.2f — low fibrosis risk; F0–F1 likely (NPV ~90%%)", f),
                    ["No advanced fibrosis expected — routine follow-up",
                     "Repeat FIB-4 annually if metabolic risk factors present",
                     "Lifestyle: reduce alcohol, achieve target weight, treat metabolic syndrome"],
                    [])
        case 1.30...2.67:
            return (.moderate,
                    String(format: "FIB-4 %.2f — indeterminate; further assessment recommended", f),
                    ["Liver elastography (FibroScan) for definitive staging",
                     "Hepatology referral if viral hepatitis, alcohol, or metabolic liver disease",
                     "Repeat FIB-4 in 6–12 months if elastography deferred",
                     "Review hepatotoxic medications"],
                    ["FIB-4 indeterminate: FibroScan or hepatology review recommended"])
        default:
            return (.critical,
                    String(format: "FIB-4 %.2f — high fibrosis risk; significant fibrosis (F2–F4) likely", f),
                    ["Urgent hepatology referral",
                     "FibroScan or liver biopsy for staging",
                     "Endoscopy for variceal surveillance if F3–F4 suspected",
                     "HCC surveillance: 6-monthly ultrasound + AFP if cirrhosis confirmed",
                     "Cease alcohol; optimise weight, diabetes, lipids"],
                    ["FIB-4 >2.67: significant liver fibrosis likely — urgent hepatology referral"])
        }
    }

    // MARK: - King's College Criteria (Acute Liver Failure — Transplant Referral)

    struct KingsCriteriaInput: Equatable {
        var isParacetamol: Bool = false  // true = paracetamol aetiology; false = non-paracetamol

        // Shared / non-paracetamol criteria
        var ptAbove100: Bool = false          // PT >100 s (INR >6.5) — single-criterion for non-paracetamol
        var ptAbove50: Bool = false           // PT >50 s (one of 5 non-paracetamol minor criteria)
        var ageUnder10OrAbove40: Bool = false // Age <10 or >40 years
        var jaundiceToDays: Bool = false      // Jaundice-to-encephalopathy interval >7 days
        var bilirubinAbove300: Bool = false   // Bilirubin >300 µmol/L
        var unfavourableAetiology: Bool = false // Drug (non-paracetamol), Wilson's, or indeterminate

        // Paracetamol-specific
        var acidosisPhBelow730: Bool = false  // Arterial pH <7.30 after resuscitation (strongest predictor)
        var creatinineAbove300: Bool = false  // Creatinine >300 µmol/L (or anuria)
        var encephalopathyGrade34: Bool = false // Grade III or IV hepatic encephalopathy
    }

    static func kingsCriteria(_ i: KingsCriteriaInput) -> ClinicalScore {
        let met: Bool
        let interpretation: String
        var recs: [String]
        var flags: [String]

        if i.isParacetamol {
            // Paracetamol: pH criterion OR (PT+Cr+Encephalopathy triple)
            let tripleMet = i.ptAbove100 && i.creatinineAbove300 && i.encephalopathyGrade34
            met = i.acidosisPhBelow730 || tripleMet
            if i.acidosisPhBelow730 {
                interpretation = "King's Criteria MET — Arterial pH <7.30 (paracetamol ALF)"
            } else if tripleMet {
                interpretation = "King's Criteria MET — Triple criterion: PT>100 + Cr>300 + Grade III/IV encephalopathy"
            } else {
                let countNear = [i.ptAbove100, i.creatinineAbove300, i.encephalopathyGrade34].filter { $0 }.count
                interpretation = "King's Criteria NOT met — monitor closely (\(countNear)/3 triple criteria present)"
            }
        } else {
            // Non-paracetamol: PT>100 alone, OR ≥3 of 5 minor criteria
            let minorCount = [i.ageUnder10OrAbove40, i.jaundiceToDays, i.ptAbove50,
                               i.bilirubinAbove300, i.unfavourableAetiology].filter { $0 }.count
            met = i.ptAbove100 || minorCount >= 3
            if i.ptAbove100 {
                interpretation = "King's Criteria MET — PT >100 s (non-paracetamol ALF)"
            } else if minorCount >= 3 {
                interpretation = "King's Criteria MET — \(minorCount)/5 minor criteria satisfied (non-paracetamol ALF)"
            } else {
                interpretation = "King's Criteria NOT met — \(minorCount)/5 minor criteria; re-evaluate as disease evolves"
            }
        }

        if met {
            recs = ["Urgent hepatology/transplant centre referral — do not delay",
                    "Contact nearest liver transplant unit immediately",
                    "Ensure adequate venous access; correct coagulopathy only if active bleeding",
                    "N-acetylcysteine infusion if paracetamol aetiology (continue even if criteria met)",
                    "ICU-level monitoring: GCS/encephalopathy grade, ICP monitoring if grade III–IV",
                    "Avoid sedation, nephrotoxins, and hepatotoxic drugs",
                    "Low threshold for renal replacement therapy",
                    "Glucose and electrolyte correction; lactulose for encephalopathy"]
            flags = ["KING'S CRITERIA MET — immediate liver transplant unit referral indicated",
                     "Without transplant, mortality in paracetamol ALF meeting criteria ≈85%"]
        } else {
            recs = ["Continue intensive monitoring of PT, bilirubin, creatinine, and encephalopathy grade",
                    "Hepatology review; daily reassessment against criteria as disease may evolve",
                    "N-acetylcysteine if paracetamol aetiology regardless of criteria status",
                    "Identify and treat underlying aetiology (viral, autoimmune, Wilson's, ischaemic, Budd-Chiari)",
                    "Maintain close liaison with liver transplant unit — early informal notification recommended"]
            flags = []
        }

        let score: Double = met ? 1 : 0
        return ClinicalScore(
            systemName: "King's College Criteria (ALF)",
            abbreviation: met ? "King's: REFER" : "King's: Monitor",
            score: score, maxScore: 1,
            risk: met ? .critical : .moderate,
            interpretation: interpretation,
            recommendations: recs,
            items: i.isParacetamol ? [
                ScoredItem(label: "Arterial pH <7.30",                           points: i.acidosisPhBelow730 ? 1.0 : 0.0,   present: i.acidosisPhBelow730),
                ScoredItem(label: "PT >100 s",                                   points: i.ptAbove100 ? 1.0 : 0.0,           present: i.ptAbove100),
                ScoredItem(label: "Creatinine >300 µmol/L",                     points: i.creatinineAbove300 ? 1.0 : 0.0,   present: i.creatinineAbove300),
                ScoredItem(label: "Grade III/IV encephalopathy",                 points: i.encephalopathyGrade34 ? 1.0 : 0.0, present: i.encephalopathyGrade34)
            ] : [
                ScoredItem(label: "PT >100 s (single criterion)",               points: i.ptAbove100 ? 2.0 : 0.0,            present: i.ptAbove100),
                ScoredItem(label: "Age <10 or >40 years",                       points: i.ageUnder10OrAbove40 ? 1.0 : 0.0,  present: i.ageUnder10OrAbove40),
                ScoredItem(label: "Jaundice-to-encephalopathy >7 days",         points: i.jaundiceToDays ? 1.0 : 0.0,       present: i.jaundiceToDays),
                ScoredItem(label: "PT >50 s",                                   points: i.ptAbove50 ? 1.0 : 0.0,            present: i.ptAbove50),
                ScoredItem(label: "Bilirubin >300 µmol/L",                     points: i.bilirubinAbove300 ? 1.0 : 0.0,    present: i.bilirubinAbove300),
                ScoredItem(label: "Unfavourable aetiology (drug/Wilson's/indeterminate)", points: i.unfavourableAetiology ? 1.0 : 0.0, present: i.unfavourableAetiology)
            ],
            redFlags: flags,
            evidenceNote: "O'Grady JG et al. Gastroenterology 1989;97:439–445. Standard transplant referral criteria for acute liver failure used by British Society of Gastroenterology and AASLD. Paracetamol ALF: pH <7.30 alone sufficient."
        )
    }

    // MARK: - ALBI Score (Albumin-Bilirubin)
    struct ALBIInput: Equatable {
        var albuminGperL: Double = 40.0   // g/L  (normal 35–50)
        var bilirubinUmolL: Double = 17.0 // μmol/L (normal <21)
    }
    static func albi(_ i: ALBIInput) -> ClinicalScore {
        // ALBI = (log₁₀(bilirubin_μmol/L) × 0.66) + (albumin_g/L × −0.085)
        let bili = max(i.bilirubinUmolL, 0.1)
        let alb  = i.albuminGperL
        let score = (log10(bili) * 0.66) + (alb * -0.085)
        let rounded = (score * 100).rounded() / 100
        let (grade, risk, recs): (String, ScoreRisk, [String])
        switch score {
        case ..<(-2.60):
            grade = "Grade 1 — Well-preserved liver function"
            risk  = .low
            recs  = ["Major hepatic resection is generally safe",
                     "Child-Pugh A equivalent functional reserve",
                     "Proceed with planned surgical strategy"]
        case -2.60 ..< -1.39:
            grade = "Grade 2 — Moderate liver dysfunction"
            risk  = .moderate
            recs  = ["Limit resection to <50% hepatic volume",
                     "Consider portal vein embolisation if extended resection planned",
                     "Optimise nutrition and correct coagulopathy pre-operatively",
                     "Hepatology review recommended"]
        default:
            grade = "Grade 3 — Severe liver dysfunction"
            risk  = .high
            recs  = ["Major hepatic resection carries prohibitive risk — avoid",
                     "Prioritise liver function optimisation (lactulose, diuretics, albumin infusion)",
                     "Consider transplant evaluation if HCC / end-stage disease",
                     "Multidisciplinary hepatobiliary conference mandatory"]
        }
        return ClinicalScore(
            name:          "ALBI Score",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: grade,
            recommendations: recs,
            evidenceNote:  "Johnson PJ et al. J Clin Oncol 2015;33:550–558. Continuous hepatic reserve score using albumin and bilirubin. Validated in HCC, cholangiocarcinoma, and resectional hepatic surgery. Preferred over Child-Pugh for granular hepatic reserve stratification."
        )
    }

    // MARK: - MELD 3.0 (Model for End-stage Liver Disease — 2022 update)
    struct MELD3Input: Equatable {
        var isFemale: Bool = false
        var creatinineMmolL: Double = 70.0   // μmol/L
        var bilirubinMmolL: Double = 17.0    // μmol/L
        var inr: Double = 1.0
        var sodiumMmolL: Int = 138            // mmol/L
        var albuminGperL: Double = 40.0      // g/L
    }
    static func meld3(_ i: MELD3Input) -> ClinicalScore {
        // MELD 3.0 = 4.56 × ln(bilirubin_mg/dL) + 0.82×(137−sodium) − 0.24×(137−sodium)×ln(creatinine_mg/dL)
        //            + 9.09×ln(INR) + 11.14×ln(creatinine_mg/dL) + 1.85 + (female: +1.33) + (albumin: −(4.92×albumin/35))
        // Convert SI units to mg/dL equivalents used in the formula:
        let bilMgDL  = max(1.0, i.bilirubinMmolL / 17.1)
        let creatMgDL = min(4.0, max(1.0, i.creatinineMmolL / 88.4)) // capped at 4 per UNOS
        let na = Double(min(max(i.sodiumMmolL, 125), 137)) // clamp 125–137
        let alb = i.albuminGperL / 10.0  // g/L → g/dL
        var score = 4.56 * log(bilMgDL)
                  + 0.82 * (137 - na)
                  - 0.24 * (137 - na) * log(creatMgDL)
                  + 9.09 * log(i.inr)
                  + 11.14 * log(creatMgDL)
                  + 1.85
        if i.isFemale { score += 1.33 }
        score -= (4.92 * alb / 3.5)
        score = max(6, score)
        let rounded = (score * 10).rounded() / 10
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch Int(rounded) {
        case 6...9:
            interp = "Low severity — 90-day mortality ~2%"
            risk   = .low
            recs   = ["Optimise hepatic risk factors (abstinence, nutrition, infection control)",
                      "Semi-annual surveillance (LFTs, US abdomen, AFP if cirrhotic)",
                      "Reassess MELD 3.0 at each visit"]
        case 10...14:
            interp = "Moderate severity — 90-day mortality ~6%"
            risk   = .moderate
            recs   = ["Hepatology review — quarterly monitoring",
                      "Manage complications: diuretics for ascites, beta-blocker for varices",
                      "Nutritional optimisation; referral to dietitian",
                      "Discuss liver transplant evaluation if aetiology is reversible or stable"]
        case 15...19:
            interp = "Significant — 90-day mortality ~20%"
            risk   = .moderate
            recs   = ["Transplant list assessment — most centres list at MELD ≥15",
                      "Hospitalise for management of hepatic decompensation if present",
                      "TIPS assessment if recurrent variceal bleed or refractory ascites"]
        default:
            interp = "Severe — 90-day mortality >50%"
            risk   = .high
            recs   = ["Urgent transplant listing — MELD ≥25 = active waitlist priority at most centres",
                      "ICU-level monitoring for ACLF / multiorgan dysfunction",
                      "Discuss goals of care if transplant not feasible"]
        }
        return ClinicalScore(
            name:          "MELD 3.0",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Kim WR et al. Hepatology 2021;74:1913–1922. MELD 3.0 adds sex (+1.33 for female), albumin term, and recalibrates coefficients on 280 000+ UNOS patients. Reduces sex disparity in waitlist outcomes vs MELD-Na. Adopted by UNOS/OPTN 2022 for organ allocation. Score ≥15 = transplant listing threshold at most centres."
        )
    }

    // MARK: - #93 Maddrey Discriminant Function (Alcoholic Hepatitis)

    struct MaddreyInput: Equatable {
        var ptSeconds: Double          // patient PT in seconds
        var controlPTSeconds: Double   // control PT in seconds
        var bilirubinMgDL: Double      // serum bilirubin in mg/dL
    }

    static func maddrey(_ i: MaddreyInput) -> ClinicalScore {
        let mdf = 4.6 * (i.ptSeconds - i.controlPTSeconds) + i.bilirubinMgDL
        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if mdf >= 32 {
            risk  = .critical
            interp = "Severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). 28-day mortality 35–45% without treatment."
            recs  = [
                "Consider prednisolone 40 mg/day × 28 days if no contraindications",
                "Reassess with Lille model at day 7 — Lille ≥0.45 indicates steroid non-response",
                "Hepatology / gastroenterology urgent review",
                "Pentoxifylline no longer preferred per recent evidence (STOPAH trial)",
                "N-acetylcysteine as adjunct if renal impairment present",
                "Abstinence counselling and addiction medicine referral",
                "Monitor for hepatorenal syndrome, SBP, hepatic encephalopathy"
            ]
            flags = ["mDF ≥ 32 — high 28-day mortality without corticosteroid therapy"]
        } else if mdf >= 20 {
            risk  = .high
            interp = "Moderately severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Elevated mortality risk; close monitoring required."
            recs  = [
                "Hepatology review within 24–48 hours",
                "Intensive nutritional support — target 35–40 kcal/kg/day",
                "Strict alcohol cessation",
                "Monitor renal function and coagulation daily"
            ]
        } else {
            risk  = .moderate
            interp = "Mild–moderate alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Lower short-term mortality; supportive management."
            recs  = [
                "Alcohol abstinence — cornerstone of management",
                "Nutritional optimisation",
                "Monitor LFTs, coagulation weekly",
                "Hepatology outpatient follow-up within 2 weeks"
            ]
        }

        return ClinicalScore(
            name:          "Maddrey Discriminant Function",
            score:         mdf,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Maddrey WC et al. Gastroenterology 1978;75:193. Formula: 4.6 × (PT_patient − PT_control) + bilirubin(mg/dL). mDF ≥32 defines severe disease with ≥35% 28-day mortality; the steroid-treatment threshold. STOPAH (NEJM 2015) confirmed prednisolone reduces 28-day mortality for mDF ≥32 but not long-term survival. Lille score at day 7 guides continuation vs. cessation."
        )
    }


}
