// ConsultationViewSpecialtyForms.swift
// Early form data for GI, Cardiovascular, Respiratory, Endocrine, Urology,
// Musculoskeletal, Infectious, Haematology, Gynaecology, Paediatrics,
// Dermatology, Psychiatry, and Internal Medicine specialties.

import SwiftUI
import SwiftData

// MARK: - General & GI Surgery — additional forms

let surgJaundiceEarlyForm: [EFGroup] = [
    EFGroup(question: "Jaundice type (single select)", icon: "sun.max.fill", chips: [
        EFChip(label: "Obstructive — dark urine, pale stools", dimId: "character",    value: "Obstructive", multiSelect: false),
        EFChip(label: "Haemolytic — known haemolytic condition", dimId: "pmh",        value: "sickle",      multiSelect: false),
        EFChip(label: "Hepatocellular — alcohol / hepatitis",    dimId: "pmh",        value: "cirrhosis",   multiSelect: false),
    ]),
    EFGroup(question: "Key discriminators", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Known gallstones",             dimId: "pmh",          value: "gallstone"),
        EFChip(label: "Fever + rigors (cholangitis)", dimId: "associations", value: "Rigors"),
        EFChip(label: "Progressive (pancreatic Ca?)", dimId: "timing",       value: "Progressive"),
        EFChip(label: "Weight loss",                  dimId: "associations", value: "Weight loss"),
        EFChip(label: "Painless (Courvoisier's sign)", dimId: "character",   value: "Painless"),
    ]),
]

let surgDysphagiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Dysphagia pattern (single select)", icon: "mouth.fill", chips: [
        EFChip(label: "Solids only → progressive (Ca / stricture)", dimId: "character",    value: "Progressive solids", multiSelect: false),
        EFChip(label: "Solids AND liquids (achalasia)",              dimId: "dysphagia_type", value: "solids_and_liquids", multiSelect: false),
        EFChip(label: "Intermittent with regurgitation (pouch)",     dimId: "regurgitation",  value: "undigested_food_hours_later", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Weight loss (alarm)",         dimId: "weight_loss",  value: "significant"),
        EFChip(label: "Heartburn history (GERD)",    dimId: "pmh",          value: "gerd"),
        EFChip(label: "Hoarse voice (recurrent laryngeal nerve)", dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "Regurgitation of undigested food",         dimId: "regurgitation", value: "undigested_food"),
        EFChip(label: "Gurgling sensation in neck (Zenker's)",    dimId: "gurgling_neck",  value: "present"),
    ]),
]

