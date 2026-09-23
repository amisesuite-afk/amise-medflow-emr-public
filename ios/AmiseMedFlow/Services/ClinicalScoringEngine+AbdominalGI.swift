// ClinicalScoringEngine+AbdominalGI.swift
// GI / Abdominal / Colorectal scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: Alvarado (Appendicitis)

    static func alvarado(_ i: AlvaradoInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Pain migration to RIF", points: 1, present: i.migrationToRIF),
            .init(label: "Anorexia", points: 1, present: i.anorexia),
            .init(label: "Nausea / vomiting", points: 1, present: i.nauseaVomiting),
            .init(label: "Tenderness in RIF", points: 2, present: i.tendernessRIF),
            .init(label: "Rebound tenderness", points: 1, present: i.reboundTenderness),
            .init(label: "Elevated temperature ≥37.3°C", points: 1, present: i.elevatedTemperature),
            .init(label: "WBC >10,000/μL", points: 2, present: i.wbcElevated),
            .init(label: "Neutrophilia >75%", points: 1, present: i.neutrophiliaShift),
        ]
        let score = items.filter(\.present).reduce(0) { $0 + $1.points }

        let (risk, interpretation) = alvaradoRisk(score)

        var recs: [String] = []
        var redFlags: [String] = []
        switch risk {
        case .low:
            recs = ["Observe / discharge with analgesia and strict return precautions",
                    "Repeat clinical assessment in 4–6 h if borderline"]
        case .moderate:
            recs = ["Surgical review", "IV access + analgesia", "FBC, CRP, U&E, LFT, urinalysis",
                    "Abdominal USS (or CT if USS equivocal)", "Nil by mouth if surgical route likely"]
        case .high, .critical:
            recs = ["Urgent surgical review — likely appendicitis",
                    "IV access + fluid resuscitation + analgesia",
                    "CT abdomen/pelvis if USS equivocal",
                    "Prophylactic antibiotics (co-amoxiclav or cefuroxime + metronidazole) before theatre",
                    "Consented for laparoscopic appendicectomy"]
            if risk == .critical {
                redFlags.append("Score ≥9 — surgical emergency; risk of perforation")
            }
        }

        return ClinicalScore(
            systemName: "Alvarado Score",
            abbreviation: "MANTRELS",
            score: score, maxScore: 10,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Alvarado 1986. Score ≤4: unlikely appendicitis; 5–6: possible; 7–8: probable; 9–10: very probable."
        )
    }

    private static func alvaradoRisk(_ s: Double) -> (ScoreRisk, String) {
        switch s {
        case ..<5:  return (.low,      "Score \(Int(s))/10 — appendicitis unlikely")
        case 5..<7: return (.moderate, "Score \(Int(s))/10 — appendicitis possible; imaging recommended")
        default:    return (.high,     "Score \(Int(s))/10 — appendicitis probable/very probable; surgical review")
        }
    }

    // MARK: Tokyo Guidelines 2018 — Acute Cholecystitis

    static func tokyoCholecystitis(_ i: TokyoCholecystitisInput) -> ClinicalScore {
        let hasGradeIIIOrgan = i.cardiovascularDysfunction || i.neurologicalDysfunction ||
                               i.respiratoryDysfunction || i.renalDysfunction ||
                               i.hepaticDysfunction || i.haematologicalDysfunction
        let hasGradeII = i.wbcAbove18 || i.durationOver72h || i.markedLocalInflammation

        let grade: Int
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasGradeIIIOrgan {
            grade = 3; risk = .critical
            interpretation = "Tokyo Grade III — Severe acute cholecystitis with organ dysfunction"
            redFlags = ["Organ dysfunction present — ICU-level care required",
                        "Urgent biliary drainage and source control"]
            recs = ["ICU / HDU admission", "IV antibiotics (piperacillin-tazobactam or meropenem)",
                    "Early urgent cholecystostomy or emergency cholecystectomy",
                    "Treat organ dysfunction concurrently", "Anaesthetic / critical care review"]
        } else if hasGradeII {
            grade = 2; risk = .high
            interpretation = "Tokyo Grade II — Moderate acute cholecystitis; early laparoscopic cholecystectomy within 72 h"
            recs = ["IV antibiotics (co-amoxiclav or cefuroxime + metronidazole)",
                    "Early laparoscopic cholecystectomy within 72 h (if fit)",
                    "ERCP or MRCP if bile duct stones suspected",
                    "HDU monitoring if WBC markedly elevated or haemodynamically unstable"]
        } else if i.localInflammationSignsMild {
            grade = 1; risk = .low
            interpretation = "Tokyo Grade I — Mild acute cholecystitis; elective or early laparoscopic cholecystectomy"
            recs = ["Oral or IV antibiotics (if febrile)",
                    "Analgesia + IV fluids",
                    "Elective laparoscopic cholecystectomy (or early if patient fit and ward allows)",
                    "USS biliary tree to exclude choledocholithiasis"]
        } else {
            grade = 0; risk = .low
            interpretation = "Criteria for acute cholecystitis not met — consider biliary colic or other diagnosis"
            recs = ["Biliary USS to confirm", "Analgesia", "Low-fat diet advice"]
        }

        let items: [ScoredItem] = [
            .init(label: "Local inflammation signs", points: 1, present: i.localInflammationSignsMild),
            .init(label: "WBC >18,000", points: 1, present: i.wbcAbove18),
            .init(label: "Duration >72 h", points: 1, present: i.durationOver72h),
            .init(label: "Marked local inflammation (gangrenous / peritonitis)", points: 2, present: i.markedLocalInflammation),
            .init(label: "Cardiovascular dysfunction", points: 3, present: i.cardiovascularDysfunction),
            .init(label: "Neurological dysfunction", points: 3, present: i.neurologicalDysfunction),
            .init(label: "Respiratory dysfunction", points: 3, present: i.respiratoryDysfunction),
            .init(label: "Renal dysfunction", points: 3, present: i.renalDysfunction),
            .init(label: "Hepatic dysfunction (INR >1.5)", points: 3, present: i.hepaticDysfunction),
            .init(label: "Haematological dysfunction (Plt <100k)", points: 3, present: i.haematologicalDysfunction),
        ]

        return ClinicalScore(
            systemName: "Acute Cholecystitis Severity",
            abbreviation: "Tokyo 2018",
            score: Double(grade), maxScore: 3,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Tokyo Guidelines 2018 (TG18). Grades I–III guide urgency of cholecystectomy."
        )
    }

    // MARK: Tokyo Guidelines 2018 — Acute Cholangitis

    static func tokyoCholangitis(_ i: TokyoCholangitisInput) -> ClinicalScore {
        let hasGradeIIIOrgan = i.cardiovascularDysfunction || i.neurologicalDysfunction ||
                               i.respiratoryDysfunction || i.renalDysfunction ||
                               i.hepaticDysfunction || i.haematologicalDysfunction
        let gradeIICount = [i.wbcAbove12OrBelow4, i.temperatureAbove39,
                            i.ageAbove75, i.bilirubinAbove5, i.albuminBelow0_7xLLN].filter { $0 }.count

        let grade: Int
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if hasGradeIIIOrgan {
            grade = 3; risk = .critical
            interpretation = "Tokyo Grade III — Severe acute cholangitis with organ dysfunction"
            redFlags = ["Urgent biliary drainage (ERCP) is life-saving",
                        "Organ dysfunction — ICU-level care"]
            recs = ["Emergency ERCP with sphincterotomy and stone extraction / stent",
                    "IV antibiotics (meropenem or piperacillin-tazobactam)",
                    "ICU admission", "Critical care / hepatobiliary surgical review",
                    "Blood cultures × 2 before antibiotics"]
        } else if gradeIICount >= 1 {
            grade = 2; risk = .high
            interpretation = "Tokyo Grade II — Moderate acute cholangitis; urgent ERCP within 24–48 h"
            recs = ["IV antibiotics (co-amoxiclav or cefuroxime + metronidazole)",
                    "Urgent ERCP within 24–48 h",
                    "Admit for IV hydration and monitoring",
                    "Blood cultures × 2 before antibiotics",
                    "MRCP if ERCP contraindicated"]
        } else if i.cholangitisConfirmed {
            grade = 1; risk = .low
            interpretation = "Tokyo Grade I — Mild acute cholangitis; respond to initial medical treatment"
            recs = ["IV antibiotics with close observation",
                    "Elective ERCP within 72 h if stable",
                    "Monitor for deterioration to Grade II/III"]
        } else {
            grade = 0; risk = .low
            interpretation = "Charcot's triad not met — consider biliary colic or other hepatobiliary cause"
            recs = ["MRCP or USS to investigate biliary tree", "Liver function tests"]
        }

        let items: [ScoredItem] = [
            .init(label: "Cholangitis confirmed (fever / Charcot's / imaging)", points: 1, present: i.cholangitisConfirmed),
            .init(label: "WBC >12 or <4 ×10⁹/L", points: 1, present: i.wbcAbove12OrBelow4),
            .init(label: "Temperature >39°C", points: 1, present: i.temperatureAbove39),
            .init(label: "Age >75", points: 1, present: i.ageAbove75),
            .init(label: "Bilirubin >5 mg/dL (>85 μmol/L)", points: 1, present: i.bilirubinAbove5),
            .init(label: "Albumin <0.7 × LLN", points: 1, present: i.albuminBelow0_7xLLN),
            .init(label: "Cardiovascular dysfunction", points: 3, present: i.cardiovascularDysfunction),
            .init(label: "Neurological dysfunction", points: 3, present: i.neurologicalDysfunction),
            .init(label: "Respiratory dysfunction", points: 3, present: i.respiratoryDysfunction),
            .init(label: "Renal dysfunction", points: 3, present: i.renalDysfunction),
            .init(label: "Hepatic dysfunction (INR >1.5)", points: 3, present: i.hepaticDysfunction),
            .init(label: "Haematological dysfunction (Plt <100k)", points: 3, present: i.haematologicalDysfunction),
        ]

        return ClinicalScore(
            systemName: "Acute Cholangitis Severity",
            abbreviation: "Tokyo 2018",
            score: Double(grade), maxScore: 3,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Tokyo Guidelines 2018 (TG18). Grade III: emergency ERCP is life-saving."
        )
    }

    // MARK: Rockall Score (Upper GI Bleed)

    static func rockall(_ i: RockallInput) -> ClinicalScore {
        var scoreItems: [ScoredItem] = []
        var total: Double = 0

        // Age
        let agePoints = Double(i.ageGroup.rawValue)
        scoreItems.append(.init(label: ageLabel(i.ageGroup), points: agePoints, present: agePoints > 0))
        total += agePoints

        // Shock
        let shockPoints = Double(i.shock.rawValue)
        scoreItems.append(.init(label: shockLabel(i.shock), points: shockPoints, present: shockPoints > 0))
        total += shockPoints

        // Comorbidity
        let comorbPoints = Double(i.comorbidity.rawValue)
        scoreItems.append(.init(label: comorbLabel(i.comorbidity), points: comorbPoints, present: comorbPoints > 0))
        total += comorbPoints

        // Endoscopy findings
        let dxPoints = Double(i.diagnosis.rawValue)
        scoreItems.append(.init(label: diagnosisLabel(i.diagnosis), points: dxPoints, present: dxPoints > 0))
        total += dxPoints

        let stigPoints: Double = i.majorStigmata ? 2 : 0
        scoreItems.append(.init(label: "Major stigmata of haemorrhage (active bleed / visible vessel / adherent clot)", points: 2, present: i.majorStigmata))
        total += stigPoints

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch total {
        case ..<2:
            risk = .low
            interpretation = "Rockall \(Int(total)) — Low risk; rebleeding <5%, mortality <0.1%"
            recs = ["Consider same-day/next-day discharge after endoscopy if haemostasis confirmed",
                    "PPI (omeprazole 20 mg OD) if peptic ulcer",
                    "Outpatient follow-up within 2 weeks",
                    "H. pylori test and treat"]
        case 2..<5:
            risk = .moderate
            interpretation = "Rockall \(Int(total)) — Moderate risk; rebleeding ~15%, mortality ~4%"
            recs = ["Admit for observation post-endoscopy", "IV PPI (omeprazole 80 mg bolus then 8 mg/h × 72 h) if high-risk ulcer",
                    "Repeat endoscopy if rebleeding", "Transfuse to Hb 70–80 g/L (90 in cardiac disease)",
                    "Correct coagulopathy"]
        case 5..<8:
            risk = .high
            interpretation = "Rockall \(Int(total)) — High risk; rebleeding >40%, mortality >14%"
            recs = ["ITU / HDU admission", "Resuscitation: cross-match ×4 units, FFP, platelets",
                    "IV PPI infusion", "Repeat endoscopy ± haemostasis",
                    "IR angioembolisation if endoscopy fails",
                    "Emergency surgery if all else fails"]
        default:
            risk = .critical
            interpretation = "Rockall \(Int(total)) — Critical risk; very high in-hospital mortality"
            redFlags = ["Score ≥8 — extremely high risk of in-hospital mortality"]
            recs = ["Immediate ITU admission", "Resuscitation: cross-match ≥6 units, FFP, platelets",
                    "Emergency endoscopy with haemostasis", "IR angioembolisation on standby",
                    "Emergency surgery if all else fails", "Palliative discussion if patient unfit for intervention"]
        }

        return ClinicalScore(
            systemName: "Rockall Score",
            abbreviation: "Rockall",
            score: total, maxScore: 11,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: scoreItems,
            redFlags: redFlags,
            evidenceNote: "Rockall 1996. Pre-endoscopy max = 7; post-endoscopy max = 11."
        )
    }

    private static func ageLabel(_ a: RockallInput.AgeGroup) -> String {
        switch a { case .under60: "Age <60 (0 pts)" ; case .sixtyTo79: "Age 60–79 (1 pt)"; case .over80: "Age ≥80 (2 pts)" }
    }
    private static func shockLabel(_ s: RockallInput.ShockStatus) -> String {
        switch s { case .none: "No shock (0 pts)"; case .pulse100SBPOver100: "HR >100, SBP ≥100 (1 pt)"; case .sbpBelow100: "SBP <100 (2 pts)" }
    }
    private static func comorbLabel(_ c: RockallInput.Comorbidity) -> String {
        switch c { case .none: "No comorbidity (0 pts)"; case .anyMajor: "CCF / IHD / major comorbidity (2 pts)"; case .renalOrLiverOrMalignancy: "Renal failure / liver failure / malignancy (3 pts)" }
    }
    private static func diagnosisLabel(_ d: RockallInput.EndoscopyDiagnosis) -> String {
        switch d { case .malloryWeissOrNoLesion: "Mallory-Weiss / no lesion (0 pts)"; case .allOtherDiagnoses: "Other diagnosis (1 pt)"; case .upperGIMalignancy: "Upper GI malignancy (2 pts)" }
    }

    // MARK: Glasgow-Blatchford Score

    static func blatchford(_ i: BlatchfordInput) -> ClinicalScore {
        var score = 0.0
        score += Double(i.bloodUreaNitrogen.rawValue)
        score += Double(i.sbp.rawValue)
        if i.heartRateOver100  { score += 1 }
        if i.melaena           { score += 1 }
        if i.syncope           { score += 2 }
        if i.hepaticDisease    { score += 2 }
        if i.cardiacFailure    { score += 2 }

        let hbPoints = i.haemoglobinPoints
        score += Double(hbPoints)

        let items: [ScoredItem] = [
            .init(label: "Blood urea nitrogen", points: Double(i.bloodUreaNitrogen.rawValue), present: i.bloodUreaNitrogen != .under6_5),
            .init(label: "Haemoglobin", points: Double(hbPoints), present: hbPoints > 0),
            .init(label: "Systolic BP", points: Double(i.sbp.rawValue), present: i.sbp != .over109),
            .init(label: "Heart rate >100 bpm", points: 1, present: i.heartRateOver100),
            .init(label: "Melaena", points: 1, present: i.melaena),
            .init(label: "Syncope", points: 2, present: i.syncope),
            .init(label: "Hepatic disease", points: 2, present: i.hepaticDisease),
            .init(label: "Cardiac failure", points: 2, present: i.cardiacFailure),
        ]
        let (risk, interp, recs) = blatchfordRisk(score)
        let redFlags = score >= 6 ? ["Blatchford ≥6: high risk — urgent endoscopy within 24h"] : []
        return ClinicalScore(
            systemName: "Glasgow-Blatchford Score",
            abbreviation: "Blatchford \(Int(score))",
            score: score, maxScore: 23,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Blatchford 2000. Predicts need for intervention in upper GI bleed before endoscopy. Score 0 = safe for outpatient management."
        )
    }

    private static func blatchfordRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0:     return (.low, "Blatchford 0: Very low risk — safe for outpatient management", ["Consider early discharge if no other concerns", "Outpatient endoscopy within 1–2 weeks", "Clear discharge advice on return criteria"])
        case 1...5: return (.moderate, "Blatchford \(Int(s)): Moderate risk — admit for observation", ["Admit and monitor", "Endoscopy within 24 hours", "IV access + group & screen", "NBM if high suspicion of variceal bleed"])
        default:    return (.high, "Blatchford \(Int(s)): High risk — urgent intervention likely", ["Urgent endoscopy within 12–24 hours", "ICU/HDU if haemodynamically unstable", "Correct coagulopathy pre-procedure", "Gastroenterology/GI surgery review", "Consider PPI infusion"])
        }
    }

    // MARK: AIMS65 (Upper GI Bleed In-Hospital Mortality)

    struct AIMS65Input: Equatable {
        var albuminUnder3: Bool = false      // serum albumin <3.0 g/dL (+1)
        var inrOver1point5: Bool = false     // INR >1.5 (+1)
        var alteredMentalStatus: Bool = false // altered mental status (+1)
        var systolicBPUnder90: Bool = false  // systolic BP ≤90 mmHg (+1)
        var ageOver65: Bool = false          // age ≥65 years (+1)
    }

    static func aims65(_ i: AIMS65Input) -> ClinicalScore {
        let flags = [i.albuminUnder3, i.inrOver1point5, i.alteredMentalStatus,
                     i.systolicBPUnder90, i.ageOver65]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "A — Albumin <3.0 g/dL",                           points: 1, present: i.albuminUnder3),
            .init(label: "I — INR >1.5",                                     points: 1, present: i.inrOver1point5),
            .init(label: "M — Altered mental status (disorientation / hepatic encephalopathy)", points: 1, present: i.alteredMentalStatus),
            .init(label: "S — Systolic BP ≤90 mmHg",                        points: 1, present: i.systolicBPUnder90),
            .init(label: "5 — Age ≥65 years",                               points: 1, present: i.ageOver65),
        ]
        let (risk, interp, recs, redFlags): (ScoreRisk, String, [String], [String]) = switch Int(score) {
        case 0:
            (.low,      "AIMS65 0 — In-hospital mortality 0.3%",
             ["Standard upper GI bleed pathway",
              "Early endoscopy within 24 h (within 12 h if haemodynamically unstable)",
              "IV PPI bolus + infusion after endoscopy if peptic ulcer confirmed",
              "Consider discharge within 24 h post-endoscopy if haemostasis confirmed"],
             [])
        case 1:
            (.low,      "AIMS65 1 — In-hospital mortality 1.2%",
             ["IV access × 2; FBC, U&E, coagulation, crossmatch",
              "IV fluid resuscitation; transfuse to Hb ≥70 g/L (>80 if ACS)",
              "Urgent upper GI endoscopy within 24 h",
              "IV PPI if peptic ulcer aetiology likely"],
             [])
        case 2:
            (.moderate, "AIMS65 2 — In-hospital mortality 4.3%",
             ["HDU-level nursing; continuous monitoring",
              "Early endoscopy within 12 h",
              "IV PPI (omeprazole 80 mg bolus then 8 mg/h for 72 h) after endoscopy",
              "Gastroenterology and surgical review",
              "Correct coagulopathy: FFP, platelets, vitamin K as indicated"],
             ["AIMS65 ≥2: consider HDU care"])
        case 3:
            (.high,     "AIMS65 3 — In-hospital mortality 12.7%",
             ["ICU-level care / resuscitation bay",
              "Urgent endoscopy within 12 h — resuscitate before scoping if haemodynamically compromised",
              "Activate massive transfusion protocol if needed",
              "Interventional radiology or surgery on standby",
              "Haematology review for coagulopathy reversal",
              "Consider vasopressors if refractory hypotension"],
             ["AIMS65 ≥3: high in-hospital mortality risk — escalate immediately"])
        default:
            (.critical, "AIMS65 \(Int(score)) — In-hospital mortality \(score >= 5 ? "~24.5%" : "~18.7%")",
             ["Emergency resuscitation; immediate ICU/resuscitation bay",
              "Massive transfusion protocol; correct all coagulopathy urgently",
              "Emergency endoscopy only when haemodynamically stabilised",
              "Surgery or interventional radiology for refractory haemorrhage",
              "Critical care + surgical + haematology joint review",
              "Discuss prognosis and goals of care early"],
             ["AIMS65 ≥4: critical upper GI haemorrhage — mortality approaching 25%"])
        }
        return ClinicalScore(
            systemName: "AIMS65 Score",
            abbreviation: "AIMS65 \(Int(score))/5",
            score: score, maxScore: 5,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Saltzman et al, Gastroenterology 2011. Validated in 29,222 patients. Predicts in-hospital mortality for upper GI haemorrhage. AUROC 0.77 vs Blatchford 0.68 for in-hospital mortality."
        )
    }

    // MARK: - Forrest Classification (peptic ulcer bleeding stigmata)

    static func forrest(_ i: ForrestInput) -> ClinicalScore {
        // Map grade to rebleed risk %, endoscopy recommendation, and score representation
        struct ForrestData {
            let label: String; let rebleedPct: Int; let risk: ScoreRisk
            let recs: [String]; let flags: [String]
        }
        let table: [Int: ForrestData] = [
            1: ForrestData(label: "Ia — Spurting arterial bleeding", rebleedPct: 90, risk: .critical,
                recs: ["Dual endoscopic therapy (injection + thermal/clip)",
                        "IV proton pump inhibitor infusion (80 mg bolus then 8 mg/h for 72 h)",
                        "Repeat endoscopy at 24 h",
                        "Surgical or interventional radiology backup immediately available",
                        "ICU-level monitoring; cross-match 4–6 units blood"],
                flags: ["Active arterial spurting — highest rebleed risk (~90%); surgery/IR if endoscopic haemostasis fails"]),
            2: ForrestData(label: "Ib — Oozing / non-spurting active bleeding", rebleedPct: 55, risk: .critical,
                recs: ["Dual endoscopic therapy",
                        "IV PPI infusion (80 mg bolus then 8 mg/h for 72 h)",
                        "Repeat endoscopy at 24 h if high-risk features persist",
                        "ICU/HDU monitoring; blood transfusion threshold Hb <80 g/L"],
                flags: ["Active oozing — rebleed risk ~55%"]),
            3: ForrestData(label: "IIa — Non-bleeding visible vessel", rebleedPct: 43, risk: .high,
                recs: ["Endoscopic therapy (thermal coagulation ± injection)",
                        "IV PPI infusion 72 h",
                        "Hospital admission; repeat endoscopy in 24 h",
                        "Oral PPI once infusion complete; H. pylori test and treat"],
                flags: ["Visible vessel — rebleed risk ~43%"]),
            4: ForrestData(label: "IIb — Adherent clot", rebleedPct: 22, risk: .moderate,
                recs: ["Attempt clot removal with endoscopic therapy (injection then wash)",
                        "If underlying vessel visible → treat as IIa",
                        "IV PPI infusion 72 h; oral PPI maintenance",
                        "Hospital admission 48–72 h; H. pylori test and treat"],
                flags: []),
            5: ForrestData(label: "IIc — Flat pigmented haematin spot", rebleedPct: 10, risk: .low,
                recs: ["Endoscopic therapy not routinely required",
                        "High-dose oral PPI (40 mg bd for 14 days)",
                        "H. pylori test and treat if not already done",
                        "Early discharge may be appropriate in low-risk patients (Blatchford 0–1)"],
                flags: []),
            6: ForrestData(label: "III — Clean ulcer base", rebleedPct: 5, risk: .low,
                recs: ["No endoscopic therapy required",
                        "Oral PPI (40 mg once daily × 4–8 weeks)",
                        "H. pylori test and treat",
                        "Consider early discharge in Blatchford score 0 patients",
                        "Outpatient follow-up; consider repeat endoscopy at 6–8 weeks if gastric ulcer"],
                flags: [])
        ]
        let data = table[i.grade] ?? table[6]!
        let items: [ScoredItem] = [
            ScoredItem(label: data.label, points: Double(data.rebleedPct), present: true)
        ]
        return ClinicalScore(
            systemName: "Forrest Classification",
            abbreviation: i.grade <= 2 ? "Ia/Ib" : i.grade == 3 ? "IIa" : i.grade == 4 ? "IIb" : i.grade == 5 ? "IIc" : "III",
            score: Double(i.grade), maxScore: 6,
            risk: data.risk,
            interpretation: "\(data.label) — estimated rebleed risk \(data.rebleedPct)%",
            recommendations: data.recs,
            items: items,
            redFlags: data.flags,
            evidenceNote: "Forrest JAH et al. Lancet 1974; 2:394–397. Laine L & Peterson WL. N Engl J Med 1994; 331:717–727."
        )
    }

    // MARK: - Oakland Score (Lower GI Bleed — Safe Discharge)

    struct OaklandInput: Equatable {
        var ageScore: Int = 0        // 0=<40; 1=40–69; 2=≥70
        var sexMale: Bool = false    // male = +1
        var previousLGIB: Bool = false  // previous hospital admission for LGIB = +1
        var dre: Int = 0             // 0=no blood on DRE; 1=blood on DRE
        var heartRate: Int = 0       // 0=<70; 1=70–89; 2=≥90 bpm
        var sbp: Int = 0             // 0=≥160 mmHg; 1=130–159; 2=100–129; 3=<100 mmHg
        var hbScore: Int = 0         // 0=Hb≥16 g/dL(M)/≥13(F); scale to 6 = Hb<7 g/dL
    }

    static func oakland(_ i: OaklandInput) -> ClinicalScore {
        let total = i.ageScore + (i.sexMale ? 1 : 0) + (i.previousLGIB ? 1 : 0)
                  + i.dre + i.heartRate + i.sbp + i.hbScore
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...8:
            risk = .low
            interpretation = "Oakland \(total) — Low risk; safe discharge appropriate (rebleed <5%)"
            recs = ["Outpatient colonoscopy within 2 weeks",
                    "Written discharge advice; return if haematochezia recurs",
                    "GP follow-up and full blood count in 2–3 days"]
            flags = []
        case 9...14:
            risk = .moderate
            interpretation = "Oakland \(total) — Intermediate risk; inpatient observation recommended"
            recs = ["Admit for inpatient colonoscopy within 24 h of bowel preparation",
                    "IV access and fluid resuscitation as required",
                    "Serial haematocrit monitoring every 6 h",
                    "Gastroenterology or colorectal surgery review"]
            flags = ["Intermediate-risk LGIB — inpatient workup required"]
        default:
            risk = .high
            interpretation = "Oakland \(total) — High risk; urgent inpatient management required"
            recs = ["Resuscitate with IV crystalloid; crossmatch and group-and-save",
                    "Urgent colonoscopy after rapid bowel preparation (≤24 h)",
                    "CT angiography if haemodynamically unstable or colonoscopy not feasible",
                    "Interventional radiology and colorectal surgery on standby",
                    "HDU/ICU admission if haemodynamic compromise"]
            flags = ["High-risk LGIB — haemodynamic instability likely",
                     "Urgent endoscopic or radiological haemostasis may be required"]
        }

        return ClinicalScore(
            systemName: "Oakland Score (LGIB)",
            abbreviation: "Oakland \(total)",
            score: Double(total), maxScore: 29,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age",             points: Double(i.ageScore),         present: i.ageScore > 0),
                ScoredItem(label: "Male sex",        points: i.sexMale ? 1.0 : 0.0,      present: i.sexMale),
                ScoredItem(label: "Previous LGIB",   points: i.previousLGIB ? 1.0 : 0.0, present: i.previousLGIB),
                ScoredItem(label: "Blood on DRE",    points: Double(i.dre),              present: i.dre > 0),
                ScoredItem(label: "Heart rate",      points: Double(i.heartRate),        present: i.heartRate > 0),
                ScoredItem(label: "Systolic BP",     points: Double(i.sbp),              present: i.sbp > 0),
                ScoredItem(label: "Haemoglobin",     points: Double(i.hbScore),          present: i.hbScore > 0)
            ],
            redFlags: flags,
            evidenceNote: "Oakland K et al. BMJ 2017;356:i6432. Validated for safe-discharge decision in acute LGIB presenting to ED. Score ≤8 = 95% probability of safe discharge without adverse outcome."
        )
    }

    // MARK: - Hinchey Classification (Perforated Diverticulitis)
    struct HincheyInput: Equatable {
        var grade: Int = 1  // 1a=pericolic abscess, 1b=mesorectal abscess, 2=pelvic abscess, 3=purulent peritonitis, 4=faecal peritonitis
    }

    static func hinchey(_ i: HincheyInput) -> ClinicalScore {
        let score = Double(i.grade)
        let flags: [String] = i.grade >= 3 ? ["Hinchey III/IV — generalised peritonitis: emergency surgery required"] : []
        let (risk, interp, recs): (ScoreRisk, String, [String])
        switch i.grade {
        case 1:
            (risk, interp, recs) = (
                .low,
                "Hinchey I (pericolic/mesorectal abscess): Localised pericolic or mesorectal abscess. Conservative management appropriate in most cases.",
                [
                    "IV antibiotics: co-amoxiclav 1.2 g TDS or piperacillin-tazobactam 4.5 g TDS",
                    "Nil by mouth until clinical improvement; then clear fluids",
                    "CT-guided percutaneous drainage if abscess >4 cm",
                    "Bowel rest and IV fluids",
                    "Reassess at 48–72 h; consider surgery if failure to improve",
                    "Elective sigmoid resection (laparoscopic Hartmann's or primary anastomosis) 6–8 weeks after recovery"
                ]
            )
        case 2:
            (risk, interp, recs) = (
                .moderate,
                "Hinchey II (pelvic abscess): Pelvic or distant abscess. CT-guided drainage is first-line; surgery if drainage fails.",
                [
                    "CT-guided percutaneous drainage if technically feasible",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Monitor WBC, CRP, and fever curve",
                    "Failure to respond at 48–72 h: laparoscopic lavage vs Hartmann's procedure",
                    "Plan interval sigmoid resection 6–8 weeks after recovery"
                ]
            )
        case 3:
            (risk, interp, recs) = (
                .high,
                "Hinchey III (purulent peritonitis): Generalised purulent peritonitis. Emergency surgery required — laparoscopic lavage vs Hartmann's procedure.",
                [
                    "Emergency surgical referral — theatre within 24 h in most cases",
                    "Resuscitation: IV fluids, electrolyte correction, Foley catheter",
                    "IV antibiotics: piperacillin-tazobactam 4.5 g TDS + metronidazole 500 mg TDS",
                    "Laparoscopic lavage and drainage (LADIES trial evidence) in select stable patients",
                    "Hartmann's procedure (sigmoid resection, end colostomy) for haemodynamic instability",
                    "ICU admission post-operatively for organ support if required",
                    "Stoma reversal considered at 6–12 months if patient fit"
                ]
            )
        default:
            (risk, interp, recs) = (
                .critical,
                "Hinchey IV (faecal peritonitis): Generalised faecal peritonitis. Life-threatening — emergency surgery within hours. Mortality 35–50%.",
                [
                    "Emergency surgery — immediate theatre (within 6 hours of diagnosis)",
                    "Aggressive resuscitation: target MAP >65 mmHg, lactate clearance",
                    "Vasopressors if septic shock: noradrenaline first-line",
                    "Hartmann's procedure (sigmoid resection, end colostomy) is standard",
                    "Damage control surgery if physiologically deranged (pH <7.2, T <34°C, coagulopathy)",
                    "ICU admission post-operatively",
                    "Mortality 35–50% — early goals of care discussion with family"
                ]
            )
        }
        return ClinicalScore(
            systemName: "Hinchey Classification",
            abbreviation: "Hinchey \(["0","Ia/Ib","II","III","IV"][min(i.grade, 4)])",
            score: score,
            maxScore: 4,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Grade Ia — pericolic abscess", points: 0, present: i.grade == 1),
                ScoredItem(label: "Grade II — pelvic/distant abscess", points: 0, present: i.grade == 2),
                ScoredItem(label: "Grade III — purulent peritonitis", points: 0, present: i.grade == 3),
                ScoredItem(label: "Grade IV — faecal peritonitis", points: 0, present: i.grade == 4)
            ],
            redFlags: flags,
            evidenceNote: "Hinchey EJ et al. Adv Surg 1978;12:85–109. Modified by Wasvary (1999) to include Grade Ia/Ib. LADIES trial (Br J Surg 2019) supports laparoscopic lavage for Hinchey III in stable patients. Faecal peritonitis (IV) remains a surgical emergency with high mortality."
        )
    }

    // MARK: - AIR Score (Appendicitis Inflammatory Response)
    struct AIRInput: Equatable {
        var vomiting: Bool = false                // 1 pt
        var painRIF: Bool = false                  // 1 pt — pain in right iliac fossa
        var reboundTenderness: Int = 0             // 0=none, 1=mild, 2=moderate, 3=strong
        var tempAbove38point5: Bool = false        // 1 pt — T ≥ 38.5°C
        var pmn: Int = 0                           // 0=<70%, 1=70–84%, 2=≥85%
        var wbc: Int = 0                           // 0=<10, 1=10–14.9, 2=≥15 ×10⁹/L
        var crp: Int = 0                           // 0=<10, 1=10–49, 2=≥50 mg/L
    }

    static func air(_ i: AIRInput) -> ClinicalScore {
        var pts = 0
        if i.vomiting      { pts += 1 }
        if i.painRIF       { pts += 1 }
        pts += min(i.reboundTenderness, 3)
        if i.tempAbove38point5 { pts += 1 }
        pts += min(i.pmn, 2)
        pts += min(i.wbc, 2)
        pts += min(i.crp, 2)

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        switch pts {
        case 0...4:
            risk = .low
            interp = "AIR \(pts)/12 — Low risk. Appendicitis unlikely. Consider observation, analgesia, and discharge with safety-net advice. D/W senior if clinical picture worsens."
            flags = []
            recs = [
                "Low risk — active observation or discharge with clear safety-net advice",
                "Reassess at 4–6 hours if admitted; repeat bloods and CRP if borderline",
                "Consider USS abdomen in children and women of childbearing age",
                "Return precautions: worsening pain, fever, vomiting — return immediately",
                "Avoid routine CT in low-risk AIR — radiation exposure not justified"
            ]
        case 5...8:
            risk = .moderate
            interp = "AIR \(pts)/12 — Intermediate risk. Significant probability of appendicitis. Admit for serial observation; imaging and surgical review recommended."
            flags = []
            recs = [
                "Admit for in-hospital observation — serial abdominal examinations",
                "Repeat FBC and CRP at 4–8 hours",
                "Ultrasound abdomen: first-line imaging (no radiation), especially in children and women",
                "CT abdomen/pelvis if USS non-diagnostic and clinical picture unclear",
                "Early surgical review — low threshold for diagnostic laparoscopy if clinical deterioration",
                "IV access and fluids; nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "AIR \(pts)/12 — High risk. Appendicitis highly likely. Surgical referral and theatre planning."
            flags = ["AIR ≥ 9 — high-risk appendicitis: urgent surgical assessment required"]
            recs = [
                "Urgent surgical referral — arrange theatre",
                "Nil by mouth, IV access, IV fluids, analgesia (morphine + anti-emetic)",
                "Preoperative bloods: FBC, CRP, U&E, LFT, coagulation, G&S",
                "IV antibiotics at induction: co-amoxiclav 1.2 g or cefuroxime + metronidazole",
                "Laparoscopic appendicectomy is the standard approach — open if laparoscopic not available",
                "Perforation risk increases with each additional hour — avoid unnecessary delay",
                "Imaging only if it will not delay theatre (may be omitted in classic high-risk presentations)"
            ]
        }
        return ClinicalScore(
            systemName: "AIR Score (Appendicitis Inflammatory Response)",
            abbreviation: "AIR \(pts)/12",
            score: Double(pts),
            maxScore: 12,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Vomiting", points: 1, present: i.vomiting),
                ScoredItem(label: "Pain in right iliac fossa", points: 1, present: i.painRIF),
                ScoredItem(label: "Rebound tenderness/guarding (mild)", points: 1, present: i.reboundTenderness == 1),
                ScoredItem(label: "Rebound tenderness/guarding (moderate)", points: 2, present: i.reboundTenderness == 2),
                ScoredItem(label: "Rebound tenderness/guarding (strong)", points: 3, present: i.reboundTenderness == 3),
                ScoredItem(label: "Temperature ≥ 38.5°C", points: 1, present: i.tempAbove38point5),
                ScoredItem(label: "PMN 70–84%", points: 1, present: i.pmn == 1),
                ScoredItem(label: "PMN ≥ 85%", points: 2, present: i.pmn == 2),
                ScoredItem(label: "WBC 10–14.9 × 10⁹/L", points: 1, present: i.wbc == 1),
                ScoredItem(label: "WBC ≥ 15 × 10⁹/L", points: 2, present: i.wbc == 2),
                ScoredItem(label: "CRP 10–49 mg/L", points: 1, present: i.crp == 1),
                ScoredItem(label: "CRP ≥ 50 mg/L", points: 2, present: i.crp == 2)
            ],
            redFlags: flags,
            evidenceNote: "Andersson M, Andersson RE. World J Surg 2008;32:1843–1849. AIR score validated across adult acute surgical populations. Sensitivity 96%, specificity 87% for scores ≥9. Superior to Alvarado in inflammatory marker specificity; requires FBC and CRP. Validated in Swedish and international cohorts."
        )
    }

    // MARK: - Paediatric Appendicitis Score (PAS)
    struct PASInput: Equatable {
        var anorexia: Bool = false              // 1 pt
        var nausea: Bool = false                // 1 pt
        var migration: Bool = false             // 1 pt — pain migrating to RIF
        var tendernessRIF: Bool = false         // 2 pts
        var coughPercussionHop: Bool = false    // 2 pts — cough/percussion/hopping worsens pain
        var pyrexia: Bool = false               // 1 pt — T ≥ 38.0°C
        var leukocytosis: Bool = false          // 2 pts — WBC > 10 × 10⁹/L
        var polymorphonuclearShift: Bool = false // 1 pt — PMN > 7.5 × 10⁹/L
    }

    static func pas(_ i: PASInput) -> ClinicalScore {
        var pts = 0
        if i.anorexia    { pts += 1 }
        if i.nausea      { pts += 1 }
        if i.migration   { pts += 1 }
        if i.tendernessRIF       { pts += 2 }
        if i.coughPercussionHop  { pts += 2 }
        if i.pyrexia     { pts += 1 }
        if i.leukocytosis         { pts += 2 }
        if i.polymorphonuclearShift { pts += 1 }

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]
        switch pts {
        case 0...3:
            risk = .low
            interp = "PAS \(pts)/10 — Low risk. Appendicitis unlikely in this child. Consider discharge with safety-net advice or short observation."
            flags = []
            recs = [
                "Low risk — observation 4–6 hours or discharge with clear safety-net advice",
                "Return immediately if: worsening pain, fever, vomiting, or inability to walk",
                "Consider USS abdomen if diagnosis remains uncertain",
                "Paediatric surgeon review if any deterioration during observation"
            ]
        case 4...6:
            risk = .moderate
            interp = "PAS \(pts)/10 — Intermediate risk. Significant probability of appendicitis. Admit, serial examination, imaging."
            flags = []
            recs = [
                "Admit for in-hospital observation and serial abdominal examinations",
                "FBC + CRP; repeat at 6–8 hours if borderline",
                "USS abdomen: first-line imaging in children (no radiation)",
                "MRI abdomen if USS non-diagnostic (preferred over CT in paediatric patients)",
                "Paediatric surgical review within 2–4 hours",
                "IV access, nil by mouth pending surgical decision"
            ]
        default:
            risk = .high
            interp = "PAS \(pts)/10 — High risk. Appendicitis likely in this child. Urgent surgical referral."
            flags = ["PAS ≥ 7 — high-risk paediatric appendicitis: urgent surgical referral"]
            recs = [
                "Urgent paediatric surgical referral — theatre planning",
                "IV access, IV fluids, analgesia (weight-adjusted morphine + ondansetron)",
                "Nil by mouth, FBC, CRP, U&E, group and save",
                "IV antibiotics at induction: co-amoxiclav (weight-adjusted dose)",
                "Laparoscopic appendicectomy is first-line in children",
                "Consider pre-op USS even in high PAS — may change operative approach if perforation/abscess",
                "Inform parents of perforation risk (~15–20% in paediatric appendicitis)"
            ]
        }
        return ClinicalScore(
            systemName: "Paediatric Appendicitis Score (PAS)",
            abbreviation: "PAS \(pts)/10",
            score: Double(pts),
            maxScore: 10,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Anorexia", points: 1, present: i.anorexia),
                ScoredItem(label: "Nausea / vomiting", points: 1, present: i.nausea),
                ScoredItem(label: "Migration of pain to RIF", points: 1, present: i.migration),
                ScoredItem(label: "Tenderness in right iliac fossa", points: 2, present: i.tendernessRIF),
                ScoredItem(label: "Cough / percussion / hop worsens pain", points: 2, present: i.coughPercussionHop),
                ScoredItem(label: "Pyrexia ≥ 38.0°C", points: 1, present: i.pyrexia),
                ScoredItem(label: "Leukocytosis (WBC > 10 × 10⁹/L)", points: 2, present: i.leukocytosis),
                ScoredItem(label: "Polymorphonuclear shift (PMN > 7.5 × 10⁹/L)", points: 1, present: i.polymorphonuclearShift)
            ],
            redFlags: flags,
            evidenceNote: "Samuel M. J Pediatr Surg 2002;37:877–881. PAS validated in children aged 2–18. Sensitivity 83%, specificity 80% for scores ≥7. Less specific than AIR for adults; use PAS in paediatric populations (<16 yrs). USS first-line imaging in children — CT reserved for diagnostic uncertainty only."
        )
    }

    // MARK: - Los Angeles Classification (GERD / Oesophagitis)
    struct LosAngelesInput: Equatable {
        var grade: Int = 0  // 0=None, 1=Grade A, 2=Grade B, 3=Grade C, 4=Grade D
    }
    static func losAngeles(_ i: LosAngelesInput) -> ClinicalScore {
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch i.grade {
        case 0:
            interp = "No endoscopic oesophagitis"
            risk   = .low
            recs   = ["Non-erosive reflux disease (NERD) if symptoms present",
                      "Empirical PPI trial 4–8 weeks; lifestyle advice (weight loss, head-of-bed elevation)",
                      "Consider 24-h pH/impedance if atypical symptoms or PPI failure"]
        case 1:
            interp = "Grade A — ≥1 mucosal break ≤5 mm, not extending between folds"
            risk   = .low
            recs   = ["PPI once daily (standard dose) for 4–8 weeks",
                      "Lifestyle modifications (avoid late meals, alcohol, tobacco)",
                      "Repeat OGD only if symptoms persist or alarm features develop"]
        case 2:
            interp = "Grade B — ≥1 mucosal break >5 mm, not extending between folds"
            risk   = .moderate
            recs   = ["PPI standard dose twice daily for 8 weeks",
                      "Confirm healing at 8 weeks: repeat OGD to exclude Barrett's",
                      "Consider H. pylori testing and eradication",
                      "Anti-reflux surgery (fundoplication) discussion if PPI-dependent"]
        case 3:
            interp = "Grade C — Mucosal breaks extending between ≥2 folds, <75% circumference"
            risk   = .moderate
            recs   = ["High-dose PPI twice daily for 8 weeks minimum",
                      "Repeat OGD to confirm healing and exclude Barrett's oesophagus",
                      "H. pylori testing mandatory",
                      "Refer for anti-reflux surgery evaluation if PPI refractory",
                      "Biopsy for Barrett's surveillance protocol if columnar metaplasia seen"]
        default:
            interp = "Grade D — Mucosal breaks extending ≥75% of oesophageal circumference"
            risk   = .high
            recs   = ["High-dose PPI twice daily for 8–12 weeks; IV PPI if unable to swallow",
                      "Urgent repeat OGD at 8 weeks — high risk of Barrett's and stricture",
                      "Biopsy from all four quadrants every 2 cm if columnar segment present",
                      "Oesophageal dilation if peptic stricture develops",
                      "Multidisciplinary discussion for anti-reflux surgery or endoscopic therapy"]
        }
        let gradeLabel = ["None","A","B","C","D"][min(i.grade, 4)]
        return ClinicalScore(
            name:          "LA Classification",
            score:         Double(i.grade),
            maxScore:      4,
            risk:          risk,
            interpretation: "Grade \(gradeLabel): \(interp)",
            recommendations: recs,
            evidenceNote:  "Lundell LR et al. Gut 1999;45:172–180. Los Angeles Classification of oesophagitis: Grade A–D based on extent and continuity of mucosal breaks at OGD. Internationally adopted standard; grade predicts PPI response rate (A/B >90%, C/D ~70%) and Barrett's risk (D ~30%)."
        )
    }

    // MARK: - Truelove-Witts Severity Index (Ulcerative Colitis)
    struct TruelovewIttsInput: Equatable {
        var stoolsPerDay: Int = 0         // BM frequency per day
        var macroscopicBlood: Bool = false // Visible blood in stool
        var hrAbove90: Bool = false        // HR > 90 bpm
        var tempAbove375: Bool = false     // Temperature > 37.5°C
        var hbBelow105: Bool = false       // Haemoglobin < 10.5 g/dL (< 105 g/L)
        var esrAbove30: Bool = false       // ESR > 30 mm/hr
    }
    static func truelovewItts(_ i: TruelovewIttsInput) -> ClinicalScore {
        let (interp, risk, score, recs): (String, ScoreRisk, Double, [String])
        let systemic = (i.hrAbove90 ? 1 : 0) + (i.tempAbove375 ? 1 : 0) +
                       (i.hbBelow105 ? 1 : 0) + (i.esrAbove30 ? 1 : 0)
        let hasSystemic = systemic >= 2
        switch (i.stoolsPerDay, i.macroscopicBlood, hasSystemic) {
        case (let n, _, false) where n < 4:
            interp = "Mild UC — < 4 stools/day, no systemic involvement"
            risk   = .low
            score  = 1
            recs   = ["Topical aminosalicylate (suppository or enema) for distal disease",
                      "Oral mesalazine for extensive mild UC",
                      "Outpatient management with gastroenterology review in 2–4 weeks",
                      "Ensure calprotectin and CRP documented"]
        case (4...5, _, false), (4...5, false, _):
            interp = "Moderate UC — 4–5 stools/day without systemic toxicity"
            risk   = .moderate
            score  = 2
            recs   = ["Oral prednisolone 40 mg daily — standard induction",
                      "Continue maintenance aminosalicylate at full dose",
                      "Ensure gastroenterology review within 5–7 days",
                      "Stool MC&S to exclude infective colitis",
                      "FBC, CRP, albumin, LFTs baseline"]
        default:
            interp = "Severe UC — ≥6 stools/day OR ≥4 with systemic toxicity (Truelove-Witts criteria)"
            risk   = .high
            score  = 3
            recs   = ["Admit for IV hydrocortisone 100 mg QDS (or equivalent)",
                      "Daily stool chart and CRP; abdominal X-ray on admission",
                      "Surgical assessment on day of admission — colectomy if not responding",
                      "Assessment at 72 h: Oxford Score/CRP > 45 at day 3 = predict failure",
                      "Biologic rescue therapy (infliximab or ciclosporin) if IV steroids fail at 72 h",
                      "Involve colorectal surgery — nil by mouth if toxic megacolon suspected"]
        }
        return ClinicalScore(
            name:          "Truelove-Witts",
            score:         score,
            maxScore:      3,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Truelove SC, Witts LJ. BMJ 1955;2:1041–1048. Original criteria: mild = <4 stools/day, no systemic features; severe = ≥6/day + one of HR>90, temp>37.5°C, Hb<10.5, ESR>30; moderate = between mild and severe. Remains the cornerstone of inpatient IBD management decisions. ACPGBI/BSG guidelines endorse IV steroids for severe disease with surgical assessment from day 1."
        )
    }

    // MARK: - Harvey-Bradshaw Index (Crohn's Disease Activity)
    struct HarveyBradshawInput: Equatable {
        var generalWellbeing: Int = 0     // 0=very well, 1=slightly below par, 2=poor, 3=very poor, 4=terrible
        var abdominalPain: Int = 0        // 0=none, 1=mild, 2=moderate, 3=severe
        var liquidStoolsPerDay: Int = 0   // number of liquid stools per day
        var abdominalMass: Int = 0        // 0=none, 1=dubious, 2=definite, 3=definite + tender
        var complications: Int = 0        // number present: arthralgia, uveitis, erythema nodosum, aphthous ulcers, pyoderma, anal fissure, fistula, abscess
    }
    static func harveyBradshaw(_ i: HarveyBradshawInput) -> ClinicalScore {
        let total = i.generalWellbeing + i.abdominalPain + i.liquidStoolsPerDay +
                    i.abdominalMass + i.complications
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...4:
            interp = "Remission (HBI < 5)"
            risk   = .low
            recs   = ["Continue maintenance therapy (azathioprine, anti-TNF, or vedolizumab)",
                      "Gastroenterology review every 6–12 months",
                      "Annual calprotectin, CRP, FBC, LFTs",
                      "Surveillance ileocolonoscopy per local IBD protocol"]
        case 5...7:
            interp = "Mildly active Crohn's disease (HBI 5–7)"
            risk   = .low
            recs   = ["Review current maintenance therapy — optimise dose",
                      "Check therapeutic drug levels if on anti-TNF",
                      "Enteral nutrition as adjunct in young patients",
                      "Exclude infection: stool MC&S, C. difficile, CMV",
                      "Gastroenterology review within 2–4 weeks"]
        case 8...16:
            interp = "Moderately active Crohn's disease (HBI 8–16)"
            risk   = .moderate
            recs   = ["Prednisolone induction: 40 mg daily tapering over 8 weeks",
                      "Consider biological therapy if corticosteroid-dependent or refractory",
                      "IBD nurse specialist involvement for monitoring and patient education",
                      "MRE or CT enterography to assess extent and exclude complication",
                      "Surgical review if loculated collection, stricture, or fistula identified"]
        default:
            interp = "Severely active Crohn's disease (HBI > 16)"
            risk   = .high
            recs   = ["Hospital admission for IV hydrocortisone or biological rescue",
                      "Urgent cross-sectional imaging (MRI/CT) for abscess, perforation, or fistula",
                      "Surgical assessment — resection or drainage as indicated",
                      "Nutritional support: nasogastric or parenteral nutrition",
                      "Multidisciplinary IBD team decision within 48 hours"]
        }
        return ClinicalScore(
            name:          "Harvey-Bradshaw Index",
            score:         Double(total),
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Harvey RF, Bradshaw JM. Lancet 1980;1:514. 5-item simplified CDAI derivative; remission <5, mild 5–7, moderate 8–16, severe >16. Requires no laboratory values; validated for outpatient monitoring. Correlates with CDAI (r ≈ 0.93). Used in surgical trials for objective preoperative activity stratification."
        )
    }

    // MARK: - #94 Manning Criteria for IBS

    struct ManningInput: Equatable {
        var painRelievedByDefecation: Bool
        var looserStoolsWithOnsetOfPain: Bool
        var increasedFrequencyWithOnsetOfPain: Bool
        var abdomenVisiblyDistended: Bool
        var mucusPerRectum: Bool
        var feelingOfIncompleteEmptying: Bool
    }

    static func manning(_ i: ManningInput) -> ClinicalScore {
        var score = 0
        if i.painRelievedByDefecation        { score += 1 }
        if i.looserStoolsWithOnsetOfPain     { score += 1 }
        if i.increasedFrequencyWithOnsetOfPain { score += 1 }
        if i.abdomenVisiblyDistended         { score += 1 }
        if i.mucusPerRectum                  { score += 1 }
        if i.feelingOfIncompleteEmptying     { score += 1 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        switch score {
        case 0, 1:
            risk  = .low
            interp = "Manning \(score)/6 — IBS unlikely. Consider organic pathology."
            recs  = [
                "Evaluate for organic causes: IBD, colorectal neoplasia, coeliac disease",
                "Colonoscopy if alarm features (rectal bleeding, weight loss, age >45, family history CRC)",
                "Coeliac serology (anti-tTG IgA)"
            ]
        case 2, 3:
            risk  = .moderate
            interp = "Manning \(score)/6 — Possible IBS. Consider targeted workup to exclude organic disease."
            recs  = [
                "Full blood count, CRP, faecal calprotectin to exclude IBD",
                "Coeliac serology",
                "Dietary assessment — low-FODMAP trial if organic disease excluded",
                "Rome IV criteria reassessment at follow-up"
            ]
        default:
            risk  = .high
            interp = "Manning \(score)/6 — Probable IBS (≥3 criteria met). Sensitivity 58–78%, specificity 67–74%."
            recs  = [
                "Confirm Rome IV criteria for IBS subtype classification (IBS-C, IBS-D, IBS-M)",
                "Faecal calprotectin to exclude IBD before committing to IBS diagnosis",
                "Colonoscopy only if alarm features present",
                "Dietary modification — low-FODMAP diet with dietitian support",
                "Antispasmodics (mebeverine, hyoscine) for pain management",
                "Cognitive behavioural therapy or gut-directed hypnotherapy for refractory symptoms"
            ]
        }

        return ClinicalScore(
            name:          "Manning Criteria for IBS",
            score:         Double(score),
            maxScore:      6,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Manning AP et al. BMJ 1978;2:653. Six symptom criteria for IBS diagnosis (score ≥3 supports diagnosis). Sensitivity 58–78%, specificity 67–74%. Superseded by Rome IV for formal classification but widely used clinically. Should not replace investigation when alarm features present."
        )
    }

    // MARK: - #100 Fong Clinical Risk Score (Colorectal Liver Metastases)

    struct FongCRSInput: Equatable {
        var nodePosivePrimaryTumour: Bool    // lymph node–positive primary CRC
        var diseaseFreeIntervalLess12Mo: Bool // DFI < 12 months from primary resection
        var moreThanOneHepaticTumour: Bool   // > 1 hepatic metastasis
        var largestTumourOver5cm: Bool       // largest hepatic met > 5 cm
        var ceaOver200: Bool                 // preoperative CEA > 200 ng/mL
    }

    static func fongCRS(_ i: FongCRSInput) -> ClinicalScore {
        var score = 0
        if i.nodePosivePrimaryTumour        { score += 1 }
        if i.diseaseFreeIntervalLess12Mo    { score += 1 }
        if i.moreThanOneHepaticTumour       { score += 1 }
        if i.largestTumourOver5cm          { score += 1 }
        if i.ceaOver200                    { score += 1 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0:
            risk  = .low
            interp = "Fong CRS \(score)/5 — Favourable prognosis. Estimated 5-year survival ~60% after hepatic resection."
            recs  = [
                "Proceed to hepatic resection if technically feasible and patient fit",
                "Colorectal MDT review",
                "Perioperative systemic chemotherapy (FOLFOX/CAPOX) per EPOC trial principles",
                "Consider ablation for small residual lesions if margins tight"
            ]
        case 1, 2:
            risk  = .moderate
            interp = "Fong CRS \(score)/5 — Intermediate prognosis. Estimated 5-year survival ~40% after hepatic resection."
            recs  = [
                "Colorectal liver MDT — hepato-pancreato-biliary surgeon, oncologist, radiologist",
                "Perioperative chemotherapy (FOLFOX/CAPOX): consider neoadjuvant to test tumour biology",
                "Staging FDG-PET CT to exclude extrahepatic disease before committing to resection",
                "Hepatic resection if ≥1 cm negative margin achievable and FLR adequate"
            ]
        case 3, 4:
            risk  = .high
            interp = "Fong CRS \(score)/5 — Poor prognosis. Estimated 5-year survival ~20% after hepatic resection."
            recs  = [
                "Oncology-led MDT discussion — systemic chemotherapy as primary treatment",
                "PET-CT mandatory to exclude extrahepatic disease",
                "Surgery only if good response to chemotherapy (≥30% tumour shrinkage) and fit patient",
                "Consider ablative techniques as alternative to open resection"
            ]
            flags = ["CRS ≥3 — poor prognosis; chemotherapy response before surgery is critical"]
        default:
            risk  = .critical
            interp = "Fong CRS \(score)/5 — Very poor prognosis. Surgery unlikely to confer survival benefit."
            recs  = [
                "Systemic chemotherapy — reassess for hepatic surgery after documented response",
                "Clinical trial enrolment if available (e.g. EGFR/VEGF-targeted therapy for RAS wild-type)",
                "Best supportive care and palliative care involvement early",
                "Reassess resectability after 3–4 cycles with repeat CT/PET"
            ]
            flags = ["CRS 5/5 — very poor 5-year survival; surgery not recommended without prior response to chemotherapy"]
        }

        return ClinicalScore(
            name:          "Fong Clinical Risk Score",
            score:         Double(score),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Fong Y et al. Ann Surg 1999;230:309. Five-variable CRS for predicting outcome after hepatic resection of colorectal liver metastases: node-positive primary, DFI <12 months, >1 hepatic tumour, largest tumour >5 cm, preoperative CEA >200 ng/mL. Score 0–5; each point progressively worsens 5-year survival (score 0 ≈60%; score 5 ≈14%). Validated in multiple external cohorts and widely used in hepato-pancreato-biliary surgical oncology decision-making."
        )
    }

    // MARK: - #110 RIPASA Score (Right Iliac Fossa Pain / Appendicitis)

    struct RIPASAInput: Equatable {
        var male: Bool
        var age14to39: Bool          // foreign national adds 1 point
        var foreignNational: Bool
        var migratingToRIF: Bool
        var anorexia: Bool
        var nausea: Bool
        var vomiting: Bool
        var durationUnder48h: Bool
        var rofFossaTenderness: Bool
        var guarding: Bool
        var reboundTenderness: Bool
        var rovsing: Bool
        var fever37_5to38_5: Bool
        var elevatedWBC: Bool
        var abnormalUrinalysis: Bool
    }

    static func ripasa(_ i: RIPASAInput) -> ClinicalScore {
        var score = 0.0

        if i.male { score += 1.0 }
        if i.age14to39 { score += 1.0 }
        if i.foreignNational { score += 1.0 }
        if i.migratingToRIF { score += 0.5 }
        if i.anorexia { score += 1.0 }
        if i.nausea { score += 1.0 }
        if i.vomiting { score += 1.0 }
        if i.durationUnder48h { score += 1.0 }
        if i.rofFossaTenderness { score += 1.0 }
        if i.guarding { score += 2.0 }
        if i.reboundTenderness { score += 1.0 }
        if i.rovsing { score += 2.0 }
        if i.fever37_5to38_5 { score += 1.0 }
        if i.elevatedWBC { score += 1.0 }
        if i.abnormalUrinalysis { score += 1.0 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case ..<5.5:
            risk  = .low
            interp = String(format: "RIPASA %.1f — Low probability of appendicitis. Observe with serial assessment.", score)
            recs  = ["Observe for 4–12 hours; repeat clinical assessment",
                     "Analgesia and IV fluids as needed",
                     "Consider alternative diagnoses: ovarian pathology, mesenteric adenitis, Meckel's diverticulitis",
                     "Discharge with written advice if improving and tolerating oral fluids"]
        case 5.5..<7.5:
            risk  = .moderate
            interp = String(format: "RIPASA %.1f — Intermediate probability. Further investigation required.", score)
            recs  = ["CT abdomen with IV contrast or USS (ultrasound guided)",
                     "Serial examination 2–4 hourly",
                     "FBC, CRP, urinalysis",
                     "Surgical review",
                     "Low threshold for diagnostic laparoscopy if no imaging clarification"]
        case 7.5..<11.5:
            risk  = .high
            interp = String(format: "RIPASA %.1f — High probability of appendicitis. Surgical intervention warranted.", score)
            recs  = ["Surgical consent for laparoscopic appendicectomy",
                     "IV antibiotics (pre-operative prophylaxis): co-amoxiclav or metronidazole + gentamicin",
                     "CT abdomen if atypical features or diagnostic uncertainty",
                     "NBM — arrange operating list",
                     "IV fluids and analgesia"]
            flags = ["RIPASA ≥7.5: appendicitis probable — consult surgeon urgently"]
        default:
            risk  = .critical
            interp = String(format: "RIPASA %.1f — Very high probability / suspected perforation. Immediate intervention.", score)
            recs  = ["Emergency laparoscopic appendicectomy",
                     "IV broad-spectrum antibiotics commenced immediately (piperacillin-tazobactam or meropenem if sepsis)",
                     "Urgent CT if perforation suspected and stable enough to delay",
                     "NBM, IV fluids, analgesia, anti-emetics",
                     "ICU/HDU booking if septic shock suspected"]
            flags = ["RIPASA ≥11.5: probable perforated appendicitis — emergency surgery; IV broad-spectrum antibiotics now"]
        }

        return ClinicalScore(
            name:          "RIPASA Score",
            score:         score,
            maxScore:      16,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Chong CF et al. Singapore Med J 2010;51(3):220. RIPASA (Right Iliac Fossa Pain Assessment Score) validated in Asian and Middle Eastern populations where Alvarado under-performs. 15 parameters; score <5.5=exclude, 5.5–7.5=observe, 7.5–11.5=probable appendicitis, ≥11.5=appendicitis very probable. Sensitivity 98%, specificity 81% vs Alvarado's sensitivity 71–88% in same populations. Incorporates demographic factors (sex, age, foreign national origin) that reflect different presentations and healthcare-seeking behaviour in Asian patients."
        )
    }

    // MARK: - #111 Fournier Gangrene Severity Index (FGSI)

    struct FGSIInput: Equatable {
        var temperature: Double     // °C
        var heartRate: Int          // bpm
        var respiratoryRate: Int    // breaths/min
        var sodium: Double          // mmol/L
        var potassium: Double       // mmol/L
        var creatinine: Double      // μmol/L
        var haematocrit: Double     // %
        var wbc: Double             // ×10⁹/L
        var bicarbonate: Double     // mmol/L
    }

    static func fgsi(_ i: FGSIInput) -> ClinicalScore {
        var score = 0

        // Temperature deviation from normal (36.0–38.4 = 0)
        let tempDev = abs(i.temperature - 37.0)
        score += tempDev >= 4.0 ? 4 : (tempDev >= 2.0 ? 3 : (tempDev >= 1.0 ? 2 : (tempDev > 0.5 ? 1 : 0)))

        // Heart rate (bpm)
        score += i.heartRate < 55 ? 4 : (i.heartRate < 70 ? 3 : (i.heartRate < 110 ? 0 : (i.heartRate < 140 ? 2 : (i.heartRate < 180 ? 3 : 4))))

        // Respiratory rate (breaths/min)
        score += i.respiratoryRate < 6 ? 4 : (i.respiratoryRate < 10 ? 3 : (i.respiratoryRate < 12 ? 2 : (i.respiratoryRate < 25 ? 0 : (i.respiratoryRate < 35 ? 1 : (i.respiratoryRate < 50 ? 3 : 4)))))

        // Sodium (mmol/L)
        score += i.sodium < 111 ? 4 : (i.sodium < 122 ? 3 : (i.sodium < 132 ? 2 : (i.sodium < 152 ? 0 : (i.sodium < 162 ? 1 : (i.sodium < 172 ? 2 : (i.sodium < 182 ? 3 : 4))))))

        // Potassium (mmol/L)
        score += i.potassium < 2.5 ? 4 : (i.potassium < 3.0 ? 2 : (i.potassium < 3.5 ? 1 : (i.potassium <= 5.5 ? 0 : (i.potassium < 6.0 ? 1 : (i.potassium < 7.0 ? 3 : 4)))))

        // Creatinine (μmol/L)
        score += i.creatinine < 53 ? 3 : (i.creatinine < 107 ? 0 : (i.creatinine < 168 ? 2 : (i.creatinine < 309 ? 3 : 4)))

        // Haematocrit (%)
        score += i.haematocrit < 20 ? 4 : (i.haematocrit < 30 ? 2 : (i.haematocrit < 46 ? 0 : (i.haematocrit < 50 ? 1 : (i.haematocrit < 60 ? 2 : 4))))

        // WBC (×10⁹/L)
        score += i.wbc < 1.0 ? 4 : (i.wbc < 3.0 ? 2 : (i.wbc < 15.0 ? 0 : (i.wbc < 20.0 ? 1 : (i.wbc < 40.0 ? 2 : 4))))

        // Bicarbonate (mmol/L)
        score += i.bicarbonate < 15 ? 4 : (i.bicarbonate < 18 ? 3 : (i.bicarbonate < 22 ? 2 : (i.bicarbonate < 32 ? 0 : (i.bicarbonate < 41 ? 1 : 2))))

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if score <= 9 {
            risk  = .high
            interp = "FGSI \(score) — Lower severity Fournier gangrene. Early mortality risk ~8–15%."
            recs  = ["Emergency wide surgical debridement — do not delay",
                     "IV broad-spectrum antibiotics: carbapenem + glycopeptide + metronidazole",
                     "ICU admission",
                     "Urology or colorectal surgery involvement depending on source",
                     "Repeat debridement at 24–48 hours",
                     "Vacuum-assisted wound closure (VAC) after debridement",
                     "Consider hyperbaric oxygen therapy if available"]
            flags = ["Fournier gangrene: emergency debridement regardless of FGSI — any score is life-threatening"]
        } else {
            risk  = .critical
            interp = "FGSI \(score) — Severe Fournier gangrene. High mortality risk ≥50%."
            recs  = ["Immediate emergency debridement — prognosis worsens with every hour of delay",
                     "Aggressive ICU resuscitation: MAP ≥65 mmHg, ScvO₂ ≥70%, lactate clearance",
                     "Broad-spectrum IV antibiotics: meropenem + vancomycin + metronidazole (consider IVIG)",
                     "Multiple planned re-debridements (typically 24–48 h intervals until clean margins)",
                     "Consider faecal diversion (defunctioning colostomy) if perianal involvement",
                     "Plastic/reconstructive surgery involvement for wound reconstruction planning",
                     "Hyperbaric oxygen therapy (5–10 sessions) — reduces mortality in observational data",
                     "Early family discussion regarding prognosis"]
            flags = ["FGSI ≥9: mortality ≥50% — immediate ICU + emergency surgery; critical prognosis discussion with family"]
        }

        return ClinicalScore(
            name:          "Fournier Gangrene Severity Index (FGSI)",
            score:         Double(score),
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Laor E et al. J Urol 1995;154:89. FGSI based on the APACHE II physiological subscale: 9 parameters, each scored 0–4 deviation from normal. Original threshold FGSI >9 predicts death (sensitivity 75%, specificity 84%; mortality 73% vs 12% for ≤9 in original series). Modern series report lower mortality with aggressive ICU care but FGSI >9 still identifies high-risk cohort. Note: FGSI does not capture extent of skin involvement — the Uludag FGSI (UFGSI) adds age and extent of involvement and has higher predictive accuracy in some series."
        )
    }



}
