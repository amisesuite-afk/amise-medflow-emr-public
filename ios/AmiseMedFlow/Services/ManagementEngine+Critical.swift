// ManagementEngine+Critical.swift
// Critical surgical plans: Abdominal Sepsis, Mesenteric Ischaemia, AAA, Necrotising Fasciitis, DVT, PE, Acute Limb Ischaemia.

import Foundation

extension ManagementEngine {

    // MARK: Abdominal Sepsis

    static let sepsisAbdominal = ManagementPlan(
        diagnosis: "Abdominal Sepsis / Septic Shock",
        icdCode: "A41.9",
        urgency: .immediate,
        immediateActions: [
            "SEPSIS-1-HOUR BUNDLE:",
            "1. Blood cultures × 2 before antibiotics",
            "2. Lactate measurement",
            "3. Broad-spectrum IV antibiotics within 1 hour: meropenem 1 g TDS + metronidazole 500 mg TDS",
            "4. IV crystalloid 30 mL/kg if lactate ≥4 or MAP <65",
            "5. Re-measure lactate if initial ≥2 mmol/L",
            "IDC for urine output monitoring (target >0.5 mL/kg/h)",
            "Vasopressors (noradrenaline) if MAP <65 despite 30 mL/kg fluid: titrate to MAP ≥65",
            "ICU referral EARLY — do not wait for organ failure",
        ],
        investigations: [
            "FBC, U&E, LFT, CRP, coagulation, blood cultures × 2, lactate, arterial blood gas",
            "Blood group and cross-match",
            "CT abdomen/pelvis (identify source: appendicitis, cholangitis, perforation, diverticulitis, ischaemia)",
            "CXR (exclude pneumonia)",
            "Urine culture",
        ],
        medicalManagement: [
            "Antibiotics: meropenem 1 g TDS covers most Gram-negative + anaerobic pathogens",
            "Add vancomycin if MRSA suspected; add fluconazole if Candida risk",
            "Hydrocortisone 200 mg/d IV if septic shock not responding to vasopressors",
            "Blood glucose control: target 6–10 mmol/L",
        ],
        surgicalIndications: [
            "Source control is mandatory — identify and treat the intra-abdominal source",
            "Delay of >12 h in source control increases mortality by 30%",
            "Emergent: perforation, strangulated hernia, ischaemia, cholangitis (ERCP)",
            "Urgent: appendicitis, cholecystitis, abscess drainage",
        ],
        surgicalProcedure: "Depends on source (see individual diagnoses); damage control surgery in extremis",
        disposition: "ICU",
        followUp: "Regular reassessment: lactate clearance, organ function, antibiotic de-escalation based on cultures",
        keyPitfalls: [
            "Antibiotic without source control = inadequate treatment — identify the source",
            "Lactate ≥4 = high-risk sepsis regardless of BP — prompt goal-directed resuscitation (fluid volume by cause of shock) and critical care review (SSC 2021)",
            "Do not give broad-spectrum antibiotics without cultures first",
            "Antibiotic de-escalation: narrow based on culture/sensitivity results at 24–48 h",
        ],
        redFlags: [
            "Lactate ≥4 + MAP <65 → septic shock; ICU + vasopressors immediately",
            "Organ failure (creatinine ↑, bilirubin ↑, platelets ↓, confused) → Sepsis-3 with SOFA ≥2",
        ],
        guidelines: "Surviving Sepsis Campaign 2021; NICE NG51"
    )

    // MARK: Acute Mesenteric Ischaemia