let surgNeckLumpEarlyForm: [EFGroup] = [
    EFGroup(question: "Lump character (single select)", icon: "person.bust.fill", chips: [
        EFChip(label: "Moves with swallowing (thyroid)",  dimId: "exam",      value: "moves with swallowing", multiSelect: false),
        EFChip(label: "Tender + recent infection (reactive)", dimId: "character", value: "Tender",            multiSelect: false),
        EFChip(label: "Rubbery / non-tender (lymphoma)",  dimId: "character", value: "Rubbery",               multiSelect: false),
        EFChip(label: "Hard / fixed (metastatic)",        dimId: "character", value: "Hard",                  multiSelect: false),
        EFChip(label: "Anterior sternomastoid (branchial cyst)", dimId: "location", value: "anterior_sternomastoid_upper_third", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Night sweats / weight loss",  dimId: "associations", value: "Night sweats"),
        EFChip(label: "Hoarse voice",                dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "Age > 50",                    dimId: "age_over",     value: "50"),
    ]),
]

let surgBreastLumpEarlyForm: [EFGroup] = [
    EFGroup(question: "Lump character (single select)", icon: "circle.circle.fill", chips: [
        EFChip(label: "Hard / fixed (Ca)",                dimId: "character", value: "Hard",         multiSelect: false),
        EFChip(label: "Smooth / mobile (fibroadenoma)",   dimId: "character", value: "Smooth mobile", multiSelect: false),
        EFChip(label: "Soft / fluctuant (cyst / abscess)", dimId: "character", value: "Soft fluctuant", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Skin dimpling (Ca)",             dimId: "associations", value: "Skin dimpling"),
        EFChip(label: "Axillary lymphadenopathy (Ca)",  dimId: "associations", value: "Axillary lymphadenopathy"),
        EFChip(label: "Tender + breastfeeding (mastitis)", dimId: "pmh",       value: "breastfeeding"),
        EFChip(label: "Skin tethering",                 dimId: "associations", value: "Skin tethering"),
        EFChip(label: "Age < 35 (fibroadenoma common)", dimId: "age_under",    value: "35"),
    ]),
]

let surgPerianaleEarlyForm: [EFGroup] = [
    EFGroup(question: "Main symptom (single select)", icon: "figure.walk.fill", chips: [
        EFChip(label: "Bright red bleeding on paper (haemorrhoids)", dimId: "associations", value: "Bright red rectal bleeding", multiSelect: false),
        EFChip(label: "Severe tearing pain on defaecation (fissure)", dimId: "character",   value: "Tearing",                   multiSelect: false),
        EFChip(label: "Throbbing constant pain (abscess)",            dimId: "character",   value: "Throbbing",                 multiSelect: false),
        EFChip(label: "Recurrent discharge / track (fistula)",        dimId: "associations", value: "Recurrent discharge",       multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle", chips: [
        EFChip(label: "Post-defaecation spasm",        dimId: "associations", value: "Sphincter spasm"),
        EFChip(label: "Protrusion / prolapse",         dimId: "associations", value: "Protrusion"),
        EFChip(label: "Pruritus ani",                  dimId: "associations", value: "Pruritus ani"),
        EFChip(label: "Fluctuant perianal swelling",   dimId: "exam",         value: "fluctuant swelling"),
        EFChip(label: "Known Crohn's disease",         dimId: "pmh",          value: "crohn"),
    ]),
]

let surgAcuteLimbEarlyForm: [EFGroup] = [
    EFGroup(question: "Six Ps — acute ischaemia features", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Pain — sudden onset",          dimId: "onset",        value: "Sudden"),
        EFChip(label: "Pallor",                       dimId: "associations", value: "Pallor"),
        EFChip(label: "Pulselessness",                dimId: "associations", value: "Pulselessness"),
        EFChip(label: "Paralysis (motor loss)",       dimId: "associations", value: "Paralysis"),
        EFChip(label: "Bilateral legs (aortoiliac)",  dimId: "site",         value: "Bilateral legs"),
    ]),
    EFGroup(question: "Aetiology clues", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Known AF (embolism)",          dimId: "pmh", value: "atrial fibrillation"),
        EFChip(label: "Known PAD / claudication",     dimId: "pmh", value: "peripheral arterial disease"),
        EFChip(label: "Popliteal mass (aneurysm)",    dimId: "exam", value: "popliteal mass"),
        EFChip(label: "Absent femoral pulses",        dimId: "exam", value: "absent femoral pulses"),
    ]),
]

let surgWoundEarlyForm: [EFGroup] = [
    EFGroup(question: "Wound problem type (single select)", icon: "bandage.fill", chips: [
        EFChip(label: "Wound opening / dehiscence",  dimId: "associations", value: "Wound opening",    multiSelect: false),
        EFChip(label: "Wound redness + discharge (SSI)", dimId: "associations", value: "Wound discharge", multiSelect: false),
        EFChip(label: "Fluctuant swelling (seroma / abscess)", dimId: "associations", value: "Fluctuant swelling", multiSelect: false),
        EFChip(label: "Pink fluid leakage (burst abdomen)", dimId: "associations", value: "Pink fluid leakage",    multiSelect: false),
    ]),
    EFGroup(question: "Severity indicators", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Fever",               dimId: "associations", value: "Fever"),
        EFChip(label: "Deep wound pain",     dimId: "associations", value: "Deep wound pain"),
        EFChip(label: "Wound dehiscence",    dimId: "associations", value: "Wound dehiscence"),
        EFChip(label: "Crepitus (gas — NF?)", dimId: "exam",        value: "crepitus"),
    ]),
]

