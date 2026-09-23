// ClinicalScoresView+CardiacForms.swift
// Cardiac score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    @ViewBuilder func cardiacFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .cha2ds2vasc: cha2ds2vascForm
        case .hasBled:     hasBledForm
        case .heart:       heartForm
        case .timi:        timiForm
        case .grace:       graceForm
        case .rcri:        rcriForm
        case .dasi:        dasiForm
        case .euroScoreII: euroScoreIIForm
        case .dukeIE:      dukeIEForm
        case .shockIndex:  shockIndexForm
        default:           EmptyView()
        }
    }


    // MARK: - CHA₂DS₂-VASc

    private var cha2ds2vascForm: some View {
        Group {
            scoreToggle("Congestive heart failure",                  binding: $cha2I.congestiveHeartFailure, points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("Hypertension (treated or BP >140/90)",      binding: $cha2I.hypertension,           points: "+1", autoKey: "hypertension")
            scoreToggle("Age ≥75 years",                             binding: $cha2I.ageOver75,              points: "+2", autoKey: "ageOver75")
            scoreToggle("Age 65–74 years (if not ≥75)",              binding: $cha2I.age65to74,              points: "+1", autoKey: "age65to74")
            scoreToggle("Diabetes mellitus",                         binding: $cha2I.diabetes,               points: "+1", autoKey: "diabetes")
            scoreToggle("Stroke / TIA / thromboembolism",            binding: $cha2I.strokeOrTIA,            points: "+2", autoKey: "strokeOrTIA")
            scoreToggle("Vascular disease (MI, PAD, aortic plaque)", binding: $cha2I.vascularDisease,        points: "+1", autoKey: "vascularDisease")
            scoreToggle("Female sex",                                 binding: $cha2I.femaleSex,              points: "+1", autoKey: "femaleSex")
        }
        .onChange(of: cha2I) { _, _ in recalculate() }
    }


    // MARK: - HAS-BLED

    private var hasBledForm: some View {
        Group {
            scoreToggle("H — Hypertension uncontrolled (SBP >160)",                     binding: $hblI.hypertensionUncontrolled, points: "+1", autoKey: "hypertensionUncontrolled")
            scoreToggle("A — Abnormal renal function (dialysis / Cr >200 μmol/L)",      binding: $hblI.renalDysfunction,         points: "+1", autoKey: "renalDysfunction")
            scoreToggle("A — Abnormal liver function (cirrhosis / bili ×2 / AST ×3)",   binding: $hblI.liverDysfunction,         points: "+1", autoKey: "liverDysfunction")
            scoreToggle("S — Stroke history",                                            binding: $hblI.strokeHistory,            points: "+1", autoKey: "strokeHistory")
            scoreToggle("B — Bleeding (prior or predisposition)",                        binding: $hblI.priorBleeding,            points: "+1", autoKey: "priorBleeding")
            scoreToggle("L — Labile INR (TTR <60%)",                                    binding: $hblI.labileINR,                points: "+1", autoKey: "labileINR")
            scoreToggle("E — Elderly (age >65)",                                         binding: $hblI.ageOver65,                points: "+1", autoKey: "ageOver65")
            scoreToggle("D — Drugs (antiplatelets / NSAIDs)",                            binding: $hblI.drugsOrAlcohol,           points: "+1", autoKey: "drugsOrAlcohol")
            scoreToggle("D — Alcohol (≥8 units/week)",                                  binding: $hblI.alcoholUse,               points: "+1", autoKey: "alcoholUse")
        }
        .onChange(of: hblI) { _, _ in recalculate() }
    }


    // MARK: - TIMI Risk Score (UA/NSTEMI)

    private var timiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("TIMI Risk Score for UA/NSTEMI (Antman et al, JAMA 2000). 7 binary risk factors; score 0–7. 0–2 = low risk (~8% 14-day MACE), 3–4 = intermediate (~13–20%), 5–7 = high (~26–40%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Risk Factors")
                scoreToggle("Age ≥65 years", binding: $timiI.ageOver65, points: "+1", autoKey: "ageOver65")
                scoreToggle("≥3 CAD risk factors (FH / HTN / hypercholesterolaemia / DM / active smoker)", binding: $timiI.threeOrMoreRiskFactors, points: "+1", autoKey: "threeOrMoreRiskFactors")
                scoreToggle("Known CAD: prior coronary stenosis ≥50%", binding: $timiI.priorCoronaryArteryStenosis, points: "+1", autoKey: "priorCoronaryArteryStenosis")
                scoreToggle("ST-segment deviation on presenting ECG", binding: $timiI.stDeviationOnECG, points: "+1", autoKey: "stDeviationOnECG")
                scoreToggle("≥2 anginal events in prior 24 hours", binding: $timiI.twoOrMoreAnginalEvents, points: "+1", autoKey: "twoOrMoreAnginalEvents")
                scoreToggle("Aspirin use in the prior 7 days (angina despite aspirin)", binding: $timiI.aspirinUseInLast7Days, points: "+1", autoKey: "aspirinUseInLast7Days")
                scoreToggle("Elevated serum cardiac markers (troponin or CK-MB)", binding: $timiI.elevatedCardiacMarkers, points: "+1", autoKey: "elevatedCardiacMarkers")
            }
            .onChange(of: timiI) { _, _ in recalculate() }
        }
    }


    // MARK: - GRACE Score (ACS Mortality)

    private var graceForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("GRACE Score (Granger CB et al, Lancet 2003; Fox KA et al, Eur Heart J 2006). Predicts in-hospital and 6-month mortality after ACS. Score 0–372. In-hospital mortality: Low <109 (<1%), Moderate 109–140 (1–3%), High >140 (>3%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Age")
                apacheSegment("Age Category", selection: $graceI.ageCategory,
                    options: [
                        (0, "<40 years (+0)"),
                        (1, "40–49 years (+18)"),
                        (2, "50–59 years (+36)"),
                        (3, "60–69 years (+55)"),
                        (4, "70–79 years (+73)"),
                        (5, "≥80 years (+91)")
                    ])
                sectionHeader("Heart Rate (bpm)")
                apacheSegment("Heart Rate", selection: $graceI.heartRate,
                    options: [
                        (0, "<70 bpm (+0)"),
                        (1, "70–89 bpm (+7)"),
                        (2, "90–109 bpm (+13)"),
                        (3, "110–149 bpm (+23)"),
                        (4, "150–199 bpm (+36)"),
                        (5, "≥200 bpm (+46)")
                    ])
                sectionHeader("Systolic Blood Pressure (mmHg)")
                apacheSegment("Systolic BP", selection: $graceI.systolicBP,
                    options: [
                        (0, "<80 mmHg (+63)"),
                        (1, "80–99 mmHg (+58)"),
                        (2, "100–119 mmHg (+47)"),
                        (3, "120–139 mmHg (+37)"),
                        (4, "140–159 mmHg (+26)"),
                        (5, "160–199 mmHg (+11)"),
                        (6, "≥200 mmHg (+0)")
                    ])
                sectionHeader("Serum Creatinine (mg/dL)")
                apacheSegment("Creatinine", selection: $graceI.creatinine,
                    options: [
                        (0, "0–0.39 mg/dL (+2)"),
                        (1, "0.4–0.79 mg/dL (+5)"),
                        (2, "0.8–1.19 mg/dL (+8)"),
                        (3, "1.2–1.59 mg/dL (+11)"),
                        (4, "1.6–1.99 mg/dL (+14)"),
                        (5, "2.0–3.99 mg/dL (+23)"),
                        (6, "≥4.0 mg/dL (+31)")
                    ])
                sectionHeader("Killip Class (Heart Failure Status)")
                apacheSegment("Killip Class", selection: $graceI.killipClass,
                    options: [
                        (0, "Class I — No CHF signs (+0)"),
                        (1, "Class II — Mild CHF (rales / elevated JVP) (+21)"),
                        (2, "Class III — Acute pulmonary oedema (+43)"),
                        (3, "Class IV — Cardiogenic shock (+64)")
                    ])
                sectionHeader("Additional Risk Factors")
                scoreToggle("Cardiac arrest at admission", binding: $graceI.cardiacArrest, points: "+43", autoKey: "cardiacArrest")
                scoreToggle("Elevated cardiac biomarkers (troponin or CK-MB above ULN)", binding: $graceI.elevatedMarkers, points: "+15", autoKey: "elevatedMarkers")
                scoreToggle("ST-segment deviation on ECG (depression or transient elevation)", binding: $graceI.stDeviation, points: "+30", autoKey: "stDeviation")
            }
            .onChange(of: graceI) { _, _ in recalculate() }
        }
    }


    // MARK: - HEART Score

    private var heartForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("HEART Score for chest pain triage (Backus et al, Neth Heart J 2010). Five domains 0–2 each; total 0–10. ≤3=low risk (<2% MACE), 4–6=moderate (~12–25%), ≥7=high (~50–65%).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("History (clinical suspicion)")
                apacheSegment("History", selection: $heartI.history,
                    options: [
                        (0, "0 — Slightly suspicious (history mostly non-cardiac)"),
                        (1, "1 — Moderately suspicious (mixed cardiac and non-cardiac features)"),
                        (2, "2 — Highly suspicious (history predominantly cardiac)")
                    ])
                sectionHeader("ECG")
                apacheSegment("ECG", selection: $heartI.ecg,
                    options: [
                        (0, "0 — Normal ECG"),
                        (1, "1 — Non-specific repolarisation disturbance (LBBB, LVH, early repol, digoxin changes)"),
                        (2, "2 — Significant ST deviation (new ST depression/elevation ≥2 mm, TWI)")
                    ])
                sectionHeader("Age")
                apacheSegment("Age", selection: $heartI.ageScore,
                    options: [
                        (0, "0 — Age <45"),
                        (1, "1 — Age 45–64"),
                        (2, "2 — Age ≥65")
                    ])
                sectionHeader("Risk Factors")
                apacheSegment("Risk Factors", selection: $heartI.riskFactors,
                    options: [
                        (0, "0 — No known risk factors"),
                        (1, "1 — 1–2 risk factors (HTN, hypercholesterolaemia, DM, obesity BMI>30, smoking, +FH) OR atherosclerosis without disease"),
                        (2, "2 — ≥3 risk factors OR known atherosclerotic disease (prior MI, PCI, CABG, stroke, PAD)")
                    ])
                sectionHeader("Troponin")
                apacheSegment("Troponin", selection: $heartI.troponin,
                    options: [
                        (0, "0 — ≤ normal limit"),
                        (1, "1 — 1–3× normal limit"),
                        (2, "2 — >3× normal limit")
                    ])
            }
            .onChange(of: heartI) { _, _ in recalculate() }
        }
    }


    // MARK: - Shock Index (#72)

    private var shockIndexForm: some View {
        Group {
            mewsSlider("Heart rate (bpm)", value: Binding(get: { Double(siI.heartRate) }, set: { siI.heartRate = Int($0) }),
                       range: 30...220, step: 1, unit: "bpm")
            mewsSlider("Systolic blood pressure (mmHg)", value: Binding(get: { Double(siI.systolicBP) }, set: { siI.systolicBP = Int($0) }),
                       range: 40...250, step: 1, unit: "mmHg")
        }
        .onChange(of: siI) { _, _ in recalculate() }
    }


    // MARK: - Duke Criteria (IE)

    private var dukeIEForm: some View {
        Group {
            Text("Modified Duke Criteria (Li 2000). Definite IE: 2 major, OR 1 major + 3 minor, OR 5 minor. Possible IE: 1 major + 1 minor, OR 3 minor. Rejected: firm alternative diagnosis, resolution with ≤4 days antibiotics, or pathological criteria not met.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Text("Major criteria").font(.caption).bold().foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Positive blood cultures (0 = none, 1 = one set, 2 = ≥2 sets typical organism / persistent)")
                Picker("Blood cultures", selection: $dukeI.positiveBloodCultures) {
                    Text("0 — No typical organism").tag(0)
                    Text("1 — Single culture").tag(1)
                    Text("2 — ≥2 sets typical organism or persistent bacteraemia").tag(2)
                }
                .pickerStyle(.segmented)
                .onChange(of: dukeI.positiveBloodCultures) { _, _ in recalculate() }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Endocardial involvement (echo/new valve regurgitation)")
                Picker("Endocardial", selection: $dukeI.endocardialInvolvement) {
                    Text("0 — None").tag(0)
                    Text("1 — Suggestive").tag(1)
                    Text("2 — Definite oscillating mass / abscess / dehiscence / new regurgitation").tag(2)
                }
                .pickerStyle(.segmented)
                .onChange(of: dukeI.endocardialInvolvement) { _, _ in recalculate() }
            }
            Text("Minor criteria").font(.caption).bold().foregroundStyle(.secondary)
            scoreToggle("Predisposing heart condition (known valve disease, prosthetic valve, prior IE)",
                        binding: $dukeI.predisposedHeartCondition, points: "Minor")
            scoreToggle("Injection drug use",
                        binding: $dukeI.ivDrugUse, points: "Minor")
            scoreToggle("Fever ≥38°C",
                        binding: $dukeI.feverGe38, points: "Minor")
            scoreToggle("Vascular phenomena (major arterial emboli, septic pulmonary infarcts, mycotic aneurysm, intracranial haemorrhage, conjunctival haemorrhage, Janeway lesions)",
                        binding: $dukeI.vascularPhenomena, points: "Minor")
            scoreToggle("Immunological phenomena (glomerulonephritis, Osler nodes, Roth spots, positive rheumatoid factor)",
                        binding: $dukeI.immunologicPhenomena, points: "Minor")
            scoreToggle("Positive blood culture (not meeting major criterion) or serological evidence",
                        binding: $dukeI.positiveBloodCultureMinor, points: "Minor")
            scoreToggle("Echo findings consistent with IE (not meeting major criterion)",
                        binding: $dukeI.echoMinor, points: "Minor")
        }
        .onChange(of: dukeI) { _, _ in recalculate() }
    }

}