    static let mesentericIschaemia = ManagementPlan(
        diagnosis: "Acute Mesenteric Ischaemia",
        icdCode: "K55.0",
        urgency: .immediate,
        immediateActions: [
            "LIFE-THREATENING EMERGENCY — mortality 60–80% without prompt recognition",
            "Two large-bore IV access + prompt goal-directed resuscitation",
            "IV morphine analgesia",
            "IV unfractionated heparin (UFH) 5,000 units stat if embolic cause suspected (unless GI bleed)",
            "IV broad-spectrum antibiotics: meropenem 1 g TDS (translocation risk)",
            "IDC + urine output monitoring",
            "Urgent vascular/general surgery review",
            "ICU referral",
        ],
        investigations: [
            "FBC, U&E, CRP, lactate (elevated >2 = ischaemia; sensitivity poor but supports diagnosis)",
            "Blood cultures × 2",
            "Blood group and cross-match 4 units",
            "CT angiography (CT-A): diagnostic test of choice; identifies arterial / venous occlusion + bowel changes",
            "ABG (metabolic acidosis — late sign, poor prognosis)",
            "ECG + troponin (AF is embolic cause in 50%)",
        ],
        medicalManagement: [
            "Anticoagulation with UFH if SMA embolus — bridge to surgery or thrombolysis",
            "Papaverine infusion via catheter if catheter-directed therapy available",
            "Antibiotics covering bowel flora",
            "Optimise cardiac output (AF rate control, inotropes if cardiogenic source)",
        ],
        surgicalIndications: [
            "All cases with viable bowel on CT: revascularisation",
            "SMA embolus: surgical embolectomy or catheter-directed thrombolysis",
            "SMA thrombosis: surgical bypass or endovascular stenting",
            "Established bowel necrosis: emergency laparotomy + resection",
            "Second-look laparotomy at 24–48 h if bowel viability uncertain",
        ],
        surgicalProcedure: "Laparotomy + SMA embolectomy / bypass + bowel resection of necrotic segments; second-look planned",
        disposition: "ICU post-operatively",
        followUp: "Long-term anticoagulation; screen for underlying cardiac cause (AF)",
        keyPitfalls: [
            "Classic presentation: pain out of proportion to examination findings — cardinal sign",
            "Normal WBC and lactate early does NOT exclude — diagnosis often delayed",
            "CT-A is essential — do not delay for plain films or ultrasound",
            "Second-look laparotomy is planned, not optional — bowel viability not reliably assessed at first laparotomy",
        ],
        redFlags: [
            "Pain out of proportion to examination + AF + age >60 → mesenteric ischaemia until proven otherwise",
            "Peritonism → bowel necrosis; emergency laparotomy without delay",
            "Rising lactate + metabolic acidosis → established necrosis; theatre immediately",
        ],
        guidelines: "ESVS 2017; WSES 2017"
    )

    // MARK: AAA (Ruptured)

    static let aaa = ManagementPlan(
        diagnosis: "Abdominal Aortic Aneurysm (Ruptured)",
        icdCode: "I71.3",
        urgency: .immediate,
        immediateActions: [
            "CALL VASCULAR SURGEON IMMEDIATELY",
            "Two large-bore IV access (14G) + cross-match 6 units URGENT",
            "Permissive hypotension: target SBP 70–90 mmHg until aortic control achieved (DO NOT over-resuscitate — blows clot)",
            "If haemodynamically unstable → theatre immediately (no CT)",
            "If haemodynamically stable → CT angiography to plan EVAR vs open",
            "O-negative blood if haemodynamically compromised and cross-match not yet available",
        ],
        investigations: [
            "FBC, U&E, coagulation, blood group + URGENT cross-match 6 units + 4 FFP",
            "CT aorta angiography (if stable): determines aneurysm anatomy, EVAR feasibility",
            "Bedside USS if CT not rapidly available (confirms aneurysm, but cannot confirm rupture)",
            "ABG, ECG",
        ],
        medicalManagement: [
            "Permissive hypotension until aortic control — avoid raising SBP above 90",
            "Massive transfusion protocol (1:1:1 ratio: pRBC : FFP : platelets)",
            "Tranexamic acid 1 g IV over 10 min (anti-fibrinolytic)",
        ],
        surgicalIndications: [
            "All ruptured AAA — emergency surgery",
        ],
        surgicalProcedure: "EVAR (preferred if anatomy suitable) or open repair (aortobifemoral graft) — EVAR has lower 30-day mortality if anatomy allows",
        disposition: "Theatre → ICU",
        followUp: "Regular EVAR surveillance USS at 1, 12 months then annually",
        keyPitfalls: [
            "Classic triad (pulsatile mass + hypotension + back/flank pain) present in <50%",
            "Do NOT over-resuscitate: target SBP 70–80 — avoid systolic >90 pre-operatively",
            "Missed diagnosis commonest in: women (less common), obese patients, atypical pain (flank, hip, back)",
            "Immediate theatre if haemodynamically unstable — CT is for stable patients only",
        ],
        redFlags: [
            "Hypotensive + pulsatile abdominal mass → emergency theatre immediately; no delay for imaging",
            "Cardiac arrest from AAA → theatre (resuscitative endovascular balloon occlusion of the aorta if trained)",
        ],
        guidelines: "ESVS 2019; NICE NG45 (AAA surveillance); SVS 2018"
    )

