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


    // MARK: - EuroSCORE II

    var euroScoreIIForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("EuroSCORE II — European System for Cardiac Operative Risk Evaluation II (Nashef 2012). Logistic model predicting in-hospital operative mortality for cardiac surgery. Low <2%, Moderate 2–5%, High ≥5%.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Patient Demographics")
                // Age is a continuous variable — use a Stepper-like apacheSegment with representative bands
                apacheSegment("Age (years)", selection: $euroScI.age,
                    options: [
                        (60, "60 — reference (age ≤60 = 0 boost)"),
                        (65, "65"),
                        (70, "70"),
                        (75, "75"),
                        (80, "80"),
                        (85, "85"),
                        (90, "≥90")
                    ])
                scoreToggle("Female sex", binding: $euroScI.female, points: "+0.22", autoKey: "female")
                sectionHeader("Co-Morbidities")
                apacheSegment("Renal Impairment", selection: $euroScI.renalImpairment,
                    options: [
                        (0, "0 — None (creatinine ≤150 μmol/L)"),
                        (1, "1 — Creatinine 151–176 μmol/L"),
                        (2, "2 — Dialysis or creatinine >176 μmol/L")
                    ])
                scoreToggle("Extracardiac arteriopathy (claudication, carotid stenosis, aortic intervention)", binding: $euroScI.extracardiacArteriopathy, points: "+0.51", autoKey: "extracardiacArteriopathy")
                scoreToggle("Poor mobility (musculoskeletal or neurological dysfunction)", binding: $euroScI.poorMobility, points: "+0.30", autoKey: "poorMobility")
                scoreToggle("Previous cardiac surgery (redo procedure)", binding: $euroScI.previousCardiacSurgery, points: "+1.00", autoKey: "previousCardiacSurgery")
                scoreToggle("Chronic lung disease (long-term bronchodilators or steroids)", binding: $euroScI.chronicLungDisease, points: "+0.19", autoKey: "chronicLungDisease")
                scoreToggle("Active endocarditis (on antibiotics at time of surgery)", binding: $euroScI.activeEndocarditis, points: "+0.62", autoKey: "activeEndocarditis")
                scoreToggle("Critical preoperative state (VT/VF, cardiac massage, ventilated, acute renal failure, IABP/LVAD)", binding: $euroScI.criticalPreoperativeState, points: "+1.09", autoKey: "criticalPreoperativeState")
                scoreToggle("Diabetes mellitus on insulin", binding: $euroScI.diabetesOnInsulin, points: "+0.33", autoKey: "diabetesOnInsulin")
                sectionHeader("Cardiac Status")
                apacheSegment("NYHA Class", selection: $euroScI.nyhaClass,
                    options: [
                        (0, "I — No symptoms"),
                        (1, "II — Symptoms on moderate exertion"),
                        (2, "III — Symptoms on mild exertion"),
                        (3, "IV — Symptoms at rest")
                    ])
                scoreToggle("CCS Class IV angina (symptoms at rest)", binding: $euroScI.ccsClass4Angina, points: "+0.22", autoKey: "ccsClass4Angina")
                apacheSegment("LV Function (EF)", selection: $euroScI.lvFunction,
                    options: [
                        (0, "0 — Good: EF >50%"),
                        (1, "1 — Moderate: EF 31–50%"),
                        (2, "2 — Poor: EF ≤30%")
                    ])
                scoreToggle("Recent MI within 90 days", binding: $euroScI.recentMI, points: "+0.55", autoKey: "recentMI")
                apacheSegment("Pulmonary Hypertension", selection: $euroScI.pulmonaryHypertension,
                    options: [
                        (0, "0 — None or trivial (PASP ≤30 mmHg)"),
                        (1, "1 — Moderate (PASP 31–55 mmHg)"),
                        (2, "2 — Severe (PASP >55 mmHg)")
                    ])
                sectionHeader("Operation Details")
                apacheSegment("Urgency", selection: $euroScI.urgency,
                    options: [
                        (0, "0 — Elective"),
                        (1, "1 — Urgent (not immediately life-threatening)"),
                        (2, "2 — Emergency (before next working day)"),
                        (3, "3 — Salvage (CPR en route to OR)")
                    ])
                apacheSegment("Weight of Procedure", selection: $euroScI.weightOfIntervention,
                    options: [
                        (0, "0 — Isolated CABG"),
                        (1, "1 — Single non-CABG procedure"),
                        (2, "2 — Two procedures"),
                        (3, "3 — Three or more procedures")
                    ])
                scoreToggle("Surgery on thoracic aorta", binding: $euroScI.surgeryOnThoracicAorta, points: "+1.17", autoKey: "surgeryOnThoracicAorta")
                scoreToggle("Post-infarct ventricular septal rupture", binding: $euroScI.postInfarctSeptalRupture, points: "+1.46", autoKey: "postInfarctSeptalRupture")
            }
            .onChange(of: euroScI) { _, _ in recalculate() }
        }
    }


    // MARK: - Barthel Index (ADL Functional Independence)

    private var barthelForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Barthel Index of Activities of Daily Living (Mahoney & Barthel 1965). 10 items totalling 0–100. Higher score = greater independence. Severe dependency 0–20; Moderate 21–60; Mild 61–90; Independent ≥91.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Self-Care")
                apacheSegment("Feeding", selection: $barthelI.feeding,
                    options: [(0, "0 — Unable / totally dependent"), (5, "5 — Needs help (e.g. cutting food)"), (10, "10 — Independent")])
                apacheSegment("Bathing", selection: $barthelI.bathing,
                    options: [(0, "0 — Dependent"), (5, "5 — Independent (can bath/shower unsupervised)")])
                apacheSegment("Grooming", selection: $barthelI.grooming,
                    options: [(0, "0 — Dependent (face, hair, teeth, shaving)"), (5, "5 — Independent")])
                apacheSegment("Dressing", selection: $barthelI.dressing,
                    options: [(0, "0 — Dependent"), (5, "5 — Needs help but does ≥50% unaided"), (10, "10 — Independent")])
                sectionHeader("Continence")
                apacheSegment("Bowel Control", selection: $barthelI.bowels,
                    options: [(0, "0 — Incontinent or needs enemas"), (5, "5 — Occasional accident (<once/week)"), (10, "10 — Continent")])
                apacheSegment("Bladder Control", selection: $barthelI.bladder,
                    options: [(0, "0 — Incontinent or catheterised and unable to manage"), (5, "5 — Occasional accident (<once/24 h)"), (10, "10 — Continent")])
                apacheSegment("Toilet Use", selection: $barthelI.toiletUse,
                    options: [(0, "0 — Dependent"), (5, "5 — Needs help but can do something unaided"), (10, "10 — Independent (on/off, wiping, clothing)")])
                sectionHeader("Mobility & Transfers")
                apacheSegment("Transfers (Bed ↔ Chair)", selection: $barthelI.transfers,
                    options: [
                        (0,  "0 — Unable; no sitting balance"),
                        (5,  "5 — Major help needed (physical, 2 people)"),
                        (10, "10 — Minor help needed (verbal or physical)"),
                        (15, "15 — Independent")
                    ])
                apacheSegment("Mobility (Level Ground)", selection: $barthelI.mobility,
                    options: [
                        (0,  "0 — Immobile"),
                        (5,  "5 — Wheelchair independent, including corners"),
                        (10, "10 — Walks with help of 1 person (verbal or physical) ≥50 m"),
                        (15, "15 — Independent (may use aid) ≥50 m")
                    ])
                apacheSegment("Stairs", selection: $barthelI.stairs,
                    options: [(0, "0 — Unable"), (5, "5 — Needs help (verbal, physical, or carrying aid)"), (10, "10 — Independent up and down")])
            }
            .onChange(of: barthelI) { _, _ in recalculate() }
        }
    }


    // MARK: - DASI (Duke Activity Status Index)

    var dasiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Duke Activity Status Index (Hlatky MA et al. Am J Cardiol 1989;64:651–654). 12 yes/no questions weighted by MET equivalent. DASI <34 ≈ <4 METs (poor functional capacity, elevated perioperative cardiac risk); 34–46 ≈ 4–6 METs (moderate); >46 ≈ >6 METs (good).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Activities of Daily Living")
                scoreToggle("Can take care of yourself (eating, dressing, bathing, toilet)", binding: $dasiI.takeCareOfSelf, points: "+2.75", autoKey: "takeCareOfSelf")
                scoreToggle("Can walk indoors on level ground", binding: $dasiI.walkIndoors, points: "+1.75", autoKey: "walkIndoors")
                scoreToggle("Can walk 1–2 blocks on level ground", binding: $dasiI.walkOneOrTwoBlocks, points: "+2.75", autoKey: "walkOneOrTwoBlocks")
                sectionHeader("Physical Exertion")
                scoreToggle("Can climb a flight of stairs or walk up a hill", binding: $dasiI.climbStairs, points: "+5.50", autoKey: "climbStairs")
                scoreToggle("Can run a short distance", binding: $dasiI.runShortDistance, points: "+8.00", autoKey: "runShortDistance")
                sectionHeader("Household Work")
                scoreToggle("Can do light housework (dusting, washing dishes)", binding: $dasiI.doLightWork, points: "+2.70", autoKey: "doLightWork")
                scoreToggle("Can do moderate housework (vacuuming, sweeping, carrying groceries)", binding: $dasiI.doModerateWork, points: "+3.50", autoKey: "doModerateWork")
                scoreToggle("Can do heavy work (scrubbing floors, moving furniture)", binding: $dasiI.doHeavyWork, points: "+8.00", autoKey: "doHeavyWork")
                scoreToggle("Can do yardwork (raking, weeding, pushing lawn mower)", binding: $dasiI.doYardWork, points: "+4.50", autoKey: "doYardWork")
                sectionHeader("Recreation")
                scoreToggle("Can have sexual activity", binding: $dasiI.haveSexualActivity, points: "+5.25", autoKey: "haveSexualActivity")
                scoreToggle("Moderate recreation (golf, bowling, dancing, doubles tennis)", binding: $dasiI.participateInModerateRecreation, points: "+6.00", autoKey: "participateInModerateRecreation")
                scoreToggle("Strenuous sports (swimming, singles tennis, football, basketball, skiing)", binding: $dasiI.participateInStrenuous, points: "+7.50", autoKey: "participateInStrenuous")
            }
            .onChange(of: dasiI) { _, _ in recalculate() }
        }
    }


    // MARK: - Clinical Frailty Scale

    private var cfsForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Clinical Frailty Scale (Rockwood et al, CMAJ 2005). 9-level ordinal scale for adults ≥65. Levels 1–3 = non-frail; 4 = vulnerable; 5–6 = frail (mild–moderate); 7–8 = severe; 9 = terminal illness. Each level ≥5 increases perioperative mortality and morbidity.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Frailty Level")
                apacheSegment("CFS Level", selection: $cfsI.level,
                    options: [
                        (1, "1 — Very Fit: robust, active, energetic; exercises regularly; among fittest for age"),
                        (2, "2 — Fit: no active disease symptoms; exercises or very active occasionally"),
                        (3, "3 — Managing Well: medical problems well controlled; not regularly active beyond routine walking"),
                        (4, "4 — Vulnerable: not dependent; but symptoms limit activities; often tired/slowed down"),
                        (5, "5 — Mildly Frail: evident slowing; dependent on others for heavy housework, finances, medications"),
                        (6, "6 — Moderately Frail: needs help with all outside activities; bathing or dressing indoors"),
                        (7, "7 — Severely Frail: completely dependent for personal care; stable, not at high risk of dying <6 months"),
                        (8, "8 — Very Severely Frail: completely dependent; approaching end of life; minor illness could be fatal"),
                        (9, "9 — Terminally Ill: life expectancy <6 months; not otherwise evidently frail")
                    ])
            }
            .onChange(of: cfsI) { _, _ in recalculate() }
        }
    }


    // MARK: - Mallampati Airway Classification

    private var mallampatiForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Modified Mallampati Airway Classification (Mallampati et al, Can Anaesth Soc J 1985; Samsoon & Young, Anaesthesia 1987). Class I–IV based on oropharyngeal visibility. Additional predictors further increase difficult airway risk.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Mallampati Class (mouth open, tongue protruded, no phonation)")
                apacheSegment("Mallampati Class", selection: $mallampatiI.mallampatiClass,
                    options: [
                        (1, "Class I — Soft palate, uvula, fauces, tonsillar pillars fully visible"),
                        (2, "Class II — Soft palate, uvula, fauces visible (pillars obscured by tongue)"),
                        (3, "Class III — Soft palate and base of uvula visible only"),
                        (4, "Class IV — Only hard palate visible (soft palate not seen)")
                    ])
                sectionHeader("Additional Airway Predictors")
                scoreToggle("Reduced mouth opening (<4 cm / <3 finger-breadths)", binding: $mallampatiI.mouthOpening, points: "+risk", autoKey: "mouthOpening")
                scoreToggle("Restricted neck extension (<80°)", binding: $mallampatiI.neckMobility, points: "+risk", autoKey: "neckMobility")
                scoreToggle("Short thyromental distance (<6 cm / <3 finger-breadths)", binding: $mallampatiI.thyromental, points: "+risk", autoKey: "thyromental")
                scoreToggle("Retrognathia / micrognathia", binding: $mallampatiI.retrognathia, points: "+risk", autoKey: "retrognathia")
                scoreToggle("Obesity (BMI ≥30) or neck circumference ≥40 cm", binding: $mallampatiI.obesity, points: "+risk", autoKey: "obesity")
                scoreToggle("Beard or poorly-fitting dentures", binding: $mallampatiI.beardOrDentures, points: "+risk", autoKey: "beardOrDentures")
            }
            .onChange(of: mallampatiI) { _, _ in recalculate() }
        }
    }


    // MARK: - MUST (Malnutrition Universal Screening Tool)

    private var mustForm: some View {
        Group {
            apacheSegment("1. BMI Score", selection: $mustI.bmiScore,
                options: [
                    (0, "0 — BMI >20 kg/m²"),
                    (1, "1 — BMI 18.5–20 kg/m²"),
                    (2, "2 — BMI <18.5 kg/m²")
                ])
            apacheSegment("2. Unintentional Weight Loss (past 3–6 months)", selection: $mustI.weightLossScore,
                options: [
                    (0, "0 — Weight loss <5%"),
                    (1, "1 — Weight loss 5–10%"),
                    (2, "2 — Weight loss >10%")
                ])
            apacheSegment("3. Acute Disease Effect", selection: $mustI.acuteDiseaseScore,
                options: [
                    (0, "0 — No acute disease effect (or not applicable)"),
                    (2, "2 — Acutely ill and no nutritional intake likely for >5 days")
                ])
        }
        .onChange(of: mustI) { _, _ in recalculate() }
    }


    // MARK: - Clavien-Dindo

    private var clavienDindoForm: some View {
        Group {
            apacheSegment("Complication Grade", selection: $cdI.grade,
                options: [
                    (0, "None — Uneventful postoperative course"),
                    (1, "Grade I — Minor deviation; bedside management only (antiemetic, analgesia, diuretic, physio)"),
                    (2, "Grade II — Pharmacological treatment, blood transfusion, or TPN required"),
                    (3, "Grade IIIa — Surgical/endoscopic/radiological intervention without GA"),
                    (4, "Grade IIIb — Surgical/endoscopic/radiological intervention under GA"),
                    (5, "Grade IVa — Life-threatening; single organ dysfunction (ICU)"),
                    (6, "Grade IVb — Life-threatening; multiorgan dysfunction (ICU)"),
                    (7, "Grade V — Death")
                ])
        }
        .onChange(of: cdI) { _, _ in recalculate() }
    }


    // MARK: - Modified Aldrete

    private var aldreteForm: some View {
        Group {
            apacheSegment("Activity — Voluntary limb movement", selection: $aldreteI.activity,
                options: [
                    (0, "0 — Unable to move any extremity on command"),
                    (1, "1 — Able to move 2 extremities on command"),
                    (2, "2 — Able to move all extremities on command")
                ])
            apacheSegment("Respiration", selection: $aldreteI.respiration,
                options: [
                    (0, "0 — Apnoeic"),
                    (1, "1 — Dyspnoea, shallow or limited breathing"),
                    (2, "2 — Able to breathe deeply and cough freely")
                ])
            apacheSegment("Circulation — BP vs. pre-operative baseline", selection: $aldreteI.circulation,
                options: [
                    (0, "0 — BP ±>50 mmHg of pre-op value"),
                    (1, "1 — BP ±20–50 mmHg of pre-op value"),
                    (2, "2 — BP ±<20 mmHg of pre-op value")
                ])
            apacheSegment("Consciousness", selection: $aldreteI.consciousness,
                options: [
                    (0, "0 — Not responding to stimuli"),
                    (1, "1 — Arousable on calling"),
                    (2, "2 — Fully awake")
                ])
            apacheSegment("Oxygen Saturation", selection: $aldreteI.oxygenSat,
                options: [
                    (0, "0 — SpO₂ <90% even with O₂ supplementation"),
                    (1, "1 — Needs O₂ supplementation to maintain SpO₂ ≥90%"),
                    (2, "2 — SpO₂ ≥92% on room air")
                ])
        }
        .onChange(of: aldreteI) { _, _ in recalculate() }
    }


    private var ecogForm: some View {
        Group {
            apacheSegment("Performance Status Grade", selection: $ecogI.grade,
                options: [
                    (0, "0 — Fully active, no restriction"),
                    (1, "1 — Restricted strenuous activity"),
                    (2, "2 — Ambulatory; unable to work"),
                    (3, "3 — Limited self-care; >50% bedbound"),
                    (4, "4 — Completely disabled; bedbound")
                ])
        }
        .onChange(of: ecogI) { _, _ in recalculate() }
    }


    // MARK: - Charlson Comorbidity Index (#76)

    private var cciForm: some View {
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

    private var mfi5Form: some View {
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

    private var mirelsForm: some View {
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

    private var ariscatForm: some View {
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
