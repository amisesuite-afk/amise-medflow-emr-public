// ClinicalScoresView+PerioperativeForms2.swift
// EuroSCORE II, Barthel Index, DASI, Clinical Frailty Scale, Mallampati,
// MUST, Clavien-Dindo Classification, Modified Aldrete Recovery Score.

import SwiftUI

extension ClinicalScoresView {

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

}