    // MARK: Necrotising Fasciitis

    static let necrotizingFasciitis = ManagementPlan(
        diagnosis: "Necrotising Fasciitis",
        icdCode: "M72.6",
        urgency: .immediate,
        immediateActions: [
            "NECROTISING FASCIITIS IS A SURGICAL EMERGENCY — every hour of delay increases mortality by ~10%",
            "IV access × 2 + prompt goal-directed fluid resuscitation",
            "IV broad-spectrum antibiotics IMMEDIATELY: meropenem 1 g TDS + clindamycin 600 mg TDS (anti-toxin effect) + fluconazole 400 mg OD",
            "IDC for urine output",
            "ICU referral simultaneously",
            "Theatre team activation — do NOT wait for confirmation",
            "Inform patient and next of kin — mortality 20–40%",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, coagulation, lactate, blood cultures × 2",
            "LRINEC score (laboratory risk indicator)",
            "MRI soft tissue (most sensitive — if time permits and patient stable)",
            "CT soft tissue (may show gas tracking along fascial planes — pathognomonic)",
            "Wound swab for MC&S",
            "Finger test: surgical incision + probe to fascial plane — necrotic fascia (no bleeding, 'dishwater' fluid, tissue planes separate easily) = positive",
        ],
        medicalManagement: [
            "IV antibiotics: meropenem 1 g TDS + clindamycin 600 mg TDS (anti-streptococcal toxin suppression) + fluconazole",
            "IVIG 2 g/kg IV (single dose) in Group A streptococcal NF — reduces mortality",
            "Hyperbaric oxygen: adjunct where available",
        ],
        surgicalIndications: [
            "All cases — immediate wide surgical debridement",
            "Do NOT biopsy, aspirate or wait for MRI if clinical suspicion high",
        ],
        surgicalProcedure: "Wide excision of all necrotic tissue until reaching healthy bleeding fascia; second-look surgery at 24–48 h; wound left open; split-thickness skin graft and reconstruction after clean wound",
        disposition: "ICU post-operatively",
        followUp: "Multiple returns to theatre (2–3 expected); plastic surgery for reconstruction; stoma if perineal involvement (Fournier's)",
        keyPitfalls: [
            "Normal skin appearance early does NOT exclude deep fascial necrosis",
            "Pain out of proportion to external appearances is the clinical hallmark",
            "LRINEC ≥8: PPV ~92% but use clinically — do not delay theatre for score calculation if clinical picture clear",
            "Type I (polymicrobial) commonest — diabetes, immunocompromised, abdominal wall; Type II (Group A Strep) more fulminant",
            "Fournier's gangrene = NF of perineum / scrotum — diverting colostomy often required",
        ],
        redFlags: [
            "Gas in soft tissue on CT → NF confirmed; immediate theatre",
            "Septic shock → life-threatening; ICU + theatre simultaneously",
            "Any delay in surgical debridement directly correlates with mortality",
        ],
        guidelines: "WSES 2018 NF Guidelines; IDSA 2014 SSTI Guidelines"
    )

    // MARK: Deep Vein Thrombosis

