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

}
