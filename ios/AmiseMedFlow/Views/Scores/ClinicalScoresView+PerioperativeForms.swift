// ClinicalScoresView+PerioperativeForms.swift
// Perioperative / surgical risk score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    func preopFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .rcri:        rcriForm
        case .asa:         asaForm
        case .childPugh:   childPughForm
        case .meld:        meldForm
        case .stopBang:    stopBangForm
        case .fib4:        fib4Form
        case .ppossum:     ppossumForm
        case .nrs2002:     nrs2002Form
        case .mallampati:  mallampatiForm
        case .cfs:         cfsForm
        default:           preopFormBodyB(score)
        }
    }

    func preopFormBodyB(_ score: ActiveScore) -> some View {
        switch score {
        case .dasi:        dasiForm
        case .barthel:     barthelForm
        case .euroScoreII: euroScoreIIForm
        case .ecog:        ecogForm
        case .cci:         cciForm
        case .mfi5:        mfi5Form
        case .must:        mustForm
        case .mirels:      mirelsForm
        case .ariscat:     ariscatForm
        case .clavienDindo: clavienDindoForm
        case .aldrete:     aldreteForm
        default:           EmptyView()
        }
    }

    // MARK: - RCRI

    var rcriForm: some View {
        Group {
            Text("Revised Cardiac Risk Index — for non-cardiac surgery.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("High-risk surgery (intrathoracic, intraabdominal or suprainguinal vascular)", binding: $rcriI.highRiskSurgery,           points: "+1", autoKey: "highRiskSurgery")
            scoreToggle("History of ischaemic heart disease",                                          binding: $rcriI.ischemicHeartDisease,        points: "+1", autoKey: "ischemicHeartDisease")
            scoreToggle("History of congestive heart failure",                                         binding: $rcriI.congestiveHeartFailure,       points: "+1", autoKey: "congestiveHeartFailure")
            scoreToggle("History of cerebrovascular disease",                                          binding: $rcriI.cerebrovascularDisease,       points: "+1", autoKey: "cerebrovascularDisease")
            scoreToggle("Insulin-dependent diabetes mellitus",                                         binding: $rcriI.insulinDependentDiabetes,     points: "+1", autoKey: "insulinDependentDiabetes")
            scoreToggle("Pre-op creatinine >177 μmol/L (>2 mg/dL)",                                  binding: $rcriI.preopCreatinineOver2,         points: "+1", autoKey: "preopCreatinineOver2")
        }
        .onChange(of: rcriI) { _, _ in recalculate() }
    }


    // MARK: - Child-Pugh

    private var childPughForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("bilirubinUmolL") || autoFill.isAuto("albuminGdL") || autoFill.isAuto("ptINR") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Bilirubin, albumin, and INR pre-filled from latest labs — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            sectionHeader("Ascites")
            Picker("Ascites", selection: $cp.ascites) {
                Text("None (1)").tag(ChildPughInput.AscitesGrade.none)
                Text("Controlled (2)").tag(ChildPughInput.AscitesGrade.controlled)
                Text("Refractory (3)").tag(ChildPughInput.AscitesGrade.refractory)
            }
            .pickerStyle(.segmented)

            sectionHeader("Encephalopathy Grade")
            Picker("Encephalopathy", selection: $cp.encephalopathy) {
                Text("None (1)").tag(ChildPughInput.EncephalopathyGrade.none)
                Text("Grade 1–2 (2)").tag(ChildPughInput.EncephalopathyGrade.grade1to2)
                Text("Grade 3–4 (3)").tag(ChildPughInput.EncephalopathyGrade.grade3to4)
            }
            .pickerStyle(.segmented)

            mewsSlider(label: "Bilirubin (μmol/L)", autoKey: "bilirubinUmolL",
                       value: $cp.bilirubinUmolL, in: 0...400, step: 5,
                       display: "\(Int(cp.bilirubinUmolL)) μmol/L")
            mewsSlider(label: "Albumin (g/dL)", autoKey: "albuminGdL",
                       value: $cp.albuminGdL, in: 1.0...5.0, step: 0.1,
                       display: String(format: "%.1f g/dL", cp.albuminGdL))
            mewsSlider(label: "PT-INR", autoKey: "ptINR",
                       value: $cp.ptINR, in: 0.8...5.0, step: 0.1,
                       display: String(format: "%.1f", cp.ptINR))
        }
        .onChange(of: cp) { _, _ in recalculate() }
    }


    // MARK: - ASA

    private var asaForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("ASA Physical Status Class")
            ForEach(ASAInput.ASAClass.allCases, id: \.rawValue) { c in
                let desc: String = switch c {
                case .i:   "I — Healthy, no systemic disease"
                case .ii:  "II — Mild systemic disease, well controlled"
                case .iii: "III — Severe systemic disease"
                case .iv:  "IV — Severe disease, constant threat to life"
                case .v:   "V — Moribund, not expected to survive without surgery"
                }
                Button {
                    asaI.asaClass = c
                    recalculate()
                } label: {
                    HStack {
                        Image(systemName: asaI.asaClass == c ? "largecircle.fill.circle" : "circle")
                            .foregroundStyle(asaI.asaClass == c ? AMColor.accent : .secondary)
                        Text(desc).font(.subheadline).foregroundStyle(.primary)
                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
        }
    }


    // MARK: - MELD

    private var meldForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("bilirubinMgDL") || autoFill.isAuto("creatinineMgDL")
                || autoFill.isAuto("inrValue") || autoFill.isAuto("sodiumMmolL") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Pre-filled from latest lab results — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            mewsSlider(label: "Bilirubin (mg/dL)", autoKey: "bilirubinMgDL",
                       value: $meldI.bilirubinMgDL, in: 0.1...40.0, step: 0.1,
                       display: String(format: "%.1f", meldI.bilirubinMgDL))
            mewsSlider(label: "Creatinine (mg/dL)", autoKey: "creatinineMgDL",
                       value: $meldI.creatinineMgDL, in: 0.1...10.0, step: 0.1,
                       display: String(format: "%.1f", meldI.creatinineMgDL))
            mewsSlider(label: "INR", autoKey: "inrValue",
                       value: $meldI.inrValue, in: 0.8...8.0, step: 0.1,
                       display: String(format: "%.1f", meldI.inrValue))
            mewsSlider(label: "Sodium (mmol/L)", autoKey: "sodiumMmolL",
                       value: $meldI.sodiumMmolL, in: 110.0...145.0, step: 1.0,
                       display: "\(Int(meldI.sodiumMmolL)) mmol/L")
            scoreToggle("On dialysis (creatinine capped at 4.0)", binding: $meldI.onDialysis,
                        points: "", autoKey: "onDialysis")
        }
        .onChange(of: meldI) { _, _ in recalculate() }
    }


    // MARK: - STOP-BANG

    private var stopBangForm: some View {
        Group {
            scoreToggle("S — Snoring loudly",                          binding: $sbangI.snoring,         points: "+1", autoKey: "snoring")
            scoreToggle("T — Tired / fatigued during day",             binding: $sbangI.tired,           points: "+1", autoKey: "tired")
            scoreToggle("O — Observed apnoea (partner / witness)",     binding: $sbangI.observed,        points: "+1", autoKey: "observed")
            scoreToggle("P — Pressure / hypertension (treated or >140/90)", binding: $sbangI.pressureTreated, points: "+1", autoKey: "pressureTreated")
            scoreToggle("B — BMI >35 kg/m²",                          binding: $sbangI.bmiOver35,       points: "+1", autoKey: "bmiOver35")
            scoreToggle("A — Age >50 years",                          binding: $sbangI.ageOver50,       points: "+1", autoKey: "ageOver50")
            scoreToggle("N — Neck circumference >40 cm",              binding: $sbangI.neckOver40cm,    points: "+1", autoKey: "neckOver40cm")
            scoreToggle("G — Gender: male",                           binding: $sbangI.male,            points: "+1", autoKey: "male")
        }
        .onChange(of: sbangI) { _, _ in recalculate() }
    }


    // MARK: - FIB-4

    private var fib4Form: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Formula: (Age × AST) ÷ (Platelets × √ALT)")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.bottom, 2)
            mewsSlider(label: "Age (years)", autoKey: "age",
                       value: Binding(get: { Double(fib4I.age) }, set: { fib4I.age = Int($0) }),
                       in: 18...100, step: 1, display: "\(fib4I.age) yr")
            mewsSlider(label: "AST (IU/L)", autoKey: "astIUL",
                       value: $fib4I.astIUL, in: 5...500, step: 1,
                       display: "\(Int(fib4I.astIUL)) IU/L")
            mewsSlider(label: "Platelets (×10⁹/L)", autoKey: "platelet10_9L",
                       value: $fib4I.platelet10_9L, in: 10...600, step: 5,
                       display: "\(Int(fib4I.platelet10_9L))")
            mewsSlider(label: "ALT (IU/L)", autoKey: "altIUL",
                       value: $fib4I.altIUL, in: 5...500, step: 1,
                       display: "\(Int(fib4I.altIUL)) IU/L")
        }
        .onChange(of: fib4I) { _, _ in recalculate() }
    }


    // MARK: - P-POSSUM

    private var ppossumForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Portsmouth POSSUM surgical mortality/morbidity predictor. Logistic regression: ln(R/1−R) = −9.065 + 0.1692×PS + 0.1550×OS. Score both pre-operatively for consent and retrospectively for audit.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            ppossumPhysiologicalSection
            ppossumOperativeSection
        }
    }


    // MARK: - NRS-2002

    private var nrs2002Form: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Nutritional Risk Screening 2002 (Kondrup et al, Clin Nutr 2003). Score ≥3 = at nutritional risk; initiate nutritional support plan. Validated in 128 randomised trials.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Nutritional Status (impaired nutrition)")
                apacheSegment("Nutritional Status Score", selection: $nrsI.nutritionalStatus,
                    options: [
                        (0, "Normal nutritional status"),
                        (1, "Mild — weight loss >5% in 3 months, or food intake 50–75% of normal in past week"),
                        (2, "Moderate — weight loss >5% in 2 months, or BMI 18.5–20.5 with impaired general condition, or food intake 25–60% of normal"),
                        (3, "Severe — weight loss >5% in 1 month (>15% in 3 months), BMI <18.5, or food intake <25% of normal")
                    ])
                sectionHeader("Disease Severity (stress metabolism)")
                apacheSegment("Disease Severity Score", selection: $nrsI.diseaseSeverity,
                    options: [
                        (0, "Normal requirements"),
                        (1, "Minor — hip fracture, chronic disease with complications (liver cirrhosis, COPD, haemodialysis, diabetes, chemotherapy)"),
                        (2, "Moderate — major abdominal surgery, stroke, haematological malignancy, ICU APACHE II <10"),
                        (3, "Severe — head injury, bone marrow transplant, ICU APACHE II ≥10")
                    ])
                scoreToggle("Age ≥70 years", binding: $nrsI.ageOver70, points: "+1", autoKey: "ageOver70")
            }
            .onChange(of: nrsI) { _, _ in recalculate() }
        }
    }

}
