// ClinicalScoresView+PerioperativeForms3.swift
// Charlson Comorbidity Index, Modified Frailty Index-5, Mirels Criteria,
// ARISCAT Score (pulmonary complications).

import SwiftUI

extension ClinicalScoresView {

    // MARK: - Charlson Comorbidity Index (#76)

    var cciForm: some View {
        Group {
            mewsSlider("Age (years — for age-adjusted CCI)", value: Binding(get: { Double(cciI.age) }, set: { cciI.age = Int($0) }),
                       range: 18...110, step: 1, unit: "yrs")
            sectionHeader("1-Point Conditions")
            scoreToggle("Myocardial infarction (any prior history)", binding: $cciI.myocardialInfarction, points: "+1", autoKey: "myocardialInfarction")
            scoreToggle("Congestive heart failure", binding: $cciI.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Peripheral vascular disease", binding: $cciI.peripheralVascularDisease, points: "+1", autoKey: "peripheralVascularDisease")
            scoreToggle("Cerebrovascular disease / TIA", binding: $cciI.cerebrovascularDisease, points: "+1", autoKey: "cerebrovascularDisease")
            scoreToggle("Dementia", binding: $cciI.dementia, points: "+1", autoKey: "dementia")
            scoreToggle("Chronic pulmonary disease (COPD / asthma)", binding: $cciI.chronicPulmonaryDisease, points: "+1", autoKey: "chronicPulmonaryDisease")
            scoreToggle("Connective tissue / rheumatological disease", binding: $cciI.connectiveTissueDisease, points: "+1", autoKey: "connectiveTissueDisease")
            scoreToggle("Peptic ulcer disease", binding: $cciI.pepticulcer, points: "+1", autoKey: "pepticulcer")
            scoreToggle("Mild liver disease (no portal hypertension)", binding: $cciI.mildLiverDisease, points: "+1", autoKey: "mildLiverDisease")
            scoreToggle("Diabetes mellitus (uncomplicated)", binding: $cciI.diabetesUncomplicated, points: "+1", autoKey: "diabetesUncomplicated")
            sectionHeader("2-Point Conditions")
            scoreToggle("Diabetes with end-organ damage (retinopathy, nephropathy, neuropathy)", binding: $cciI.diabetesWithEndOrganDamage, points: "+2", autoKey: "diabetesWithEndOrganDamage")
            scoreToggle("Hemiplegia / paraplegia", binding: $cciI.hemiplecia, points: "+2", autoKey: "hemiplecia")
            scoreToggle("Moderate/severe CKD (creatinine > 3 mg/dL or dialysis)", binding: $cciI.moderateOrSevereCKD, points: "+2", autoKey: "moderateOrSevereCKD")
            scoreToggle("Solid tumour (within 5 years, no metastasis)", binding: $cciI.solidTumour, points: "+2", autoKey: "solidTumour")
            scoreToggle("Leukaemia (AML, CML, ALL, CLL)", binding: $cciI.leukaemia, points: "+2", autoKey: "leukaemia")
            scoreToggle("Lymphoma / multiple myeloma / Waldenström's", binding: $cciI.lymphoma, points: "+2", autoKey: "lymphoma")
            sectionHeader("3–6-Point Conditions")
            scoreToggle("Moderate/severe liver disease (portal hypertension, varices, ascites)", binding: $cciI.moderateOrSevereLiverDisease, points: "+3", autoKey: "moderateOrSevereLiverDisease")
            scoreToggle("Metastatic solid tumour", binding: $cciI.metastaticSolidTumour, points: "+6", autoKey: "metastaticSolidTumour")
            scoreToggle("AIDS (not HIV+ only)", binding: $cciI.aids, points: "+6", autoKey: "aids")
        }
        .onChange(of: cciI) { _, _ in recalculate() }
    }


    // MARK: - Modified Frailty Index-5 (#77)

    var mfi5Form: some View {
        Group {
            scoreToggle("Diabetes mellitus (requiring medication)", binding: $mfi5I.diabetes, points: "+1", autoKey: "diabetes")
            scoreToggle("Functional dependence (partial or total — ADL)", binding: $mfi5I.functionalDependence, points: "+1", autoKey: "functionalDependence")
            scoreToggle("COPD or pneumonia requiring hospitalisation (past year)", binding: $mfi5I.COPD, points: "+1", autoKey: "COPD")
            scoreToggle("Congestive heart failure", binding: $mfi5I.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Hypertension requiring medication", binding: $mfi5I.hypertension, points: "+1", autoKey: "hypertension")
        }
        .onChange(of: mfi5I) { _, _ in recalculate() }
    }


    // MARK: - Mirels Criteria

    var mirelsForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion site").font(.subheadline)
                Picker("Site", selection: $mirelsI.site) {
                    Text("Upper limb (+1)").tag(1)
                    Text("Lower limb (+2)").tag(2)
                    Text("Peritrochanteric (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pain").font(.subheadline)
                Picker("Pain", selection: $mirelsI.pain) {
                    Text("Mild (+1)").tag(1)
                    Text("Moderate (+2)").tag(2)
                    Text("Functional (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion type (radiological)").font(.subheadline)
                Picker("Lesion", selection: $mirelsI.lesionType) {
                    Text("Blastic (+1)").tag(1)
                    Text("Mixed (+2)").tag(2)
                    Text("Lytic (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Lesion size (cortical diameter)").font(.subheadline)
                Picker("Size", selection: $mirelsI.lesionSizeRatio) {
                    Text("< 1/3 (+1)").tag(1)
                    Text("1/3 – 2/3 (+2)").tag(2)
                    Text("> 2/3 (+3)").tag(3)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: mirelsI) { _, _ in recalculate() }
    }


    // MARK: - ARISCAT Score

    var ariscatForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Age (years)").font(.subheadline)
                Stepper("\(ariscatI.age) yrs", value: $ariscatI.age, in: 0...110)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pre-op SpO₂ (%)").font(.subheadline)
                Stepper("\(ariscatI.spo2Preop)%", value: $ariscatI.spo2Preop, in: 70...100)
            }
            Toggle(isOn: $ariscatI.respiratoryInfection) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Acute respiratory infection (last month)").font(.subheadline)
                    Text("+17 if present").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Pre-op haemoglobin (g/dL)").font(.subheadline)
                HStack {
                    Slider(value: $ariscatI.preOpHaemoglobin, in: 5...20, step: 0.5)
                    Text(String(format: "%.1f", ariscatI.preOpHaemoglobin))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Surgical incision type").font(.subheadline)
                Picker("Incision", selection: $ariscatI.surgicalIncision) {
                    Text("Peripheral (+0)").tag(0)
                    Text("Upper abdominal (+15)").tag(1)
                    Text("Intrathoracic (+24)").tag(2)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Planned surgical duration (hours)").font(.subheadline)
                HStack {
                    Slider(value: $ariscatI.surgicalDurationHrs, in: 0.5...10, step: 0.5)
                    Text(String(format: "%.1f h", ariscatI.surgicalDurationHrs))
                        .frame(width: 55)
                        .font(.caption.monospacedDigit())
                }
            }
            Toggle(isOn: $ariscatI.emergencyProcedure) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Emergency procedure").font(.subheadline)
                    Text("+8 if emergency").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .onChange(of: ariscatI.age)                 { _, _ in recalculate() }
        .onChange(of: ariscatI.spo2Preop)           { _, _ in recalculate() }
        .onChange(of: ariscatI.respiratoryInfection){ _, _ in recalculate() }
        .onChange(of: ariscatI.preOpHaemoglobin)    { _, _ in recalculate() }
        .onChange(of: ariscatI.surgicalIncision)    { _, _ in recalculate() }
        .onChange(of: ariscatI.surgicalDurationHrs) { _, _ in recalculate() }
        .onChange(of: ariscatI.emergencyProcedure)  { _, _ in recalculate() }
    }

}
