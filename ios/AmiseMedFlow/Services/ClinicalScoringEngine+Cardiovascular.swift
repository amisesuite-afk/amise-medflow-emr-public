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

        // Two-level Wells (NICE NG158 2020; ESC 2019): ≤ 4 PE unlikely → D-dimer first, CTPA only
        // if positive; > 4 PE likely → CTPA directly (web-last-gaps wording). The low / moderate
        // risk bands are kept for display; both follow the "PE unlikely" pathway.
        let unlikely = "Two-level Wells score (NICE NG158): Wells ≤ 4 (PE unlikely) → D-dimer, and CTPA only if it is positive"
        let dDimerCaveat = "D-dimer is unhelpful after recent surgery and in pregnancy — go to imaging (CTPA, or V/Q in pregnancy or contrast allergy)"
        if score <= 1 {
            risk = .low
            interpretation = "Wells PE \(score) — PE unlikely (≤ 4); D-dimer first"
            recs = [unlikely,
                    dDimerCaveat]
        } else if score <= 4 {
            risk = .moderate
            interpretation = "Wells PE \(score) — PE unlikely (≤ 4); D-dimer first"
            recs = [unlikely,
                    dDimerCaveat,
                    "If haemodynamically unstable → bedside ECHO / empirical anticoagulation"]
        } else {
            risk = .high
            interpretation = "Wells PE \(score) — PE likely (> 4); CTPA directly"
            redFlags = ["High probability PE — anticoagulate empirically while awaiting CTPA",
                        "If haemodynamically unstable: consider thrombolysis or surgical embolectomy"]
            recs = ["Two-level Wells score (NICE NG158): Wells > 4 (PE likely) → CTPA directly, with interim anticoagulation if CTPA is delayed",
                    "Empirical anticoagulation (LMWH or heparin IV) before imaging if safe",
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
            evidenceNote: "Johnston 2007. NICE NG128 (2019, updated 2022) advises NOT to use ABCD2 or other scores to decide urgency: everyone with a suspected TIA is seen by a specialist within 24 h of onset, with aspirin 300 mg. Shown for reference only."
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

}
