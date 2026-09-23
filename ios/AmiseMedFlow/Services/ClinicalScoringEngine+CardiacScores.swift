// ClinicalScoringEngine+CardiacScores.swift
// EuroSCORE II · DASI · GRACE · Surgical Apgar · TIMI · HEART · 4T Score
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

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

}
