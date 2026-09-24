// DiagnosisRadiationEngine+DiseaseDictionary3b.swift
// Medical disease dictionary — Rheumatology, Haematology, and remaining entries (part B).

import Foundation



extension DiagnosisRadiationEngine {

    static let _medicalEntries2B: [Entry] = [

        // ══════════════════════════════════════════════════════════════
        // MUSCULOSKELETAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["gout", "gouty arthritis", "hyperuricaemia"], radiation: .init(
            conditionName: "Gout / Gouty Arthritis",
            icd10Primary: "M10.9",
            investigations: [
                .init(name: "Serum uric acid", category: .blood, rationale: "Baseline — note: may be normal during acute attack"),
                .init(name: "FBC / CRP / ESR", category: .blood, rationale: "Inflammatory markers — severity and exclude septic arthritis"),
                .init(name: "U&E / Creatinine / eGFR", category: .blood, rationale: "Renal function — urate excretion + ULT drug choice"),
                .init(name: "Synovial fluid aspiration + polarised light microscopy", category: .other, rationale: "Gold standard — negatively birefringent monosodium urate crystals"),
                .init(name: "X-ray of affected joint", category: .imaging, rationale: "Chronic gout: punched-out erosions, tophi"),
                .init(name: "Fasting glucose / HbA1c + lipid profile", category: .blood, rationale: "Metabolic syndrome screen"),
            ],
            planTemplate: """
- ACUTE ATTACK:
  • NSAIDs: naproxen 500 mg BD or indomethacin 50 mg TDS × 5–7 days (if no contraindication)
  • Colchicine: 1 mg stat, then 0.5 mg 1h later (max 1.5 mg in first day)
  • Or prednisolone 30–40 mg OD × 5 days (if NSAIDs + colchicine contraindicated)
  • Joint rest + ice packs; elevate limb
  • Avoid aspirin (increases uric acid at low doses)
- DO NOT START urate-lowering therapy (ULT) during acute attack — wait 4–6 weeks
- URATE-LOWERING THERAPY (after acute attack, ≥2 attacks/year):
  • Allopurinol: start 50–100 mg OD, uptitrate monthly to target SUA <360 µmol/L (6 mg/dL)
  • Or febuxostat 80 mg OD (if allopurinol intolerant)
  • Cover initiation with colchicine 0.5 mg OD prophylaxis × 6 months
- LIFESTYLE: avoid purine-rich foods (offal, shellfish, red meat), alcohol (esp. beer)
  • Increase water intake >2 L/day; weight loss; avoid fructose
""",
            billingCodes: [
                .init(icd10: "M10.9", icdDescription: "Gout, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Cannot exclude septic arthritis → joint aspiration mandatory", "First MTP joint: classic podagra — treat empirically if typical presentation"],
            followUp: "Uric acid 6 weeks after starting allopurinol; monthly until target. Annual: U&E, uric acid.",
            guidelineReference: "ACR 2020; EULAR 2016; BSR 2017"
        )),

