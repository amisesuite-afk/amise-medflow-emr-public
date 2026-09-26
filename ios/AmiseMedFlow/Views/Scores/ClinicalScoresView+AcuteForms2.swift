// ClinicalScoresView+AcuteForms2.swift
// Baux Score, ISS, Hinchey, AIR Score and remaining acute score input forms.

import SwiftUI


extension ClinicalScoresView {

    // MARK: - Baux Score (#60)

    var bauxForm: some View {
        Group {
            mewsSlider("Age (years)", value: Binding(get: { Double(bauxI.age) }, set: { bauxI.age = Int($0) }),
                       range: 0...120, step: 1, unit: "yrs")
            mewsSlider("Total Body Surface Area Burned", value: Binding(get: { Double(bauxI.tbsa) }, set: { bauxI.tbsa = Int($0) }),
                       range: 0...100, step: 1, unit: "%")
            scoreToggle("Inhalation injury confirmed", binding: $bauxI.hasInhalationInjury, points: "+17")
        }
        .onChange(of: bauxI) { _, _ in recalculate() }
    }


    // MARK: - ISS (#61)

    var issForm: some View {
        Group {
            apacheSegment("Head/Neck (incl. C-spine) — AIS", selection: $issI.head,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Face — AIS", selection: $issI.face,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Chest (incl. T-spine) — AIS", selection: $issI.chest,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Abdomen/Pelvis (incl. L-spine) — AIS", selection: $issI.abdomen,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("Extremity/Pelvis — AIS", selection: $issI.extremity,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
            apacheSegment("External (burns, lacerations) — AIS", selection: $issI.external,
                options: [(0,"0 — No injury"),(1,"1 — Minor"),(2,"2 — Moderate"),(3,"3 — Serious"),(4,"4 — Severe"),(5,"5 — Critical"),(6,"6 — Unsurvivable")])
        }
        .onChange(of: issI) { _, _ in recalculate() }
    }


    // MARK: - Hinchey (#69)

    var hincheyForm: some View {
        Group {
            apacheSegment("Hinchey Grade", selection: $hincheyI.grade,
                options: [
                    (1, "Grade Ia/Ib — pericolic or mesorectal abscess"),
                    (2, "Grade II — pelvic or distant abscess"),
                    (3, "Grade III — generalised purulent peritonitis"),
                    (4, "Grade IV — generalised faecal peritonitis")
                ])
        }
        .onChange(of: hincheyI) { _, _ in recalculate() }
    }


    // MARK: - AIR Score (#70)

    var airScoreForm: some View {
        Group {
            scoreToggle("Vomiting", binding: $airI.vomiting, points: "+1", autoKey: "vomiting")
            scoreToggle("Pain in right iliac fossa", binding: $airI.painRIF, points: "+1", autoKey: "painRIF")
            apacheSegment("Rebound tenderness / guarding", selection: $airI.reboundTenderness,
                options: [
                    (0, "Absent"),
                    (1, "Mild — pain on release of pressure"),
                    (2, "Moderate — involuntary guarding"),
                    (3, "Strong — board-like rigidity / peritonism")
                ])
            scoreToggle("Temperature ≥ 38.5°C", binding: $airI.tempAbove38point5, points: "+1", autoKey: "tempAbove38point5")
            apacheSegment("PMN (polymorphonuclear leucocytes)", selection: $airI.pmn,
                options: [
                    (0, "< 70%"),
                    (1, "70–84%  (+1)"),
                    (2, "≥ 85%   (+2)")
                ])
            apacheSegment("WBC (white blood cell count)", selection: $airI.wbc,
                options: [
                    (0, "< 10 × 10⁹/L"),
                    (1, "10–14.9 × 10⁹/L  (+1)"),
                    (2, "≥ 15 × 10⁹/L     (+2)")
                ])
            apacheSegment("CRP (C-reactive protein)", selection: $airI.crp,
                options: [
                    (0, "< 10 mg/L"),
                    (1, "10–49 mg/L  (+1)"),
                    (2, "≥ 50 mg/L   (+2)")
                ])
        }
        .onChange(of: airI) { _, _ in recalculate() }
    }


    // MARK: - Parkland Formula (#73)

    var parklandForm: some View {
        Group {
            mewsSlider("Body weight (kg)", value: $parklandI.weightKg,
                       range: 1...250, step: 1, unit: "kg")
            mewsSlider("Total body surface area burned (%TBSA)", value: $parklandI.tbsaPercent,
                       range: 0...100, step: 1, unit: "%")
            scoreToggle("Inhalation injury (early airway review)", binding: $parklandI.hasInhalationInjury, points: "Airway")
            mewsSlider("Hours since the burn", value: $parklandI.hoursSinceBurn,
                       range: 0...24, step: 0.5, unit: "h")
            mewsSlider("Fluid already given since the burn", value: $parklandI.fluidGivenMl,
                       range: 0...10000, step: 100, unit: "mL")
            scoreToggle("Child (under 16)", binding: $parklandI.isChild, points: "≥10% TBSA")
            scoreToggle("Electrical injury (high voltage)", binding: $parklandI.isElectrical, points: "IV fluids")
        }
        .onChange(of: parklandI) { _, _ in recalculate() }
    }


    // MARK: - Paediatric Appendicitis Score (#74)

    var pasForm: some View {
        Group {
            scoreToggle("Anorexia", binding: $pasI.anorexia, points: "+1", autoKey: "anorexia")
            scoreToggle("Nausea or vomiting", binding: $pasI.nausea, points: "+1", autoKey: "nausea")
            scoreToggle("Migration of pain to right iliac fossa", binding: $pasI.migration, points: "+1", autoKey: "migration")
            scoreToggle("Tenderness in right iliac fossa", binding: $pasI.tendernessRIF, points: "+2", autoKey: "tendernessRIF")
            scoreToggle("Pain with cough, percussion, or hopping", binding: $pasI.coughPercussionHop, points: "+2", autoKey: "coughPercussionHop")
            scoreToggle("Pyrexia (temperature ≥ 38°C)", binding: $pasI.pyrexia, points: "+1", autoKey: "pyrexia")
            scoreToggle("Leukocytosis (WBC ≥ 10 × 10⁹/L)", binding: $pasI.leukocytosis, points: "+2", autoKey: "leukocytosis")
            scoreToggle("Polymorphonuclear leucocyte shift > 75%", binding: $pasI.polymorphonuclearShift, points: "+1", autoKey: "polymorphonuclearShift")
        }
        .onChange(of: pasI) { _, _ in recalculate() }
    }


    // MARK: - STONE Score
    var stoneForm: some View {
        Group {
            Text("Based on unenhanced CT findings. Score ≥4 = high probability of ureteric colic.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Stone size on CT")
                Picker("Stone size", selection: $stoneI.sizeMm) {
                    Text("Not seen / > 10 mm (0 pts)").tag(0)
                    Text("1–5 mm (2 pts)").tag(3)
                    Text("6–10 mm (1 pt)").tag(7)
                }
                .pickerStyle(.menu)
            }
            Toggle("Tightness at ureter/UVJ (hydronephrosis expected)", isOn: Binding(
                get: { stoneI.toUreters > 0 },
                set: { stoneI.toUreters = $0 ? 1 : 0 }
            ))
            scoreToggle("Obstruction (hydronephrosis or ureteric dilation)", binding: $stoneI.obstruction, points: "+1")
            scoreToggle("Nausea / vomiting", binding: $stoneI.nausea, points: "+1")
            scoreToggle("Erythrocytes in urine (haematuria)", binding: $stoneI.erythrocytes, points: "+1")
        }
        .onChange(of: stoneI) { _, _ in recalculate() }
    }