    static let dvt = ManagementPlan(
        diagnosis: "Deep Vein Thrombosis",
        icdCode: "I82.409",
        urgency: .semiUrgent,
        immediateActions: [
            "Clinical assessment: Wells DVT score",
            "D-dimer if Wells ≤1 (low probability): if negative, DVT excluded without USS",
            "Compression duplex USS urgently if Wells ≥2",
            "If high clinical suspicion + delay to imaging: commence LMWH empirically",
        ],
        investigations: [
            "Compression duplex USS (whole leg): diagnostic test of choice",
            "D-dimer: high sensitivity (~96%), low specificity — use to rule out only",
            "FBC, U&E, LFT, coagulation (baseline before anticoagulation)",
            "Thrombophilia screen (if provoked, first episode, unusual site, family Hx): defer until 3 months after stopping anticoagulation",
            "Malignancy screen if unprovoked: CXR, urinalysis, FBC, PSA (male), CT chest/abdomen/pelvis if indicated",
        ],
        medicalManagement: [
            "Anticoagulation: DOAC first-line (apixaban 10 mg BD × 7 d, then 5 mg BD; or rivaroxaban 15 mg BD × 21 d, then 20 mg OD)",
            "LMWH: enoxaparin 1 mg/kg BD SC if DOAC contraindicated (renal impairment, pregnancy, cancer-related — use LMWH in cancer-VTE: dalteparin 200 IU/kg OD × 30 d then 150 IU/kg OD)",
            "Duration: provoked DVT 3 months; unprovoked proximal DVT ≥3–6 months; recurrent/unprovoked: consider lifelong",
            "Compression stockings: reduce post-thrombotic syndrome (Grade 2B — SOCTRATES trial)",
        ],
        surgicalIndications: [
            "Catheter-directed thrombolysis for massive iliofemoral DVT + limb-threatening symptoms",
            "IVC filter: recurrent PE on anticoagulation, anticoagulation contraindicated",
        ],
        surgicalProcedure: "Catheter-directed thrombolysis or thrombectomy for massive proximal DVT only",
        disposition: "Outpatient anticoagulation for most; admit if severe symptoms, PE concern, anticoagulation risk",
        followUp: "Review 3 months; consider indefinite anticoagulation for unprovoked; thrombophilia screen at 3 months",
        keyPitfalls: [
            "Always consider PE — DVT and PE are the same disease",
            "Cancer-associated DVT: DOAC (edoxaban or rivaroxaban) now preferred over LMWH in most",
            "Below-knee DVT: controversial — treat if symptomatic or extension risk",
            "Delay to anticoagulation increases PE risk and post-thrombotic syndrome",
        ],
        redFlags: [
            "Haemodynamic instability + DVT → suspect massive PE; CTPA urgently",
            "Phlegmasia cerulea dolens (massive DVT + limb ischaemia) → emergency thrombectomy",
        ],
        guidelines: "NICE NG158; BTS PE 2003 updated; ASH 2020"
    )

    // MARK: Pulmonary Embolism

    static let pulmonaryEmbolism = ManagementPlan(
        diagnosis: "Pulmonary Embolism",
        icdCode: "I26.99",
        urgency: .urgent,
        immediateActions: [
            "Oxygen: high-flow if SpO₂ <92% — target SpO₂ 94–98%",
            "IV access + baseline obs",
            "Assess haemodynamic status: SBP <90 mmHg (or a drop >40 mmHg) → massive (high-risk) PE; tachycardia alone is not high-risk (ESC 2019)",
            "Massive PE (haemodynamic instability): systemic thrombolysis (alteplase 100 mg IV over 2 hours) is life-saving — contraindicated after major surgery, trauma or bleeding in the previous 3 weeks (surgical embolectomy or catheter-directed therapy instead) (ESC 2019)",
            "If sub-massive: anticoagulate and monitor closely",
            "Analgesia for pleuritic pain",
        ],
        investigations: [
            "ABG, FBC, U&E, D-dimer (if Wells PE ≤4 and stable)",
            "ECG (S1Q3T3, RBBB, sinus tachycardia — S1Q3T3 present in only 20%)",
            "CXR (Westermark / Hampton's hump — insensitive; useful to exclude alternative diagnosis)",
            "Troponin + BNP (risk stratification: elevated = right heart strain = worse prognosis)",
            "CTPA (definitive): if Wells PE >4, or D-dimer positive",
            "ECHO bedside (if massive PE — RV strain; can guide thrombolysis decision)",
        ],
        medicalManagement: [
            "Anticoagulation: DOAC first-line (rivaroxaban 15 mg BD × 21 d, then 20 mg OD; or apixaban 10 mg BD × 7 d, then 5 mg BD)",
            "LMWH: enoxaparin 1 mg/kg BD if DOAC contraindicated",
            "Massive PE: IV alteplase 100 mg over 2 h (systemic thrombolysis) if haemodynamically unstable",
            "Sub-massive PE + RV strain: consider reduced-dose thrombolysis or catheter-directed therapy",
            "Duration: provoked 3 months; unprovoked 6 months+",
        ],
        surgicalIndications: [
            "Surgical embolectomy: massive PE + contraindication to thrombolysis or failed thrombolysis",
            "Catheter-directed thrombolysis: sub-massive PE with RV strain",
        ],
        surgicalProcedure: "Surgical pulmonary embolectomy (CPB); or catheter-directed thrombolysis / AngioJet thrombectomy",
        disposition: "Massive PE → ICU; sub-massive → HDU / monitored ward; low-risk → outpatient DOAC (PESI score <2)",
        followUp: "CTPA or V/Q scan at 3–6 months (chronic thromboembolic disease); echocardiogram if RV strain; thrombophilia screen at 3 months",
        keyPitfalls: [
            "S1Q3T3 is present in only 20% — do not rely on ECG to exclude PE",
            "D-dimer: negative rules out PE only in low-to-moderate probability (Wells ≤4)",
            "Massive PE: do NOT delay thrombolysis awaiting CTPA if arrest imminent",
            "Post-PE syndrome: chronic dyspnoea — screen for CTEPH at 3–6 months",
        ],
        redFlags: [
            "Cardiac arrest / pulseless electrical activity in context of PE → thrombolysis during CPR (alteplase 50 mg stat)",
            "Haemodynamic compromise + RV strain on ECHO → massive PE; thrombolysis or embolectomy",
        ],
        guidelines: "ESC PE Guidelines 2019; BTS 2003 (updated); NICE NG158"
    )