// MARK: - Cardiovascular early forms

let cardioHeartFailureEarlyForm: [EFGroup] = [
    EFGroup(question: "Predominant symptom pattern (single select)", icon: "heart.slash.fill", chips: [
        EFChip(label: "Orthopnoea / PND (HFrEF)",    dimId: "character",    value: "Orthopnoea",   multiSelect: false),
        EFChip(label: "Exertional dyspnoea",          dimId: "exacerbating", value: "Exertion",     multiSelect: false),
        EFChip(label: "Leg oedema",                   dimId: "associations", value: "Leg swelling", multiSelect: false),
    ]),
    EFGroup(question: "Key features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Known heart failure",         dimId: "pmh",   value: "heart failure"),
        EFChip(label: "S3 gallop on exam",           dimId: "exam",  value: "s3 gallop"),
        EFChip(label: "Palpable pulsatile liver (tamponade?)", dimId: "becks_triad", value: "jvp_muffled_hypotension"),
        EFChip(label: "Shortness of breath",         dimId: "associations", value: "Shortness of breath"),
    ]),
]

let cardioStrokeTIAEarlyForm: [EFGroup] = [
    EFGroup(question: "Deficit pattern (single select)", icon: "brain.head.profile.fill", chips: [
        EFChip(label: "Unilateral face/arm/leg weakness", dimId: "face_arm_leg",   value: "unilateral_weakness",      multiSelect: false),
        EFChip(label: "Sudden focal deficit (ischaemic)", dimId: "sudden_onset",   value: "focal_neurological_deficit", multiSelect: false),
        EFChip(label: "Thunderclap headache at onset (haemorrhagic)", dimId: "headache", value: "thunderclap_at_onset", multiSelect: false),
        EFChip(label: "Complete resolution < 24 h (TIA)", dimId: "focal_deficit", value: "complete_resolution_24h",  multiSelect: false),
    ]),
    EFGroup(question: "Risk markers", icon: "staroflife.circle", chips: [
        EFChip(label: "BP > 180 (PRES / hypertensive)", dimId: "BP",           value: "severely_elevated_above_180"),
        EFChip(label: "Known TIA / prior stroke",       dimId: "pmh",          value: "tia"),
        EFChip(label: "Known carotid stenosis",         dimId: "carotid_stenosis", value: "ipsilateral_significant"),
        EFChip(label: "Prior migraine (vestibular migraine ddx)", dimId: "prior_migraine_history", value: "present"),
    ]),
]

