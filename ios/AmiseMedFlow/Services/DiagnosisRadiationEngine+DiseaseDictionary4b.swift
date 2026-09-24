// DiagnosisRadiationEngine+DiseaseDictionary4b.swift
// Medical disease dictionary — Neurology, Dermatology, and remaining entries (part B).

import Foundation



extension DiagnosisRadiationEngine {

    static let _medicalEntries3B: [Entry] = [

        // ══════════════════════════════════════════════════════════════
        // NEUROLOGY — STROKE / TIA
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["stroke", "ischaemic stroke", "cerebrovascular accident", "cva", "tia", "transient ischaemic attack"], radiation: .init(
            conditionName: "Ischaemic Stroke / TIA",
            icd10Primary: "I63.9",
            investigations: [
                .init(name: "CT Brain (non-contrast) — IMMEDIATE", category: .imaging, rationale: "Exclude haemorrhage before thrombolysis; haemorrhage evident immediately"),
                .init(name: "MRI Brain + DWI (diffusion-weighted)", category: .imaging, rationale: "DWI most sensitive for ischaemia within hours — confirms TIA territory"),
                .init(name: "CT/MR Angiography (intracranial + carotid)", category: .imaging, rationale: "Identify large vessel occlusion (LVO) for thrombectomy eligibility"),
                .init(name: "12-lead ECG + cardiac monitoring ≥24h", category: .other, rationale: "AF detection — paroxysmal AF in up to 25% of cryptogenic stroke"),
                .init(name: "FBC / Coagulation / U&E / Glucose", category: .blood, rationale: "Stroke mimics (hypoglycaemia); coagulopathy; anaemia"),
                .init(name: "Lipid profile / HbA1c", category: .blood, rationale: "Modifiable risk factors"),
                .init(name: "Carotid Doppler Ultrasound", category: .imaging, rationale: "Ipsilateral carotid stenosis >50% → carotid endarterectomy within 2 weeks"),
                .init(name: "Echocardiogram (TTE/TOE)", category: .imaging, rationale: "Cardioembolic source — thrombus, PFO, valvular disease"),
            ],
            planTemplate: """
- HYPERACUTE STROKE UNIT TRANSFER — time critical
- THROMBOLYSIS (IV alteplase 0.9 mg/kg max 90 mg):
  • Window: onset <4.5h (or last-known well <4.5h)
  • Contraindications: haemorrhage on CT, anticoagulation, BP >185/110 uncontrolled, recent surgery/trauma
  • ACTIVATE STROKE TEAM immediately
- MECHANICAL THROMBECTOMY:
  • LVO on CTA/MRA + salvageable penumbra (ASPECTS ≥6) + onset <24h
  • Transfers to thrombectomy-capable centre if not available locally
- BLOOD PRESSURE:
  • Pre-thrombolysis: treat if >185/110; target <185/110 for eligibility
  • Post-thrombolysis: <180/105 for 24h
  • Non-thrombolysis: avoid aggressive lowering <220/120 in acute 24h (collateral perfusion)
- ANTIPLATELET:
  • Start aspirin 300 mg stat if haemorrhage excluded (thrombolysis: delay 24h)
  • Dual antiplatelet (aspirin + clopidogrel) × 21 days for minor stroke/TIA (POINT trial)
  • Switch to clopidogrel 75 mg OD monotherapy after 21 days
- TIA: ABCD² score; high-risk (≥4) → admit / next-day stroke clinic + dual antiplatelet
  • Carotid endarterectomy within 2 weeks if stenosis >50% ipsilateral
- ANTICOAGULATION for AF:
  • DOAC (apixaban or rivaroxaban) after 2 weeks for most ischaemic strokes with AF
  • LMWH bridge in high-risk settings
""",
            billingCodes: [
                .init(icd10: "I63.9", icdDescription: "Cerebral infarction, unspecified", cpt: nil, cptDescription: "Medical management / thrombolysis"),
                .init(icd10: "G45.9", icdDescription: "Transient ischaemic attack, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "STROKE: Time = Brain. Activate stroke pathway immediately. CT within 15 min of arrival.",
            redFlags: ["Large vessel occlusion → mechanical thrombectomy eligible → transfer urgently", "BP >185/110 pre-thrombolysis → control before giving alteplase", "TIA with ABCD² ≥4 → high 48h stroke risk → admit + dual antiplatelet"],
            followUp: "Stroke clinic at 1 week. Carotid Doppler at 24h. Cardiology follow-up if AF. BP/lipid optimisation. Speech/OT/physio rehabilitation.",
            guidelineReference: "RCP Stroke Guidelines 2023; ESO 2021; AHA/ASA 2019; NICE NG128"
        )),

        Entry(keywords: ["intracranial haemorrhage", "subarachnoid haemorrhage", "sah", "intracerebral haemorrhage", "thunderclap headache"], radiation: .init(
            conditionName: "Subarachnoid Haemorrhage / Intracranial Haemorrhage",
            icd10Primary: "I60.9",
            investigations: [
                .init(name: "CT Brain non-contrast (URGENT)", category: .imaging, rationale: "SAH: hyperdense blood in cisterns (sensitivity ~98% in first 6h)"),
                .init(name: "LP (lumbar puncture — 12h after headache onset if CT negative)", category: .other, rationale: "Xanthochromia — gold standard for SAH if CT negative"),
                .init(name: "CT Angiography (CTA)", category: .imaging, rationale: "Aneurysm identification — saccular aneurysm in 85% SAH"),
                .init(name: "FBC / Coagulation / U&E", category: .blood, rationale: "Pre-operative; hyponatraemia common in SAH (SIADH/CSW)"),
                .init(name: "ECG / Troponin", category: .blood, rationale: "Neurogenic cardiac effects of SAH (ST changes, troponin rise)"),
            ],
            planTemplate: """
- IMMEDIATE:
  • Urgent neurosurgical / neurology referral
  • ICU/HDU admission
  • Analgesia: paracetamol 1g QDS; avoid NSAIDs (platelet effects)
  • Bed rest; avoid Valsalva
  • IV nimodipine 60 mg 4-hourly (calcium channel blocker — reduces vasospasm after SAH)
  • IV fluids: maintain euvolaemia; avoid hyponatraemia
- ANEURYSMAL SAH:
  • Neurosurgical coiling (endovascular) or clipping (open) within 24–72h
  • Monitor for vasospasm (day 4–14): TCD monitoring; consider CTA
  • Treat vasospasm: IV fluids (triple H therapy cautious); vasopressors; intra-arterial nimodipine
- BLOOD PRESSURE: SBP <160 mmHg (pre-treatment of aneurysm); avoid hypotension
- ANTI-SEIZURE PROPHYLAXIS: levetiracetam 500 mg BD (controversial — local protocol)
- ICH (Intracerebral): reverse anticoagulation; neurosurgery for accessible haematoma with deterioration
""",
            billingCodes: [
                .init(icd10: "I60.9", icdDescription: "Subarachnoid haemorrhage, unspecified", cpt: nil, cptDescription: "Neurosurgical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Thunderclap headache = SAH until proven otherwise. CT BRAIN STAT. Neurological emergency.",
            redFlags: ["Sentinel headache (mild preceding) → preceding leak → high rupture risk", "Rebleed before treatment → fatal → secure aneurysm urgently"],
            followUp: "CTA at 3–6 months (aneurysm occlusion check). Neuropsychological assessment. Annual follow-up for vasospasm sequelae.",
            guidelineReference: "NICE NG224; ESO 2021; Neurocritical Care Society"
        )),

        // ══════════════════════════════════════════════════════════════
        // CARDIOLOGY — ATRIAL FIBRILLATION
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["atrial fibrillation", "af", "paroxysmal af", "flutter", "irregular heartbeat", "palpitations irregular"], radiation: .init(
            conditionName: "Atrial Fibrillation",
            icd10Primary: "I48.91",
            investigations: [
                .init(name: "12-lead ECG (confirms AF)", category: .other, rationale: "Absent P waves + irregularly irregular rhythm + narrow QRS"),
                .init(name: "FBC / TFTs / U&E / LFTs", category: .blood, rationale: "Thyrotoxicosis; electrolyte imbalance; alcohol (hepatic)"),
                .init(name: "Echocardiogram (TTE)", category: .imaging, rationale: "Structural heart disease, LV function, LA size, valvular disease"),
                .init(name: "CXR", category: .imaging, rationale: "Cardiomegaly, pulmonary oedema"),
                .init(name: "Thyroid function (TSH / free T4)", category: .blood, rationale: "Thyrotoxicosis — commonest reversible cause"),
                .init(name: "HbA1c / Fasting glucose", category: .blood, rationale: "Diabetes — independent AF risk factor"),
                .init(name: "Holter monitor / 7-day event recorder (if paroxysmal)", category: .other, rationale: "Document paroxysmal AF; quantify burden"),
            ],
            planTemplate: """
- CHA₂DS₂-VASc SCORE (stroke risk — guide anticoagulation):
  • ≥2 men / ≥3 women: DOAC strongly recommended
  • 1 (men) / 2 (women): DOAC recommended (consider)
  • 0 (men) / 1 (women): no anticoagulation needed
- ANTICOAGULATION (preferred DOAC over warfarin):
  • Apixaban 5 mg BD (dose-reduced 2.5 mg BD if ≥2 of: age ≥80, weight ≤60 kg, Cr ≥133)
  • Rivaroxaban 20 mg OD with evening meal
  • Dabigatran 150 mg BD (110 mg if >75 or renal impairment)
  • Warfarin: target INR 2–3 (if DOAC contraindicated)
  • ASSESS BLEEDING RISK: HAS-BLED score — treat modifiable bleeding risk factors
- RATE CONTROL (most patients — target HR <110 at rest):
  • Beta-blocker: bisoprolol 2.5–5 mg OD (titrate to <110 bpm)
  • Or digoxin 125–250 mcg OD (if contraindication to beta-blocker; elderly; HFrEF)
  • Or rate-limiting calcium blocker: diltiazem 60 mg TDS (if no HF)
- RHYTHM CONTROL (selected: younger, symptomatic, recent onset <12 months, HF):
  • Electrical cardioversion (DCCV) after 4+ weeks anticoagulation (or TOE to exclude LA thrombus)
  • Flecainide 100–150 mg BD (pill-in-pocket for PAF if no structural disease)
  • Amiodarone 200 mg TDS × 1/52 → 200 mg BD × 1/52 → 200 mg OD maintenance
  • AF ablation: pulmonary vein isolation — paroxysmal AF in symptomatic patients
""",
            billingCodes: [
                .init(icd10: "I48.91", icdDescription: "Unspecified atrial fibrillation", cpt: "92960", cptDescription: "Electrical cardioversion"),
            ],
            consentCategory: nil,
            urgencyNote: "Haemodynamically unstable AF (SBP <90, pulmonary oedema): immediate synchronised DCCV.",
            redFlags: ["Haemodynamic compromise → immediate DCCV", "AF + WPW (delta wave on ECG) → DO NOT use beta-blockers/digoxin/adenosine → amiodarone or procainamide"],
            followUp: "Cardiology at 4–6 weeks. INR check 1 week if warfarin. BP and rate control at 2 weeks. Annual: TFTs, U&E, LFTs if amiodarone.",
            guidelineReference: "ESC 2020; NICE NG196; AHA/ACC 2023"
        )),

        // ══════════════════════════════════════════════════════════════
        // HAEMATOLOGY — ANAEMIA
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["anaemia", "anemia", "iron deficiency anaemia", "iron deficiency", "low haemoglobin"], radiation: .init(
            conditionName: "Iron Deficiency Anaemia",
            icd10Primary: "D50.9",
            investigations: [
                .init(name: "FBC (MCV, MCH, MCHC, Hb)", category: .blood, rationale: "Microcytic hypochromic anaemia — classic IDA pattern"),
                .init(name: "Iron studies (Serum iron / TIBC / Transferrin saturation)", category: .blood, rationale: "Low ferritin (<15) + low saturation (<20%) = IDA"),
                .init(name: "Ferritin", category: .blood, rationale: "Most sensitive marker for iron stores (elevated as acute phase reactant in inflammation)"),
                .init(name: "Reticulocyte count", category: .blood, rationale: "Assess marrow response; reticulocytosis after treatment = good response"),
                .init(name: "Blood film", category: .blood, rationale: "Target cells, pencil cells, hypochromia — confirms IDA pattern"),
                .init(name: "OGD + Colonoscopy (if ≥50y or male any age)", category: .endoscopy, rationale: "GI blood loss — colorectal cancer / PU — MANDATORY investigation"),
                .init(name: "Faecal occult blood (FOB) / FIT", category: .other, rationale: "Screen for GI blood loss"),
                .init(name: "Coeliac screen (anti-tTG IgA + total IgA)", category: .blood, rationale: "Malabsorption — commonest cause in young women after menorrhagia"),
                .init(name: "Urine dipstick (haematuria)", category: .other, rationale: "Renal loss of iron in haemoglobinuria"),
            ],
            planTemplate: """
- TREAT THE CAUSE (mandatory — do not just replace iron without investigation):
  • GI blood loss: colonoscopy/OGD → treat underlying cause
  • Menorrhagia: gynaecology referral
  • Coeliac: gluten-free diet
- ORAL IRON REPLACEMENT (mild-moderate, tolerating orals):
  • Ferrous sulfate 200 mg TDS (65 mg elemental iron per tablet) — first-line
  • Take on empty stomach; ascorbic acid (vitamin C) 250 mg enhances absorption
  • Continue for 3 months after Hb normalises (to replete stores)
  • Side effects: constipation, black stools, nausea (switch to ferrous gluconate 300 mg TDS if poor tolerance)
- IV IRON (if oral not tolerated / malabsorption / pre-operative rapid repletion):
  • Ferric carboxymaltose (Ferinject): 1000 mg IV over 15 min (max 1g per visit)
  • Ferric derisomaltose (Monofer): up to 20 mg/kg (large single dose)
  • Monitor for hypersensitivity reactions (ANAPHYLAXIS RISK — have resuscitation available)
  • Hb response at 4 weeks: +20 g/L expected
- PRE-OPERATIVE ANAEMIA: target Hb ≥100 g/L; IV iron if surgery within 4 weeks
- BLOOD TRANSFUSION: threshold Hb <70 g/L (or <80 g/L in cardiac disease / symptomatic)
""",
            billingCodes: [
                .init(icd10: "D50.9", icdDescription: "Iron deficiency anaemia, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Hb <70 g/L + symptomatic or Hb <80 g/L + cardiac disease: consider blood transfusion.",
            redFlags: ["New IDA in men or post-menopausal women → MANDATORY GI investigation (bowel cancer until proven otherwise)", "Hb <60 g/L → consider inpatient transfusion"],
            followUp: "FBC at 4 weeks (confirm Hb rise ≥20 g/L). Ferritin at 3 months. Continue iron 3 months post-normalisation.",
            guidelineReference: "BSH 2021; NICE CG233; ESMO 2018 (perioperative anaemia)"
        )),

        // ══════════════════════════════════════════════════════════════
        // WOUND / SURGICAL SITE INFECTION
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["wound infection", "surgical site infection", "ssi", "wound dehiscence", "wound discharge", "mesh infection"], radiation: .init(
            conditionName: "Surgical Site Infection / Wound Complication",
            icd10Primary: "T81.40XA",
            investigations: [
                .init(name: "Wound swab (MC&S)", category: .other, rationale: "Identify organism + sensitivities — guide targeted antibiotics"),
                .init(name: "FBC / CRP / Blood cultures (if systemic)", category: .blood, rationale: "Systemic infection; bacteraemia if unwell"),
                .init(name: "Blood glucose / HbA1c", category: .blood, rationale: "Diabetes — major risk factor for SSI and impaired healing"),
                .init(name: "Albumin / Prealbumin", category: .blood, rationale: "Nutritional status — hypoalbuminaemia impairs wound healing"),
                .init(name: "X-ray / Ultrasound of wound", category: .imaging, rationale: "Gas in tissues (necrotising fasciitis); deep collection; mesh position"),
                .init(name: "CT scan (deep SSI / mesh infection)", category: .imaging, rationale: "Collection depth, extent; mesh integrity; fistula"),
                .init(name: "MRI (necrotising fasciitis suspected)", category: .imaging, rationale: "Best modality for soft tissue planes — NF requires emergency OT"),
            ],
            planTemplate: """
- SUPERFICIAL SSI (skin / subcutaneous):
  • Open wound (remove sutures / staples over infected area)
  • Irrigate with saline; pack with Aquacel or similar dressing
  • Oral antibiotics (culture-guided): flucloxacillin 500 mg QDS × 5–7 days (Staph)
    If MRSA risk or penicillin allergy: doxycycline 200 mg OD or clindamycin 300 mg QDS
  • Mark wound margin; photograph; reassess at 48h
- DEEP SSI (below fascia / organ/space):
  • CT abdomen/pelvis to identify collection
  • Radiological drainage (USS/CT-guided) where accessible
  • Surgical drainage + washout if not amenable to radiological drainage
  • IV antibiotics: tazobactam/piperacillin 4.5 g 8-hourly (broad spectrum)
- WOUND DEHISCENCE (burst abdomen):
  • Wet pack wound immediately; do NOT attempt primary closure in ward
  • Emergency OT: mass closure (looped nylon or PDS) with retention sutures
  • NBM + IV fluids
- MESH INFECTION:
  • CT first — assess extent; fistula
  • May require mesh removal (especially if chronic / biofilm)
  • Prolonged antibiotic course: culture-guided × 6+ weeks
- NECROTISING FASCIITIS (SURGICAL EMERGENCY):
  • Extreme pain out of proportion, crepitus, rapidly advancing → EMERGENCY OT
  • IV meropenem + vancomycin + clindamycin (toxin inhibition)
  • Radical surgical debridement — return to OT at 24h; daily until clean
  • ICU + plastic surgery involvement
""",
            billingCodes: [
                .init(icd10: "T81.40XA", icdDescription: "Infection following a procedure, initial encounter", cpt: "10180", cptDescription: "Incision and drainage of complex postoperative wound infection"),
                .init(icd10: "T81.31XA", icdDescription: "Disruption of wound, initial encounter", cpt: "13160", cptDescription: "Secondary closure of surgical wound"),
            ],
            consentCategory: "Wound Exploration / Debridement / Secondary Closure",
            urgencyNote: "Crepitus / pain out of proportion / rapidly spreading → necrotising fasciitis → EMERGENCY OT.",
            redFlags: ["Gas in tissues on imaging → NF → emergency OT within 1h", "Systemic sepsis from wound → IV antibiotics + drainage urgent"],
            followUp: "Wound review at 48h and 1 week. Dressing team. Vacuum-assisted closure (VAC) for large defects. Plastic surgery for complex reconstruction.",
            guidelineReference: "NICE NG141; IDSA 2014; WHO SSI Prevention 2018"
        )),

    ]

}
