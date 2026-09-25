// ClinicalScoresView+MonitoringForms2.swift
// LACE Index, FINDRISC, CKD-EPI eGFR, CAGE questionnaire score input forms.

import SwiftUI
import SwiftData


extension ClinicalScoresView {

    // MARK: - LACE Index

    var laceForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Length of stay (days)").font(.subheadline).accessibilityHidden(true)   // spoken on the stepper
                Stepper("\(laceI.lengthOfStayDays) day(s)", value: $laceI.lengthOfStayDays, in: 0...30)
                    .accessibilityLabel("Length of stay (days)")
                    .accessibilityValue("\(laceI.lengthOfStayDays) day(s)")
            }
            Toggle(isOn: $laceI.acuteAdmission) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Acute (unplanned) admission").font(.subheadline)
                    Text("+3 if acute").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Charlson Comorbidity Index (CCI)").font(.subheadline).accessibilityHidden(true)   // spoken on the stepper
                HStack {
                    Stepper("\(laceI.charlsonIndex)", value: $laceI.charlsonIndex, in: 0...20)
                        .accessibilityLabel("Charlson Comorbidity Index (CCI)")
                        .accessibilityValue("\(laceI.charlsonIndex)")
                    Text("(scored 0–4 in LACE)").font(.caption2).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("ED visits in last 6 months").font(.subheadline).accessibilityHidden(true)   // spoken on the stepper
                Stepper("\(laceI.edVisitsLast6Months)", value: $laceI.edVisitsLast6Months, in: 0...10)
                    .accessibilityLabel("ED visits in last 6 months")
                    .accessibilityValue("\(laceI.edVisitsLast6Months)")
            }
        }
        .onChange(of: laceI.lengthOfStayDays)   { _, _ in recalculate() }
        .onChange(of: laceI.acuteAdmission)     { _, _ in recalculate() }
        .onChange(of: laceI.charlsonIndex)      { _, _ in recalculate() }
        .onChange(of: laceI.edVisitsLast6Months){ _, _ in recalculate() }
    }


    // MARK: - FINDRISC

    var findRiscForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Age group").font(.subheadline)
                Picker("Age", selection: $findRiscI.ageGroup) {
                    Text("< 45 years (+0)").tag(0)
                    Text("45–54 years (+2)").tag(2)
                    Text("55–64 years (+3)").tag(3)
                    Text("≥ 65 years (+4)").tag(4)
                }
                .pickerStyle(.segmented)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("BMI (kg/m²)").font(.subheadline)
                HStack {
                    Slider(value: $findRiscI.bmi, in: 15...50, step: 0.5)
                    Text(String(format: "%.1f", findRiscI.bmi))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Waist circumference (cm)").font(.subheadline)
                HStack {
                    Slider(value: $findRiscI.waistCircumferenceCm, in: 60...150, step: 1)
                    Text(String(format: "%.0f cm", findRiscI.waistCircumferenceCm))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Sex").font(.subheadline)
                Picker("Sex", selection: $findRiscI.sex) {
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                }
                .pickerStyle(.segmented)
            }
            Toggle(isOn: Binding(
                get:  { findRiscI.physicalActivityMinPerWeek == 0 },
                set:  { findRiscI.physicalActivityMinPerWeek = $0 ? 0 : 150 }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("< 30 min moderate physical activity/day").font(.subheadline)
                    Text("+2 if inactive").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: Binding(
                get:  { !findRiscI.vegetablesFruitDaily },
                set:  { findRiscI.vegetablesFruitDaily = !$0 }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Does NOT eat vegetables/fruit daily").font(.subheadline)
                    Text("+1 if absent").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: $findRiscI.hypertensionMeds) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("On antihypertensive medication").font(.subheadline)
                    Text("+2").font(.caption).foregroundStyle(.secondary)
                }
            }
            Toggle(isOn: $findRiscI.highBloodGlucoseHistory) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("History of high blood glucose").font(.subheadline)
                    Text("+5").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Family history of diabetes").font(.subheadline)
                Picker("Family history", selection: $findRiscI.familyHistoryDiabetes) {
                    Text("None (+0)").tag(0)
                    Text("Second-degree relative (+3)").tag(3)
                    Text("First-degree relative (+5)").tag(5)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: findRiscI.ageGroup)                 { _, _ in recalculate() }
        .onChange(of: findRiscI.bmi)                      { _, _ in recalculate() }
        .onChange(of: findRiscI.waistCircumferenceCm)     { _, _ in recalculate() }
        .onChange(of: findRiscI.sex)                      { _, _ in recalculate() }
        .onChange(of: findRiscI.physicalActivityMinPerWeek){ _, _ in recalculate() }
        .onChange(of: findRiscI.vegetablesFruitDaily)     { _, _ in recalculate() }
        .onChange(of: findRiscI.hypertensionMeds)         { _, _ in recalculate() }
        .onChange(of: findRiscI.highBloodGlucoseHistory)  { _, _ in recalculate() }
        .onChange(of: findRiscI.familyHistoryDiabetes)    { _, _ in recalculate() }
    }


    // MARK: - CKD-EPI eGFR

    var ckdEpiForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Serum creatinine (mg/dL)").font(.subheadline)
                HStack {
                    Slider(value: $ckdEpiI.serumCreatinineMgDL, in: 0.4...15, step: 0.1)
                    Text(String(format: "%.1f", ckdEpiI.serumCreatinineMgDL))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Age (years)").font(.subheadline).accessibilityHidden(true)   // spoken on the stepper
                Stepper("\(ckdEpiI.ageYears) yrs", value: $ckdEpiI.ageYears, in: 18...100)
                    .accessibilityLabel("Age (years)")
                    .accessibilityValue("\(ckdEpiI.ageYears) yrs")
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Sex").font(.subheadline)
                Picker("Sex", selection: $ckdEpiI.sex) {
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: ckdEpiI.serumCreatinineMgDL) { _, _ in recalculate() }
        .onChange(of: ckdEpiI.ageYears)             { _, _ in recalculate() }
        .onChange(of: ckdEpiI.sex)                  { _, _ in recalculate() }
    }


    // MARK: - CAGE

    var cageForm: some View {
        Group {
            Text("CAGE questionnaire: 2 or more positive responses = probable alcohol use disorder (sensitivity ~74%, specificity ~91% for AUD in primary care).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("C — Have you felt you should Cut down on your drinking?",
                        binding: $cageI.feltCutDown, points: "+1")
            scoreToggle("A — Have people Annoyed you by criticising your drinking?",
                        binding: $cageI.annoyedByCriticism, points: "+1")
            scoreToggle("G — Have you ever felt bad or Guilty about your drinking?",
                        binding: $cageI.feltGuilty, points: "+1")
            scoreToggle("E — Have you ever had a drink first thing in the morning to steady your nerves or get rid of a hangover (Eye-opener)?",
                        binding: $cageI.eyeOpener, points: "+1")
        }
        .onChange(of: cageI) { _, _ in recalculate() }
    }

}
