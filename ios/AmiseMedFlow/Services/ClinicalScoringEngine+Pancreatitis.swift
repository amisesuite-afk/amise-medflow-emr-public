// ClinicalScoringEngine+Pancreatitis.swift
// Pancreatitis severity scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: Ranson Criteria (Pancreatitis)

    static func ranson(_ i: RansonInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age >55 years", points: 1, present: i.ageOver55),
            .init(label: "WBC >16,000/μL (admission)", points: 1, present: i.wbcOver16k),
            .init(label: "Glucose >11 mmol/L (admission)", points: 1, present: i.glucoseOver200),
            .init(label: "LDH >350 IU/L (admission)", points: 1, present: i.ldhOver350),
            .init(label: "AST >250 IU/L (admission)", points: 1, present: i.astOver250),
            .init(label: "Haematocrit fall >10% (48 h)", points: 1, present: i.hctFallOver10),
            .init(label: "BUN rise >1.8 mmol/L (48 h)", points: 1, present: i.bunRiseOver5),
            .init(label: "Calcium <2 mmol/L (48 h)", points: 1, present: i.calciumBelow8),
            .init(label: "PaO₂ <60 mmHg (48 h)", points: 1, present: i.pao2Below60),
            .init(label: "Base deficit >4 mEq/L (48 h)", points: 1, present: i.baseDeficitOver4),
            .init(label: "Fluid sequestration >6 L (48 h)", points: 1, present: i.fluidSequestrationOver6L),
        ]
        let score = Double(items.filter(\.present).count)

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch score {
        case ..<3:
            risk = .low
            interpretation = "Ranson \(Int(score))/11 — Mild pancreatitis; mortality <5%"
            recs = ["IV fluids: moderate goal-directed crystalloid (1.5 mL/kg/h after a 10 mL/kg bolus only if hypovolaemic; avoid aggressive fluids — WATERFALL 2022; ACG 2024)",
                    "Analgesia (morphine IV)", "Nil by mouth initially",
                    "Monitor FBC, U&E, LFT, calcium, glucose every 12–24 h",
                    "Reintroduce clear fluids when pain resolving and bowel sounds present"]
        case 3..<6:
            risk = .high
            interpretation = "Ranson \(Int(score))/11 — Moderate-to-severe pancreatitis; mortality ~15%"
            recs = ["HDU admission", "Goal-directed IV fluids (target urine output >0.5 mL/kg/h; avoid aggressive fluids — WATERFALL 2022; ACG 2024)",
                    "Analgesia (morphine IV or epidural)", "Nil by mouth",
                    "MRCP / USS to assess biliary aetiology",
                    "Early ERCP if gallstone pancreatitis + cholangitis within 24–72 h",
                    "Nutritional support: NG/NJ feeding within 48–72 h if unable to eat",
                    "CT abdomen at 48–72 h to assess necrosis (modified CT severity index)",
                    "Daily FBC, U&E, calcium, LFT, glucose, CRP, coagulation"]
            redFlags = ["Consider ICU if haemodynamically unstable"]
        default:
            risk = .critical
            interpretation = "Ranson \(Int(score))/11 — Severe pancreatitis; mortality >50%"
            redFlags = ["Mortality risk >50% — ITU admission essential",
                        "High risk of pancreatic necrosis and multi-organ failure"]
            recs = ["ITU admission", "Goal-directed fluid resuscitation (avoid aggressive fluids — WATERFALL 2022; ACG 2024)",
                    "Vasopressors if haemodynamically compromised", "Invasive monitoring",
                    "Early ERCP within 24 h if biliary aetiology + cholangitis",
                    "CT abdomen with contrast (CTSI) at 48–72 h — assess extent of necrosis",
                    "Broad-spectrum IV antibiotics only if infected necrosis suspected (imipenem or meropenem)",
                    "Nasojejunal feeding: commence within 24–48 h",
                    "Surgery (necrosectomy) only if infected necrosis — delay ≥3–4 weeks"]
        }

        return ClinicalScore(
            systemName: "Ranson Criteria",
            abbreviation: "Ranson",
            score: score, maxScore: 11,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Ranson 1974. Score ≥3 = severe; ≥6 = critical. Requires 48 h to complete."
        )
    }

    // MARK: Glasgow Pancreatitis Score

    static func glasgowPancreatitis(_ i: GlasgowPancreatitisInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "PaO₂ <8 kPa (60 mmHg)", points: 1, present: i.pao2Below60),
            .init(label: "Age >55 years", points: 1, present: i.ageOver55),
            .init(label: "Neutrophils (WBC) >15×10⁹/L", points: 1, present: i.wbcOver15k),
            .init(label: "Calcium <2 mmol/L", points: 1, present: i.calciumBelow2),
            .init(label: "Urea >16 mmol/L", points: 1, present: i.ureaOver16),
            .init(label: "LDH >600 IU/L or AST >200 IU/L", points: 1, present: i.ldhOver600OrAstOver200),
            .init(label: "Albumin <32 g/L", points: 1, present: i.albuminBelow32),
            .init(label: "Glucose >10 mmol/L", points: 1, present: i.glucoseOver10),
        ]
        let score = Double(items.filter(\.present).count)
        let severe = score >= 3

        return ClinicalScore(
            systemName: "Glasgow Pancreatitis Score",
            abbreviation: "PANCREAS",
            score: score, maxScore: 8,
            risk: glasgowSeverityRisk(Int(score)),
            interpretation: severe
                ? "Glasgow \(Int(score))/8 — Severe acute pancreatitis"
                : "Glasgow \(Int(score))/8 — Predicted mild pancreatitis",
            recommendations: severe
                ? ["HDU/ITU admission", "Goal-directed IV fluid resuscitation (avoid aggressive fluids — WATERFALL 2022; ACG 2024)",
                   "CT abdomen at 48–72 h", "Nutritional support within 48 h",
                   "ERCP within 72 h if biliary aetiology + cholangitis"]
                : ["IV fluids + analgesia", "Nil by mouth initially",
                   "Monitor closely — repeat score at 48 h"],
            items: items,
            redFlags: severe ? ["Score ≥3 at 48 h — criteria for severe pancreatitis met"] : [],
            evidenceNote: "Glasgow/Imrie Score (Blamey 1984). Assessed at 48 h. ≥3 = severe."
        )
    }

    // MARK: BISAP (Bedside Index for Severity in Acute Pancreatitis)

    struct BISAPInput: Equatable {
        var bunOver9mmolL: Bool = false          // BUN >9 mmol/L (>25 mg/dL)
        var impairedMentalStatus: Bool = false   // disorientation, stupor, or coma
        var sirs: Bool = false                   // SIRS (≥2 of 4 SIRS criteria met)
        var ageOver60: Bool = false              // age >60 years
        var pleuralEffusion: Bool = false        // pleural effusion on imaging
    }

    static func bisap(_ i: BISAPInput) -> ClinicalScore {
        let flags = [i.bunOver9mmolL, i.impairedMentalStatus, i.sirs, i.ageOver60, i.pleuralEffusion]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "B — BUN >9 mmol/L (>25 mg/dL)",          points: 1, present: i.bunOver9mmolL),
            .init(label: "I — Impaired mental status (disorientation / stupor / coma)", points: 1, present: i.impairedMentalStatus),
            .init(label: "S — SIRS (≥2 of: temp >38 or <36°C, HR >90, RR >20, WBC >12k or <4k)", points: 1, present: i.sirs),
            .init(label: "A — Age >60 years",                       points: 1, present: i.ageOver60),
            .init(label: "P — Pleural effusion on imaging",         points: 1, present: i.pleuralEffusion),
        ]
        let (risk, interp, recs, redFlags): (ScoreRisk, String, [String], [String]) = switch Int(score) {
        case 0:
            (.low,      "BISAP 0 — Predicted mortality 0.1% — mild pancreatitis very likely",
             ["Goal-directed IV fluids (Hartmann's / Ringer's lactate preferred; avoid aggressive fluids — WATERFALL 2022; ACG 2024)",
              "Monitor urine output, U&E, lipase at 24–48 h",
              "Consider early enteral feeding if tolerated",
              "Abdominal imaging not routine unless diagnosis uncertain"],
             [])
        case 1:
            (.low,      "BISAP 1 — Predicted mortality 0.4% — mild pancreatitis expected",
             ["IV fluid resuscitation; reassess at 6 h and 24 h",
              "Monitor amylase/lipase, FBC, CRP, renal function",
              "Enteral nutrition if not tolerating oral by 48 h"],
             [])
        case 2:
            (.moderate, "BISAP 2 — Predicted mortality 1.6% — moderate severity likely",
             ["Active IV resuscitation; Hartmann's preferred over normal saline",
              "CECT abdomen at 48–72 h if not improving",
              "Nutritional support: nasojejunal tube if oral intake fails by 48 h",
              "Consider HDU monitoring; re-score at 24 h"],
             ["CRP >150 at 48 h suggests necrotising pancreatitis"])
        case 3:
            (.high,     "BISAP 3 — Predicted mortality 5.3% — severe pancreatitis likely",
             ["Urgent HDU/ICU referral",
              "CECT abdomen (pancreatic protocol) as soon as haemodynamically stable",
              "Invasive monitoring; strict fluid balance",
              "Enteral nutrition via nasojejunal tube within 24–48 h",
              "Multidisciplinary review: pancreatic surgery, radiology, intensivist"],
             ["BISAP ≥3: high probability severe or necrotising pancreatitis"])
        case 4:
            (.high,     "BISAP 4 — Predicted mortality 12.7% — severe pancreatitis",
             ["ICU-level care mandatory",
              "CECT for necrosis mapping; interventional radiology on standby",
              "Early nutritional support; consider TPN if enteral route not feasible",
              "Broad-spectrum antibiotics ONLY if infected necrosis confirmed or strongly suspected",
              "Surgical/endoscopic intervention planning for necrosectomy if needed"],
             ["BISAP ≥3: severe pancreatitis confirmed — ICU level care required"])
        default:
            (.critical, "BISAP 5 — Predicted mortality 22.0% — critical pancreatitis",
             ["ICU admission mandatory; intensivist-led care",
              "Urgent CECT for extent of pancreatic necrosis",
              "Multidisciplinary team: HPB surgery, interventional radiology, critical care",
              "Plan step-up approach for infected necrosis: drainage → necrosectomy",
              "Discuss prognosis with family; goals-of-care conversation"],
             ["BISAP 5: critical severity — mortality ~22%; escalate immediately"])
        }
        return ClinicalScore(
            systemName: "BISAP Score",
            abbreviation: "BISAP \(Int(score))/5",
            score: score, maxScore: 5,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Wu et al, Am J Gastroenterol 2008. Validated in 17,992 patients. Predicts in-hospital mortality and severe pancreatitis. BISAP ≥3: sensitivity 64%, specificity 91% for severe pancreatitis."
        )
    }

    // MARK: - CTSI (Balthazar CT Severity Index)

    static func ctsi(_ i: CTSIInput) -> ClinicalScore {
        let total = i.balthazarGrade + i.necrosisScore
        let (risk, interp, recs, flags) = ctsiRisk(total)
        var items: [ScoredItem] = []
        let gradeLabels = ["A — Normal pancreas", "B — Oedematous pancreas",
                           "C — Peripancreatic fat stranding",
                           "D — Single peripancreatic fluid collection",
                           "E — ≥2 fluid collections or gas in/around pancreas"]
        let gradeLabel = i.balthazarGrade < gradeLabels.count
            ? gradeLabels[i.balthazarGrade] : "Grade \(i.balthazarGrade)"
        items.append(ScoredItem(label: "Balthazar grade — \(gradeLabel)",
                               points: Double(i.balthazarGrade),
                               present: i.balthazarGrade > 0))
        let necLabels = [0: "None", 2: "Necrosis <33%", 4: "Necrosis 33–50%", 6: "Necrosis >50%"]
        items.append(ScoredItem(label: necLabels[i.necrosisScore] ?? "Necrosis",
                               points: Double(i.necrosisScore),
                               present: i.necrosisScore > 0))
        return ClinicalScore(
            systemName: "CT Severity Index",
            abbreviation: "CTSI \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Balthazar EA et al. Radiology 1990; 174:331–336."
        )
    }

    // MARK: - Harmless Acute Pancreatitis Score (HAPS) (#78)

    struct HAPSInput: Equatable {
        var peritonismAbsent: Bool = false    // no peritoneal irritation on exam
        var creatinineNormal: Bool = false    // serum creatinine ≤ 177 µmol/L (< 2 mg/dL)
        var haematocritNormal: Bool = false   // haematocrit ≤ 43% (male) or ≤ 39.6% (female)
    }

    static func haps(_ i: HAPSInput) -> ClinicalScore {
        let pts = [i.peritonismAbsent, i.creatinineNormal, i.haematocritNormal].filter { $0 }.count
        let isHarmless = pts == 3

        let risk: ScoreRisk
        let interp: String
        if isHarmless {
            risk = .low
            interp = "HAPS = 3/3 — ALL three criteria met. HARMLESS acute pancreatitis. Predicted mild course; uneventful recovery without intervention expected (NPV ~97–99%). Conservative management appropriate; early oral rehydration may be considered."
        } else {
            risk = .high
            interp = "HAPS \(pts)/3 — Not all criteria met. Cannot classify as harmless. Severe or complicated pancreatitis cannot be excluded. Treat as potentially severe — IV fluids, nil by mouth, monitoring, and reassessment with APACHE II / BISAP / CT if clinically indicated."
        }

        let flags: [String] = !isHarmless ? ["HAPS < 3: potentially severe acute pancreatitis — do not apply conservative 'harmless' pathway; escalate monitoring and consider CT for severity staging"] : []
        let recs: [String]
        if isHarmless {
            recs = [
                "HAPS predicts harmless course with high NPV — conservative management appropriate.",
                "Early oral fluids (if tolerated) and analgesia.",
                "Monitor amylase/lipase trend; discharge when clinically stable.",
                "Investigate aetiology (gallstones, alcohol): US abdomen, LFTs."
            ]
        } else {
            recs = [
                "HAPS does not confirm harmless course — standard acute pancreatitis pathway applies.",
                "IV fluid resuscitation: moderate goal-directed crystalloid, reassessed at 12–24 h (avoid aggressive fluids — WATERFALL 2022; ACG 2024).",
                "Nil by mouth; nasogastric tube if vomiting.",
                "Repeat bloods at 24–48 h; consider CT abdomen if no improvement at 48–72 h.",
                "BISAP and APACHE II scores recommended for formal severity stratification."
            ]
        }

        return ClinicalScore(
            name: "Harmless Acute Pancreatitis Score (HAPS)",
            score: Double(pts),
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "No peritoneal irritation on abdominal examination", points: 1, present: i.peritonismAbsent),
                ScoredItem(label: "Serum creatinine ≤ 177 µmol/L (< 2 mg/dL)", points: 1, present: i.creatinineNormal),
                ScoredItem(label: "Haematocrit ≤ 43% (male) / ≤ 39.6% (female)", points: 1, present: i.haematocritNormal)
            ],
            redFlags: flags,
            evidenceNote: "Lankisch PG et al. Am J Gastroenterol 2009;104:2943–2949. HAPS validated in 397 patients (prospective) and 1444 (validation cohort). All 3 criteria met on admission: PPV 98% for mild AP, NPV 99% for exclusion of severe AP. Simple bedside score requiring no imaging. Does not replace CT for complications. Comparable to APACHE II for early risk stratification."
        )
    }


    // MARK: – #80 Glasgow-Imrie
    // Standard modified Glasgow (Imrie) criteria — PANCREAS, worst values in the first 48 h,
    // one point each (Blamey 1984):
    //   P  PaO₂ < 8 kPa (60 mmHg)       A  Age > 55 years
    //   N  WCC > 15 × 10⁹/L             C  Calcium < 2 mmol/L
    //   R  Urea > 16 mmol/L             E  LDH > 600 IU/L OR AST > 200 IU/L (ONE criterion)
    //   A  Albumin < 32 g/L             S  Glucose > 10 mmol/L
    // ≥ 3 = severe. Field names are kept for the existing Scores form bindings: `ldh180` and
    // `ast100` are the two halves of the single enzyme criterion.

    struct GlasgowImrieInput: Equatable {
        var pao2Below59: Bool = false         // PaO₂ < 8 kPa (60 mmHg)
        var ageAbove55: Bool = false           // Age > 55 years
        var wbcAbove15: Bool = false           // WBC > 15 × 10⁹/L
        var calciumBelow2: Bool = false        // Serum calcium < 2.0 mmol/L
        var ureaAbove16: Bool = false          // Serum urea > 16 mmol/L
        var albuminBelow32: Bool = false       // Serum albumin < 32 g/L
        var ldh180: Bool = false              // LDH > 600 IU/L   ┐ one criterion:
        var ast100: Bool = false              // AST > 200 IU/L   ┘ either scores 1 point
        var glucoseAbove10: Bool = false       // Serum glucose > 10 mmol/L

        /// The single enzyme criterion (E): LDH > 600 IU/L or AST > 200 IU/L.
        var enzymeCriterion: Bool { ldh180 || ast100 }

        /// The eight PANCREAS criteria, in order.
        var criteria: [Bool] {
            [pao2Below59, ageAbove55, wbcAbove15, calciumBelow2,
             ureaAbove16, enzymeCriterion, albuminBelow32, glucoseAbove10]
        }
    }

    /// Shared Glasgow banding (both Glasgow implementations): 0–2 predicted mild; ≥3 severe
    /// (.high); ≥5 shown as .critical to mark the heavier burden (local display convention, not
    /// part of the published score).
    static func glasgowSeverityRisk(_ points: Int) -> ScoreRisk {
        points >= 5 ? .critical : (points >= 3 ? .high : .low)
    }

    static func glasgowImrie(_ i: GlasgowImrieInput) -> ClinicalScore {
        let pts = i.criteria.filter { $0 }.count

        let risk = glasgowSeverityRisk(pts)
        let interp: String
        if pts < 3 {
            interp = "Glasgow-Imrie \(pts)/8 — Predicted mild acute pancreatitis. Standard IV fluid resuscitation, analgesia and supportive care. Reassess at 48 h: the score uses the worst values in the first 48 h and may not be complete at admission."
        } else {
            interp = "Glasgow-Imrie \(pts)/8 — Severe acute pancreatitis predicted (≥ 3 criteria). HDU/ICU assessment, goal-directed resuscitation (avoid aggressive fluids), CT imaging if not improving, and HPB/gastroenterology specialist review."
        }

        let flags: [String] = pts >= 3 ? ["Glasgow-Imrie ≥ 3: severe acute pancreatitis predicted — HDU/ICU and specialist review required"] : []
        let recs: [String]
        if pts < 3 {
            recs = [
                "Mild acute pancreatitis predicted — moderate goal-directed fluids for the first 24 h (avoid aggressive fluids — WATERFALL 2022; ACG 2024).",
                "Early oral intake when tolerated (24–48 h).",
                "US abdomen to assess for gallstones and common bile duct dilation.",
                "Monitor with serial bloods at 24 and 48 h.",
                "Consider ERCP within 24–48 h if biliary pancreatitis with cholangitis."
            ]
        } else {
            recs = [
                "Severe acute pancreatitis predicted — HDU/ICU admission.",
                "Goal-directed IV crystalloid guided by urine output (avoid aggressive fluids — WATERFALL 2022; ACG 2024).",
                "CT abdomen with contrast at 48–72 h to assess for necrosis and complications.",
                "Nasojejunal feeding preferred if enteral route feasible; PN if not.",
                "Antibiotics only if infected necrosis confirmed or high clinical suspicion.",
                "Multidisciplinary HPB/ICU/gastroenterology review.",
                "ERCP if biliary aetiology with cholangitis (within 24 h for cholangitis)."
            ]
        }

        return ClinicalScore(
            name: "Glasgow-Imrie Pancreatitis Score",
            score: Double(pts),
            maxScore: 8,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "PaO₂ < 8 kPa (60 mmHg)", points: 1, present: i.pao2Below59),
                ScoredItem(label: "Age > 55 years", points: 1, present: i.ageAbove55),
                ScoredItem(label: "WCC > 15 × 10⁹/L", points: 1, present: i.wbcAbove15),
                ScoredItem(label: "Serum calcium < 2.0 mmol/L", points: 1, present: i.calciumBelow2),
                ScoredItem(label: "Serum urea > 16 mmol/L", points: 1, present: i.ureaAbove16),
                ScoredItem(label: "LDH > 600 IU/L or AST > 200 IU/L (one criterion)", points: 1, present: i.enzymeCriterion),
                ScoredItem(label: "Serum albumin < 32 g/L", points: 1, present: i.albuminBelow32),
                ScoredItem(label: "Serum glucose > 10 mmol/L", points: 1, present: i.glucoseAbove10)
            ],
            redFlags: flags,
            evidenceNote: "Imrie CW et al. Br J Surg 1978;65:478–480. Modified by Blamey SL et al. Gut 1984;25:1340–1346. Eight variables, assessed at 48 h from admission. Score ≥ 3 predicts severe acute pancreatitis with sensitivity ~70%, specificity ~85%. Widely used in UK/Commonwealth clinical practice. Variables must be based on worst values within first 48 h — not all may be available at admission. Compare with BISAP (admission-only) and APACHE II (daily, more complex)."
        )
    }


}