let cardioDVTPEEarlyForm: [EFGroup] = [
    EFGroup(question: "Presentation (single select)", icon: "arrow.down.to.line.circle.fill", chips: [
        EFChip(label: "Leg swelling / DVT",          dimId: "associations", value: "Swelling",             multiSelect: false),
        EFChip(label: "Sudden SOB / pleuritic pain (PE)", dimId: "onset", value: "Sudden",                  multiSelect: false),
        EFChip(label: "Superficial cord (thrombophlebitis)", dimId: "palpable_cord", value: "superficial_vein", multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Previous DVT / PE",          dimId: "pmh",          value: "dvt"),
        EFChip(label: "Known malignancy",           dimId: "pmh",          value: "malignancy"),
        EFChip(label: "Shortness of breath",        dimId: "associations", value: "Shortness of breath"),
        EFChip(label: "Long bone fracture / surgery (fat embolism)", dimId: "preceding_event", value: "long_bone_fracture_or_arthroplasty"),
        EFChip(label: "Petechiae (axilla / conjunctiva)", dimId: "petechiae", value: "axilla_conjunctiva"),
    ]),
]

let cardioHypertensionEarlyForm: [EFGroup] = [
    EFGroup(question: "BP reading context (single select)", icon: "waveform.path.ecg.rectangle.fill", chips: [
        EFChip(label: "BP > 180/120 — possible urgency/emergency", dimId: "BP",             value: "above_180_120", multiSelect: false),
        EFChip(label: "Resistant hypertension (≥3 drugs)",         dimId: "associations",   value: "Resistant hypertension", multiSelect: false),
        EFChip(label: "Normal home BP — white coat suspected",      dimId: "home_BP",        value: "below_135_85", multiSelect: false),
    ]),
    EFGroup(question: "Secondary cause flags", icon: "staroflife.circle.fill", chips: [
        EFChip(label: "Hypokalaemia (Conn's syndrome)",        dimId: "associations", value: "Hypokalaemia"),
        EFChip(label: "ACEi worsens renal function (renovascular)", dimId: "associations", value: "ACE inhibitor worsens renal function"),
        EFChip(label: "Papilloedema / encephalopathy (emergency)", dimId: "end_organ_damage", value: "papilloedema_encephalopathy_AKI"),
    ]),
]

// MARK: - Respiratory early forms

let respCoughEarlyForm: [EFGroup] = [
    EFGroup(question: "Key discriminating feature (single select)", icon: "waveform.path.fill", chips: [
        EFChip(label: "Resolves on stopping ACEi",     dimId: "relieving",  value: "Stop ACEi",      multiSelect: false),
        EFChip(label: "Wheeze — known asthma",         dimId: "pmh",        value: "asthma",         multiSelect: false),
        EFChip(label: "Post-nasal drip sensation",     dimId: "character",  value: "Drip sensation", multiSelect: false),
        EFChip(label: "Worse lying (GERD cough)",      dimId: "timing",     value: "Worse lying",    multiSelect: false),
        EFChip(label: "Haemoptysis",                   dimId: "associations", value: "Haemoptysis",  multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Night sweats (TB?)",            dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",                   dimId: "associations", value: "Weight loss"),
        EFChip(label: "Smoker (COPD / Ca)",            dimId: "social",       value: "smok"),
        EFChip(label: "Breathlessness",                dimId: "associations", value: "Breathlessness"),
        EFChip(label: "Relieved by bronchodilator (asthma)", dimId: "relieving", value: "Bronchodilator"),
    ]),
]

let respSOBEarlyForm: [EFGroup] = [
    EFGroup(question: "Most likely pattern (single select)", icon: "lungs.fill", chips: [
        EFChip(label: "Wheeze — asthma / COPD",      dimId: "character",  value: "Wheeze",          multiSelect: false),
        EFChip(label: "Known COPD exacerbation",     dimId: "pmh",        value: "copd",            multiSelect: false),
        EFChip(label: "Sudden onset (pneumothorax)", dimId: "onset",      value: "Sudden",          multiSelect: false),
        EFChip(label: "Heart failure features",      dimId: "pmh",        value: "heart failure",   multiSelect: false),
        EFChip(label: "Consolidation signs (pneumonia)", dimId: "exam",   value: "consolidation",   multiSelect: false),
    ]),
    EFGroup(question: "Red flag features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haemoptysis",           dimId: "associations", value: "Haemoptysis"),
        EFChip(label: "Night sweats (TB)",     dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",           dimId: "associations", value: "Weight loss"),
        EFChip(label: "Reduced breath sounds", dimId: "exam",         value: "reduced breath sounds"),
        EFChip(label: "Hyperresonance (PTX)",  dimId: "exam",         value: "hyperresonance"),
    ]),
]

// MARK: - Endocrine & Metabolic early forms

