// ClinicalScoringEngine+AbdominalGI5.swift
// Manning Criteria for IBS, Fong CRS, RIPASA Score, Fournier Gangrene Severity Index
// No AI, no network calls — HIPAA-safe.
// Input structs live in ClinicalScoringEngine+InputStructs3.swift.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - #94 Manning Criteria for IBS

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
