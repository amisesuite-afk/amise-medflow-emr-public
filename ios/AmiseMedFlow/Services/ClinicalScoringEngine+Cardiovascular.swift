// ClinicalScoringEngine+Cardiovascular.swift
// Cardiovascular / VTE / Pulmonary Embolism scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: Wells DVT Score

    static func wellsDVT(_ i: WellsDVTInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Active cancer (treatment within 6 months)", points: 1, present: i.activeCancer),
            .init(label: "Paralysis, paresis or recent plaster cast", points: 1, present: i.paralysisParesisPlastercast),
            .init(label: "Bedridden >3 d or surgery within 12 weeks", points: 1, present: i.bedridden3dOrSurgery12w),
            .init(label: "Localised tenderness along deep vein", points: 1, present: i.localizedTendernessDeepVein),
            .init(label: "Entire leg swollen", points: 1, present: i.entireLegSwollen),
            .init(label: "Calf >3 cm larger than asymptomatic side", points: 1, present: i.calfSwellingOver3cm),
            .init(label: "Pitting oedema", points: 1, present: i.pittingOedema),
            .init(label: "Collateral superficial veins (non-varicose)", points: 1, present: i.collateralSuperficialVeins),
            .init(label: "Previously documented DVT", points: 1, present: i.previousDVT),
            .init(label: "Alternative diagnosis equally or more likely", points: -2.0, present: i.alternativeDiagnosisAsLikely),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []

        if score <= 0 {
            risk = .low
            interpretation = "Wells DVT \(Int(score)) — Low probability (~5%); D-dimer to exclude"
            recs = ["D-dimer: if negative, DVT excluded without USS",
                    "If D-dimer positive → whole-leg compression USS",
                    "Reassess if symptoms change"]
        } else if score <= 2 {
            risk = .moderate
            interpretation = "Wells DVT \(Int(score)) — Moderate probability (~17%); USS recommended"
            recs = ["Whole-leg compression duplex USS",
                    "If USS negative + D-dimer negative → DVT excluded",
                    "If USS negative but D-dimer positive → repeat USS in 1 week",
                    "Anticoagulate if USS positive"]
        } else {
            risk = .high
            interpretation = "Wells DVT \(Int(score)) — High probability (~53%); proceed to USS ± anticoagulate"
            recs = ["Whole-leg compression duplex USS urgently",
                    "Commence LMWH / DOAC while awaiting USS if delays anticipated",
                    "If USS positive → therapeutic anticoagulation (apixaban/rivaroxaban or LMWH)",
                    "If USS negative → D-dimer; if positive, repeat USS in 1 week",
                    "Investigate for malignancy if unprovoked DVT in patient >40"]
        }

        return ClinicalScore(
            systemName: "Wells DVT Score",
            abbreviation: "Wells DVT",
            score: score, maxScore: 9,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: [],
            evidenceNote: "Wells 1997. Score ≤0: low; 1–2: moderate; ≥3: high probability DVT."
        )
    }

    // MARK: Wells PE Score

    static func wellsPE(_ i: WellsPEInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Clinical signs/symptoms of DVT", points: 3, present: i.clinicalSignsDVT),
            .init(label: "PE more likely than alternative diagnosis", points: 3, present: i.alternativeDxLessLikely),
            .init(label: "Heart rate >100 bpm", points: 1.5, present: i.hrOver100),
            .init(label: "Immobilisation or surgery within 4 weeks", points: 1.5, present: i.immobilisationOrSurgery4w),
            .init(label: "Previous DVT / PE", points: 1.5, present: i.previousDVTOrPE),
            .init(label: "Haemoptysis", points: 1, present: i.haemoptysis),
            .init(label: "Active malignancy (treatment within 6 months)", points: 1, present: i.malignancyActive),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        if score <= 1 {
            risk = .low
            interpretation = "Wells PE \(score) — Low probability; D-dimer first"
            recs = ["D-dimer: if negative → PE excluded",
                    "If D-dimer positive → CT pulmonary angiography (CTPA)",
                    "Consider V/Q if contrast allergy or pregnancy"]
        } else if score <= 4 {
            risk = .moderate
            interpretation = "Wells PE \(score) — Moderate probability (~28%); CTPA or D-dimer"
            recs = ["CTPA (preferred) or age-adjusted D-dimer",
                    "If haemodynamically unstable → ECHO bedside / empirical anticoagulation",
                    "LMWH or DOAC while awaiting imaging if high clinical concern"]
        } else {
            risk = .high
            interpretation = "Wells PE \(score) — High probability (>50%); immediate CTPA"
            redFlags = ["High probability PE — anticoagulate empirically while awaiting CTPA",
                        "If haemodynamically unstable: consider thrombolysis or surgical embolectomy"]
            recs = ["Immediate CTPA", "Empirical anticoagulation (LMWH or heparin IV) before imaging if safe",
                    "If massive PE (SBP <90): thrombolysis (alteplase 100 mg IV) or embolectomy",
                    "Cardiology / respiratory / surgery referral",
                    "HDU monitoring: HR, SBP, O₂ sat continuous"]
        }

        return ClinicalScore(
            systemName: "Wells PE Score",
            abbreviation: "Wells PE",
            score: score, maxScore: 12.5,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Wells 2000. Score ≤4: PE unlikely (with negative D-dimer excludes); >4: PE likely, CTPA."
        )
    }

    // MARK: ABCD2 Score (TIA)

    static func abcd2(_ i: ABCD2Input) -> ClinicalScore {
        var items: [ScoredItem] = [
            .init(label: "Age ≥60 years", points: 1, present: i.ageOver60),
            .init(label: "BP ≥140/90 mmHg at presentation", points: 1, present: i.bpOver140_90),
            .init(label: "Unilateral weakness", points: 2, present: i.unilateralWeakness),
            .init(label: "Speech disturbance without weakness", points: 1, present: i.speechWithoutWeakness),
        ]
        let durationPoints: Double
        if i.durationOver60min { durationPoints = 2 }
        else if i.duration10to59min { durationPoints = 1 }
        else { durationPoints = 0 }
        items.append(.init(label: "Duration >60 min (+2) or 10–59 min (+1)", points: durationPoints, present: durationPoints > 0))
        items.append(.init(label: "Diabetes mellitus", points: 1, present: i.diabetes))

        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var redFlags: [String] = []

        switch score {
        case ..<4:
            risk = .low
            interpretation = "ABCD2 \(Int(score))/7 — Low risk; 2-day stroke risk ~1%"
            recs = ["Aspirin 300 mg stat → 75 mg/d", "Statin (atorvastatin 80 mg)",
                    "Urgent outpatient TIA clinic within 24 h",
                    "Carotid duplex USS", "ECG (screen for AF)", "Brain MRI/DWI"]
        case 4...5:
            risk = .moderate
            interpretation = "ABCD2 \(Int(score))/7 — Moderate risk; 2-day stroke risk ~4%"
            recs = ["Same-day specialist TIA review", "Aspirin 300 mg stat → 75 mg/d + clopidogrel 300 mg stat → 75 mg/d (dual for 21 days)",
                    "Atorvastatin 80 mg", "Brain MRI/DWI within 24 h",
                    "Carotid duplex USS same day (carotid endarterectomy within 48 h if ≥50% stenosis)",
                    "24 h ECG / Holter (screen for paroxysmal AF)", "BP control"]
        case 6:
            risk = .high
            interpretation = "ABCD2 \(Int(score))/7 — High risk; 2-day stroke risk ~8%"
            redFlags = ["High stroke risk — requires urgent specialist assessment today",
                        "If in AF → anticoagulate not antiplatelet"]
            recs = ["Admit or same-day specialist TIA assessment",
                    "Aspirin 300 mg stat + clopidogrel 300 mg stat (dual antiplatelet)",
                    "Atorvastatin 80 mg", "MRI brain / DWI within 24 h",
                    "Carotid endarterectomy within 48 h if ≥50% ipsilateral stenosis",
                    "Echocardiography + prolonged cardiac monitoring for AF",
                    "BP target <130/80 mmHg long-term"]
        default:
            risk = .critical
            interpretation = "ABCD2 \(Int(score))/7 — Maximum risk; 2-day stroke risk ~8%"
            redFlags = ["Maximum ABCD2 score — very high early stroke risk",
                        "If in AF → anticoagulate not antiplatelet"]
            recs = ["Immediate specialist assessment / emergency admission",
                    "Aspirin 300 mg stat + clopidogrel 300 mg stat (dual antiplatelet)",
                    "Atorvastatin 80 mg", "MRI brain / DWI urgently",
                    "Carotid endarterectomy within 48 h if ≥50% ipsilateral stenosis",
                    "Echocardiography + prolonged cardiac monitoring for AF",
                    "BP target <130/80 mmHg long-term"]
        }

        return ClinicalScore(
            systemName: "ABCD2 Score",
            abbreviation: "ABCD2",
            score: score, maxScore: 7,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items,
            redFlags: redFlags,
            evidenceNote: "Johnston 2007. Predicts 2-day stroke risk after TIA. Score ≤3: low; 4–5: moderate; 6–7: high."
        )
    }

    // MARK: Revised Cardiac Risk Index (RCRI)

    static func rcri(_ i: RCRIInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "High-risk surgery (intraperitoneal / intrathoracic / suprainguinal vascular)", points: 1, present: i.highRiskSurgery),
            .init(label: "Ischaemic heart disease (Hx MI, angina, nitrates, Q-waves)", points: 1, present: i.ischemicHeartDisease),
            .init(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
            .init(label: "Cerebrovascular disease (Hx stroke / TIA)", points: 1, present: i.cerebrovascularDisease),
            .init(label: "Insulin-dependent diabetes mellitus", points: 1, present: i.insulinDependentDiabetes),
            .init(label: "Pre-op creatinine >177 μmol/L (>2 mg/dL)", points: 1, present: i.preopCreatinineOver2),
        ]
        let score = Double(items.filter(\.present).count)

        let risk: ScoreRisk
        let maceRisk: String
        var recs: [String] = []

        switch score {
        case 0:
            risk = .low; maceRisk = "~0.4% MACE"
            recs = ["Proceed to surgery", "Standard perioperative monitoring"]
        case 1:
            risk = .low; maceRisk = "~1% MACE"
            recs = ["Proceed to surgery", "Cardiology review if symptomatic", "Standard ECG"]
        case 2:
            risk = .moderate; maceRisk = "~2.4% MACE"
            recs = ["Cardiology pre-op assessment", "Continue beta-blockers and statins perioperatively",
                    "Consider stress testing if active cardiac symptoms",
                    "Post-op troponin monitoring if RCRI ≥2"]
        default:
            risk = .high; maceRisk = ">5% MACE"
            recs = ["Formal cardiology evaluation before elective surgery",
                    "Non-invasive stress testing if functional capacity <4 METs",
                    "Consider coronary revascularisation if appropriate before surgery",
                    "Beta-blockade continuation (do NOT start new beta-blocker <2 d pre-op)",
                    "Perioperative troponin × 2 (at 24 h and 48 h post-op)",
                    "Discuss risk/benefit with patient"]
        }

        return ClinicalScore(
            systemName: "Revised Cardiac Risk Index",
            abbreviation: "RCRI",
            score: score, maxScore: 6,
            risk: risk, interpretation: "RCRI \(Int(score))/6 — Predicted \(maceRisk) (major adverse cardiac event)",
            recommendations: recs, items: items,
            redFlags: score >= 3 ? ["RCRI ≥3: formal cardiology assessment recommended before elective surgery"] : [],
            evidenceNote: "Lee 1999. Validated for major non-cardiac surgery. MACE = MI, cardiac arrest, complete heart block."
        )
    }

    // MARK: Caprini VTE Risk

    static func caprini(_ i: CapriniInput) -> ClinicalScore {
        let items: [ScoredItem] = [
            .init(label: "Age >75", points: 3, present: i.ageOver75),
            .init(label: "Age 60–74", points: 2, present: i.age60to74),
            .init(label: "Age 41–59", points: 1, present: i.age41to59),
            .init(label: "Active or prior malignancy", points: 2, present: i.activeOrPriorMalignancy),
            .init(label: "Prior VTE", points: 3, present: i.priorVTE),
            .init(label: "Family history of VTE", points: 3, present: i.familyHistoryVTE),
            .init(label: "Thrombophilia (Factor V, APS, etc.)", points: 3, present: i.thrombophilia),
            .init(label: "Minor surgery (<45 min)", points: 1, present: i.minorSurgery),
            .init(label: "Major open surgery (>45 min)", points: 2, present: i.majorSurgery),
            .init(label: "Laparoscopic surgery (>45 min)", points: 2, present: i.laparoscopicSurgeryOver45min),
            .init(label: "Immobility / bed rest", points: 1, present: i.immobilityBedridden),
            .init(label: "Central venous access", points: 2, present: i.centralVenousAccess),
            .init(label: "Hormonal therapy / OCP", points: 1, present: i.hormonalTherapy),
            .init(label: "Sepsis within 30 days", points: 1, present: i.sepsis30d),
            .init(label: "BMI ≥40 kg/m²", points: 1, present: i.bmi40Plus),
            .init(label: "Stroke (prior)", points: 5, present: i.stroke),
            .init(label: "MI (prior)", points: 5, present: i.mi),
            .init(label: "Spinal cord injury", points: 5, present: i.spinalCordInjury),
            .init(label: "Pelvic fracture / hip or knee replacement", points: 5, present: i.pelvisFractureOrHipKneeReplacement),
            .init(label: "Multiple trauma", points: 5, present: i.multipleTrauma),
        ]
        let score = items.filter(\.present).reduce(0.0) { $0 + $1.points }

        let risk: ScoreRisk
        let vteRisk: String
        var recs: [String] = []

        switch score {
        case ..<2:
            risk = .low; vteRisk = "Very low (<0.5%)"
            recs = ["Early ambulation", "No pharmacological prophylaxis needed"]
        case 2...3:
            risk = .low; vteRisk = "Low (~1.5%)"
            recs = ["Mechanical prophylaxis (TED stockings + pneumatic compression device)",
                    "LMWH if bleeding risk acceptable (LMWH enoxaparin 40 mg OD)"]
        case 4...5:
            risk = .moderate; vteRisk = "Moderate (~3%)"
            recs = ["LMWH enoxaparin 40 mg OD subcutaneous (start 12 h post-op or pre-op)",
                    "Mechanical prophylaxis (IPC device)", "Continue for 28 days in high-risk surgery",
                    "Consider extended thromboprophylaxis if major abdominal / pelvic surgery"]
        case 6...7:
            risk = .high; vteRisk = "High (>6%)"
            recs = ["LMWH enoxaparin 40 mg OD (or 1.5 mg/kg OD) SC",
                    "Mechanical compression devices (IPC) throughout admission",
                    "Extended LMWH prophylaxis 28 d post-op (cancer surgery, colorectal, pelvic)",
                    "Consider fondaparinux if HIT history",
                    "Ensure adequate hydration + early mobilisation"]
        default:
            risk = .critical; vteRisk = "Very High (>10%)"
            recs = ["LMWH enoxaparin 40 mg OD (or 1.5 mg/kg OD) SC",
                    "Mechanical compression devices (IPC) throughout admission",
                    "Extended LMWH prophylaxis 28 d post-op mandatory",
                    "Consider fondaparinux if HIT history",
                    "Haematology review — consider direct oral anticoagulant if appropriate",
                    "Ensure adequate hydration + early mobilisation"]
        }

        return ClinicalScore(
            systemName: "Caprini VTE Risk Score",
            abbreviation: "Caprini",
            score: score, maxScore: 40,
            risk: risk, interpretation: "Caprini \(Int(score)) — \(vteRisk) VTE risk",
            recommendations: recs, items: items,
            redFlags: score >= 8 ? ["Caprini ≥8: very high VTE risk — extended prophylaxis mandatory"] : [],
            evidenceNote: "Caprini 1991, updated 2013. Widely validated in surgical patients. Score drives LMWH prophylaxis decisions."
        )
    }

    // MARK: CHA₂DS₂-VASc

    static func cha2ds2vasc(_ i: CHA2DS2VAScInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure))
        if i.congestiveHeartFailure { score += 1 }
        items.append(.init(label: "Hypertension", points: 1, present: i.hypertension))
        if i.hypertension { score += 1 }
        if i.ageOver75 {
            items.append(.init(label: "Age ≥75 years", points: 2, present: true))
            score += 2
        } else {
            items.append(.init(label: "Age 65–74 years", points: 1, present: i.age65to74))
            if i.age65to74 { score += 1 }
        }
        items.append(.init(label: "Diabetes mellitus", points: 1, present: i.diabetes))
        if i.diabetes { score += 1 }
        items.append(.init(label: "Stroke / TIA / thromboembolism", points: 2, present: i.strokeOrTIA))
        if i.strokeOrTIA { score += 2 }
        items.append(.init(label: "Vascular disease (MI, PAD, aortic plaque)", points: 1, present: i.vascularDisease))
        if i.vascularDisease { score += 1 }
        items.append(.init(label: "Female sex", points: 1, present: i.femaleSex))
        if i.femaleSex { score += 1 }

        let (risk, interp, recs) = cha2ds2vascRisk(score, female: i.femaleSex)
        let redFlags: [String] = score >= 2 ? ["CHA₂DS₂-VASc ≥2 (male) or ≥3 (female): anticoagulation recommended by ESC/AHA"] : []
        return ClinicalScore(
            systemName: "CHA₂DS₂-VASc Score",
            abbreviation: "CHA₂DS₂-VASc \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Lip 2010, ESC 2020 AF guidelines. For non-valvular AF only. Score ≥2 (male) or ≥3 (female): OAC recommended."
        )
    }

    private static func cha2ds2vascRisk(_ s: Double, female: Bool) -> (ScoreRisk, String, [String]) {
        let threshold = female ? 3.0 : 2.0
        switch s {
        case 0: return (.low, "CHA₂DS₂-VASc 0 (male) — Very low stroke risk (~0%/yr)", ["No anticoagulation needed", "Reassess annually"])
        case 1: return (female ? .low : .moderate, "CHA₂DS₂-VASc 1 — Annual stroke risk ~1.3%", ["Consider anticoagulation (male)", "Female sex alone does not require OAC", "Individualise risk–benefit"])
        case _ where s >= threshold:
            let annualRisk = s >= 6 ? ">10" : s >= 4 ? "4–8" : "2–3"
            return (.high, "CHA₂DS₂-VASc \(Int(s)) — Annual stroke risk ~\(annualRisk)%",
                    ["Anticoagulation recommended (OAC preferred over aspirin)", "DOAC first-line unless contraindicated (e.g. mechanical valve, moderate–severe mitral stenosis → warfarin)", "Check HAS-BLED score before prescribing", "Baseline renal function, LFTs, FBC"])
        default:
            return (.moderate, "CHA₂DS₂-VASc \(Int(s))", ["Individualise anticoagulation decision"])
        }
    }

    // MARK: HAS-BLED

    static func hasBled(_ i: HASBLEDInput) -> ClinicalScore {
        var score = 0.0
        var items: [ScoredItem] = []
        items.append(.init(label: "H — Hypertension (uncontrolled, SBP >160)", points: 1, present: i.hypertensionUncontrolled))
        if i.hypertensionUncontrolled { score += 1 }
        items.append(.init(label: "A — Abnormal renal function", points: 1, present: i.renalDysfunction))
        if i.renalDysfunction { score += 1 }
        items.append(.init(label: "A — Abnormal liver function", points: 1, present: i.liverDysfunction))
        if i.liverDysfunction { score += 1 }
        items.append(.init(label: "S — Stroke history", points: 1, present: i.strokeHistory))
        if i.strokeHistory { score += 1 }
        items.append(.init(label: "B — Bleeding predisposition / history", points: 1, present: i.priorBleeding))
        if i.priorBleeding { score += 1 }
        items.append(.init(label: "L — Labile INR (TTR <60%)", points: 1, present: i.labileINR))
        if i.labileINR { score += 1 }
        items.append(.init(label: "E — Elderly (age >65)", points: 1, present: i.ageOver65))
        if i.ageOver65 { score += 1 }
        items.append(.init(label: "D — Drugs (antiplatelets/NSAIDs)", points: 1, present: i.drugsOrAlcohol))
        if i.drugsOrAlcohol { score += 1 }
        items.append(.init(label: "D — Alcohol (≥8 units/wk)", points: 1, present: i.alcoholUse))
        if i.alcoholUse { score += 1 }

        let (risk, interp, recs) = hasBledRisk(score)
        let redFlags: [String] = score >= 3 ? ["HAS-BLED ≥3: high bleeding risk — review modifiable factors before anticoagulation"] : []
        return ClinicalScore(
            systemName: "HAS-BLED Bleeding Risk Score",
            abbreviation: "HAS-BLED \(Int(score))",
            score: score, maxScore: 9,
            risk: risk, interpretation: interp,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Pisters 2010. Predicts 1-year major bleeding risk in patients on anticoagulation for AF. Used alongside CHA₂DS₂-VASc."
        )
    }

    private static func hasBledRisk(_ s: Double) -> (ScoreRisk, String, [String]) {
        switch s {
        case 0...1: return (.low, "HAS-BLED \(Int(s)): Low bleeding risk (~1%/yr)", ["Anticoagulation appropriate if CHA₂DS₂-VASc indicates", "Routine monitoring"])
        case 2:     return (.moderate, "HAS-BLED 2: Moderate bleeding risk (~1.9%/yr)", ["Anticoagulation can be considered — weigh against stroke risk", "Address modifiable risk factors (BP control, avoid NSAIDs)", "Frequent INR monitoring if on warfarin"])
        default:    return (.high, "HAS-BLED \(Int(s)): High bleeding risk (≥3%/yr)", ["Does NOT mean anticoagulation is contraindicated — stroke risk often still exceeds bleeding risk", "Address ALL modifiable factors: hypertension, labile INR, alcohol, NSAIDs", "Consider DOAC over warfarin", "Regular review; involve haematology if complex"])
        }
    }

    // MARK: - Padua Prediction Score (Medical VTE Risk)

    static func padua(_ i: PaduaInput) -> ClinicalScore {
        var score = 0
        var items: [ScoredItem] = []
        func add(_ label: String, _ flag: Bool, pts: Int) {
            if flag { score += pts }
            items.append(ScoredItem(label: label, points: Double(flag ? pts : 0), present: flag))
        }
        add("Active/recent cancer (≤6 months or metastatic)", i.activeOrRecentCancer, pts: 3)
        add("Previous VTE (excl. superficial thrombosis)", i.previousVTE, pts: 3)
        add("Reduced mobility ≥3 days (anticipated bed rest)", i.reducedMobility, pts: 3)
        add("Known thrombophilia (inherited or acquired)", i.thrombophilia, pts: 3)
        add("Recent trauma or surgery (≤1 month)", i.recentTraumaOrSurgery, pts: 2)
        add("Age ≥70 years", i.ageOver70, pts: 1)
        add("Heart failure or respiratory failure", i.heartOrRespiratoryFailure, pts: 1)
        add("Acute MI or ischaemic stroke", i.acuteMIOrIschaemicStroke, pts: 1)
        add("Acute infection or inflammatory condition", i.acuteInfectionOrInflammatory, pts: 1)
        add("BMI ≥30 (obese)", i.obese, pts: 1)
        add("Ongoing hormonal treatment (OCP, HRT)", i.ongoingHormonalTreatment, pts: 1)

        let isHighRisk = score >= 4
        let risk: ScoreRisk = isHighRisk ? .high : .low
        let interpretation = isHighRisk
            ? "Padua \(score) — HIGH VTE risk; pharmacological prophylaxis recommended"
            : "Padua \(score) — LOW VTE risk; mechanical prophylaxis sufficient"
        let recs: [String] = isHighRisk
            ? ["Low molecular weight heparin (LMWH) prophylaxis — start immediately",
               "Enoxaparin 40 mg SC OD (CrCl ≥30 mL/min) or fondaparinux 2.5 mg SC OD",
               "Continue until patient is fully mobile (minimum 14 days in high-risk)",
               "Renal dose-adjust if CrCl <30 mL/min",
               "Combine with compression stockings or IPC device",
               "Review and restart prophylaxis if surgery is planned"]
            : ["Graduated compression stockings (class 2)",
               "Intermittent pneumatic compression (IPC) if stockings contraindicated",
               "Early mobilisation — key non-pharmacological intervention",
               "Reassess daily; escalate if score increases to ≥4"]
        let redFlags: [String] = isHighRisk
            ? ["Padua ≥4: high VTE risk — LMWH prophylaxis required unless contraindicated"]
            : []
        return ClinicalScore(
            systemName: "Padua Prediction Score",
            abbreviation: "Padua \(score)",
            score: Double(score), maxScore: 20,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Barbar S et al, J Thromb Haemost 2010. Validated in 1180 medical inpatients. Score ≥4 = high risk (11% VTE without prophylaxis vs 2.2% with LMWH). Complements Caprini for surgical patients."
        )
    }

    // MARK: - EuroSCORE II (Cardiac Surgery Operative Mortality)

    static func euroScoreII(_ i: EuroScoreIIInput) -> ClinicalScore {
        // Logistic EuroSCORE II — Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734–745.
        // Predicted mortality % = 100 × eˣ / (1 + eˣ) where x = β₀ + Σ(βᵢ × factor)
        var x = -5.324537

        // Patient factors
        let ageBoost = max(0.0, Double(i.age - 60)) * 0.0285489
        x += ageBoost
        if i.female                    { x += 0.2196434  }
        switch i.renalImpairment {
        case 1:                          x += 0.3541226
        case 2:                          x += 0.6521653
        default: break
        }
        if i.extracardiacArteriopathy  { x += 0.5085682  }
        if i.poorMobility              { x += 0.2971552  }
        if i.previousCardiacSurgery    { x += 1.0023510  }
        if i.chronicLungDisease        { x += 0.1886564  }
        if i.activeEndocarditis        { x += 0.6194522  }
        if i.criticalPreoperativeState { x += 1.0856296  }
        if i.diabetesOnInsulin         { x += 0.3304052  }
        switch i.nyhaClass {
        case 1:                          x += 0.1070545
        case 2:                          x += 0.2338955
        case 3:                          x += 0.5718132
        default: break
        }
        if i.ccsClass4Angina           { x += 0.2218732  }
        switch i.lvFunction {
        case 1:                          x += 0.3196276
        case 2:                          x += 1.5169013
        default: break
        }
        if i.recentMI                  { x += 0.5460218  }
        switch i.pulmonaryHypertension {
        case 1:                          x += 0.6084972
        case 2:                          x += 1.3765812
        default: break
        }
        switch i.urgency {
        case 1:                          x += 0.4084417
        case 2:                          x += 0.9361202
        case 3:                          x += 1.8071808
        default: break
        }
        switch i.weightOfIntervention {
        case 1:                          x += 0.5521478
        case 2:                          x += 0.9724533
        case 3:                          x += 1.6151723
        default: break
        }
        if i.surgeryOnThoracicAorta    { x += 1.1745886  }
        if i.postInfarctSeptalRupture  { x += 1.4630660  }

        let pct = 100.0 * exp(x) / (1.0 + exp(x))
        let pctRounded = (pct * 10).rounded() / 10

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch pct {
        case ..<2:
            (.low, String(format: "Predicted operative mortality %.1f%% (low risk)", pct),
             ["Proceed with standard cardiac surgical care",
              "Routine anaesthetic and surgical team pre-operative assessment",
              "ICU care post-operatively as per unit protocol",
              "Document EuroSCORE II result in surgical consent discussion"],
             [])
        case 2..<5:
            (.moderate, String(format: "Predicted operative mortality %.1f%% (moderate risk)", pct),
             ["Senior anaesthetist and cardiac surgeon review pre-operatively",
              "Detailed consent discussion including predicted mortality risk",
              "Optimise modifiable risk factors before surgery",
              "ICU/HDU post-operative care plan; perfusionist briefing",
              "Consider cardiac catheterisation if not yet done"],
             [])
        default:
            (.high, String(format: "Predicted operative mortality %.1f%% (high risk)", pct),
             ["Multidisciplinary heart team (MDT) review mandatory before proceeding",
              "Comprehensive risk-benefit discussion with patient and family",
              "Explore alternatives: transcatheter procedures (TAVI, MICS) if applicable",
              "Cardiology and anaesthetic co-management; optimise haemodynamics pre-operatively",
              "ICU post-operative care; senior perfusionist and OR team briefing",
              "Consider palliative or conservative pathway if risk exceeds benefit"],
             [String(format: "EuroSCORE II %.1f%% — high operative mortality; MDT review and detailed consent required before proceeding", pct)])
        }

        let nyhaLabels = ["I", "II", "III", "IV"]
        let renalLabels = ["None", "Creatinine 151–176 μmol/L", "Dialysis or >176 μmol/L"]
        let lvLabels = ["Good >50%", "Moderate 31–50%", "Poor ≤30%"]
        let urgencyLabels = ["Elective", "Urgent", "Emergency", "Salvage"]
        let wLabels = ["Isolated CABG", "Single non-CABG procedure", "Two procedures", "Three or more procedures"]
        let phLabels = ["None", "Moderate 31–55 mmHg", "Severe >55 mmHg"]

        let items: [ScoredItem] = [
            ScoredItem(label: "Age \(i.age) years (+\(String(format: "%.3f", ageBoost)) above 60)", points: ageBoost, present: i.age > 60),
            ScoredItem(label: "Female sex +0.220", points: 0.2196434, present: i.female),
            ScoredItem(label: "Renal impairment: \(renalLabels[min(i.renalImpairment, 2)])", points: i.renalImpairment == 1 ? 0.3541226 : 0.6521653, present: i.renalImpairment > 0),
            ScoredItem(label: "Extracardiac arteriopathy +0.509", points: 0.5085682, present: i.extracardiacArteriopathy),
            ScoredItem(label: "Poor mobility +0.297", points: 0.2971552, present: i.poorMobility),
            ScoredItem(label: "Previous cardiac surgery +1.002", points: 1.0023510, present: i.previousCardiacSurgery),
            ScoredItem(label: "Chronic lung disease +0.189", points: 0.1886564, present: i.chronicLungDisease),
            ScoredItem(label: "Active endocarditis +0.619", points: 0.6194522, present: i.activeEndocarditis),
            ScoredItem(label: "Critical preoperative state +1.086", points: 1.0856296, present: i.criticalPreoperativeState),
            ScoredItem(label: "Diabetes on insulin +0.330", points: 0.3304052, present: i.diabetesOnInsulin),
            ScoredItem(label: "NYHA class \(nyhaLabels[min(i.nyhaClass, 3)])", points: [0, 0.1070545, 0.2338955, 0.5718132][min(i.nyhaClass, 3)], present: i.nyhaClass > 0),
            ScoredItem(label: "CCS Class 4 angina +0.222", points: 0.2218732, present: i.ccsClass4Angina),
            ScoredItem(label: "LV function: \(lvLabels[min(i.lvFunction, 2)])", points: [0, 0.3196276, 1.5169013][min(i.lvFunction, 2)], present: i.lvFunction > 0),
            ScoredItem(label: "Recent MI (<90 days) +0.546", points: 0.5460218, present: i.recentMI),
            ScoredItem(label: "Pulmonary hypertension: \(phLabels[min(i.pulmonaryHypertension, 2)])", points: i.pulmonaryHypertension == 1 ? 0.6084972 : 1.3765812, present: i.pulmonaryHypertension > 0),
            ScoredItem(label: "Urgency: \(urgencyLabels[min(i.urgency, 3)])", points: [0, 0.4084417, 0.9361202, 1.8071808][min(i.urgency, 3)], present: i.urgency > 0),
            ScoredItem(label: "Weight of intervention: \(wLabels[min(i.weightOfIntervention, 3)])", points: [0, 0.5521478, 0.9724533, 1.6151723][min(i.weightOfIntervention, 3)], present: i.weightOfIntervention > 0),
            ScoredItem(label: "Surgery on thoracic aorta +1.175", points: 1.1745886, present: i.surgeryOnThoracicAorta),
            ScoredItem(label: "Post-infarct septal rupture +1.463", points: 1.4630660, present: i.postInfarctSeptalRupture)
        ]

        return ClinicalScore(
            systemName: "EuroSCORE II",
            abbreviation: "EuroSCORE",
            score: pctRounded, maxScore: 100,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Nashef SAM et al. Eur J Cardiothorac Surg 2012;41:734–745. www.euroscore.org"
        )
    }

    // MARK: - DASI (Duke Activity Status Index)

    static func dasi(_ i: DASIInput) -> ClinicalScore {
        // MET-weighted sum of 12 yes/no functional capacity questions
        // Hlatky MA et al. A brief self-administered questionnaire to determine functional capacity.
        // Am J Cardiol 1989;64:651–654.
        var total = 0.0
        if i.takeCareOfSelf            { total += 2.75 }
        if i.walkIndoors               { total += 1.75 }
        if i.walkOneOrTwoBlocks        { total += 2.75 }
        if i.climbStairs               { total += 5.50 }
        if i.runShortDistance          { total += 8.00 }
        if i.doLightWork               { total += 2.70 }
        if i.doModerateWork            { total += 3.50 }
        if i.doHeavyWork               { total += 8.00 }
        if i.doYardWork                { total += 4.50 }
        if i.haveSexualActivity        { total += 5.25 }
        if i.participateInModerateRecreation { total += 6.00 }
        if i.participateInStrenuous    { total += 7.50 }

        // <34 ≈ <4 METs (poor), 34–46 ≈ 4–6 METs (moderate), >46 ≈ >6 METs (good)
        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case ..<34:
            (.high, "Poor functional capacity (<4 METs) — elevated perioperative cardiac risk",
             ["Formal cardiopulmonary exercise testing (CPET) if major surgery planned",
              "Cardiology pre-operative assessment prior to elective intermediate/high-risk surgery",
              "Optimise modifiable risk factors: blood pressure, diabetes, anaemia, dyspnoea",
              "Consider cardiac stress imaging if functional capacity cannot be adequately assessed",
              "Physiotherapy prehabilitation programme to improve exercise tolerance before surgery"],
             ["DASI <34 — functional capacity below 4 METs; elevated perioperative cardiac risk; cardiology review recommended before major surgery"])
        case 34...46:
            (.moderate, "Moderate functional capacity (4–6 METs)",
             ["Routine pre-operative cardiorespiratory assessment",
              "Optimise cardiovascular risk factors pre-operatively",
              "Anaesthetic team review for high-risk or prolonged procedures",
              "Encourage graduated aerobic conditioning before elective major surgery"],
             [])
        default:
            (.low, "Good functional capacity (>6 METs) — low perioperative cardiac risk",
             ["Standard pre-operative assessment — no additional cardiac workup required for most procedures",
              "Maintain current physical activity levels; document exercise tolerance in surgical consent",
              "Reassess if new cardiorespiratory symptoms develop pre-operatively"],
             [])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Can take care of self (ADLs) +2.75", points: 2.75, present: i.takeCareOfSelf),
            ScoredItem(label: "Can walk indoors on level ground +1.75", points: 1.75, present: i.walkIndoors),
            ScoredItem(label: "Can walk 1–2 blocks on level ground +2.75", points: 2.75, present: i.walkOneOrTwoBlocks),
            ScoredItem(label: "Can climb a flight of stairs or walk up a hill +5.50", points: 5.50, present: i.climbStairs),
            ScoredItem(label: "Can run a short distance +8.00", points: 8.00, present: i.runShortDistance),
            ScoredItem(label: "Can do light housework (dusting, washing dishes) +2.70", points: 2.70, present: i.doLightWork),
            ScoredItem(label: "Can do moderate housework (vacuuming, carrying groceries) +3.50", points: 3.50, present: i.doModerateWork),
            ScoredItem(label: "Can do heavy work (scrubbing floors, moving furniture) +8.00", points: 8.00, present: i.doHeavyWork),
            ScoredItem(label: "Can do yardwork (raking, weeding, pushing mower) +4.50", points: 4.50, present: i.doYardWork),
            ScoredItem(label: "Can have sexual activity +5.25", points: 5.25, present: i.haveSexualActivity),
            ScoredItem(label: "Moderate recreation (golf, bowling, dancing) +6.00", points: 6.00, present: i.participateInModerateRecreation),
            ScoredItem(label: "Strenuous sports (swimming, tennis, football) +7.50", points: 7.50, present: i.participateInStrenuous)
        ]

        let rounded = (total * 10).rounded() / 10
        return ClinicalScore(
            systemName: "Duke Activity Status Index",
            abbreviation: "DASI",
            score: rounded, maxScore: 58.2,
            risk: risk,
            interpretation: "DASI \(String(format: "%.1f", rounded)) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Hlatky MA et al. Am J Cardiol 1989;64:651–654."
        )
    }

    // MARK: - GRACE Score (ACS Mortality)

    static func grace(_ i: GRACEInput) -> ClinicalScore {
        let agePts   = [0, 18, 36, 55, 73, 91][min(i.ageCategory, 5)]
        let hrPts    = [0,  7, 13, 23, 36, 46][min(i.heartRate, 5)]
        let sbpPts   = [63, 58, 47, 37, 26, 11, 0][min(i.systolicBP, 6)]
        let creatPts = [2,  5,  8, 11, 14, 23, 31][min(i.creatinine, 6)]
        let killipPts = [0, 21, 43, 64][min(i.killipClass, 3)]
        var total = agePts + hrPts + sbpPts + creatPts + killipPts
        if i.cardiacArrest { total += 43 }
        if i.elevatedMarkers { total += 15 }
        if i.stDeviation { total += 30 }

        // In-hospital mortality thresholds (Granger 2003)
        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0..<109:
            (.low, "Low risk — in-hospital mortality <1%",
             ["Evaluate for early discharge with outpatient cardiology follow-up",
              "Antiplatelet therapy (aspirin + P2Y12 inhibitor); statin; beta-blocker",
              "Non-invasive stress test or elective coronary angiography within 72 h",
              "Cardiac rehab referral post-discharge"],
             [])
        case 109...140:
            (.moderate, "Moderate risk — in-hospital mortality 1–3%",
             ["Admission to monitored cardiac care unit or HDU",
              "Serial ECG and troponin at 3–6 h",
              "Dual antiplatelet therapy + anticoagulation per ACS protocol",
              "Coronary angiography within 24 h (intermediate/high-risk NSTEMI pathway)",
              "Cardiology review within 12 h"],
             [])
        default:
            (.high, "High risk — in-hospital mortality >3% (score >140 = high risk)",
             ["Immediate cardiology consult; consider cardiac catheterisation lab activation",
              "Urgent coronary angiography (≤24 h); prepare for PCI or CABG if indicated",
              "Continuous ECG monitoring; IV access; anticoagulation + dual antiplatelet",
              "ICU or CCU level care; haemodynamic monitoring",
              "Serial troponin, ECG; watch for cardiogenic shock and mechanical complications"],
             ["GRACE >140 — high in-hospital mortality; urgent cardiologist involvement required"])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Age category (\(["<40","40–49","50–59","60–69","70–79","≥80"][min(i.ageCategory,5)])) +\(agePts)", points: Double(agePts), present: true),
            ScoredItem(label: "Heart rate (\(["<70","70–89","90–109","110–149","150–199","≥200"][min(i.heartRate,5)]) bpm) +\(hrPts)", points: Double(hrPts), present: true),
            ScoredItem(label: "Systolic BP (\(["<80","80–99","100–119","120–139","140–159","160–199","≥200"][min(i.systolicBP,6)]) mmHg) +\(sbpPts)", points: Double(sbpPts), present: true),
            ScoredItem(label: "Creatinine (\(["0–0.39","0.4–0.79","0.8–1.19","1.2–1.59","1.6–1.99","2.0–3.99","≥4.0"][min(i.creatinine,6)]) mg/dL) +\(creatPts)", points: Double(creatPts), present: true),
            ScoredItem(label: "Killip class \(i.killipClass + 1) +\(killipPts)", points: Double(killipPts), present: true),
            ScoredItem(label: "Cardiac arrest at admission +43", points: 43, present: i.cardiacArrest),
            ScoredItem(label: "Elevated cardiac markers +15", points: 15, present: i.elevatedMarkers),
            ScoredItem(label: "ST-segment deviation +30", points: 30, present: i.stDeviation)
        ]

        return ClinicalScore(
            systemName: "GRACE Score",
            abbreviation: "GRACE",
            score: Double(total), maxScore: 372,
            risk: risk,
            interpretation: "GRACE \(total) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Granger CB et al. Lancet 2003;362:777–781. Fox KA et al. Eur Heart J 2006;27:2755–2764."
        )
    }

    // MARK: - Surgical Apgar Score

    static func surgicalApgar(_ i: SurgicalApgarInput) -> ClinicalScore {
        // EBL points: >1000=0, 601-1000=1, 101-600=2, ≤100=3
        let eblPts: Int = switch i.estimatedBloodLoss {
        case 0: 0   // >1000
        case 1: 1   // 601-1000
        case 2: 2   // 101-600
        default: 3  // ≤100
        }
        // Lowest MAP points: <40=0, 40-54=1, 55-69=2, ≥70=3
        let mapPts: Int = switch i.lowestMAP {
        case 0: 0   // <40
        case 1: 1   // 40-54
        case 2: 2   // 55-69
        default: 3  // ≥70
        }
        // Lowest HR points: ≥120 or <40=0, 101-119=0, 86-100=1, 56-85=3, 41-55=2, ≤40=0
        let hrPts: Int = switch i.lowestHeartRate {
        case 0: 0   // ≥120
        case 1: 0   // 101-119
        case 2: 1   // 86-100
        case 3: 3   // 56-85 (normal)
        case 4: 2   // 41-55
        default: 0  // ≤40
        }
        let total = eblPts + mapPts + hrPts

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...2:
            (.critical, "Very high risk of major complication or death (~56% 30-day morbidity/mortality)",
             ["Immediate postoperative ICU/HDU admission",
              "Senior surgical and anaesthetic review; consider re-operation if clinical concern",
              "Continuous haemodynamic monitoring; early vasopressor support if MAP <65 mmHg",
              "Serial organ function monitoring (renal, hepatic, respiratory)",
              "Involve critical care team in postoperative management plan"],
             ["SAS ≤2 — very high surgical risk; ICU/HDU admission essential"])
        case 3...4:
            (.high, "High risk of major complication (~27–43% 30-day morbidity/mortality)",
             ["HDU or high-dependency step-down admission",
              "4-hourly vital sign monitoring with early-warning escalation",
              "Daily surgical review; maintain fluid balance chart",
              "DVT prophylaxis and early mobilisation when haemodynamically stable",
              "Consider physiotherapy and enhanced recovery input"],
             ["SAS 3–4 — high surgical risk; HDU monitoring recommended"])
        case 5...6:
            (.moderate, "Moderate risk of major complication (~16–22% 30-day morbidity/mortality)",
             ["Surgical ward admission with 4-hourly observations",
              "Early enhanced recovery protocol (oral fluid, mobilisation by day 1)",
              "Daily surgical review; pain management optimisation",
              "DVT prophylaxis; early removal of urinary catheter"],
             [])
        case 7...8:
            (.low, "Low risk of major complication (~9–10% 30-day morbidity/mortality)",
             ["Standard postoperative ward care",
              "Early mobilisation; regular pain review",
              "Routine enhanced recovery protocol",
              "Discharge planning from day 1"],
             [])
        default:
            (.low, "Very low risk of major complication (~3.5% 30-day morbidity/mortality)",
             ["Standard postoperative ward care; early enhanced recovery",
              "Aim for discharge by standard protocol timeline",
              "Routine outpatient follow-up at 2–4 weeks"],
             [])
        }

        let eblLabels = [">1000 mL (+0)", "601-1000 mL (+1)", "101-600 mL (+2)", "≤100 mL (+3)"]
        let mapLabels = ["<40 mmHg (+0)", "40–54 mmHg (+1)", "55–69 mmHg (+2)", "≥70 mmHg (+3)"]
        let hrLabels  = ["≥120 bpm (+0)", "101–119 bpm (+0)", "86–100 bpm (+1)", "56–85 bpm (+3)", "41–55 bpm (+2)", "≤40 bpm (+0)"]
        let items: [ScoredItem] = [
            ScoredItem(label: "Estimated blood loss: \(eblLabels[min(i.estimatedBloodLoss, 3)])", points: Double(eblPts), present: true),
            ScoredItem(label: "Lowest MAP: \(mapLabels[min(i.lowestMAP, 3)])", points: Double(mapPts), present: true),
            ScoredItem(label: "Lowest heart rate: \(hrLabels[min(i.lowestHeartRate, 5)])", points: Double(hrPts), present: true)
        ]

        return ClinicalScore(
            systemName: "Surgical Apgar Score",
            abbreviation: "SAS",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "SAS \(total)/10 — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Gawande AA et al. J Am Coll Surg 2007;204:201–208. Regenbogen SE et al. Ann Surg 2010;252:706–712."
        )
    }

    // MARK: - TIMI Risk Score (UA/NSTEMI)

    static func timi(_ i: TIMIInput) -> ClinicalScore {
        var total = 0
        if i.ageOver65 { total += 1 }
        if i.threeOrMoreRiskFactors { total += 1 }
        if i.priorCoronaryArteryStenosis { total += 1 }
        if i.stDeviationOnECG { total += 1 }
        if i.twoOrMoreAnginalEvents { total += 1 }
        if i.aspirinUseInLast7Days { total += 1 }
        if i.elevatedCardiacMarkers { total += 1 }

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...2:
            (.low, "Low risk — 14-day composite event rate ~8%",
             ["Conservative management; serial troponins (0, 3, 6 h)",
              "Non-invasive stress testing before discharge if troponins negative",
              "Dual antiplatelet therapy and anticoagulation per ACS pathway",
              "Cardiology follow-up within 72 h"],
             [])
        case 3...4:
            (.moderate, "Intermediate risk — 14-day composite event rate ~13–20%",
             ["Hospital admission; cardiology review",
              "Inpatient stress testing or early invasive strategy depending on clinical context",
              "Dual antiplatelet + anticoagulation; consider GP IIb/IIIa inhibitor if high-risk features",
              "Echocardiography to assess LV function"],
             [])
        default:
            (.high, "High risk — 14-day composite event rate ~26–40%",
             ["Early invasive strategy (coronary angiography within 24–48 h)",
              "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
              "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
              "Continuous cardiac monitoring; cardiology on-call review urgently",
              "Glycoprotein IIb/IIIa inhibitor if refractory ischaemia or catheter lab planned"],
             ["High TIMI score — early invasive strategy strongly recommended"])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Age ≥65",                           points: 1, present: i.ageOver65),
            ScoredItem(label: "≥3 CAD risk factors",              points: 1, present: i.threeOrMoreRiskFactors),
            ScoredItem(label: "Prior coronary stenosis ≥50%",     points: 1, present: i.priorCoronaryArteryStenosis),
            ScoredItem(label: "ST deviation on ECG",              points: 1, present: i.stDeviationOnECG),
            ScoredItem(label: "≥2 anginal events in prior 24 h",  points: 1, present: i.twoOrMoreAnginalEvents),
            ScoredItem(label: "Aspirin use in prior 7 days",      points: 1, present: i.aspirinUseInLast7Days),
            ScoredItem(label: "Elevated cardiac markers",         points: 1, present: i.elevatedCardiacMarkers)
        ]

        return ClinicalScore(
            systemName: "TIMI Risk Score (UA/NSTEMI)",
            abbreviation: "TIMI",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: "TIMI \(total)/7 — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Antman EM et al. JAMA 2000;284:835–842."
        )
    }

    // MARK: - HEART Score (chest pain risk stratification)

    static func heart(_ i: HEARTInput) -> ClinicalScore {
        let total = i.history + i.ecg + i.ageScore + i.riskFactors + i.troponin
        let (risk, interp, recs, flags) = heartRisk(total)
        let items: [ScoredItem] = [
            ScoredItem(label: "History",      points: Double(i.history),     present: i.history > 0),
            ScoredItem(label: "ECG",          points: Double(i.ecg),         present: i.ecg > 0),
            ScoredItem(label: "Age",          points: Double(i.ageScore),    present: i.ageScore > 0),
            ScoredItem(label: "Risk factors", points: Double(i.riskFactors), present: i.riskFactors > 0),
            ScoredItem(label: "Troponin",     points: Double(i.troponin),    present: i.troponin > 0)
        ]
        return ClinicalScore(
            systemName: "HEART Score",
            abbreviation: "HEART",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: "HEART \(total)/10 — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Backus BE et al. Neth Heart J 2010;18:422–428. Six AJ et al. Heart 2008;94:1509–1513. Mahler SA et al. Crit Pathw Cardiol 2015;14:1–8."
        )
    }

    private static func heartRisk(_ score: Int) -> (ScoreRisk, String, [String], [String]) {
        switch score {
        case 0...3:
            return (.low,
                    "Low risk — MACE probability <2% at 6 weeks",
                    ["Discharge from ED with outpatient follow-up if clinically stable",
                     "Serial troponins (0 h and 3 h) to confirm negative before discharge",
                     "Aspirin and early outpatient cardiology review",
                     "Discharge instructions: return if symptoms recur"],
                    [])
        case 4...6:
            return (.moderate,
                    "Moderate risk — MACE probability ~12–25% at 6 weeks",
                    ["Hospital observation with serial troponins (0, 3, 6 h)",
                     "Non-invasive stress testing (exercise ECG or stress echo)",
                     "Cardiology review before discharge",
                     "Antiplatelet therapy; consider anticoagulation if ACS confirmed"],
                    [])
        default:
            return (.high,
                    "High risk — MACE probability ~50–65% at 6 weeks",
                    ["Urgent cardiology review and inpatient monitoring",
                     "Early invasive strategy (coronary angiography within 24–48 h)",
                     "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor)",
                     "Anticoagulation (LMWH or fondaparinux) unless contraindicated",
                     "Continuous cardiac monitoring; prepare for intervention"],
                    ["High HEART score — early invasive strategy strongly recommended"])
        }
    }

    // MARK: - 4T Score (Heparin-Induced Thrombocytopenia)

    struct FourTInput: Equatable {
        // Each domain 0–2
        var thrombocytopenia: Int = 0   // 0=<30% fall or nadir<10; 1=30–50% or nadir 10–19; 2=≥50% fall and nadir≥20
        var timing: Int = 0             // 0=<4 days without recent heparin; 1=consistent but not clear; 2=5–10 days or ≤1 day if prior heparin within 30 days
        var thrombosis: Int = 0         // 0=none; 1=progressive/recurrent or erythematous skin lesions; 2=new thrombosis, skin necrosis, or acute systemic reaction after IV heparin bolus
        var otherCause: Int = 0         // 0=definite other cause; 1=possible other cause; 2=no other cause evident
    }

    static func fourT(_ i: FourTInput) -> ClinicalScore {
        let total = i.thrombocytopenia + i.timing + i.thrombosis + i.otherCause
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String]

        switch total {
        case 0...3:
            risk = .low
            interpretation = "4T Score \(total) — Low probability of HIT (<5%)"
            recs = ["HIT unlikely; continue heparin if clinically indicated",
                    "No need for HIT-specific antibody testing based on score alone",
                    "Monitor platelet count per clinical indication"]
            flags = []
        case 4...5:
            risk = .moderate
            interpretation = "4T Score \(total) — Intermediate probability of HIT (~10–30%)"
            recs = ["Discontinue all heparin products (including flushes and LMWH) pending investigation",
                    "Send anti-PF4/heparin ELISA antibody assay urgently",
                    "Switch to alternative non-heparin anticoagulant (argatroban, fondaparinux, or danaparoid) if anticoagulation required",
                    "Haematology review",
                    "Do NOT give warfarin until platelet count has recovered to ≥150 × 10⁹/L"]
            flags = ["Intermediate HIT probability — stop heparin and test anti-PF4 antibodies",
                     "Risk of venous and arterial limb-threatening thrombosis"]
        default:
            risk = .critical
            interpretation = "4T Score \(total) — High probability of HIT (>80%)"
            recs = ["Immediately discontinue ALL heparin-containing products",
                    "Initiate non-heparin anticoagulation urgently (argatroban or bivalirudin for HIT with thrombosis)",
                    "Send anti-PF4/heparin ELISA and serotonin release assay (SRA)",
                    "Urgent haematology consult",
                    "Doppler ultrasound to exclude DVT/thrombosis",
                    "Do NOT give warfarin, platelet transfusions, or LMWH",
                    "Anticoagulate for minimum 4 weeks after platelet recovery"]
            flags = ["HIGH probability HIT — immediate heparin cessation mandatory",
                     "Life-threatening thrombotic complication risk",
                     "Urgent haematology review required"]
        }

        return ClinicalScore(
            systemName: "4T Score",
            abbreviation: "4T \(total)/8",
            score: Double(total), maxScore: 8,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Thrombocytopenia",     points: Double(i.thrombocytopenia), present: i.thrombocytopenia > 0),
                ScoredItem(label: "Timing of platelet fall", points: Double(i.timing),        present: i.timing > 0),
                ScoredItem(label: "Thrombosis / skin necrosis", points: Double(i.thrombosis), present: i.thrombosis > 0),
                ScoredItem(label: "Other cause",           points: Double(i.otherCause),       present: i.otherCause > 0)
            ],
            redFlags: flags,
            evidenceNote: "Warkentin TE et al. Thromb Haemost 2003;90:759–765. Lo GK et al. J Thromb Haemost 2006;4:759–765. Validated pre-test probability tool for HIT diagnosis; positive predictive value ~50–80% at high scores."
        )
    }

    // MARK: - sPESI (Simplified Pulmonary Embolism Severity Index)
    struct SPESIInput: Equatable {
        var age: Int = 40               // years
        var cancer: Bool = false         // active malignancy
        var cardiopulmonaryDisease: Bool = false  // chronic cardiopulmonary disease (chronic HF or COPD)
        var heartRateAbove109: Bool = false       // HR ≥110 bpm at presentation
        var sbpBelow100: Bool = false             // SBP <100 mmHg
        var spo2Below90: Bool = false             // SpO2 <90% on room air
    }

    static func spesi(_ i: SPESIInput) -> ClinicalScore {
        var pts = 0
        var items: [ScoredItem] = []

        let agePt = i.age > 80 ? 1 : 0
        pts += agePt
        items.append(ScoredItem(label: "Age >80 years", points: 1, present: i.age > 80))
        items.append(ScoredItem(label: "Active cancer", points: 1, present: i.cancer))
        if i.cancer { pts += 1 }
        items.append(ScoredItem(label: "Chronic cardiopulmonary disease (HF or COPD)", points: 1, present: i.cardiopulmonaryDisease))
        if i.cardiopulmonaryDisease { pts += 1 }
        items.append(ScoredItem(label: "HR ≥110 bpm", points: 1, present: i.heartRateAbove109))
        if i.heartRateAbove109 { pts += 1 }
        items.append(ScoredItem(label: "SBP <100 mmHg", points: 1, present: i.sbpBelow100))
        if i.sbpBelow100 { pts += 1 }
        items.append(ScoredItem(label: "SpO₂ <90%", points: 1, present: i.spo2Below90))
        if i.spo2Below90 { pts += 1 }

        let score = Double(pts)
        let flags: [String] = pts >= 1 ? ["sPESI ≥1 — high-risk PE: 30-day mortality ~10.9% vs 1.0% for sPESI 0"] : []
        let (risk, interp): (ScoreRisk, String)
        if pts == 0 {
            (risk, interp) = (.low, "sPESI 0/6: Low-risk PE. Consider outpatient treatment or short hospital stay. 30-day mortality ~1.0%. Criteria: age ≤80, no cancer, no cardiopulmonary disease, HR <110, SBP ≥100, SpO2 ≥90%.")
        } else {
            (risk, interp) = (.high, "sPESI \(pts)/6: High-risk PE. Inpatient management required. 30-day mortality ~10.9%. Consider systemic anticoagulation, risk stratify further with echocardiogram and troponin.")
        }
        return ClinicalScore(
            systemName: "Simplified PESI",
            abbreviation: "sPESI \(pts)/6",
            score: score,
            maxScore: 6,
            risk: risk,
            interpretation: interp,
            recommendations: pts == 0 ? [
                "Consider outpatient management with LMWH or DOAC (e.g. rivaroxaban 15 mg BD for 21 days then 20 mg OD)",
                "Oral anticoagulation for minimum 3 months; assess duration based on provoked vs unprovoked",
                "Arrange close follow-up within 7–14 days",
                "Educate on signs of PE recurrence and bleeding"
            ] : [
                "Admit for inpatient anticoagulation and monitoring",
                "Initiate parenteral anticoagulation (LMWH or UFH) immediately",
                "Echo + troponin/BNP to risk-stratify for intermediate-high vs high-risk PE",
                "If massive PE (haemodynamic instability): systemic thrombolysis or catheter-directed therapy",
                "If intermediate-high risk: consider NOAC after clinical stability, monitor for deterioration",
                "Supplemental oxygen to maintain SpO2 ≥95%",
                "Avoid bed rest in haemodynamically stable patients — early mobilisation"
            ],
            items: items,
            redFlags: flags,
            evidenceNote: "Jiménez D et al. Lancet 2010;376:1043–1048. sPESI validated across multiple cohorts. sPESI 0 identifies patients safe for outpatient PE treatment. ESC 2019 guidelines recommend sPESI for initial PE risk stratification."
        )
    }

    // MARK: - PERC Rule (Pulmonary Embolism Rule-out Criteria)
    struct PERCInput: Equatable {
        var age: Int = 40                    // years
        var hrAbove99: Bool = false           // HR ≥ 100 bpm
        var spo2Below95: Bool = false         // SpO2 < 95%
        var legSwelling: Bool = false         // unilateral leg swelling
        var haemoptysis: Bool = false
        var exogenousEstrogen: Bool = false   // OCP, HRT, or other exogenous oestrogen
        var priorDVTorPE: Bool = false
        var recentSurgeryOrTrauma: Bool = false  // hospitalisation for surgery or trauma in past 4 weeks
    }

    static func perc(_ i: PERCInput) -> ClinicalScore {
        var criteria = 0  // how many PERC criteria are VIOLATED (not met)
        if i.age >= 50          { criteria += 1 }
        if i.hrAbove99          { criteria += 1 }
        if i.spo2Below95        { criteria += 1 }
        if i.legSwelling        { criteria += 1 }
        if i.haemoptysis        { criteria += 1 }
        if i.exogenousEstrogen  { criteria += 1 }
        if i.priorDVTorPE       { criteria += 1 }
        if i.recentSurgeryOrTrauma { criteria += 1 }

        let allMet = criteria == 0

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        if allMet {
            risk = .low
            interp = "PERC Rule met (0/8 criteria failed). In patients with pre-test probability < 15%, PE can be excluded without D-dimer or imaging — reducing unnecessary workup and radiation."
            flags = []
            recs = [
                "PERC-negative: PE excluded in low pre-test probability setting (<15%)",
                "No D-dimer or CTPA required if pre-test clinical probability is genuinely low",
                "Reassess if symptoms worsen, new onset tachycardia, or SpO2 drops",
                "Document clinical probability assessment alongside PERC result",
                "If pre-test probability is ≥15%, PERC rule does NOT apply — proceed to Wells + D-dimer"
            ]
        } else {
            risk = .moderate
            interp = "PERC Rule NOT met (\(criteria)/8 criteria failed). Further evaluation required — proceed with clinical probability assessment (Wells PE) and D-dimer or direct imaging."
            flags = criteria >= 3 ? ["PERC ≥ 3 criteria: proceed directly to Wells PE + CTPA pathway"] : []
            recs = [
                "PERC-positive: PE not excluded — formal risk stratification required",
                "Apply Wells PE score to determine pre-test probability",
                "D-dimer if Wells PE low/moderate probability; CTPA if high probability or D-dimer positive",
                "Anticoagulation immediately if Wells PE high probability and no contraindication while awaiting imaging",
                "Consider bilateral leg Doppler USS if CTPA contraindicated or inconclusive"
            ]
        }
        return ClinicalScore(
            systemName: "PERC Rule (PE Rule-out Criteria)",
            abbreviation: allMet ? "PERC Met" : "PERC Fail \(criteria)/8",
            score: Double(criteria),
            maxScore: 8,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age ≥ 50 years", points: 1, present: i.age >= 50),
                ScoredItem(label: "Heart rate ≥ 100 bpm", points: 1, present: i.hrAbove99),
                ScoredItem(label: "SpO₂ < 95%", points: 1, present: i.spo2Below95),
                ScoredItem(label: "Unilateral leg swelling", points: 1, present: i.legSwelling),
                ScoredItem(label: "Haemoptysis", points: 1, present: i.haemoptysis),
                ScoredItem(label: "Exogenous oestrogen use", points: 1, present: i.exogenousEstrogen),
                ScoredItem(label: "Prior DVT or PE", points: 1, present: i.priorDVTorPE),
                ScoredItem(label: "Recent surgery or trauma requiring hospitalisation (≤4 weeks)", points: 1, present: i.recentSurgeryOrTrauma)
            ],
            redFlags: flags,
            evidenceNote: "Kline JA et al. J Thromb Haemost 2004;2:1247–1255. PERC validated in ED cohorts; reduces CTPA use by ~20% in low-pretest-probability patients. Must be applied only when physician-assessed pre-test probability is <15%. Not a standalone rule — requires gestalt clinical probability estimate first."
        )
    }

    // MARK: - Shock Index (Haemodynamic Instability)
    struct ShockIndexInput: Equatable {
        var heartRate: Int = 80       // bpm
        var systolicBP: Int = 120     // mmHg
    }

    static func shockIndex(_ i: ShockIndexInput) -> ClinicalScore {
        guard i.systolicBP > 0 else {
            return ClinicalScore(
                systemName: "Shock Index",
                abbreviation: "SI — Invalid",
                score: 0,
                maxScore: 3,
                risk: .critical,
                interpretation: "Invalid: systolic BP must be > 0.",
                recommendations: ["Check vital signs — systolic BP cannot be zero."],
                items: [],
                redFlags: ["SBP = 0 entered — verify patient vitals immediately"],
                evidenceNote: ""
            )
        }
        let si = Double(i.heartRate) / Double(i.systolicBP)
        let siRounded = (si * 100).rounded() / 100

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]

        switch si {
        case ..<0.6:
            risk = .low
            interp = "Shock Index \(siRounded) — Normal. No haemodynamic compromise. Routine monitoring appropriate."
            flags = []
            recs = [
                "Normal range — routine vital-sign monitoring",
                "Reassess if clinical condition changes"
            ]
        case 0.6..<1.0:
            risk = .moderate
            interp = "Shock Index \(siRounded) — Mild abnormality. Some studies suggest slight increase in adverse outcomes. Correlate clinically."
            flags = []
            recs = [
                "Mild elevation — ensure adequate IV access",
                "Reassess in 15–30 minutes",
                "Consider fluid responsiveness assessment if clinical concern"
            ]
        case 1.0..<1.4:
            risk = .high
            interp = "Shock Index \(siRounded) — Significant haemodynamic compromise. Associated with 30-day mortality up to 30% in trauma. Urgent assessment required."
            flags = ["SI ≥ 1.0 — significant haemorrhagic shock risk: urgent assessment"]
            recs = [
                "Urgent assessment — likely haemodynamic compromise",
                "Large-bore IV access ×2 (14–16G), cross-match, activate MTP protocol if trauma",
                "IV fluid resuscitation: balanced crystalloid, targeting MAP >65 mmHg",
                "Identify source of blood loss: abdominal USS (FAST), chest X-ray",
                "Vasopressors (noradrenaline) if fluid-unresponsive hypotension",
                "Consider damage-control resuscitation: 1:1:1 (pRBC:FFP:platelets)",
                "Activate trauma team if trauma mechanism"
            ]
        default:
            risk = .critical
            interp = "Shock Index \(siRounded) — Severe haemodynamic compromise (class III–IV haemorrhagic shock). Immediate resuscitation and source control required. Mortality risk > 50% without intervention."
            flags = ["SI ≥ 1.4 — severe haemorrhagic shock: immediate resuscitation and surgical control"]
            recs = [
                "Immediate resuscitation — class III/IV haemorrhagic shock",
                "Activate massive transfusion protocol (MTP): 1:1:1 ratio",
                "Immediate surgical/interventional haemostasis — IR embolisation or emergency surgery",
                "Permissive hypotension (target SBP 80–90 mmHg) until haemostasis achieved",
                "TXA 1 g IV within 3 hours of injury (CRASH-2 trial)",
                "Correct hypothermia, acidaemia, coagulopathy — the 'lethal triad'",
                "ICU admission post-resuscitation"
            ]
        }
        return ClinicalScore(
            systemName: "Shock Index",
            abbreviation: "SI \(siRounded)",
            score: si,
            maxScore: 3,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Heart rate (bpm)", points: Double(i.heartRate), present: true),
                ScoredItem(label: "Systolic BP (mmHg)", points: Double(i.systolicBP), present: true),
                ScoredItem(label: "Shock Index (HR ÷ SBP)", points: siRounded * 100, present: true)
            ],
            redFlags: flags,
            evidenceNote: "Allgöwer M, Burri C. Dtsch Med Wochenschr 1967;92:1947–1950. Shock Index validated in trauma (Mutschler 2013) and obstetric haemorrhage (Bhatt 2018). SI ≥ 1.0 predicts need for massive transfusion (sensitivity 87%). Limitations: less reliable in patients on beta-blockers or with pre-existing hypertension/bradycardia."
        )
    }

    // MARK: - Revised Geneva Score (Pulmonary Embolism)
    struct RevisedGenevaInput: Equatable {
        var age: Int = 40                       // years
        var priorDVTorPE: Bool = false           // 3 pts
        var surgeryOrFractureInMonth: Bool = false // 2 pts — surgery or fracture ≤ 1 month
        var activeMalignancy: Bool = false       // 2 pts
        var unilateralLimbPain: Bool = false     // 3 pts
        var haemoptysis: Bool = false            // 2 pts
        var heartRateAbove74: Bool = false       // HR 75–94 = 3 pts
        var heartRateAbove94: Bool = false       // HR ≥ 95 = 5 pts
        var painOnPalpationLimbAndEdema: Bool = false // 4 pts
    }

    static func revisedGeneva(_ i: RevisedGenevaInput) -> ClinicalScore {
        var pts = 0
        if i.age >= 65 { pts += 1 }
        if i.priorDVTorPE             { pts += 3 }
        if i.surgeryOrFractureInMonth { pts += 2 }
        if i.activeMalignancy         { pts += 2 }
        if i.unilateralLimbPain       { pts += 3 }
        if i.haemoptysis              { pts += 2 }
        if i.heartRateAbove94 {
            pts += 5
        } else if i.heartRateAbove74 {
            pts += 3
        }
        if i.painOnPalpationLimbAndEdema { pts += 4 }

        let (risk, interp): (ScoreRisk, String)
        let flags: [String]
        let recs: [String]
        switch pts {
        case 0...3:
            risk = .low
            interp = "Revised Geneva \(pts)/22 — Low clinical probability for PE. D-dimer recommended; if negative, PE excluded."
            flags = []
            recs = [
                "Low probability — D-dimer testing: negative result excludes PE in low-probability patients",
                "If D-dimer positive: CTPA (CT pulmonary angiography)",
                "Combine with PERC rule: if all 8 PERC criteria met AND low pretest probability → no D-dimer needed",
                "Consider leg Doppler USS if CTPA contraindicated",
                "Reassess if symptoms change or new tachycardia develops"
            ]
        case 4...10:
            risk = .moderate
            interp = "Revised Geneva \(pts)/22 — Moderate clinical probability for PE. D-dimer or direct CTPA depending on clinical urgency."
            flags = []
            recs = [
                "Moderate probability — D-dimer if not clinically decompensated",
                "CTPA if D-dimer positive or clinical status deteriorating",
                "IV access; oxygen if SpO2 < 94%; analgesia",
                "Low-molecular-weight heparin (LMWH) if clinical deterioration occurs while awaiting imaging",
                "Echocardiography if haemodynamically unstable to rule out massive PE"
            ]
        default:
            risk = .high
            interp = "Revised Geneva \(pts)/22 — High clinical probability for PE. CTPA immediately; anticoagulate without awaiting result."
            flags = ["Revised Geneva ≥ 11 — high probability PE: CTPA and anticoagulation without delay"]
            recs = [
                "High probability — anticoagulate immediately (LMWH or unfractionated heparin) unless contraindicated",
                "CTPA urgent — do not delay anticoagulation for imaging result",
                "Haemodynamically unstable massive PE: consider systemic thrombolysis (alteplase 100 mg) or surgical embolectomy",
                "sPESI score to assess severity and disposition (ambulatory vs. HDU/ICU)",
                "Cardiac echo to assess right ventricular strain (prognostic)",
                "Notify ITU/HDU if hypotensive, HR > 120, or SpO2 < 90%"
            ]
        }
        return ClinicalScore(
            systemName: "Revised Geneva Score (PE)",
            abbreviation: "Geneva \(pts)/22",
            score: Double(pts),
            maxScore: 22,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Age ≥ 65 years", points: 1, present: i.age >= 65),
                ScoredItem(label: "Prior DVT or PE", points: 3, present: i.priorDVTorPE),
                ScoredItem(label: "Surgery or fracture ≤ 1 month", points: 2, present: i.surgeryOrFractureInMonth),
                ScoredItem(label: "Active malignancy", points: 2, present: i.activeMalignancy),
                ScoredItem(label: "Unilateral lower-limb pain", points: 3, present: i.unilateralLimbPain),
                ScoredItem(label: "Haemoptysis", points: 2, present: i.haemoptysis),
                ScoredItem(label: "Heart rate 75–94 bpm", points: 3, present: i.heartRateAbove74 && !i.heartRateAbove94),
                ScoredItem(label: "Heart rate ≥ 95 bpm", points: 5, present: i.heartRateAbove94),
                ScoredItem(label: "Pain on deep palpation of lower limb AND oedema", points: 4, present: i.painOnPalpationLimbAndEdema)
            ],
            redFlags: flags,
            evidenceNote: "Le Gal G et al. Ann Intern Med 2006;144:165–171. Revised Geneva Score validated in 965 consecutive patients; AUC 0.74. Low risk: 7% PE prevalence; Moderate: 29%; High: 64%. Does not require physician gestalt — all items are objective. Equivalent performance to Wells PE in meta-analyses."
        )
    }

    // MARK: - #101 Berlin Criteria for ARDS

    struct BerlinARDSInput: Equatable {
        var pao2FiO2Ratio: Double          // PaO₂ / FiO₂ ratio (mmHg)
        var peepOrCPAP: Int                // PEEP/CPAP applied (cmH₂O)
        var acuteOnsetWithin1Week: Bool    // onset within 1 week of clinical insult
        var bilateralOpacitiesOnImaging: Bool // not explained by effusions/collapse/nodules
        var notExplainedByCardiacFailure: Bool // not fully explained by cardiac failure/fluid overload
    }

    static func berlinARDS(_ i: BerlinARDSInput) -> ClinicalScore {
        // Berlin 2012: requires all 3 non-severity criteria first
        let qualifies = i.acuteOnsetWithin1Week && i.bilateralOpacitiesOnImaging && i.notExplainedByCardiacFailure

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        // Minimum PEEP ≥5 cmH₂O required for classification
        let peepMet = i.peepOrCPAP >= 5

        if !qualifies || !peepMet {
            risk  = .low
            interp = "Berlin criteria not fully met — ARDS not confirmed. Review onset, imaging, and cardiac/fluid status."
            recs  = [
                "Confirm acute onset within 7 days of clinical insult",
                "Ensure bilateral opacities on chest X-ray/CT (not explained by effusions, collapse or nodules)",
                "Exclude cardiac failure / fluid overload as primary cause (echocardiography if uncertain)",
                "PEEP ≥5 cmH₂O required for Berlin classification"
            ]
            return ClinicalScore(
                name:          "Berlin ARDS Criteria",
                score:         i.pao2FiO2Ratio,
                maxScore:      nil,
                risk:          risk,
                interpretation: interp,
                recommendations: recs,
                evidenceNote:  "ARDS Definition Task Force. JAMA 2012;307:2526. Berlin definition replaced the 1994 AECC criteria. Three severity categories based on PaO₂/FiO₂ with PEEP ≥5 cmH₂O: mild 200–300 mmHg (27% mortality), moderate 100–200 mmHg (32%), severe <100 mmHg (45%)."
            )
        }

        let ratio = i.pao2FiO2Ratio
        if ratio > 300 {
            risk  = .low
            interp = "PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg — Berlin criteria met but PF ratio >300: not ARDS. Monitor."
            recs  = ["Continue monitoring; repeat ABG if condition deteriorates"]
        } else if ratio >= 200 {
            risk  = .moderate
            interp = "Mild ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (200–300). 27% mortality."
            recs  = [
                "Lung-protective ventilation: tidal volume 6 mL/kg PBW, plateau pressure <30 cmH₂O",
                "Treat underlying cause (pneumonia, sepsis, aspiration, trauma)",
                "Daily spontaneous breathing trial when appropriate",
                "Fluid-conservative strategy after resuscitation phase",
                "Early prone positioning if condition deteriorates to moderate/severe"
            ]
        } else if ratio >= 100 {
            risk  = .high
            interp = "Moderate ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (100–200). 32% mortality."
            recs  = [
                "Lung-protective ventilation mandatory: tidal volume 4–6 mL/kg PBW",
                "PEEP optimisation — consider PEEP-FiO₂ table or oesophageal pressure monitoring",
                "Prone positioning ≥16 hours/day — mortality benefit demonstrated",
                "Neuromuscular blockade for 48 hours if persistent dyssynchrony",
                "Consider recruiting manoeuvres cautiously",
                "Treat underlying cause aggressively"
            ]
            flags = ["Moderate ARDS PF <200 — prone positioning indicated; consider NMB"]
        } else {
            risk  = .critical
            interp = "Severe ARDS — PaO₂/FiO₂ \(String(format: "%.0f", ratio)) mmHg (<100). 45% mortality."
            recs  = [
                "Mandatory lung-protective ventilation: tidal volume 4–6 mL/kg PBW",
                "Prone positioning ≥16 hours/day — mandatory for PF <150",
                "Neuromuscular blockade early (cisatracurium 48 hours)",
                "High PEEP strategy",
                "ECMO referral if PaO₂/FiO₂ <80 despite prone ventilation — consult ECMO centre",
                "Early multidisciplinary ICU review",
                "Family meeting regarding prognosis"
            ]
            flags = ["Severe ARDS PF <100 — ECMO referral threshold; mortality 45%"]
        }

        return ClinicalScore(
            name:          "Berlin ARDS Criteria",
            score:         ratio,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "ARDS Definition Task Force. JAMA 2012;307:2526. Berlin definition: acute onset <7 days, bilateral opacities not explained by effusions/collapse/nodules, respiratory failure not explained by cardiac failure/fluid overload, PEEP/CPAP ≥5 cmH₂O. Mild: PaO₂/FiO₂ 200–300 (27% mortality); Moderate 100–200 (32%); Severe <100 (45%). Replaces 1994 AECC criteria; validated in 4,188 patients from 3 multicentre cohorts."
        )
    }


}
