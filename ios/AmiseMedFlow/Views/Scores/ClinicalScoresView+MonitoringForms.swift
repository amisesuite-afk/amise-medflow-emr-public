// ClinicalScoresView+MonitoringForms.swift
// Monitoring / surveillance score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func monitoringFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .mews: return AnyView(mewsForm)
        case .news2: return AnyView(news2Form)
        case .waterlow: return AnyView(waterlowForm)
        case .surgicalApgar: return AnyView(surgicalApgarForm)
        case .phq9: return AnyView(phq9Form)
        case .braden: return AnyView(bradenForm)
        case .ipss: return AnyView(ipssForm)
        case .lace: return AnyView(laceForm)
        case .findRisc: return AnyView(findRiscForm)
        case .ckdEpi: return AnyView(ckdEpiForm)
        case .cage: return AnyView(cageForm)
        default: return AnyView(EmptyView())
        }
    }


    // MARK: - MEWS

    private var mewsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("respiratoryRate") || autoFill.isAuto("heartRate") || autoFill.isAuto("systolicBP") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Pre-filled from most recent vitals — verify and adjust if needed.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            mewsSlider(label: "Respiratory Rate (breaths/min)", autoKey: "respiratoryRate",
                       value: Binding(get: { Double(mewsI.respiratoryRate) }, set: { mewsI.respiratoryRate = Int($0) }),
                       in: 4...50, step: 1, display: "\(mewsI.respiratoryRate)")
            mewsSlider(label: "SpO₂ (%)", autoKey: "oxygenSaturation",
                       value: Binding(get: { Double(mewsI.oxygenSaturation) }, set: { mewsI.oxygenSaturation = Int($0) }),
                       in: 70...100, step: 1, display: "\(mewsI.oxygenSaturation)%")
            mewsSlider(label: "Heart Rate (bpm)", autoKey: "heartRate",
                       value: Binding(get: { Double(mewsI.heartRate) }, set: { mewsI.heartRate = Int($0) }),
                       in: 20...200, step: 1, display: "\(mewsI.heartRate)")
            mewsSlider(label: "Systolic BP (mmHg)", autoKey: "systolicBP",
                       value: Binding(get: { Double(mewsI.systolicBP) }, set: { mewsI.systolicBP = Int($0) }),
                       in: 40...240, step: 2, display: "\(mewsI.systolicBP)")
            mewsSlider(label: "Temperature (°C)", autoKey: "temperature",
                       value: $mewsI.temperature, in: 33.0...42.0, step: 0.1,
                       display: String(format: "%.1f°C", mewsI.temperature))
            mewsPickerRow(label: "AVPU — Consciousness", autoKey: "consciousnessAVPU") {
                Picker("AVPU", selection: $mewsI.consciousnessAVPU) {
                    Text("Alert (0)").tag(MEWSInput.AVPULevel.alert)
                    Text("Voice (1)").tag(MEWSInput.AVPULevel.voice)
                    Text("Pain (2)").tag(MEWSInput.AVPULevel.pain)
                    Text("Unresponsive (3)").tag(MEWSInput.AVPULevel.unresponsive)
                }
                .pickerStyle(.segmented)
            }
            sectionHeader("Urine Output")
            Picker("Urine", selection: $mewsI.urineOutput) {
                Text("Normal (0)").tag(MEWSInput.UrineOutput.normal)
                Text("Low (1)").tag(MEWSInput.UrineOutput.low)
                Text("Nil <10mL/hr (2)").tag(MEWSInput.UrineOutput.nil_)
            }
            .pickerStyle(.segmented)

            Divider().padding(.vertical, 4)
            Button(action: saveMEWSToVitals) {
                Label(
                    mewsSaved ? "Saved to vitals" : "Save readings to Vitals",
                    systemImage: mewsSaved ? "checkmark.circle.fill" : "waveform.path.ecg.rectangle"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(mewsSaved ? .green : .teal)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    (mewsSaved ? Color.green : Color.teal).opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)
            .disabled(mewsSaved)
            .animation(.easeInOut(duration: 0.2), value: mewsSaved)
        }
        .onChange(of: mewsI) { _, _ in mewsSaved = false; recalculate() }
    }


    // MARK: - NEWS2

    private var news2Form: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("respiratoryRate") || autoFill.isAuto("heartRate") || autoFill.isAuto("systolicBP") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Pre-filled from most recent vitals — verify and adjust if needed.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            mewsSlider(label: "Respiratory Rate (breaths/min)", autoKey: "respiratoryRate",
                       value: Binding(get: { Double(news2I.respiratoryRate) }, set: { news2I.respiratoryRate = Int($0) }),
                       in: 4...50, step: 1, display: "\(news2I.respiratoryRate)")
            mewsSlider(label: "SpO₂ (%)", autoKey: "spo2",
                       value: Binding(get: { Double(news2I.spo2) }, set: { news2I.spo2 = Int($0) }),
                       in: 70...100, step: 1, display: "\(news2I.spo2)%")
            scoreToggle("On supplemental oxygen", binding: $news2I.onSupplementalO2, points: "+2", autoKey: "onSupplementalO2")
            mewsSlider(label: "Systolic BP (mmHg)", autoKey: "systolicBP",
                       value: Binding(get: { Double(news2I.systolicBP) }, set: { news2I.systolicBP = Int($0) }),
                       in: 40...260, step: 2, display: "\(news2I.systolicBP)")
            mewsSlider(label: "Heart Rate (bpm)", autoKey: "heartRate",
                       value: Binding(get: { Double(news2I.heartRate) }, set: { news2I.heartRate = Int($0) }),
                       in: 20...200, step: 1, display: "\(news2I.heartRate)")
            mewsSlider(label: "Temperature (°C)", autoKey: "temperatureCelsius",
                       value: $news2I.temperatureCelsius, in: 33.0...42.0, step: 0.1,
                       display: String(format: "%.1f°C", news2I.temperatureCelsius))
            mewsPickerRow(label: "AVPU — Consciousness", autoKey: "avpu") {
                Picker("AVPU", selection: $news2I.avpu) {
                    Text("Alert (0)").tag(AVPU.alert)
                    Text("Confused (3)").tag(AVPU.confused)
                    Text("Voice (3)").tag(AVPU.voice)
                    Text("Pain (3)").tag(AVPU.pain)
                    Text("Unresponsive (3)").tag(AVPU.unresponsive)
                }
                .pickerStyle(.segmented)
            }
            Divider().padding(.vertical, 4)
            Button(action: saveNEWS2ToVitals) {
                Label(
                    news2Saved ? "Saved to vitals" : "Save readings to Vitals",
                    systemImage: news2Saved ? "checkmark.circle.fill" : "waveform.path.ecg"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(news2Saved ? .green : .teal)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    (news2Saved ? Color.green : Color.teal).opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 10)
                )
            }
            .buttonStyle(.plain)
            .disabled(news2Saved)
            .animation(.easeInOut(duration: 0.2), value: news2Saved)
        }
        .onChange(of: news2I) { _, _ in news2Saved = false; recalculate() }
    }


    // MARK: - Surgical Apgar Score

    private var surgicalApgarForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Surgical Apgar Score (Gawande et al, J Am Coll Surg 2007; Regenbogen et al, Ann Surg 2010). Three intraoperative variables; score 0–10. Higher score = lower risk. Score ≤4: high risk (~27–56% 30-day major complication/death); 5–6 moderate (~16–22%); 7–8 low (~9–10%); 9–10 very low (~3.5%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Estimated Blood Loss")
                apacheSegment("Estimated Blood Loss (EBL)", selection: $surgApgarI.estimatedBloodLoss,
                    options: [
                        (0, ">1 000 mL (0 points)"),
                        (1, "601–1 000 mL (1 point)"),
                        (2, "101–600 mL (2 points)"),
                        (3, "≤100 mL (3 points)")
                    ])
                sectionHeader("Lowest Intraoperative Mean Arterial Pressure")
                apacheSegment("Lowest MAP", selection: $surgApgarI.lowestMAP,
                    options: [
                        (0, "<40 mmHg (0 points)"),
                        (1, "40–54 mmHg (1 point)"),
                        (2, "55–69 mmHg (2 points)"),
                        (3, "≥70 mmHg (3 points)")
                    ])
                sectionHeader("Lowest Intraoperative Heart Rate")
                apacheSegment("Lowest Heart Rate", selection: $surgApgarI.lowestHeartRate,
                    options: [
                        (0, "≥120 bpm (0 points)"),
                        (1, "101–119 bpm (0 points)"),
                        (2, "86–100 bpm (1 point)"),
                        (3, "56–85 bpm (3 points — normal)"),
                        (4, "41–55 bpm (2 points)"),
                        (5, "≤40 bpm (0 points)")
                    ])
            }
            .onChange(of: surgApgarI) { _, _ in recalculate() }
        }
    }


    // MARK: - Waterlow Pressure Ulcer Risk

    private var waterlowForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Waterlow Pressure Ulcer Risk Assessment (Waterlow J, Nursing Times 1985; revised 2005). Scores six patient factors plus four special risk categories. Low risk 0–9; at risk 10–14; high risk 15–19; very high risk ≥20.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Build / Weight for Height")
                apacheSegment("Build", selection: $waterlowI.buildWeight,
                    options: [
                        (0, "0 — Average"),
                        (1, "1 — Above average"),
                        (2, "2 — Obese"),
                        (3, "3 — Below average")
                    ])
                sectionHeader("Skin Type / Visual Risk Areas")
                apacheSegment("Skin Type", selection: $waterlowI.skinType,
                    options: [
                        (0, "0 — Healthy"),
                        (1, "1 — Tissue paper / fragile"),
                        (2, "2 — Dry"),
                        (3, "3 — Oedematous"),
                        (4, "4 — Clammy / pyrexia"),
                        (5, "5 — Discoloured (but not broken)"),
                        (6, "6 — Broken or spot")
                    ])
                sectionHeader("Sex and Age")
                apacheSegment("Sex / Age", selection: $waterlowI.sexAge,
                    options: [
                        (0, "0 — Male 14–49"),
                        (1, "1 — Female 14–49 / Male 50–64"),
                        (2, "2 — Female 50–64 / Male 65–74"),
                        (3, "3 — Female 65–74 / Male 75–80"),
                        (4, "4 — Female 75–80"),
                        (5, "5 — 81+")
                    ])
                sectionHeader("Mobility")
                apacheSegment("Mobility", selection: $waterlowI.mobility,
                    options: [
                        (0, "0 — Fully mobile"),
                        (1, "1 — Restless / fidgety"),
                        (2, "2 — Apathetic"),
                        (3, "3 — Restricted / chair-fast"),
                        (4, "4 — Inert / in traction"),
                        (5, "5 — Chairbound / bedridden")
                    ])
                sectionHeader("Continence")
                apacheSegment("Continence", selection: $waterlowI.continence,
                    options: [
                        (0, "0 — Complete / catheterised"),
                        (1, "1 — Occasionally incontinent"),
                        (2, "2 — Catheterised but incontinent of faeces"),
                        (3, "3 — Doubly incontinent")
                    ])
                sectionHeader("Appetite / Nutritional Status")
                apacheSegment("Appetite", selection: $waterlowI.appetite,
                    options: [
                        (0, "0 — Average"),
                        (1, "1 — Poor"),
                        (2, "2 — NG tube / fluids only"),
                        (3, "3 — NBM / anorexic")
                    ])
                sectionHeader("Special Risk Factors")
                scoreToggle("Tissue malnutrition: cachexia / terminal / cardiac failure / peripheral vascular / anaemia / smoking", binding: $waterlowI.tissuemalnutrition, points: "+8", autoKey: "tissuemalnutrition")
                scoreToggle("Neurological deficit: diabetes / motor-sensory / paraplegia", binding: $waterlowI.neurologicalDeficit, points: "+5", autoKey: "neurologicalDeficit")
                scoreToggle("Major surgery or trauma: orthopaedic below waist / spinal / >2 h on operating table", binding: $waterlowI.majorSurgery, points: "+5", autoKey: "majorSurgery")
                scoreToggle("Medication: cytotoxic agents / high-dose steroids", binding: $waterlowI.onCytotoxics, points: "+4", autoKey: "onCytotoxics")
            }
            .onChange(of: waterlowI) { _, _ in recalculate() }
        }
    }


    // MARK: - PHQ-9
    private var phq9Form: some View {
        let items: [(String, WritableKeyPath<ClinicalScoringEngine.PHQ9Input, Int>)] = [
            ("Little interest or pleasure in doing things", \.anhedonia),
            ("Feeling down, depressed, or hopeless", \.depressedMood),
            ("Trouble falling or staying asleep, or sleeping too much", \.sleepProblem),
            ("Feeling tired or having little energy", \.fatigue),
            ("Poor appetite or overeating", \.appetiteChange),
            ("Feeling bad about yourself — or that you are a failure", \.selfWorth),
            ("Trouble concentrating on things", \.concentration),
            ("Moving or speaking so slowly (or being fidgety/restless)", \.psychomotor),
            ("Thoughts that you would be better off dead, or of hurting yourself", \.suicidalThought),
        ]
        return Group {
            Text("Over the last 2 weeks, how often have you been bothered by the following? (0=Not at all, 1=Several days, 2=More than half the days, 3=Nearly every day)")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            ForEach(items.indices, id: \.self) { idx in
                let (itemLabel, kp) = items[idx]
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(idx + 1). \(itemLabel)").font(.subheadline)
                    Picker("", selection: Binding(
                        get: { phq9I[keyPath: kp] },
                        set: { phq9I[keyPath: kp] = $0 }
                    )) {
                        Text("0 — Not at all").tag(0)
                        Text("1 — Several days").tag(1)
                        Text("2 — More than half").tag(2)
                        Text("3 — Nearly every day").tag(3)
                    }
                    .pickerStyle(.segmented)
                }
                .padding(.vertical, 2)
            }
            if phq9I.suicidalThought >= 2 {
                Label("⚠️ Q9 ≥2 — immediate psychiatric risk assessment required",
                      systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .font(.footnote.bold())
                    .padding(.top, 4)
            }
        }
        .onChange(of: phq9I) { _, _ in recalculate() }
    }


    // MARK: - Braden Scale
    private var bradenForm: some View {
        Group {
            Text("Each subscale scored 1 (worst) to 3 or 4 (best). Total 6–23; ≤18 = at risk.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            bradenPicker("Sensory Perception",
                         labels: ["1 — Completely limited","2 — Very limited","3 — Slightly limited","4 — No impairment"],
                         value: $bradenI.sensoryPerception)
            bradenPicker("Moisture",
                         labels: ["1 — Constantly moist","2 — Very moist","3 — Occasionally moist","4 — Rarely moist"],
                         value: $bradenI.moisture)
            bradenPicker("Activity",
                         labels: ["1 — Bedfast","2 — Chairfast","3 — Walks occasionally","4 — Walks frequently"],
                         value: $bradenI.activity)
            bradenPicker("Mobility",
                         labels: ["1 — Completely limited","2 — Very limited","3 — Slightly limited","4 — No limitation"],
                         value: $bradenI.mobility)
            bradenPicker("Nutrition",
                         labels: ["1 — Very poor","2 — Probably inadequate","3 — Adequate","4 — Excellent"],
                         value: $bradenI.nutrition)
            bradenPicker("Friction and Shear",
                         labels: ["1 — Problem","2 — Potential problem","3 — No apparent problem"],
                         value: $bradenI.frictionShear)
        }
        .onChange(of: bradenI) { _, _ in recalculate() }
    }


    // MARK: - IPSS

    private var ipssForm: some View {
        Group {
            ForEach([
                ("Incomplete emptying", \ClinicalScoringEngine.IPSSInput.incompleteEmptying),
                ("Frequency",           \ClinicalScoringEngine.IPSSInput.frequency),
                ("Intermittency",       \ClinicalScoringEngine.IPSSInput.intermittency),
                ("Urgency",             \ClinicalScoringEngine.IPSSInput.urgency),
                ("Weak stream",         \ClinicalScoringEngine.IPSSInput.weakStream),
                ("Straining",           \ClinicalScoringEngine.IPSSInput.straining),
                ("Nocturia",            \ClinicalScoringEngine.IPSSInput.nocturia),
            ], id: \.0) { label, kp in
                ipssItemPicker(label, keyPath: kp)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Quality of life (0 = delighted, 6 = terrible)").font(.subheadline)
                Stepper("\(ipssI.qualityOfLife)", value: $ipssI.qualityOfLife, in: 0...6)
            }
        }
        .onChange(of: ipssI) { _, _ in recalculate() }
    }

}
