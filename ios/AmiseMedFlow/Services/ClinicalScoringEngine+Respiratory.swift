// ClinicalScoringEngine+Respiratory.swift
// Respiratory / Pulmonary scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: STOP-BANG (OSA)

    static func stopBang(_ i: STOPBANGInput) -> ClinicalScore {
        let flags = [i.snoring, i.tired, i.observed, i.pressureTreated,
                     i.bmiOver35, i.ageOver50, i.neckOver40cm, i.male]
        let score = Double(flags.filter { $0 }.count)
        let items: [ScoredItem] = [
            .init(label: "S — Snoring loudly", points: 1, present: i.snoring),
            .init(label: "T — Tired / fatigued during day", points: 1, present: i.tired),
            .init(label: "O — Observed apnoea (partner/witness)", points: 1, present: i.observed),
            .init(label: "P — Pressure / hypertension (treated or BP >140/90)", points: 1, present: i.pressureTreated),
            .init(label: "B — BMI >35 kg/m²", points: 1, present: i.bmiOver35),
            .init(label: "A — Age >50 years", points: 1, present: i.ageOver50),
            .init(label: "N — Neck circumference >40 cm", points: 1, present: i.neckOver40cm),
            .init(label: "G — Gender male", points: 1, present: i.male),
        ]
        let (risk, interp, recs) = stopBangRisk(score)
        let redFlags = i.observed ? ["Observed apnoea: high pre-test probability of OSA regardless of total score"] : []
        return ClinicalScore(
            systemName: "STOP-BANG Questionnaire",
            abbreviation: "STOP-BANG \(Int(score))/8",
            score: score, maxScore: 8,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Chung 2008. Pre-operative OSA screening. Sensitivity 84% for moderate–severe OSA (AHI ≥15) at score ≥3."
        )
    }

    private static func stopBangRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...2: return (.low, "STOP-BANG \(Int(s))/8: Low OSA risk", ["Routine anaesthetic assessment", "Standard post-op oxygen monitoring"])
        case 3...4: return (.moderate, "STOP-BANG \(Int(s))/8: Intermediate OSA risk", ["Pre-op sleep study or SpO₂ overnight if time allows", "Discuss with anaesthesia team pre-op", "Avoid benzodiazepines if possible", "PACU monitoring; consider extended post-op SpO₂"])
        default:    return (.high, "STOP-BANG \(Int(s))/8: High OSA risk", ["Formal sleep study / polysomnography", "If CPAP user: bring CPAP to hospital", "Inform anaesthetist pre-op", "Avoid opioids where possible; use multimodal analgesia", "Extended PACU stay / HDU post-op consideration", "Nurse semi-upright post-operatively"])
        }
    }

    // MARK: PSI/PORT — Community-Acquired Pneumonia Severity Index

    static func psiPort(_ i: PSIPortInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age (male, per year)", points: Double(i.ageMale), present: i.ageMale > 0),
            .init(label: "Age −10 (female, per year)", points: Double(i.ageFemale), present: i.ageFemale > 0),
            .init(label: "Nursing home resident", points: 10, present: i.nursingHomeResident),
            .init(label: "Neoplastic disease", points: 30, present: i.neoplasticDisease),
            .init(label: "Liver disease", points: 20, present: i.liverDisease),
            .init(label: "Congestive heart failure", points: 10, present: i.congestiveHeartFailure),
            .init(label: "Cerebrovascular disease", points: 10, present: i.cerebrovascularDisease),
            .init(label: "Renal disease", points: 10, present: i.renalDisease),
            .init(label: "Altered mental status", points: 20, present: i.alteredMentalStatus),
            .init(label: "Respiratory rate ≥30/min", points: 20, present: i.respiratoryRateOver30),
            .init(label: "Systolic BP <90 mmHg", points: 20, present: i.systolicBPUnder90),
            .init(label: "Temp <35°C or ≥40°C", points: 15, present: i.tempUnder35orOver40),
            .init(label: "Heart rate ≥125 bpm", points: 10, present: i.heartRateOver125),
            .init(label: "Arterial pH <7.35", points: 30, present: i.arterialPHUnder735),
            .init(label: "BUN ≥11 mmol/L", points: 20, present: i.bunOver11mmoL),
            .init(label: "Sodium <130 mEq/L", points: 20, present: i.sodiumUnder130),
            .init(label: "Glucose ≥14 mmol/L", points: 10, present: i.glucoseOver14),
            .init(label: "Haematocrit <30%", points: 10, present: i.haematocritUnder30),
            .init(label: "PaO₂ <60 mmHg or SpO₂ <90%", points: 10, present: i.pao2Under60orSpO2Under90),
            .init(label: "Pleural effusion on imaging", points: 10, present: i.pleuralEffusion),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let (psiClass, risk, interpretation, recs, redFlags): (Int, ScoreRisk, String, [String], [String])
        switch score {
        case ..<71:
            let cls = score <= 0 || (!i.neoplasticDisease && !i.liverDisease && !i.congestiveHeartFailure
                                     && !i.cerebrovascularDisease && !i.renalDisease
                                     && !i.alteredMentalStatus && !i.respiratoryRateOver30
                                     && !i.systolicBPUnder90 && !i.heartRateOver125
                                     && !i.pao2Under60orSpO2Under90
                                     && (i.ageMale > 0 ? i.ageMale < 50 : i.ageFemale < 40)) ? 1 : 2
            psiClass = cls; risk = .low
            interpretation = "PSI Class \(cls) — 30-day mortality \(cls == 1 ? "<0.1%" : "0.6%")"
            recs = ["Outpatient treatment appropriate", "Amoxicillin 500 mg TDS or doxycycline",
                    "Review in 48 h if not improving", "Return if oxygen saturation falls"]
            redFlags = []
        case 71...90:
            psiClass = 3; risk = .moderate
            interpretation = "PSI Class III — 30-day mortality ~2.8%"
            recs = ["Brief inpatient observation or outpatient with close follow-up",
                    "Amoxicillin-clavulanate ± macrolide", "SpO₂ monitoring", "Review in 24 h"]
            redFlags = []
        case 91...130:
            psiClass = 4; risk = .high
            interpretation = "PSI Class IV — 30-day mortality ~8.2%"
            recs = ["Hospital admission required", "Amoxicillin-clavulanate + clarithromycin IV/oral",
                    "Continuous SpO₂ monitoring", "FBC, U&E, CRP, blood cultures × 2 before antibiotics",
                    "Chest X-ray follow-up at 6 weeks"]
            redFlags = ["Class IV: admission and IV antibiotics mandatory"]
        default:
            psiClass = 5; risk = .critical
            interpretation = "PSI Class V — 30-day mortality ~29%"
            recs = ["ICU-level care required", "Piperacillin-tazobactam + azithromycin IV",
                    "Consider non-invasive ventilation or intubation", "Urgent intensivist review",
                    "Strict fluid balance, vasopressors if shocked", "Blood cultures × 2 stat"]
            redFlags = ["Class V: ICU referral and broad-spectrum IV antibiotics urgently"]
        }

        return ClinicalScore(
            systemName: "Pneumonia Severity Index",
            abbreviation: "PSI/PORT Class \(psiClass)",
            score: score, maxScore: 395,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Fine et al, NEJM 1997. Validated in 52,000+ patients. Class I–II: outpatient. Class III: short stay. IV–V: admit/ICU. 30-day mortality 0.1%→29%."
        )
    }

    // MARK: - CURB-65 (Community-Acquired Pneumonia)

    static func curb65(_ i: CURB65Input) -> ClinicalScore {
        var score = 0
        var items: [ScoredItem] = []
        func add(_ label: String, _ flag: Bool) {
            if flag { score += 1 }
            items.append(ScoredItem(label: label, points: flag ? 1.0 : 0.0, present: flag))
        }
        add("C — Confusion (new onset, AMT ≤8)", i.confusion)
        add("U — Urea >7 mmol/L", i.ureaDOver7)
        add("R — Respiratory rate ≥30 /min", i.respiratoryRateOver30)
        add("B — BP: SBP <90 or DBP ≤60 mmHg", i.lowBP)
        add("65 — Age ≥65 years", i.ageOver65)

        let (risk, interpretation, recs, redFlags) = curb65Risk(score)
        return ClinicalScore(
            systemName: "CURB-65",
            abbreviation: "CURB-65 \(score)/5",
            score: Double(score), maxScore: 5,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Lim WS et al, Thorax 2003. 30-day mortality: score 0–1 <3%, score 2 ~9%, score 3–5 ~22%. Validated in 1068 patients. Use alongside clinical judgement."
        )
    }

    private static func curb65Risk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case 0...1:
            return (.low,
                    "CURB-65 \(s)/5 — low severity; 30-day mortality <3%",
                    ["Outpatient treatment appropriate in most cases",
                     "Amoxicillin 500 mg TDS × 5 days (first-line, uncomplicated)",
                     "Or doxycycline 200 mg stat then 100 mg OD if penicillin allergy",
                     "Review at 48h if not improving; return if symptoms worsen"],
                    [])
        case 2:
            return (.moderate,
                    "CURB-65 2/5 — moderate severity; 30-day mortality ~9%",
                    ["Consider short inpatient stay or supervised outpatient therapy",
                     "Amoxicillin-clavulanate 625 mg TDS ± clarithromycin 500 mg BD",
                     "SpO₂ monitoring; supplemental O₂ if <94%",
                     "CXR, FBC, CRP, U&E, blood cultures × 2"],
                    ["CURB-65 2: consider inpatient assessment"])
        default:
            return (.high,
                    "CURB-65 \(s)/5 — high severity; 30-day mortality ~\(s >= 4 ? "27–29" : "22")%",
                    ["Hospital admission required (score 3) or urgent ICU assessment (score 4–5)",
                     "Co-amoxiclav + clarithromycin IV or piperacillin-tazobactam + azithromycin",
                     "Continuous SpO₂; escalate O₂ therapy as needed",
                     "Blood cultures × 2 and urine pneumococcal/legionella antigen",
                     "CXR, ABG if SpO₂ <92% or RR >30"],
                    ["CURB-65 ≥3: hospital admission required; score ≥4 consider ICU"])
        }
    }

    // MARK: - DECAF Score (COPD Exacerbation Severity)
    struct DECAFInput: Equatable {
        var dyspnoeaMRC: Int = 3         // Medical Research Council dyspnoea grade 1–5 (at baseline pre-exacerbation)
        var eosinopenia: Bool = false    // Eosinophils <0.05×10⁹/L on admission bloods
        var consolidation: Bool = false  // Chest X-ray consolidation at presentation
        var acidaemia: Bool = false      // pH <7.30 on arterial blood gas
        var atrialFibrillation: Bool = false  // AF on ECG or history of paroxysmal AF
    }

    static func decaf(_ i: DECAFInput) -> ClinicalScore {
        var pts = 0
        var items: [ScoredItem] = []

        // Dyspnoea MRC ≥4 or ≥5
        let dyspPts = i.dyspnoeaMRC >= 5 ? 2 : (i.dyspnoeaMRC >= 4 ? 1 : 0)
        pts += dyspPts
        items.append(ScoredItem(label: "MRC dyspnoea grade \(i.dyspnoeaMRC) (MRC 3=0, MRC 4=1, MRC 5a/5b=2)", points: Double(dyspPts), present: i.dyspnoeaMRC >= 4))
        items.append(ScoredItem(label: "Eosinopenia (eosinophils <0.05×10⁹/L)", points: 1, present: i.eosinopenia))
        if i.eosinopenia { pts += 1 }
        items.append(ScoredItem(label: "Consolidation on CXR", points: 1, present: i.consolidation))
        if i.consolidation { pts += 1 }
        items.append(ScoredItem(label: "Acidaemia (pH <7.30)", points: 1, present: i.acidaemia))
        if i.acidaemia { pts += 1 }
        items.append(ScoredItem(label: "Atrial fibrillation (AF)", points: 1, present: i.atrialFibrillation))
        if i.atrialFibrillation { pts += 1 }

        let score = Double(pts)
        let flags: [String] = pts >= 3 ? ["DECAF ≥3 — in-hospital mortality 25–49%: consider early ICU/HDU referral"] : []
        let (risk, interp): (ScoreRisk, String)
        switch pts {
        case 0...1:
            (risk, interp) = (.low, "DECAF \(pts)/6: Low risk. In-hospital mortality ~1.4–2.5%. Standard ward management appropriate. Consider early supported discharge pathway if ≤1.")
        case 2:
            (risk, interp) = (.moderate, "DECAF \(pts)/6: Moderate risk. In-hospital mortality ~6.3%. Admission required; close monitoring for deterioration.")
        default:
            (risk, interp) = (.high, "DECAF \(pts)/6: High risk. In-hospital mortality 25–49%. Early ICU/HDU assessment required. Consider NIV if pH <7.35.")
        }
        return ClinicalScore(
            systemName: "DECAF Score",
            abbreviation: "DECAF \(pts)/6",
            score: score,
            maxScore: 6,
            risk: risk,
            interpretation: interp,
            recommendations: pts >= 3 ? [
                "Early ICU/HDU referral — high mortality group",
                "Non-invasive ventilation (NIV) if pH <7.35 with hypercapnia",
                "Controlled oxygen therapy: target SpO2 88–92% (24% Venturi mask)",
                "Systemic corticosteroids: prednisolone 30–40 mg daily for 5 days",
                "Antibiotics if sputum purulent or consolidation on CXR",
                "Bronchodilators: salbutamol and ipratropium nebulisers",
                "Thromboprophylaxis with LMWH",
                "Review goals of care and ceiling of treatment early"
            ] : pts == 2 ? [
                "Admit to respiratory ward; 4-hourly observations minimum",
                "Controlled oxygen therapy: SpO2 88–92%",
                "Systemic corticosteroids and bronchodilators",
                "Antibiotics if purulent sputum or fever",
                "Monitor for acidaemia — repeat ABG at 1 h if pH <7.35 on arrival",
                "LMWH thromboprophylaxis"
            ] : [
                "Standard medical ward admission",
                "Controlled oxygen: SpO2 88–92%",
                "Oral prednisolone 30 mg for 5 days",
                "Short-acting bronchodilators (salbutamol + ipratropium nebulisers 4-hourly)",
                "Consider early supported discharge at 24–48 h if clinical improvement"
            ],
            items: items,
            redFlags: flags,
            evidenceNote: "Steer J et al. Thorax 2012;67:970–976. DECAF validated in UK COPD cohorts (n=920). DECAF 0–1 identifies low-risk patients suitable for early discharge pathways. Superior to APACHE II for acute COPD exacerbations."
        )
    }

    // MARK: - #99 ARISCAT Score (Postoperative Pulmonary Complications)

    struct ARISCATInput: Equatable {
        var age: Int             // years
        var spo2Preop: Int       // pre-operative SpO₂ (%)
        var respiratoryInfection: Bool  // acute URTI in last month
        var preOpHaemoglobin: Double    // g/dL
        var surgicalIncision: Int  // 0=peripheral, 1=upper abdominal, 2=intrathoracic
        var surgicalDurationHrs: Double // planned/actual operative duration (hours)
        var emergencyProcedure: Bool
    }

    static func ariscat(_ i: ARISCATInput) -> ClinicalScore {
        var score = 0

        // Age
        if i.age >= 80      { score += 16 }
        else if i.age >= 51 { score += 3 }

        // SpO₂
        if i.spo2Preop <= 90      { score += 24 }
        else if i.spo2Preop <= 95 { score += 8 }

        // Respiratory infection
        if i.respiratoryInfection { score += 17 }

        // Pre-op haemoglobin
        if i.preOpHaemoglobin <= 10 { score += 11 }

        // Surgical incision
        if i.surgicalIncision == 2      { score += 24 }   // intrathoracic
        else if i.surgicalIncision == 1 { score += 15 }   // upper abdominal

        // Duration
        if i.surgicalDurationHrs >= 3      { score += 16 }
        else if i.surgicalDurationHrs >= 2 { score += 8 }

        // Emergency
        if i.emergencyProcedure { score += 8 }

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if score >= 45 {
            risk  = .critical
            interp = "ARISCAT \(score) — High risk of postoperative pulmonary complications (PPC rate ~42%)."
            recs  = [
                "Preoperative physiotherapy and breathing exercises — begin ≥2 weeks before surgery",
                "Optimise pre-existing respiratory conditions (asthma, COPD)",
                "Treat any current URTI; delay elective surgery until resolved",
                "Correct anaemia preoperatively (transfusion or IV iron as appropriate)",
                "Discuss enhanced recovery after surgery (ERAS) pulmonary protocol with anaesthesia",
                "Plan postoperative care: HDU/ICU likely; early physiotherapy post-op",
                "Consider regional anaesthesia techniques to reduce systemic opioid use"
            ]
            flags = ["ARISCAT ≥45 — high PPC risk; preoperative optimisation and HDU/ICU planning required"]
        } else if score >= 26 {
            risk  = .high
            interp = "ARISCAT \(score) — Intermediate risk of postoperative pulmonary complications (PPC rate ~13%)."
            recs  = [
                "Preoperative respiratory physiotherapy if time permits",
                "Optimise respiratory comorbidities",
                "Anaesthetic review: consider lung-protective ventilation strategy",
                "Early postoperative mobilisation and incentive spirometry",
                "Monitor SpO₂ closely in recovery"
            ]
        } else {
            risk  = .low
            interp = "ARISCAT \(score) — Low risk of postoperative pulmonary complications (PPC rate ~1.6%)."
            recs  = [
                "Standard ERAS respiratory protocol",
                "Early mobilisation and breathing exercises postoperatively",
                "Routine monitoring"
            ]
        }

        return ClinicalScore(
            name:          "ARISCAT Score",
            score:         Double(score),
            maxScore:      123,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Canet J et al. Anesthesiology 2010;113:1338. Validated 7-item preoperative risk score for postoperative pulmonary complications (PPC). Score 0–123; low <26 (PPC 1.6%), intermediate 26–44 (12.8%), high ≥45 (42.1%). Originally developed and validated in a European multicentre cohort of 2,464 non-cardiac surgical patients. Included in ESA/ESAIC preoperative assessment guidelines."
        )
    }

    // MARK: - #104 mMRC Dyspnoea Scale

    struct MMRCInput: Equatable {
        var grade: Int   // 0 = no dyspnoea on strenuous exercise; to 4 = too breathless to leave house
    }

    static func mmrc(_ i: MMRCInput) -> ClinicalScore {
        let grade = max(0, min(4, i.grade))
        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        switch grade {
        case 0:
            risk  = .low
            interp = "mMRC Grade 0 — Breathlessness only with strenuous exercise. No functional impairment."
            recs  = ["Maintain exercise capacity; reassess if symptoms develop"]
        case 1:
            risk  = .low
            interp = "mMRC Grade 1 — Breathless when hurrying on level ground or walking up a slight hill."
            recs  = [
                "Optimise any underlying respiratory or cardiac disease",
                "Pulmonary function tests if not done",
                "Smoking cessation counselling if smoker"
            ]
        case 2:
            risk  = .moderate
            interp = "mMRC Grade 2 — Walks slower than peers on level ground due to breathlessness, or stops after ≤15 min walking."
            recs  = [
                "Spirometry and respiratory review",
                "Consider COPD assessment (GOLD staging) if applicable",
                "Structured exercise rehabilitation programme",
                "Optimise COPD/cardiac medications"
            ]
        case 3:
            risk  = .high
            interp = "mMRC Grade 3 — Stops for breath after walking about 100 m or after a few minutes on level ground."
            recs  = [
                "Urgent respiratory / cardiology review",
                "Pulmonary rehabilitation programme (strong evidence in COPD)",
                "Home nebuliser and oxygen assessment if indicated",
                "Review all optimisable causes: bronchodilators, diuretics, anaemia correction",
                "Assess perioperative risk if surgery planned (functional capacity <4 METs)"
            ]
        default:
            risk  = .critical
            interp = "mMRC Grade 4 — Too breathless to leave house, or breathless when dressing/undressing."
            recs  = [
                "Urgent assessment of all reversible causes",
                "Home oxygen assessment (ambulatory and nocturnal oximetry)",
                "Palliative care referral for refractory breathlessness if appropriate",
                "Consider pulmonary rehabilitation even at this grade — evidence supports benefit",
                "Preoperative risk stratification: functional capacity <4 METs significantly increases perioperative cardiac risk"
            ]
        }

        return ClinicalScore(
            name:          "mMRC Dyspnoea Scale",
            score:         Double(grade),
            maxScore:      4,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Fletcher CM et al. BMJ 1959;1:257. Modified Medical Research Council scale for breathlessness: 0 (strenuous exercise only) to 4 (too breathless to leave house). Grade ≥2 used in GOLD COPD classification; grade ≥2 with CAT <10 = mMRC primary metric. Widely used in perioperative assessment to grade functional capacity. Correlates with 6-minute walk test (r = −0.65) and health-related quality of life measures."
        )
    }


}