    // MARK: - Paediatric Trauma Score

    var ptsForm: some View {
        Group {
            Text("PTS: 6 parameters scored +2/+1/−1. Range −6 to +12. Score ≤8 = major trauma — triage to paediatric trauma centre.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("Weight")
                Picker("Weight", selection: $ptsI.weight) {
                    Text(">20 kg (+2)").tag(0)
                    Text("10–20 kg (+1)").tag(1)
                    Text("<10 kg (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.weight) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Airway")
                Picker("Airway", selection: $ptsI.airway) {
                    Text("Normal (+2)").tag(0)
                    Text("Maintainable (+1)").tag(1)
                    Text("Unmaintainable (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.airway) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Systolic BP")
                Picker("BP", selection: $ptsI.systolicBP) {
                    Text(">90 mmHg (+2)").tag(0)
                    Text("50–90 mmHg (+1)").tag(1)
                    Text("<50 mmHg (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.systolicBP) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("CNS")
                Picker("CNS", selection: $ptsI.cns) {
                    Text("Awake (+2)").tag(0)
                    Text("Obtunded/LOC (+1)").tag(1)
                    Text("Comatose (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.cns) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Open wound")
                Picker("Wound", selection: $ptsI.openWound) {
                    Text("None (+2)").tag(0)
                    Text("Minor (+1)").tag(1)
                    Text("Major / penetrating (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.openWound) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Fracture")
                Picker("Fracture", selection: $ptsI.fracture) {
                    Text("None (+2)").tag(0)
                    Text("Closed (+1)").tag(1)
                    Text("Open / multiple (−1)").tag(2)
                }.pickerStyle(.segmented)
                  .onChange(of: ptsI.fracture) { _, _ in recalculate() }
            }
        }
    }


    // MARK: - RIPASA Score

    var ripasaForm: some View {
        Group {
            Text("RIPASA: Right Iliac Fossa Pain Assessment Score. Score ≥7.5 = probable appendicitis (sensitivity 98%, specificity 81%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            scoreToggle("Male sex", binding: $ripasaI.male, points: "+1")
            scoreToggle("Age 14–39 years", binding: $ripasaI.age14to39, points: "+1")
            scoreToggle("Foreign national", binding: $ripasaI.foreignNational, points: "+1")
            scoreToggle("Pain migrating to RIF", binding: $ripasaI.migratingToRIF, points: "+0.5")
            scoreToggle("Anorexia", binding: $ripasaI.anorexia, points: "+1")
            scoreToggle("Nausea", binding: $ripasaI.nausea, points: "+1")
            scoreToggle("Vomiting", binding: $ripasaI.vomiting, points: "+1")
            scoreToggle("Duration < 48 hours", binding: $ripasaI.durationUnder48h, points: "+1")
            scoreToggle("RIF tenderness", binding: $ripasaI.rofFossaTenderness, points: "+1")
            scoreToggle("Guarding", binding: $ripasaI.guarding, points: "+2")
            scoreToggle("Rebound tenderness", binding: $ripasaI.reboundTenderness, points: "+1")
            scoreToggle("Rovsing's sign", binding: $ripasaI.rovsing, points: "+2")
            scoreToggle("Fever 37.5–38.5 °C", binding: $ripasaI.fever37_5to38_5, points: "+1")
            scoreToggle("Elevated WBC", binding: $ripasaI.elevatedWBC, points: "+2", autoKey: "wbcElevated")
            scoreToggle("Abnormal urinalysis", binding: $ripasaI.abnormalUrinalysis, points: "+1")
        }
        .onChange(of: ripasaI) { _, _ in recalculate() }
    }

}
