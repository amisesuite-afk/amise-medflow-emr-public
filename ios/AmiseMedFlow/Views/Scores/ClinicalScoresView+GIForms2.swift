// ClinicalScoresView+GIForms2.swift
// Truelove-Witts, Harvey-Bradshaw Index, Maddrey Discriminant Function, Manning Criteria, Fong CRS input forms.

import SwiftUI
import SwiftData


extension ClinicalScoresView {

    // MARK: - Truelove-Witts

    private var trueloveWittsForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Stools per day").font(.subheadline)
                Stepper("\(trueloveI.stoolsPerDay)", value: $trueloveI.stoolsPerDay, in: 0...30)
            }
            scoreToggle("Macroscopic blood in stool", binding: $trueloveI.macroscopicBlood, points: "+1", autoKey: "macroscopicBlood")
            scoreToggle("Heart rate > 90 bpm", binding: $trueloveI.hrAbove90, points: "+1", autoKey: "hrAbove90")
            scoreToggle("Temperature > 37.5°C", binding: $trueloveI.tempAbove375, points: "+1", autoKey: "tempAbove375")
            scoreToggle("Haemoglobin < 10.5 g/dL", binding: $trueloveI.hbBelow105, points: "+1", autoKey: "hbBelow105")
            scoreToggle("ESR > 30 mm/h", binding: $trueloveI.esrAbove30, points: "+1", autoKey: "esrAbove30")
        }
        .onChange(of: trueloveI) { _, _ in recalculate() }
    }


    // MARK: - Harvey-Bradshaw Index

    private var harveyBradshawForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("General wellbeing (0 = very well, 4 = terrible)").font(.subheadline)
                Stepper("\(harveyI.generalWellbeing)", value: $harveyI.generalWellbeing, in: 0...4)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Abdominal pain (0 = none, 3 = severe)").font(.subheadline)
                Stepper("\(harveyI.abdominalPain)", value: $harveyI.abdominalPain, in: 0...3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Liquid stools per day").font(.subheadline)
                Stepper("\(harveyI.liquidStoolsPerDay)", value: $harveyI.liquidStoolsPerDay, in: 0...30)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Abdominal mass (0 = none, 3 = tender)").font(.subheadline)
                Stepper("\(harveyI.abdominalMass)", value: $harveyI.abdominalMass, in: 0...3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Complications (arthralgia, uveitis, etc.)").font(.subheadline)
                Stepper("\(harveyI.complications)", value: $harveyI.complications, in: 0...10)
            }
        }
        .onChange(of: harveyI) { _, _ in recalculate() }
    }


    // MARK: - Maddrey Discriminant Function

    private var maddreyForm: some View {
        Group {
            VStack(alignment: .leading, spacing: 4) {
                Text("Patient PT (seconds)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.ptSeconds, in: 10...60, step: 0.5)
                    Text(String(format: "%.1f s", maddreyI.ptSeconds))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Control PT (seconds)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.controlPTSeconds, in: 10...20, step: 0.5)
                    Text(String(format: "%.1f s", maddreyI.controlPTSeconds))
                        .frame(width: 60)
                        .font(.caption.monospacedDigit())
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Bilirubin (mg/dL)").font(.subheadline)
                HStack {
                    Slider(value: $maddreyI.bilirubinMgDL, in: 0...50, step: 0.5)
                    Text(String(format: "%.1f", maddreyI.bilirubinMgDL))
                        .frame(width: 50)
                        .font(.caption.monospacedDigit())
                }
            }
        }
        .onChange(of: maddreyI.ptSeconds)        { _, _ in recalculate() }
        .onChange(of: maddreyI.controlPTSeconds) { _, _ in recalculate() }
        .onChange(of: maddreyI.bilirubinMgDL)    { _, _ in recalculate() }
    }


    // MARK: - Manning Criteria for IBS

    private var manningForm: some View {
        Group {
            scoreToggle("Pain relieved by defecation",
                        binding: $manningI.painRelievedByDefecation, points: "+1")
            scoreToggle("Looser stools with onset of pain",
                        binding: $manningI.looserStoolsWithOnsetOfPain, points: "+1")
            scoreToggle("Increased stool frequency with onset of pain",
                        binding: $manningI.increasedFrequencyWithOnsetOfPain, points: "+1")
            scoreToggle("Abdomen visibly distended",
                        binding: $manningI.abdomenVisiblyDistended, points: "+1")
            scoreToggle("Mucus per rectum",
                        binding: $manningI.mucusPerRectum, points: "+1")
            scoreToggle("Feeling of incomplete emptying",
                        binding: $manningI.feelingOfIncompleteEmptying, points: "+1")
        }
        .onChange(of: manningI) { _, _ in recalculate() }
    }


    // MARK: - Fong Clinical Risk Score

    private var fongCrsForm: some View {
        Group {
            scoreToggle("Lymph node–positive primary tumour",
                        binding: $fongI.nodePosivePrimaryTumour, points: "+1")
            scoreToggle("Disease-free interval < 12 months",
                        binding: $fongI.diseaseFreeIntervalLess12Mo, points: "+1")
            scoreToggle("More than 1 hepatic metastasis",
                        binding: $fongI.moreThanOneHepaticTumour, points: "+1")
            scoreToggle("Largest hepatic tumour > 5 cm",
                        binding: $fongI.largestTumourOver5cm, points: "+1")
            scoreToggle("Preoperative CEA > 200 ng/mL",
                        binding: $fongI.ceaOver200, points: "+1")
        }
        .onChange(of: fongI) { _, _ in recalculate() }
    }

}