    // MARK: Acute Limb Ischaemia

    static let acuteLimbIschaemia = ManagementPlan(
        diagnosis: "Acute Limb Ischaemia",
        icdCode: "I74.3",
        urgency: .immediate,
        immediateActions: [
            "SURGICAL EMERGENCY — window for limb salvage 4–6 hours from onset",
            "IV access + analgesia (morphine IV)",
            "IV unfractionated heparin 5,000 units stat (to prevent propagation)",
            "Start heparin infusion 1,000 units/hour (target APTT 60–90 s)",
            "Nil by mouth",
            "Urgent vascular surgery review — target revascularisation within 4–6 h",
        ],
        investigations: [
            "FBC, U&E, coagulation, creatine kinase, blood cultures, cross-match",
            "ECG (AF in 40% — embolic cause)",
            "Ankle-brachial pressure index (ABPI) if Doppler available",
            "CT angiography (if time permits and stable — maps occlusion for operative planning)",
            "ECHO (cardiac source of embolus?)",
        ],
        medicalManagement: [
            "UFH anticoagulation throughout",
            "Thrombolysis (catheter-directed): selected cases of acute-on-chronic thrombosis with viable limb",
        ],
        surgicalIndications: [
            "All cases of acute limb ischaemia — revascularise urgently",
            "Embolus: Fogarty embolectomy (under LA if possible)",
            "Thrombosis on background PAD: bypass or angioplasty",
            "Irreversible ischaemia (6 Ps + fixed mottling + rigor): primary amputation",
        ],
        surgicalProcedure: "Fogarty embolectomy / thrombectomy; bypass grafting; on-table angiography; fasciotomy if >6 h ischaemia or compartment syndrome risk",
        disposition: "Theatre → ICU / HDU",
        followUp: "Investigate embolus source (AF, cardiac thrombus); anticoagulation long-term; wound review",
        keyPitfalls: [
            "6 Ps: Pain, Pallor, Pulselessness, Paraesthesia, Paralysis, Perishingly cold (Poikilothermia)",
            "Paralysis/paraesthesia = neural ischaemia = LATE sign — urgent revascularisation without delay",
            "Reperfusion injury: potassium release + myoglobinuria after revascularisation — generous IV fluids + monitor K⁺",
            "Fasciotomy: mandatory if ischaemia >4–6 h, compartment pressure >30 mmHg or clinical compartment syndrome",
        ],
        redFlags: [
            "Paralysis or paraesthesia → irreversible ischaemia developing; revascularise within 1–2 h or amputate",
            "Fixed mottling + muscle rigidity = irreversible → primary amputation",
        ],
        guidelines: "ESVS 2020; SVS 2012"
    )


}
