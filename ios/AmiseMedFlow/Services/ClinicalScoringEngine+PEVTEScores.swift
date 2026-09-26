// ClinicalScoringEngine+PEVTEScores.swift
// sPESI · PERC Rule · Shock Index · Revised Geneva · Berlin Criteria for ARDS
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

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
                "Oxygen to a target SpO2 of 94–98% (88–92% if at risk of hypercapnic respiratory failure) (BTS 2017)",
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
