// ClinicalScoresView+NeurologicalForms.swift
// Neurological score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func neuroFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .abcd2: return AnyView(abcd2Form)
        case .lrinec: return AnyView(lrinecForm)
        case .gcs: return AnyView(gcsForm)
        case .nihss: return AnyView(nihssForm)
        case .mrs: return AnyView(mrsForm)
        default: return AnyView(EmptyView())
        }
    }


    // MARK: - ABCD2

    private var abcd2Form: some View {
        VStack(alignment: .leading, spacing: 12) {
            // NICE NG128: not for triage — shown for reference only.
            Label("Reference only. NICE NG128: do not use ABCD² or other scores to decide urgency — every suspected TIA gets aspirin 300 mg (unless contraindicated) and specialist assessment within 24 h of onset.",
                  systemImage: "info.circle")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            sectionHeader("Age")
            Picker("Age", selection: $abcd.ageOver60) {
                Text("< 60 years (0)").tag(false)
                Text("≥ 60 years (+1)").tag(true)
            }
            .pickerStyle(.segmented)

            sectionHeader("BP at Presentation")
            Picker("BP", selection: $abcd.bpOver140_90) {
                Text("Normal (0)").tag(false)
                Text("SBP ≥140 or DBP ≥90 (+1)").tag(true)
            }
            .pickerStyle(.segmented)

            sectionHeader("Clinical Features of TIA")
            VStack(spacing: 0) {
                scoreToggle("Unilateral weakness", binding: $abcd.unilateralWeakness, points: "+2")
                    .onChange(of: abcd.unilateralWeakness) { _, _ in
                        if abcd.unilateralWeakness { abcd.speechWithoutWeakness = false }
                        recalculate()
                    }
                scoreToggle("Speech disturbance without weakness", binding: $abcd.speechWithoutWeakness, points: "+1")
                    .onChange(of: abcd.speechWithoutWeakness) { _, _ in
                        if abcd.speechWithoutWeakness { abcd.unilateralWeakness = false }
                        recalculate()
                    }
            }

            sectionHeader("Duration of Symptoms")
            Picker("Duration", selection: $abcdDuration) {
                Text("< 10 min (0)").tag(0)
                Text("10–59 min (+1)").tag(1)
                Text("≥ 60 min (+2)").tag(2)
            }
            .pickerStyle(.segmented)
            .onChange(of: abcdDuration) { _, v in
                abcd.duration10to59min  = (v == 1)
                abcd.durationOver60min  = (v == 2)
                recalculate()
            }

            scoreToggle("Diabetes mellitus", binding: $abcd.diabetes, points: "+1", autoKey: "diabetes")
        }
        .onChange(of: abcd) { _, _ in recalculate() }
    }


    // MARK: - LRINEC

    private var lrinecForm: some View {
        Group {
            sectionHeader("Laboratory Values")
            scoreToggle("CRP >150 mg/L",           binding: $lrin.crpOver150,        points: "+4", autoKey: "crpOver150")
            scoreToggle("WBC >25 ×10⁹/L",          binding: $lrin.wbcOver25,         points: "+2", autoKey: "wbcOver25")
            scoreToggle("WBC 15–25 ×10⁹/L",        binding: $lrin.wbc15to25,         points: "+1", autoKey: "wbc15to25")
            scoreToggle("Hb <11 g/dL",             binding: $lrin.hbBelow11,         points: "+2", autoKey: "hbBelow11")
            scoreToggle("Hb 11–13.5 g/dL",         binding: $lrin.hb11to13_5,        points: "+1", autoKey: "hb11to13_5")
            scoreToggle("Sodium <135 mmol/L",       binding: $lrin.sodiumBelow135,    points: "+2", autoKey: "sodiumBelow135")
            scoreToggle("Creatinine >177 μmol/L",   binding: $lrin.creatinineOver177, points: "+4", autoKey: "creatinineOver177")
            scoreToggle("Creatinine 141–177 μmol/L",binding: $lrin.creatinine141to177,points: "+2", autoKey: "creatinine141to177")
            scoreToggle("Glucose >10 mmol/L",       binding: $lrin.glucoseOver10,     points: "+1", autoKey: "glucoseOver10")
        }
        .onChange(of: lrin) { _, _ in recalculate() }
    }


    // MARK: - GCS

    private var gcsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Eye Opening")
            Picker("Eye", selection: $gcsI.eyeOpening) {
                Text("Spontaneous (4)").tag(GCSInput.EyeScore.spontaneous)
                Text("To Voice (3)").tag(GCSInput.EyeScore.toVoice)
                Text("To Pain (2)").tag(GCSInput.EyeScore.toPain)
                Text("None (1)").tag(GCSInput.EyeScore.none)
            }
            .pickerStyle(.segmented)
            sectionHeader("Verbal Response")
            Picker("Verbal", selection: $gcsI.verbalResponse) {
                Text("Oriented (5)").tag(GCSInput.VerbalScore.oriented)
                Text("Confused (4)").tag(GCSInput.VerbalScore.confused)
                Text("Words (3)").tag(GCSInput.VerbalScore.inappropriateWords)
                Text("Sounds (2)").tag(GCSInput.VerbalScore.sounds)
                Text("None (1)").tag(GCSInput.VerbalScore.none)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)
            sectionHeader("Motor Response")
            Picker("Motor", selection: $gcsI.motorResponse) {
                Text("Obeys (6)").tag(GCSInput.MotorScore.obeys)
                Text("Localises (5)").tag(GCSInput.MotorScore.localises)
                Text("Withdraws (4)").tag(GCSInput.MotorScore.withdraws)
                Text("Flexion (3)").tag(GCSInput.MotorScore.abnormalFlexion)
                Text("Extension (2)").tag(GCSInput.MotorScore.extension_)
                Text("None (1)").tag(GCSInput.MotorScore.none)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)
        }
        .onChange(of: gcsI) { _, _ in recalculate() }
    }


    // MARK: - NIHSS (NIH Stroke Scale)

    private var nihssForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("NIH Stroke Scale (Brott T et al. Stroke 1989;20:864–870; Adams HP et al. Stroke 1999;30:2315–2328). 15 items; total 0–42. 0 = no deficit; 1–4 = minor; 5–15 = moderate; 16–20 = moderate-severe; 21–42 = severe. Requires bedside neurological examination.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Level of Consciousness (Item 1a–1c)")
                apacheSegment("1a. Consciousness Level", selection: $nihssI.consciousness,
                    options: [
                        (0, "0 — Alert; keenly responsive"),
                        (1, "1 — Not alert; arousable by minor stimulation"),
                        (2, "2 — Not alert; requires repeated stimulation or painful stimuli"),
                        (3, "3 — Unresponsive or responds only with reflex motor")
                    ])
                apacheSegment("1b. LOC Questions (month + age)", selection: $nihssI.locQuestions,
                    options: [
                        (0, "0 — Both correct"),
                        (1, "1 — One correct (or intubated / dysarthric / dysphasic)"),
                        (2, "2 — Neither correct")
                    ])
                apacheSegment("1c. LOC Commands (open/close eyes, grip/release)", selection: $nihssI.locCommands,
                    options: [
                        (0, "0 — Both obeyed"),
                        (1, "1 — One obeyed"),
                        (2, "2 — Neither obeyed")
                    ])
                sectionHeader("Eye Movements & Visual Fields (Items 2–3)")
                apacheSegment("2. Best Gaze", selection: $nihssI.gazeDeviation,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Partial gaze palsy; gaze abnormal but not forced"),
                        (2, "2 — Forced deviation; total gaze paresis not overcome by oculocephalic manoeuvre")
                    ])
                apacheSegment("3. Visual Fields", selection: $nihssI.visualFields,
                    options: [
                        (0, "0 — No visual loss"),
                        (1, "1 — Partial hemianopia"),
                        (2, "2 — Complete hemianopia"),
                        (3, "3 — Bilateral hemianopia / cortical blindness")
                    ])
                sectionHeader("Face & Motor Function (Items 4–8)")
                apacheSegment("4. Facial Palsy", selection: $nihssI.facialPalsy,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Minor paralysis (flattened nasolabial fold, asymmetric smile)"),
                        (2, "2 — Partial paralysis (lower face only)"),
                        (3, "3 — Complete paralysis; upper and lower face")
                    ])
                apacheSegment("5a. Motor Arm — Left", selection: $nihssI.motorArmLeft,
                    options: [
                        (0, "0 — No drift; holds 90° (or 45°) for 10 s"),
                        (1, "1 — Drift; holds 90° but drifts before 10 s; does not hit bed"),
                        (2, "2 — Some effort against gravity; arm cannot reach or maintain 90°"),
                        (3, "3 — No effort against gravity; arm falls"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("5b. Motor Arm — Right", selection: $nihssI.motorArmRight,
                    options: [
                        (0, "0 — No drift"),
                        (1, "1 — Drift before 10 s"),
                        (2, "2 — Some effort against gravity"),
                        (3, "3 — No effort against gravity"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("6a. Motor Leg — Left", selection: $nihssI.motorLegLeft,
                    options: [
                        (0, "0 — No drift; holds 30° for 5 s"),
                        (1, "1 — Drift; leg falls by end of 5 s but does not hit bed"),
                        (2, "2 — Some effort against gravity; falls to bed within 5 s"),
                        (3, "3 — No effort against gravity; falls immediately"),
                        (4, "4 — No movement")
                    ])
                apacheSegment("6b. Motor Leg — Right", selection: $nihssI.motorLegRight,
                    options: [
                        (0, "0 — No drift"),
                        (1, "1 — Drift before 5 s"),
                        (2, "2 — Some effort against gravity"),
                        (3, "3 — No effort against gravity"),
                        (4, "4 — No movement")
                    ])
                sectionHeader("Coordination, Sensation & Language (Items 7–11)")
                apacheSegment("7. Limb Ataxia", selection: $nihssI.limbAtaxia,
                    options: [
                        (0, "0 — Absent"),
                        (1, "1 — Present in one limb"),
                        (2, "2 — Present in two limbs")
                    ])
                apacheSegment("8. Sensory", selection: $nihssI.sensory,
                    options: [
                        (0, "0 — Normal; no sensory loss"),
                        (1, "1 — Mild-moderate sensory loss; feels pinprick as less sharp"),
                        (2, "2 — Severe to total sensory loss; patient unaware of being touched")
                    ])
                apacheSegment("9. Best Language", selection: $nihssI.language,
                    options: [
                        (0, "0 — No aphasia; normal"),
                        (1, "1 — Mild-moderate aphasia; some obvious loss; can identify"),
                        (2, "2 — Severe aphasia; fragmentary expression; cannot identify"),
                        (3, "3 — Mute; global aphasia; no usable speech or auditory comprehension")
                    ])
                apacheSegment("10. Dysarthria", selection: $nihssI.dysarthria,
                    options: [
                        (0, "0 — Normal"),
                        (1, "1 — Mild-moderate; slurred but understandable"),
                        (2, "2 — Severe; unintelligible or mute / intubated")
                    ])
                apacheSegment("11. Extinction / Inattention", selection: $nihssI.extinction,
                    options: [
                        (0, "0 — No abnormality"),
                        (1, "1 — Inattention or extinction to one modality"),
                        (2, "2 — Profound hemi-inattention / extinction to more than one modality")
                    ])
            }
            .onChange(of: nihssI) { _, _ in recalculate() }
        }
    }


    // MARK: - modified Rankin Scale (mRS)

    private var mrsForm: some View {
        Group {
            apacheSegment("Disability Level", selection: $mrsI.level,
                options: [
                    (0, "0 — No symptoms"),
                    (1, "1 — No significant disability; performs all usual activities despite symptoms"),
                    (2, "2 — Slight disability; unable to perform all previous activities, independent"),
                    (3, "3 — Moderate disability; requires some help, walks without assistance"),
                    (4, "4 — Moderately severe disability; unable to walk or attend to bodily needs without assistance"),
                    (5, "5 — Severe disability; bedridden, incontinent, requires constant nursing care"),
                    (6, "6 — Dead")
                ])
        }
        .onChange(of: mrsI) { _, _ in recalculate() }
    }

}
