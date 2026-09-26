// ClinicalScoringEngine+AbdominalGI4.swift
// AIMS65 upper GI bleed in-hospital mortality and Forrest Classification scoring.

import Foundation


extension ClinicalScoringEngine {

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