let endoDiabetesEarlyForm: [EFGroup] = [
    EFGroup(question: "Review focus (single select)", icon: "cross.case.fill", chips: [
        EFChip(label: "HbA1c > 48 — new or poorly controlled", dimId: "HbA1c",          value: "above_48",  multiSelect: false),
        EFChip(label: "HbA1c 39–47 — pre-diabetes",            dimId: "HbA1c",          value: "39_to_47",  multiSelect: false),
        EFChip(label: "HbA1c > 9% — poor control",             dimId: "HbA1c",          value: "above_9",   multiSelect: false),
    ]),
    EFGroup(question: "Complications screen", icon: "list.bullet.clipboard.fill", chips: [
        EFChip(label: "Foot ulcer",                   dimId: "associations", value: "Foot ulcer"),
        EFChip(label: "Peripheral neuropathy",        dimId: "associations", value: "Peripheral neuropathy"),
        EFChip(label: "Proteinuria (nephropathy)",    dimId: "associations", value: "Proteinuria"),
        EFChip(label: "eGFR low (nephropathy)",       dimId: "inv",          value: "eGFR low"),
        EFChip(label: "Long-standing diabetes",       dimId: "pmh",          value: "long standing diabetes"),
    ]),
]

let endoThyroidEarlyForm: [EFGroup] = [
    EFGroup(question: "Functional state (single select)", icon: "staroflife.fill", chips: [
        EFChip(label: "TSH elevated — hypothyroid",   dimId: "inv", value: "tsh elevated",   multiSelect: false),
        EFChip(label: "TSH suppressed — hyperthyroid", dimId: "inv", value: "tsh suppressed", multiSelect: false),
        EFChip(label: "FNAC malignant — carcinoma",   dimId: "inv", value: "fnac malignant",  multiSelect: false),
    ]),
    EFGroup(question: "Examination / investigation features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Exophthalmos (Graves')",        dimId: "associations", value: "Exophthalmos"),
        EFChip(label: "Hard thyroid nodule",           dimId: "exam",         value: "hard nodule"),
        EFChip(label: "Hoarse voice (Ca / nerve)",     dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "TPO antibody positive (Hashimoto's)", dimId: "inv",    value: "tpo antibody"),
        EFChip(label: "Neck pain + raised ESR (De Quervain's)", dimId: "associations", value: "Neck pain"),
    ]),
]

let endoAdrenalEarlyForm: [EFGroup] = [
    EFGroup(question: "Clinical syndrome (single select)", icon: "bolt.circle.fill", chips: [
        EFChip(label: "Resistant HTN + hypokalaemia (Conn's)", dimId: "associations", value: "Hypokalaemia",       multiSelect: false),
        EFChip(label: "Hypertensive crisis (phaeochromocytoma)", dimId: "associations", value: "Hypertensive crisis", multiSelect: false),
        EFChip(label: "Striae + bruising + obesity (Cushing's)", dimId: "associations", value: "Striae",            multiSelect: false),
        EFChip(label: "Incidental adrenal mass",               dimId: "imaging_finding", value: "incidental_adrenal_mass", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "MEN2 history (phaeochromocytoma risk)", dimId: "pmh",          value: "men2"),
        EFChip(label: "Steroid use history (Cushing's)",       dimId: "associations", value: "Steroid use"),
        EFChip(label: "Resistant hypertension",                dimId: "associations", value: "Resistant hypertension"),
    ]),
]

// MARK: - Urology & Renal early forms

let uroUrinaryEarlyForm: [EFGroup] = [
    EFGroup(question: "Urinary symptom pattern (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Dysuria + frequency (UTI)",           dimId: "associations", value: "Dysuria",             multiSelect: false),
        EFChip(label: "Loin pain + fever (pyelonephritis)",  dimId: "associations", value: "Loin pain",           multiSelect: false),
        EFChip(label: "Painless haematuria (bladder Ca?)",   dimId: "associations", value: "Painless haematuria", multiSelect: false),
        EFChip(label: "Urgency / urge incontinence (OAB)",   dimId: "associations", value: "Urgency",             multiSelect: false),
        EFChip(label: "Pelvic pain + negative culture (IC)", dimId: "associations", value: "Pelvic pain",         multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "staroflife.circle", chips: [
        EFChip(label: "Smoking (bladder Ca risk)", dimId: "pmh", value: "smoking"),
        EFChip(label: "Fever",                     dimId: "associations", value: "Fever"),
        EFChip(label: "Renal angle tenderness",    dimId: "exam",         value: "renal angle tenderness"),
    ]),
]