        Entry(keywords: ["sickle cell", "sickle cell disease", "sickle cell crisis", "vaso-occlusive crisis", "hbs"], radiation: .init(
            conditionName: "Sickle Cell Disease / Vaso-Occlusive Crisis",
            icd10Primary: "D57.1",
            investigations: [
                .init(name: "FBC + reticulocyte count", category: .blood, rationale: "Haemoglobin level — baseline and crisis depth"),
                .init(name: "Blood film + sickle screen", category: .blood, rationale: "Sickle cells, Howell-Jolly bodies"),
                .init(name: "Haemoglobin electrophoresis / HPLC", category: .blood, rationale: "HbS%, HbF, HbA2 — disease characterisation"),
                .init(name: "U&E / Creatinine / LFTs", category: .blood, rationale: "Organ function — sickle nephropathy / hepatopathy"),
                .init(name: "Blood cultures (if febrile)", category: .blood, rationale: "Infection — functionally asplenic"),
                .init(name: "Chest X-ray (if chest symptoms)", category: .imaging, rationale: "Acute chest syndrome — pulmonary infiltrate"),
                .init(name: "Urine MC&S", category: .other, rationale: "UTI — common in SCD"),
                .init(name: "Group and Screen", category: .blood, rationale: "Extended phenotype — pre-transfusion"),
            ],
            planTemplate: """
- ACUTE VOC MANAGEMENT:
  • Pain: WHO ladder — paracetamol → NSAIDs → weak opioid → IV/SC morphine (0.1 mg/kg)
  • Patient-controlled analgesia (PCA) for severe pain
  • IV fluids (mild dehydration: 0.9% NaCl 1–1.5× maintenance)
  • O₂ only if SaO₂ <95% (avoid hyperoxia — worsens sickling)
  • Incentive spirometry — prevent acute chest syndrome
  • DVT prophylaxis: LMWH if admitted
- FEBRILE / ACUTE CHEST SYNDROME:
  • Empirical antibiotics: ceftriaxone 2 g IV OD + azithromycin (atypicals)
  • Transfusion: exchange transfusion if HbS >70% and critical
- CHRONIC MANAGEMENT:
  • Hydroxyurea: increases HbF — reduces crises (haematology referral)
  • Folic acid 5 mg OD — ongoing
  • Penicillin prophylaxis (if functionally asplenic): phenoxymethylpenicillin 250 mg BD
  • Vaccinations: pneumococcal, meningococcal, Hib, influenza — mandatory
""",
            billingCodes: [
                .init(icd10: "D57.1", icdDescription: "Sickle cell disease without crisis", cpt: nil, cptDescription: "Medical management"),
                .init(icd10: "D57.00", icdDescription: "Sickle cell disease with unspecified crisis", cpt: nil, cptDescription: "Acute crisis management"),
            ],
            consentCategory: nil,
            urgencyNote: "Acute chest syndrome: ADMIT + IV antibiotics + O₂ + urgent haematology.",
            redFlags: ["Acute chest syndrome → ICU consider", "Stroke → exchange transfusion + neurology", "Splenic sequestration → transfuse"],
            followUp: "Haematology review every 3–6 months. Annual: echo, renal function, retinal exam, DEXA.",
            guidelineReference: "BSH 2021; NHLBI 2014"
        )),

