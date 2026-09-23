// ClinicalScoresView+SepsisForms2.swift
// APACHE II and remaining sepsis score input forms for ClinicalScoresView.

import SwiftUI


extension ClinicalScoresView {

    // MARK: - APACHE II

    var apacheIIForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("ICU severity scoring. APS + Age + Chronic Health. Score ≥20 → high ICU mortality.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            apacheIIVitalsSection
            apacheIILabsSection
            apacheIIContextSection
        }
    }


    var kdigoForm: some View {
        Group {
            apacheSegment("Creatinine Rise from Baseline", selection: $kdigoI.creatinineRise,
                options: [
                    (0, "0 — <1.5× baseline"),
                    (1, "1 — 1.5–1.9× baseline"),
                    (2, "2 — 2.0–2.9× baseline"),
                    (3, "3 — ≥3× or >354 µmol/L")
                ])
            apacheSegment("Urine Output", selection: $kdigoI.urineOutput,
                options: [
                    (0, "0 — Normal"),
                    (1, "1 — <0.5 mL/kg/h ×6 h"),
                    (2, "2 — <0.5 mL/kg/h ×12 h"),
                    (3, "3 — <0.3 mL/kg/h ×24 h or anuria ×12 h")
                ])
            scoreToggle("Renal replacement therapy required", binding: $kdigoI.requiresRRT, points: "Stage 3")
        }
        .onChange(of: kdigoI) { _, _ in recalculate() }
    }


    // MARK: - NUTRIC Score (#62)

    var nutricForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(nutricI.age) }, set: { nutricI.age = Int($0) }),
                       range: 18...100, step: 1, unit: "yrs")
            apacheSegment("APACHE II score at ICU admission", selection: $nutricI.apacheII,
                options: [
                    (0, "< 15"),
                    (10, "15–19"),
                    (20, "20–27"),
                    (28, "≥ 28")
                ])
            apacheSegment("SOFA score at ICU admission", selection: $nutricI.sofa,
                options: [
                    (0, "< 6"),
                    (6, "6–9"),
                    (10, "≥ 10")
                ])
            apacheSegment("Number of comorbidities (Charlson-equivalent)", selection: $nutricI.comorbidities,
                options: [
                    (0, "0–1"),
                    (2, "≥ 2")
                ])
            apacheSegment("Days from hospital admission to ICU", selection: $nutricI.daysHospitalToICU,
                options: [
                    (0, "0–1 days"),
                    (2, "≥ 2 days")
                ])
        }
        .onChange(of: nutricI) { _, _ in recalculate() }
    }


    // MARK: - DECAF (#68)

    var decafForm: some View {
        Group {
            apacheSegment("MRC Dyspnoea Grade (baseline, pre-exacerbation)", selection: $decafI.dyspnoeaMRC,
                options: [
                    (1, "Grade 1 — breathless on strenuous exercise"),
                    (2, "Grade 2 — breathless hurrying on flat"),
                    (3, "Grade 3 — walks slower than peers; stops for breath"),
                    (4, "Grade 4 — stops for breath after 100 m on flat"),
                    (5, "Grade 5 — too breathless to leave house / undress")
                ])
            scoreToggle("Eosinopenia (eosinophils < 0.05 × 10⁹/L)",
                        binding: $decafI.eosinopenia, points: "+1", autoKey: "eosinopenia")
            scoreToggle("Consolidation on chest X-ray",
                        binding: $decafI.consolidation, points: "+1", autoKey: "consolidation")
            scoreToggle("Acidaemia (pH < 7.30 on ABG)",
                        binding: $decafI.acidaemia, points: "+1", autoKey: "acidaemia")
            scoreToggle("Atrial fibrillation (new or pre-existing)",
                        binding: $decafI.atrialFibrillation, points: "+1", autoKey: "atrialFibrillation")
        }
        .onChange(of: decafI) { _, _ in recalculate() }
    }


    // MARK: - SAPS II
    var sapsIIForm: some View {
        Group {
            Text("Worst values within first 24 hours of ICU admission.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            sapsIIStepper("Age (years)", value: $sapsIII.ageYears, range: 0...120, step: 1)
            sapsIIStepper("Max heart rate (bpm)", value: $sapsIII.heartRateMax, range: 0...300, step: 1)
            sapsIIStepper("Min systolic BP (mmHg)", value: $sapsIII.sbpMin, range: 0...300, step: 1)
            HStack {
                Text("Max temperature (°C)")
                Spacer()
                Stepper(String(format: "%.1f °C", sapsIII.tempMax),
                        value: $sapsIII.tempMax, in: 30.0...45.0, step: 0.1)
                    .fixedSize()
            }
            Toggle("Ventilated (PaO₂/FiO₂ applicable)", isOn: $sapsIII.onVentilator)
            if sapsIII.onVentilator {
                sapsIIStepper("PaO₂/FiO₂ ratio (mmHg)", value: $sapsIII.pao2FiO2, range: 0...600, step: 5)
            }
            sapsIIStepper("Urine output (mL/24 h)", value: $sapsIII.urineOutputML, range: 0...5000, step: 50)
            HStack {
                Text("BUN (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f mmol/L", sapsIII.bunMmolL),
                        value: $sapsIII.bunMmolL, in: 0...100, step: 0.5)
                    .fixedSize()
            }
            HStack {
                Text("WBC (× 10⁹/L)")
                Spacer()
                Stepper(String(format: "%.1f ×10⁹/L", sapsIII.wbc),
                        value: $sapsIII.wbc, in: 0...100, step: 0.5)
                    .fixedSize()
            }
            sapsIIStepper("Sodium (mmol/L)", value: $sapsIII.sodiumMmolL, range: 100...180, step: 1)
            HStack {
                Text("Potassium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f mmol/L", sapsIII.potassiumMmolL),
                        value: $sapsIII.potassiumMmolL, in: 0...10, step: 0.1)
                    .fixedSize()
            }
            sapsIIStepper("Bicarbonate (mmol/L)", value: $sapsIII.bicarbonateMmolL, range: 0...60, step: 1)
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", sapsIII.bilirubinUmolL),
                        value: $sapsIII.bilirubinUmolL, in: 0...600, step: 5)
                    .fixedSize()
            }
            sapsIIStepper("GCS (3–15)", value: $sapsIII.gcsScore, range: 3...15, step: 1)
            Divider()
            Text("Admission type").font(.subheadline.bold())
            Toggle("Scheduled surgical admission", isOn: $sapsIII.scheduledSurgical)
            Toggle("Unscheduled surgical admission", isOn: $sapsIII.unscheduledSurgical)
            Divider()
            Text("Chronic disease").font(.subheadline.bold())
            Toggle("Metastatic cancer", isOn: $sapsIII.metastaticCancer)
            Toggle("Haematological malignancy", isOn: $sapsIII.haematologicalMalignancy)
            Toggle("AIDS", isOn: $sapsIII.aids)
        }
        .onChange(of: sapsIII) { _, _ in recalculate() }
    }


    // MARK: - Centor / McIsaac

    var centorForm: some View {
        Group {
            scoreToggle("Tonsillar exudate", binding: $centorI.tonsillarExudate, points: "+1", autoKey: "tonsillarExudate")
            scoreToggle("Tender anterior cervical lymphadenopathy", binding: $centorI.tenderAnteriorCervical, points: "+1", autoKey: "tenderAnteriorCervical")
            scoreToggle("Fever history (≥38°C)", binding: $centorI.feverHistory, points: "+1", autoKey: "feverHistory")
            scoreToggle("Absence of cough", binding: $centorI.noCough, points: "+1", autoKey: "noCough")
            VStack(alignment: .leading, spacing: 4) {
                Text("Age group").font(.subheadline)
                Picker("", selection: $centorI.ageGroup) {
                    Text("< 15 years (+1)").tag(0)
                    Text("15–44 years (0)").tag(1)
                    Text("≥ 45 years (−1)").tag(2)
                }
                .pickerStyle(.segmented)
            }
        }
        .onChange(of: centorI) { _, _ in recalculate() }
    }


    // MARK: - Berlin ARDS

    var berlinARDSForm: some View {
        Group {
            Text("Berlin Definition (2012). Requires: acute onset ≤1 week, bilateral opacities not explained by effusions/lobar collapse/nodules, respiratory failure not fully explained by cardiac failure. PF ratio measured with PEEP/CPAP ≥5 cmH₂O.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("PaO₂/FiO₂ ratio (mmHg)")
                Spacer()
                Stepper(String(format: "%.0f", berlinI.pao2FiO2Ratio),
                        onIncrement: { berlinI.pao2FiO2Ratio = min(600, berlinI.pao2FiO2Ratio + 10) },
                        onDecrement: { berlinI.pao2FiO2Ratio = max(0, berlinI.pao2FiO2Ratio - 10) })
                    .fixedSize()
            }
            HStack {
                Text("PEEP/CPAP (cmH₂O)")
                Spacer()
                Stepper("\(berlinI.peepOrCPAP)", value: $berlinI.peepOrCPAP, in: 0...30)
                    .fixedSize()
            }
            scoreToggle("Acute onset within 1 week of clinical insult or new/worsening symptoms",
                        binding: $berlinI.acuteOnsetWithin1Week, points: "Required")
            scoreToggle("Bilateral opacities on CXR/CT not fully explained by effusions, lobar/lung collapse, or nodules",
                        binding: $berlinI.bilateralOpacitiesOnImaging, points: "Required")
            scoreToggle("Respiratory failure not fully explained by cardiac failure or fluid overload",
                        binding: $berlinI.notExplainedByCardiacFailure, points: "Required")
        }
        .onChange(of: berlinI) { _, _ in recalculate() }
    }


    // MARK: - mMRC Dyspnoea Scale

    var mmrcForm: some View {
        Group {
            Text("Modified Medical Research Council dyspnoea scale. Grade ≥2 is used in GOLD COPD classification. Grade ≥2 correlates with significant functional impairment and is used in perioperative risk assessment (functional capacity < 4 METs).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Dyspnoea grade")
                Picker("mMRC grade", selection: $mmrcI.grade) {
                    Text("0 — Only with strenuous exercise").tag(0)
                    Text("1 — Hurrying on level or walking up a slight hill").tag(1)
                    Text("2 — Walks slower than peers, or stops after ≤15 min on level").tag(2)
                    Text("3 — Stops for breath after ~100 m or few minutes on level ground").tag(3)
                    Text("4 — Too breathless to leave house, or when dressing/undressing").tag(4)
                }
                .pickerStyle(.inline)
                .onChange(of: mmrcI.grade) { _, _ in recalculate() }
            }
        }
    }


    // MARK: - FGSI

    var fgsiForm: some View {
        Group {
            Text("Fournier Gangrene Severity Index. Score ≥9 = high mortality risk (>75%). Based on APACHE-II physiological parameters.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("Temperature (°C)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.temperature),
                        onIncrement: { fgsiI.temperature = min(45, fgsiI.temperature + 0.1); recalculate() },
                        onDecrement: { fgsiI.temperature = max(30, fgsiI.temperature - 0.1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Heart rate (bpm)")
                Spacer()
                Stepper("\(fgsiI.heartRate)", value: $fgsiI.heartRate, in: 20...200, step: 5)
                    .fixedSize()
                    .onChange(of: fgsiI.heartRate) { _, _ in recalculate() }
            }
            HStack {
                Text("Respiratory rate (/min)")
                Spacer()
                Stepper("\(fgsiI.respiratoryRate)", value: $fgsiI.respiratoryRate, in: 4...60, step: 1)
                    .fixedSize()
                    .onChange(of: fgsiI.respiratoryRate) { _, _ in recalculate() }
            }
            HStack {
                Text("Sodium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.sodium),
                        onIncrement: { fgsiI.sodium = min(200, fgsiI.sodium + 1); recalculate() },
                        onDecrement: { fgsiI.sodium = max(90, fgsiI.sodium - 1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Potassium (mmol/L)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.potassium),
                        onIncrement: { fgsiI.potassium = min(10, fgsiI.potassium + 0.1); recalculate() },
                        onDecrement: { fgsiI.potassium = max(1, fgsiI.potassium - 0.1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Creatinine (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.creatinine),
                        onIncrement: { fgsiI.creatinine = min(1000, fgsiI.creatinine + 10); recalculate() },
                        onDecrement: { fgsiI.creatinine = max(10, fgsiI.creatinine - 10); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Haematocrit (%)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.haematocrit),
                        onIncrement: { fgsiI.haematocrit = min(75, fgsiI.haematocrit + 1); recalculate() },
                        onDecrement: { fgsiI.haematocrit = max(10, fgsiI.haematocrit - 1); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("WBC (×10⁹/L)")
                Spacer()
                Stepper(String(format: "%.1f", fgsiI.wbc),
                        onIncrement: { fgsiI.wbc = min(60, fgsiI.wbc + 0.5); recalculate() },
                        onDecrement: { fgsiI.wbc = max(0, fgsiI.wbc - 0.5); recalculate() })
                    .fixedSize()
            }
            HStack {
                Text("Bicarbonate (mmol/L)")
                Spacer()
                Stepper(String(format: "%.0f", fgsiI.bicarbonate),
                        onIncrement: { fgsiI.bicarbonate = min(50, fgsiI.bicarbonate + 1); recalculate() },
                        onDecrement: { fgsiI.bicarbonate = max(5, fgsiI.bicarbonate - 1); recalculate() })
                    .fixedSize()
            }
        }
        .onChange(of: fgsiI) { _, _ in recalculate() }
    }

}