let uroRetentionEarlyForm: [EFGroup] = [
    EFGroup(question: "Retention cause (single select)", icon: "nosign.fill", chips: [
        EFChip(label: "Male > 50 — enlarged prostate (BPH)", dimId: "sex_male", value: "", multiSelect: false),
        EFChip(label: "Poor stream — urethral stricture",    dimId: "associations", value: "Poor stream", multiSelect: false),
        EFChip(label: "Irregular prostate (Ca?)",            dimId: "exam",         value: "irregular prostate", multiSelect: false),
        EFChip(label: "Neurogenic (SCI / MS)",               dimId: "pmh",          value: "spinal cord injury", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Hesitancy",          dimId: "associations", value: "Hesitancy"),
        EFChip(label: "Weak stream",        dimId: "associations", value: "Weak stream"),
        EFChip(label: "Bone pain (Ca mets)", dimId: "associations", value: "Bone pain"),
        EFChip(label: "Prior urethral trauma or STI (stricture)", dimId: "pmh", value: "urethral trauma"),
        EFChip(label: "Age > 50",           dimId: "age_over",     value: "50"),
    ]),
]

let uroScrotalEarlyForm: [EFGroup] = [
    EFGroup(question: "Scrotal presentation (single select)", icon: "circle.grid.2x1.fill", chips: [
        EFChip(label: "Sudden severe pain — torsion (EMERGENCY)", dimId: "onset",     value: "Sudden",             multiSelect: false),
        EFChip(label: "Tender epididymis + discharge (E-O)",      dimId: "exam",      value: "tender epididymis",  multiSelect: false),
        EFChip(label: "Transilluminates (hydrocele)",             dimId: "exam",      value: "transilluminates",   multiSelect: false),
        EFChip(label: "Hard nodule / solid mass (tumour)",        dimId: "exam",      value: "hard nodule",        multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Absent cremasteric reflex (torsion)",  dimId: "exam",          value: "absent cremasteric reflex"),
        EFChip(label: "Urethral discharge (epididymo-orchitis)", dimId: "associations", value: "Urethral discharge"),
        EFChip(label: "Prior undescended testis (tumour risk)", dimId: "pmh",          value: "undescended testis"),
        EFChip(label: "Raised AFP / βhCG",                    dimId: "inv",           value: "afp or bhcg"),
    ]),
]

// MARK: - Musculoskeletal early forms

let mskBackPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Red flag pattern (single select)", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Urinary retention + saddle anaesthesia (Cauda Equina — EMERGENCY)", dimId: "associations", value: "Urinary retention", multiSelect: false),
        EFChip(label: "Known cancer + progressive (MSCC)", dimId: "pmh",    value: "cancer",       multiSelect: false),
        EFChip(label: "Trauma + osteoporosis (fracture)",  dimId: "onset",  value: "After trauma", multiSelect: false),
        EFChip(label: "Leg radiation + SLR positive (disc)", dimId: "radiation", value: "Leg",     multiSelect: false),
        EFChip(label: "Morning stiffness > 1 h (ankylosing spondylitis)", dimId: "timing", value: "Morning stiffness", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Saddle anaesthesia",              dimId: "exam",         value: "saddle anaesthesia"),
        EFChip(label: "Bilateral leg weakness",          dimId: "associations", value: "Bilateral leg weakness"),
        EFChip(label: "Nocturnal / progressive pain",    dimId: "timing",       value: "Nocturnal"),
        EFChip(label: "Relieved by exercise (AS)",       dimId: "relieving",    value: "Exercise"),
        EFChip(label: "Worse with movement (mechanical)", dimId: "exacerbating", value: "Movement"),
    ]),
]

let mskJointPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Joint presentation (single select)", icon: "figure.walk.motion.fill", chips: [
        EFChip(label: "First MTP — gout (urate crystals)", dimId: "joint_affected", value: "first_MTP",  multiSelect: false),
        EFChip(label: "Hot swollen joint — septic arthritis", dimId: "character",   value: "Hot",        multiSelect: false),
        EFChip(label: "After GI / STI infection (reactive)", dimId: "recent_infection", value: "GI_or_STI", multiSelect: false),
        EFChip(label: "Weight-bearing ache + crepitus (OA)", dimId: "character",    value: "Deep ache",  multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Tophi present (gout)",               dimId: "tophi",         value: "present"),
        EFChip(label: "Dengue fever features",              dimId: "dengue_NS1_IgM", value: "positive"),
        EFChip(label: "Keratoderma blennorrhagica (reactive)", dimId: "skin_lesion", value: "keratoderma_blennorrhagica"),
        EFChip(label: "X-ray joint space narrowing (OA)",   dimId: "xray",          value: "joint_space_narrowing_osteophytes"),
    ]),
]

// MARK: - Infectious & Tropical early forms

let infectFeverEarlyForm: [EFGroup] = [
    EFGroup(question: "Infection pattern (single select)", icon: "thermometer.medium.fill", chips: [
        EFChip(label: "Dengue — platelet < 100 + NS1/IgM", dimId: "platelet_count", value: "below_100",        multiSelect: false),
        EFChip(label: "Leptospirosis — flood/water exposure", dimId: "exposure",    value: "flooding_animal_water_contact", multiSelect: false),
        EFChip(label: "Typhoid — rose spots + blood culture", dimId: "rose_spots",  value: "present",          multiSelect: false),
        EFChip(label: "UTI — positive dipstick / dysuria",   dimId: "urinalysis_nitrites", value: "positive",  multiSelect: false),
        EFChip(label: "Pneumonia — consolidation on CXR",    dimId: "CXR",         value: "new_consolidation", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Conjunctival suffusion (leptospirosis)", dimId: "conjunctival_suffusion", value: "present"),
        EFChip(label: "Rigors",                           dimId: "associations", value: "Rigors"),
        EFChip(label: "Skin / soft tissue erythema (cellulitis)", dimId: "exam", value: "erythema"),
        EFChip(label: "Weil's syndrome — jaundice + renal failure", dimId: "jaundice_renal", value: "Weil_syndrome"),
    ]),
]

let infectSepsisEarlyForm: [EFGroup] = [
    EFGroup(question: "Sepsis source (single select)", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Intra-abdominal — peritonism / free air", dimId: "peritonism",   value: "guarding_rigidity",         multiSelect: false),
        EFChip(label: "Urosepsis — urine culture + obstructed kidney", dimId: "urine_culture", value: "significant_growth", multiSelect: false),
        EFChip(label: "Pulmonary — new CXR infiltrate",          dimId: "CXR",          value: "new_infiltrate",            multiSelect: false),
        EFChip(label: "Necrotising fasciitis — crepitus + necrosis", dimId: "exam",     value: "crepitus",                  multiSelect: false),
    ]),
    EFGroup(question: "Alarming local features (NF / gas gangrene)", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Skin necrosis",                    dimId: "exam",         value: "skin necrosis"),
        EFChip(label: "Dishwater fluid",                  dimId: "exam",         value: "dishwater fluid"),
        EFChip(label: "Scrotal / perineal crepitus (Fournier's)", dimId: "site", value: "Scrotum"),
        EFChip(label: "Hypotension / shock",              dimId: "associations", value: "Hypotension"),
        EFChip(label: "Diabetes (NF risk factor)",        dimId: "pmh",          value: "diabetes"),
    ]),
]