        // ══════════════════════════════════════════════════════════════
        // INFLAMMATORY BOWEL DISEASE
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["inflammatory bowel disease", "ulcerative colitis", "crohn's disease", "crohn disease"], radiation: .init(
            conditionName: "Inflammatory Bowel Disease",
            icd10Primary: "K51.90",
            investigations: [
                .init(name: "FBC / CRP / ESR / Ferritin", category: .blood, rationale: "Inflammation + iron deficiency anaemia"),
                .init(name: "Faecal calprotectin", category: .other, rationale: "Distinguishes IBD from IBS; disease activity monitoring"),
                .init(name: "Stool MC&S + CDiff toxin", category: .other, rationale: "Exclude infective colitis and superinfection"),
                .init(name: "Colonoscopy + biopsy", category: .endoscopy, rationale: "Gold standard diagnosis — extent and pattern"),
                .init(name: "MRI small bowel", category: .imaging, rationale: "Crohn's — assess small bowel extent and fistulae"),
                .init(name: "Vitamin B12 / Folate / Iron / Zinc", category: .blood, rationale: "Nutritional deficiencies — especially Crohn's"),
                .init(name: "U&E / LFTs / Albumin", category: .blood, rationale: "Nutritional status and PSC screen"),
                .init(name: "TPMT / NUDT15 genotype (pre-azathioprine)", category: .blood, rationale: "Myelosuppression risk with thiopurines"),
            ],
            planTemplate: """
- ACUTE SEVERE COLITIS (Truelove & Witts criteria — >6 stools/day + systemic features): ADMIT
  • IV hydrocortisone 100 mg 6-hourly × 3 days
  • IV fluids + electrolyte replacement
  • Thromboprophylaxis (LMWH)
  • CT abdomen (exclude toxic megacolon)
  • GI/surgery review — rescue therapy vs colectomy at day 3
  • Rescue: IV ciclosporin or infliximab (day 3 decision)
- MILD-MODERATE COLITIS:
  • 5-ASA: mesalazine 2.4–4.8 g/day PO + mesalazine enemas / foam
  • Oral prednisolone 40 mg OD tapering (5 mg/week)
- MAINTENANCE:
  • 5-ASA long-term; azathioprine 2–2.5 mg/kg/day; biological (infliximab, adalimumab)
  • IBD nurse support; diet: low-residue in flare
- CROHN'S specific:
  • Budesonide 9 mg OD for ileocaecal disease
  • Elemental nutrition as induction
  • Anti-TNF early if steroid-dependent or fistulising
""",
            billingCodes: [
                .init(icd10: "K51.90", icdDescription: "Ulcerative colitis, unspecified", cpt: "44388", cptDescription: "Colonoscopy with biopsy"),
            ],
            consentCategory: nil,
            urgencyNote: "Acute severe colitis (>6 bloody stools/day + fever/tachycardia): ADMIT urgently.",
            redFlags: ["Toxic megacolon → emergency colectomy", "Perforation → emergency OT", "Haemorrhage → transfuse + GI"],
            followUp: "GI review 4–6 weeks. Colonoscopy surveillance after 8–10 years (CRC risk). Annual FBC/CRP.",
            guidelineReference: "ECCO 2022; NICE NG130; ACG 2019"
        )),

        // ══════════════════════════════════════════════════════════════
        // VASCULAR SURGICAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["mesenteric ischaemia", "mesenteric ischemia", "acute mesenteric", "bowel ischaemia"], radiation: .init(
            conditionName: "Acute Mesenteric Ischaemia",
            icd10Primary: "K55.0",
            investigations: [
                .init(name: "CT Mesenteric Angiography (CT-MA)", category: .imaging, rationale: "Definitive — identifies embolus/thrombosis, extent, bowel viability"),
                .init(name: "Lactate (serum)", category: .blood, rationale: "Raised lactate >2 → bowel ischaemia; >4 → poor prognosis"),
                .init(name: "FBC / U&E / LFTs / Coagulation", category: .blood, rationale: "Leucocytosis, AKI, coagulopathy"),
                .init(name: "ABG / Metabolic screen", category: .blood, rationale: "Metabolic acidosis — severe ischaemia"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Elevated in ischaemia; exclude pancreatitis"),
                .init(name: "ECG", category: .other, rationale: "Atrial fibrillation — most common embolic source"),
                .init(name: "Echocardiogram", category: .imaging, rationale: "Cardiac thrombus — embolic source"),
            ],
            planTemplate: """
- EMERGENCY SURGICAL REFERRAL — DO NOT DELAY
- Resuscitate: IV fluids (crystalloid), O₂, Foley catheter
- IV heparin anticoagulation (if embolic — after surgical review)
- NBM immediately
- SURGICAL OPTIONS (based on CT findings):
  • Embolectomy / thrombectomy: viable bowel + short ischaemia time
  • Resection of non-viable bowel + second-look laparotomy at 24–48h
  • Endovascular: catheter-directed thrombolysis for SMA thrombosis (selected cases)
- NON-OCCLUSIVE (NOMI): vasodilators (papaverine infusion) + treat underlying cause
- Post-op: heparin → warfarin/DOAC for AF-related embolism
- Broad-spectrum antibiotics (bowel flora): tazobactam/piperacillin or meropenem
- ICU/HDU monitoring post-operatively
""",
            billingCodes: [
                .init(icd10: "K55.0", icdDescription: "Acute vascular disorders of intestine", cpt: "44005", cptDescription: "Enterolysis (freeing of intestinal adhesion)"),
                .init(icd10: "K55.0", icdDescription: "Acute mesenteric ischaemia", cpt: "34151", cptDescription: "Embolectomy/thrombectomy, mesenteric artery"),
            ],
            consentCategory: "Emergency Laparotomy / Mesenteric Revascularisation",
            urgencyNote: "SURGICAL EMERGENCY — mortality >50% with delay. Immediate CT angiography + surgical review.",
            redFlags: ["Peritonism → immediate OT — no further delay", "Lactate >4 → resuscitate + emergency OT", "AF source → anticoagulate after surgical haemostasis"],
            followUp: "Anticoagulation review 6 weeks. Dietitian input (short bowel risk). Stoma follow-up if applicable.",
            guidelineReference: "ESVS 2017; ESTES 2016; BSG 2019"
        )),

        Entry(keywords: ["abdominal aortic aneurysm", "aaa", "aortic aneurysm", "ruptured aaa", "ruptured aneurysm"], radiation: .init(
            conditionName: "Abdominal Aortic Aneurysm",
            icd10Primary: "I71.4",
            investigations: [
                .init(name: "CT Aorta with contrast (CTA)", category: .imaging, rationale: "Defines size, morphology, extent — essential pre-operatively"),
                .init(name: "Abdominal Ultrasound (USS)", category: .imaging, rationale: "Screening and surveillance — size monitoring"),
                .init(name: "FBC / U&E / Creatinine / Coagulation", category: .blood, rationale: "Pre-operative assessment"),
                .init(name: "Group and Crossmatch (×6 units)", category: .blood, rationale: "For repair — ruptured AAA: emergency XM"),
                .init(name: "ECG / Troponin / Echo", category: .other, rationale: "Cardiac risk stratification pre-elective repair"),
                .init(name: "Lung Function / PFTs", category: .other, rationale: "Pre-operative respiratory assessment"),
                .init(name: "eGFR / Creatinine", category: .blood, rationale: "Renal function — EVAR contrast load; post-repair AKI risk"),
            ],
            planTemplate: """
- RUPTURED AAA (haemodynamically unstable): EMERGENCY OT
  • Permissive hypotension: target SBP 80–90 mmHg until aortic control
  • Massive transfusion protocol: 1:1:1 (PRBC:FFP:Plt)
  • EVAR preferred if anatomy allows — faster, lower mortality in experienced centres
  • Open repair (aorto-aortic / aorto-bi-iliac graft) if EVAR unsuitable
- ELECTIVE REPAIR (AAA ≥5.5 cm in men; ≥5.0 cm in women, or growth >1 cm/year):
  • EVAR (endovascular): preferred if suitable anatomy
  • Open repair: fit patients with unsuitable anatomy
- SURVEILLANCE (below repair threshold):
  • <4.5 cm: USS every 2 years; 4.5–5.4 cm: USS every 3–6 months
  • Control vascular risk: smoking cessation + statin + antihypertensive + aspirin
- EVAR post-op: CT at 1 month, 12 months, then annually (endoleak surveillance)
""",
            billingCodes: [
                .init(icd10: "I71.4", icdDescription: "Abdominal aortic aneurysm, without rupture", cpt: "34802", cptDescription: "EVAR, aorto-aortic"),
                .init(icd10: "I71.3", icdDescription: "Ruptured abdominal aortic aneurysm", cpt: "35102", cptDescription: "Open repair, ruptured AAA"),
            ],
            consentCategory: "Aortic Aneurysm Repair (EVAR / Open)",
            urgencyNote: "Ruptured AAA: highest surgical emergency — mortality 50% even with operative repair. Activate major haemorrhage protocol.",
            redFlags: ["Haemodynamic instability + back/abdominal pain → ruptured AAA → emergency OT", "AAA >5.5 cm → elective repair planning"],
            followUp: "Post-EVAR: CT at 1, 12 months then annually. Open repair: USS 5 years. Duplex for graft surveillance.",
            guidelineReference: "ESVS 2019; NICE NG156; SVS 2018"
        )),

        Entry(keywords: ["peripheral arterial disease", "pad", "peripheral vascular disease", "intermittent claudication", "critical limb ischaemia", "pvd"], radiation: .init(
            conditionName: "Peripheral Arterial Disease",
            icd10Primary: "I70.209",
            investigations: [
                .init(name: "ABPI (Ankle Brachial Pressure Index)", category: .other, rationale: "Diagnostic: <0.9 PAD; <0.5 critical ischaemia"),
                .init(name: "Duplex Arterial Ultrasound (lower limb)", category: .imaging, rationale: "Localise lesions — stenosis / occlusion pattern"),
                .init(name: "CT Angiography (CTA) lower limb", category: .imaging, rationale: "Pre-intervention anatomy — extent of disease"),
                .init(name: "Fasting glucose / HbA1c", category: .blood, rationale: "Diabetes — major modifiable risk factor"),
                .init(name: "Lipid profile", category: .blood, rationale: "Statin indication — very high cardiovascular risk"),
                .init(name: "FBC / Creatinine / eGFR", category: .blood, rationale: "Anaemia + renal function (contrast planning)"),
                .init(name: "ECG / Cardiology review", category: .other, rationale: "Concurrent coronary artery disease — very common"),
            ],
            planTemplate: """
- RISK FACTOR MODIFICATION (all patients):
  • Smoking cessation — most important intervention
  • Statin: atorvastatin 40–80 mg OD (target LDL <1.8 mmol/L)
  • Antiplatelet: aspirin 75 mg OD or clopidogrel 75 mg OD
  • Blood pressure control: ACE inhibitor + amlodipine (RAMPART evidence)
  • Diabetes optimisation: HbA1c <53 mmol/mol
- SUPERVISED EXERCISE PROGRAMME (claudication — first-line):
  • 3× per week for ≥12 weeks — proven to improve walking distance
- CILOSTAZOL 100 mg BD (claudication — if exercise programme insufficient):
  • Phosphodiesterase inhibitor — improves symptoms; contraindicated in HF
- REVASCULARISATION (critical limb ischaemia or lifestyle-limiting claudication):
  • Angioplasty ± stenting (endovascular — first choice aorto-iliac/fem-pop)
  • Bypass grafting (fem-pop, fem-distal — autologous vein preferred)
- CRITICAL LIMB ISCHAEMIA: urgent vascular surgical referral; LMWH; wound care
""",
            billingCodes: [
                .init(icd10: "I70.209", icdDescription: "Peripheral arterial disease, lower extremity", cpt: "35556", cptDescription: "Femoro-popliteal bypass graft"),
                .init(icd10: "I70.209", icdDescription: "PAD", cpt: "37221", cptDescription: "Iliac angioplasty with stent"),
            ],
            consentCategory: "Peripheral Vascular Reconstruction",
            urgencyNote: "Critical limb ischaemia (rest pain / ulcer / gangrene): urgent vascular referral — limb-threatening.",
            redFlags: ["Acute limb ischaemia (6 Ps: Pain, Pallor, Pulseless, Paraesthesia, Paralysis, Perishingly cold) → emergency OT"],
            followUp: "Duplex graft surveillance at 6 weeks, 6 months, then annually. Wound clinic for ulcers.",
            guidelineReference: "ESVS 2017; NICE NG19; AHA/ACC 2016"
        )),

        Entry(keywords: ["aortic dissection", "type a dissection", "type b dissection", "stanford a", "stanford b"], radiation: .init(
            conditionName: "Aortic Dissection",
            icd10Primary: "I71.00",
            investigations: [
                .init(name: "CT Aorta (ECG-gated CTA chest/abdomen/pelvis)", category: .imaging, rationale: "Diagnostic — Stanford type, extent, branch involvement"),
                .init(name: "CXR (widened mediastinum)", category: .imaging, rationale: "Rapid screening — abnormal in 60%"),
                .init(name: "ECG", category: .other, rationale: "Rule out ACS; inferior ST changes if RCA compromised"),
                .init(name: "FBC / U&E / Creatinine / LFTs / Lactate", category: .blood, rationale: "Organ malperfusion"),
                .init(name: "Troponin", category: .blood, rationale: "ACS exclusion / myocardial involvement"),
                .init(name: "D-dimer", category: .blood, rationale: "Elevation supports diagnosis (not diagnostic alone)"),
                .init(name: "Group and Crossmatch", category: .blood, rationale: "Type A: pre-operative requirement"),
            ],
            planTemplate: """
- STANFORD TYPE A (ascending aorta involved): EMERGENCY CARDIAC SURGERY
  • Emergency cardiothoracic referral
  • HR and BP control: IV labetalol or esmolol (target HR <60, SBP 100–120)
  • Analgesia: IV morphine
- STANFORD TYPE B (descending only, uncomplicated):
  • Medical management: IV beta-blocker + vasodilator (nicardipine)
  • Target SBP 100–120 mmHg; HR <60
  • Monitor for malperfusion (renal, limb, bowel)
- TYPE B COMPLICATED (malperfusion / rupture / expansion):
  • TEVAR (Thoracic EVAR) — preferred endovascular approach
- ICU/HDU monitoring mandatory
- Regular neurological assessment (spinal cord ischaemia)
- Anticoagulation: avoid in Type A pre-op; cautious in Type B
""",
            billingCodes: [
                .init(icd10: "I71.01", icdDescription: "Dissection of thoracoabdominal aorta", cpt: "33860", cptDescription: "Ascending aorta repair, Type A dissection"),
            ],
            consentCategory: "Emergency Aortic Surgery / TEVAR",
            urgencyNote: "Type A dissection: immediate cardiothoracic transfer — mortality 1–2% per hour untreated.",
            redFlags: ["Haemopericardium → tamponade", "Aortic regurgitation", "Coronary malperfusion → MI", "Neurological deficit → spinal cord ischaemia"],
            followUp: "CT surveillance at 1, 6, 12 months, then annually. Lifelong antihypertensive therapy.",
            guidelineReference: "ESC 2014; ESVS 2017; STS 2015"
        )),

        // ══════════════════════════════════════════════════════════════

    ]

}
