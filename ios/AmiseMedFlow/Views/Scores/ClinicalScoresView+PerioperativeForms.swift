// ClinicalScoresView+PerioperativeForms.swift
// Perioperative / surgical risk score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    // AnyView on purpose — see formBodyByCategory.
    func preopFormBody(_ score: ActiveScore) -> AnyView {
        switch score {
        case .rcri: return AnyView(rcriForm)
        case .asa: return AnyView(asaForm)
        case .childPugh: return AnyView(childPughForm)
        case .meld: return AnyView(meldForm)
        case .stopBang: return AnyView(stopBangForm)
        case .fib4: return AnyView(fib4Form)
        case .ppossum: return AnyView(ppossumForm)
        case .nrs2002: return AnyView(nrs2002Form)
        case .mallampati: return AnyView(mallampatiForm)
        case .cfs: return AnyView(cfsForm)
        default: return preopFormBodyB(score)
        }
    }

    // AnyView on purpose — see formBodyByCategory.
    func preopFormBodyB(_ score: ActiveScore) -> AnyView {
        switch score {
        case .dasi: return AnyView(dasiForm)
        case .barthel: return AnyView(barthelForm)
        case .euroScoreII: return AnyView(euroScoreIIForm)
        case .ecog: return AnyView(ecogForm)
        case .cci: return AnyView(cciForm)
        case .mfi5: return AnyView(mfi5Form)
        case .must: return AnyView(mustForm)
        case .mirels: return AnyView(mirelsForm)
        case .ariscat: return AnyView(ariscatForm)
        case .clavienDindo: return AnyView(clavienDindoForm)
        case .aldrete: return AnyView(aldreteForm)
        default: return AnyView(EmptyView())
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
        .onChange(of: ppossumI) { _, _ in recalculate() }
    }

    // MARK: - P-POSSUM sub-sections

    private var ppossumPhysiologicalSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader("Physiological Score (12 variables)")
            apacheSegment("Age", selection: $ppossumI.agePhys, options: [
                (1, "≤60 yr (+1)"), (2, "61–70 yr (+2)"), (4, "71–80 yr (+4)"), (8, "≥81 yr (+8)")])
            apacheSegment("Cardiac signs", selection: $ppossumI.cardiacSigns, options: [
                (1, "None (+1)"), (2, "Diuretics / digoxin / antianginals / antihypertensives (+2)"),
                (4, "Peripheral oedema / warfarin (+4)"), (8, "Raised JVP / cardiomegaly (+8)")])
            apacheSegment("Respiratory history", selection: $ppossumI.respiratoryHx, options: [
                (1, "None (+1)"), (2, "Exertional dyspnoea / mild COPD (+2)"),
                (4, "Limiting dyspnoea / moderate COPD (+4)"), (8, "Breathless at rest / fibrosing alveolitis (+8)")])
            apacheSegment("Systolic BP (mmHg)", selection: $ppossumI.sbpPhys, options: [
                (1, "110–130 (+1)"), (2, "131–170 or 100–109 (+2)"),
                (4, "≥171 or 90–99 (+4)"), (8, "≤89 (+8)")])
            apacheSegment("Heart rate (bpm)", selection: $ppossumI.hrPhys, options: [
                (1, "51–80 (+1)"), (2, "81–100 or ≤50 (+2)"),
                (4, "101–120 (+4)"), (8, "≥121 (+8)")])
            apacheSegment("GCS", selection: $ppossumI.gcsPhys, options: [
                (1, "15 (+1)"), (2, "12–14 (+2)"), (4, "9–11 (+4)"), (8, "≤8 (+8)")])
            apacheSegment("Haemoglobin (g/dL)", selection: $ppossumI.haemoglobin, options: [
                (1, "13–16 (+1)"), (2, "11.5–12.9 or 16.1–17 (+2)"),
                (4, "10–11.4 or 17.1–18 (+4)"), (8, "≤9.9 or ≥18.1 (+8)")])
            apacheSegment("WBC (×10³/µL)", selection: $ppossumI.wbcPhys, options: [
                (1, "4–10 (+1)"), (2, "10.1–20 or 3.1–3.9 (+2)"), (4, "≥20.1 or ≤3.0 (+4)")])
            apacheSegment("Urea (mmol/L)", selection: $ppossumI.urea, options: [
                (1, "<7.5 (+1)"), (2, "7.5–10.0 (+2)"), (4, "10.1–15.0 (+4)"), (8, "≥15.1 (+8)")])
            apacheSegment("Sodium (mmol/L)", selection: $ppossumI.sodiumPhys, options: [
                (1, "136–145 (+1)"), (2, "131–135 or 146–150 (+2)"),
                (4, "126–130 (+4)"), (8, "≤125 (+8)")])
            apacheSegment("Potassium (mmol/L)", selection: $ppossumI.potassiumPhys, options: [
                (1, "3.5–5.0 (+1)"), (2, "3.2–3.4 or 5.1–5.3 (+2)"),
                (4, "2.9–3.1 or 5.4–5.9 (+4)"), (8, "≤2.8 or ≥6.0 (+8)")])
            apacheSegment("ECG", selection: $ppossumI.ecg, options: [
                (1, "Normal (+1)"), (2, "AF rate 60–90 (+2)"),
                (4, "AF other rate or >5 ectopics (+4)"), (8, "Q waves / ST changes / BBB (+8)")])
        }
    }

    private var ppossumOperativeSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader("Operative Score (6 variables)")
            apacheSegment("Operative magnitude", selection: $ppossumI.operativeMagnitude, options: [
                (1, "Minor (+1)"), (2, "Moderate (+2)"), (4, "Major (+4)"), (8, "Major+ (+8)")])
            apacheSegment("Number of procedures", selection: $ppossumI.numProcedures, options: [
                (1, "1 (+1)"), (2, "2 (+2)"), (4, "≥3 (+4)")])
            apacheSegment("Blood loss (mL)", selection: $ppossumI.bloodLoss, options: [
                (1, "<100 (+1)"), (2, "101–500 (+2)"), (4, "501–999 (+4)"), (8, "≥1000 (+8)")])
            apacheSegment("Peritoneal soiling", selection: $ppossumI.peritonealSoiling, options: [
                (1, "None (+1)"), (2, "Minor serosal / haematoma (+2)"),
                (4, "Local pus (+4)"), (8, "Free bowel content / pus / blood (+8)")])
            apacheSegment("Malignancy", selection: $ppossumI.malignancy, options: [
                (1, "None (+1)"), (2, "Primary only (+2)"), (4, "Nodal disease (+4)"), (8, "Distant metastases (+8)")])
            apacheSegment("Urgency", selection: $ppossumI.urgency, options: [
                (1, "Elective (+1)"), (4, "Emergency >2h — resuscitated (+4)"),
                (8, "Emergency <2h — not resuscitated (+8)")])
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
