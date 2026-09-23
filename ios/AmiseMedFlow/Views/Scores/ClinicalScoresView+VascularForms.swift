// ClinicalScoresView+VascularForms.swift
// Vascular / VTE score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    func vascularFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .wellsDVT:      wellsDVTForm
        case .wellsPE:       wellsPEForm
        case .caprini:       capriniForm
        case .padua:         paduaForm
        case .fourT:         fourTForm
        case .spesi:         spesiForm
        case .perc:          percForm
        case .revisedGeneva: revisedGenevaForm
        default:             EmptyView()
        }
    }


    // MARK: - Wells DVT

    private var wellsDVTForm: some View {
        Group {
            scoreToggle("Active cancer (treatment/palliation ≤6 months)",     binding: $wDVT.activeCancer,                  points: "+1",  autoKey: "activeCancer")
            scoreToggle("Paralysis, paresis or plaster cast of lower limb",   binding: $wDVT.paralysisParesisPlastercast,   points: "+1",  autoKey: "paralysisParesisPlastercast")
            scoreToggle("Bedridden ≥3 days or surgery within 12 weeks",       binding: $wDVT.bedridden3dOrSurgery12w,       points: "+1",  autoKey: "bedridden3dOrSurgery12w")
            scoreToggle("Localised tenderness along deep vein distribution",  binding: $wDVT.localizedTendernessDeepVein,  points: "+1",  autoKey: "localizedTendernessDeepVein")
            scoreToggle("Entire leg swollen",                                  binding: $wDVT.entireLegSwollen,              points: "+1",  autoKey: "entireLegSwollen")
            scoreToggle("Calf swelling >3 cm vs asymptomatic leg",            binding: $wDVT.calfSwellingOver3cm,           points: "+1",  autoKey: "calfSwellingOver3cm")
            scoreToggle("Pitting oedema in symptomatic leg only",             binding: $wDVT.pittingOedema,                 points: "+1",  autoKey: "pittingOedema")
            scoreToggle("Collateral superficial veins (non-varicose)",        binding: $wDVT.collateralSuperficialVeins,    points: "+1",  autoKey: "collateralSuperficialVeins")
            scoreToggle("Alternative diagnosis at least as likely as DVT",    binding: $wDVT.alternativeDiagnosisAsLikely,  points: "−2")
            scoreToggle("Previously documented DVT",                           binding: $wDVT.previousDVT,                   points: "+1",  autoKey: "previousDVT")
        }
        .onChange(of: wDVT) { _, _ in recalculate() }
    }


    // MARK: - Wells PE

    private var wellsPEForm: some View {
        Group {
            scoreToggle("Clinical signs / symptoms of DVT",                    binding: $wPE.clinicalSignsDVT,           points: "+3",   autoKey: "clinicalSignsDVT")
            scoreToggle("Alternative Dx less likely than PE",                  binding: $wPE.alternativeDxLessLikely,    points: "+3",   autoKey: "alternativeDxLessLikely")
            scoreToggle("Heart rate >100 bpm",                                 binding: $wPE.hrOver100,                  points: "+1.5", autoKey: "hrOver100")
            scoreToggle("Immobilisation ≥3 days or surgery within 4 weeks",   binding: $wPE.immobilisationOrSurgery4w,  points: "+1.5", autoKey: "immobilisationOrSurgery4w")
            scoreToggle("Previous DVT or PE",                                  binding: $wPE.previousDVTOrPE,            points: "+1.5", autoKey: "previousDVTOrPE")
            scoreToggle("Haemoptysis",                                         binding: $wPE.haemoptysis,                points: "+1",   autoKey: "haemoptysis")
            scoreToggle("Malignancy (treatment ≤6 months or palliative)",     binding: $wPE.malignancyActive,           points: "+1",   autoKey: "malignancyActive")
        }
        .onChange(of: wPE) { _, _ in recalculate() }
    }


    // MARK: - Caprini

    private var capriniForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            capriniAgeSection
            capriniRiskSection
            capriniHighRiskSection
        }
    }


    // MARK: - Padua Prediction Score

    private var paduaForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            paduaHighRiskSection
            paduaLowRiskSection
        }
    }


    // MARK: - 4T Score (HIT)

    private var fourTForm: some View {
        Group {
            apacheSegment("1. Thrombocytopenia", selection: $fourTI.thrombocytopenia,
                options: [
                    (0, "0 — Platelet fall <30%, or nadir <10 × 10⁹/L"),
                    (1, "1 — Platelet fall 30–50%, or nadir 10–19 × 10⁹/L"),
                    (2, "2 — Platelet fall >50% AND nadir ≥20 × 10⁹/L")
                ])
            apacheSegment("2. Timing of platelet fall", selection: $fourTI.timing,
                options: [
                    (0, "0 — Platelet fall <4 days, no recent heparin exposure"),
                    (1, "1 — Consistent with days 5–10 but not clear; or fall after day 10"),
                    (2, "2 — Onset days 5–10, or ≤1 day if heparin exposure in past 30 days")
                ])
            apacheSegment("3. Thrombosis or other sequelae", selection: $fourTI.thrombosis,
                options: [
                    (0, "0 — None"),
                    (1, "1 — Progressive or recurrent thrombosis; non-necrotising skin lesions"),
                    (2, "2 — New proven thrombosis, skin necrosis, or acute systemic reaction after IV heparin bolus")
                ])
            apacheSegment("4. Other cause for thrombocytopenia", selection: $fourTI.otherCause,
                options: [
                    (0, "0 — Definite other cause present"),
                    (1, "1 — Possible other cause"),
                    (2, "2 — No other cause evident")
                ])
        }
        .onChange(of: fourTI) { _, _ in recalculate() }
    }


    // MARK: - sPESI (#67)

    private var spesiForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(spesiI.age) }, set: { spesiI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Active cancer (treatment within 6 months or palliative)",
                        binding: $spesiI.cancer, points: "+1", autoKey: "cancer")
            scoreToggle("Chronic cardiopulmonary disease (heart failure or COPD)",
                        binding: $spesiI.cardiopulmonaryDisease, points: "+1", autoKey: "cardiopulmonaryDisease")
            scoreToggle("Heart rate ≥ 110 bpm",
                        binding: $spesiI.heartRateAbove109, points: "+1", autoKey: "heartRateAbove109")
            scoreToggle("Systolic BP < 100 mmHg",
                        binding: $spesiI.sbpBelow100, points: "+1", autoKey: "sbpBelow100")
            scoreToggle("SpO₂ < 90%",
                        binding: $spesiI.spo2Below90, points: "+1", autoKey: "spo2Below90")
        }
        .onChange(of: spesiI) { _, _ in recalculate() }
    }


    // MARK: - PERC Rule (#71)

    private var percForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(percI.age) }, set: { percI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Heart rate ≥ 100 bpm", binding: $percI.hrAbove99, points: "PERC fail", autoKey: "hrAbove99")
            scoreToggle("SpO₂ < 95%", binding: $percI.spo2Below95, points: "PERC fail", autoKey: "spo2Below95")
            scoreToggle("Unilateral leg swelling", binding: $percI.legSwelling, points: "PERC fail", autoKey: "legSwelling")
            scoreToggle("Haemoptysis", binding: $percI.haemoptysis, points: "PERC fail", autoKey: "haemoptysis")
            scoreToggle("Exogenous oestrogen (OCP, HRT)", binding: $percI.exogenousEstrogen, points: "PERC fail", autoKey: "exogenousEstrogen")
            scoreToggle("Prior DVT or PE", binding: $percI.priorDVTorPE, points: "PERC fail", autoKey: "priorDVTorPE")
            scoreToggle("Recent surgery or trauma (≤ 4 weeks, requiring hospitalisation)",
                        binding: $percI.recentSurgeryOrTrauma, points: "PERC fail", autoKey: "recentSurgeryOrTrauma")
        }
        .onChange(of: percI) { _, _ in recalculate() }
    }


    // MARK: - Revised Geneva Score (#75)

    private var revisedGenevaForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(rgI.age) }, set: { rgI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            scoreToggle("Prior DVT or PE", binding: $rgI.priorDVTorPE, points: "+3", autoKey: "priorDVTorPE")
            scoreToggle("Surgery or lower-limb fracture within 1 month", binding: $rgI.surgeryOrFractureInMonth, points: "+2", autoKey: "surgeryOrFractureInMonth")
            scoreToggle("Active malignancy (solid or haematological)", binding: $rgI.activeMalignancy, points: "+2", autoKey: "activeMalignancy")
            scoreToggle("Unilateral lower-limb pain", binding: $rgI.unilateralLimbPain, points: "+3", autoKey: "unilateralLimbPain")
            scoreToggle("Haemoptysis", binding: $rgI.haemoptysis, points: "+2", autoKey: "haemoptysis")
            scoreToggle("Heart rate 75–94 bpm", binding: $rgI.heartRateAbove74, points: "+3", autoKey: "heartRateAbove74")
            scoreToggle("Heart rate ≥ 95 bpm", binding: $rgI.heartRateAbove94, points: "+5", autoKey: "heartRateAbove94")
            scoreToggle("Pain on deep palpation of lower limb + unilateral oedema", binding: $rgI.painOnPalpationLimbAndEdema, points: "+4", autoKey: "painOnPalpationLimbAndEdema")
        }
        .onChange(of: rgI) { _, _ in recalculate() }
    }

}
