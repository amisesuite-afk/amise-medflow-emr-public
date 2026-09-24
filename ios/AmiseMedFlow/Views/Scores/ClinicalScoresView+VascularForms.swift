// ClinicalScoresView+VascularForms.swift
// Vascular / VTE score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func vascularFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .wellsDVT: return AnyView(wellsDVTForm)
        case .wellsPE: return AnyView(wellsPEForm)
        case .caprini: return AnyView(capriniForm)
        case .padua: return AnyView(paduaForm)
        case .fourT: return AnyView(fourTForm)
        case .spesi: return AnyView(spesiForm)
        case .perc: return AnyView(percForm)
        case .revisedGeneva: return AnyView(revisedGenevaForm)
        default: return AnyView(EmptyView())
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
        .onChange(of: cap) { _, _ in recalculate() }
    }

    // Age bands are mutually exclusive — selecting one clears the others so points never double-count.
    private func capriniAgeBinding(_ keyPath: WritableKeyPath<CapriniInput, Bool>) -> Binding<Bool> {
        Binding(
            get: { cap[keyPath: keyPath] },
            set: { on in
                if on {
                    cap.age41to59 = false
                    cap.age60to74 = false
                    cap.ageOver75 = false
                }
                cap[keyPath: keyPath] = on
            }
        )
    }

    @ViewBuilder private var capriniAgeSection: some View {
        Group {
            sectionHeader("Age")
            scoreToggle("Age 41–60 years", binding: capriniAgeBinding(\.age41to59), points: "+1")
            scoreToggle("Age 61–74 years", binding: capriniAgeBinding(\.age60to74), points: "+2")
            scoreToggle("Age ≥75 years",   binding: capriniAgeBinding(\.ageOver75), points: "+3")
        }
    }

    @ViewBuilder private var capriniRiskSection: some View {
        Group {
            sectionHeader("Risk Factors")
            scoreToggle("Minor surgery planned",                      binding: $cap.minorSurgery,                 points: "+1")
            scoreToggle("Major surgery (>45 min)",                    binding: $cap.majorSurgery,                 points: "+2")
            scoreToggle("Laparoscopic surgery >45 min",               binding: $cap.laparoscopicSurgeryOver45min, points: "+2")
            scoreToggle("Confined to bed / immobile >72 h",           binding: $cap.immobilityBedridden,          points: "+1")
            scoreToggle("Central venous access",                      binding: $cap.centralVenousAccess,          points: "+2")
            scoreToggle("Oral contraceptive / HRT",                   binding: $cap.hormonalTherapy,              points: "+1")
            scoreToggle("Sepsis within 1 month",                      binding: $cap.sepsis30d,                    points: "+1")
            scoreToggle("BMI >40",                                    binding: $cap.bmi40Plus,                    points: "+1")
            scoreToggle("Malignancy (present or previous)",           binding: $cap.activeOrPriorMalignancy,      points: "+2")
            scoreToggle("History of DVT/PE",                          binding: $cap.priorVTE,                     points: "+3")
            scoreToggle("Family history of VTE",                      binding: $cap.familyHistoryVTE,             points: "+3")
            scoreToggle("Thrombophilia (e.g. Factor V Leiden, APS)",  binding: $cap.thrombophilia,                points: "+3")
        }
    }

    @ViewBuilder private var capriniHighRiskSection: some View {
        Group {
            sectionHeader("Very High Risk (within 1 month)")
            scoreToggle("Stroke",                                     binding: $cap.stroke,                              points: "+5")
            scoreToggle("Acute myocardial infarction",                binding: $cap.mi,                                  points: "+5")
            scoreToggle("Acute spinal cord injury / paralysis",       binding: $cap.spinalCordInjury,                    points: "+5")
            scoreToggle("Hip/pelvis/leg fracture or elective arthroplasty", binding: $cap.pelvisFractureOrHipKneeReplacement, points: "+5")
            scoreToggle("Multiple trauma",                            binding: $cap.multipleTrauma,                      points: "+5")
        }
    }


    // MARK: - Padua Prediction Score

    private var paduaForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            paduaHighRiskSection
            paduaLowRiskSection
        }
        .onChange(of: paduaI) { _, _ in recalculate() }
    }

    @ViewBuilder private var paduaHighRiskSection: some View {
        Group {
            sectionHeader("Major Risk Factors")
            scoreToggle("Active cancer (metastases or chemo/RT within 6 months)", binding: $paduaI.activeOrRecentCancer, points: "+3")
            scoreToggle("Previous VTE (excluding superficial thrombosis)",        binding: $paduaI.previousVTE,          points: "+3")
            scoreToggle("Reduced mobility (bed rest ≥3 days)",                    binding: $paduaI.reducedMobility,      points: "+3")
            scoreToggle("Known thrombophilic condition",                          binding: $paduaI.thrombophilia,        points: "+3")
        }
    }

    @ViewBuilder private var paduaLowRiskSection: some View {
        Group {
            sectionHeader("Other Risk Factors")
            scoreToggle("Recent trauma and/or surgery (≤1 month)",   binding: $paduaI.recentTraumaOrSurgery,         points: "+2")
            scoreToggle("Age ≥70 years",                             binding: $paduaI.ageOver70,                     points: "+1")
            scoreToggle("Heart and/or respiratory failure",          binding: $paduaI.heartOrRespiratoryFailure,     points: "+1")
            scoreToggle("Acute MI or ischaemic stroke",              binding: $paduaI.acuteMIOrIschaemicStroke,      points: "+1")
            scoreToggle("Acute infection and/or rheumatological disorder", binding: $paduaI.acuteInfectionOrInflammatory, points: "+1")
            scoreToggle("Obesity (BMI ≥30)",                         binding: $paduaI.obese,                         points: "+1")
            scoreToggle("Ongoing hormonal treatment",                binding: $paduaI.ongoingHormonalTreatment,      points: "+1")
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
