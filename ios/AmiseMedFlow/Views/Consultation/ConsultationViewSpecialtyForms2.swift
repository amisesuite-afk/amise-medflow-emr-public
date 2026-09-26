// ConsultationViewSpecialtyForms2.swift
// Early form data for Haematology, Gynaecology, Paediatrics, Dermatology,
// Psychiatry, Internal Medicine, and the dispatch function.

import SwiftUI
import SwiftData


// MARK: - Haematology & Oncology early forms

let haemAnaemiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Anaemia type clues (single select)", icon: "drop.circle.fill", chips: [
        EFChip(label: "Iron deficiency — pallor + pica",    dimId: "associations", value: "Pica",               multiSelect: false),
        EFChip(label: "Haemolytic — jaundice + dark urine", dimId: "associations", value: "Dark urine",         multiSelect: false),
        EFChip(label: "Sickle cell — pain crisis",          dimId: "associations", value: "Crisis pain",        multiSelect: false),
        EFChip(label: "B12/folate — neuropathy + sore tongue", dimId: "associations", value: "Neuropathy",      multiSelect: false),
        EFChip(label: "Chronic disease — known chronic illness", dimId: "associations", value: "Chronic illness", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Pallor",            dimId: "associations", value: "Pallor"),
        EFChip(label: "Sore tongue",       dimId: "associations", value: "Sore tongue"),
        EFChip(label: "Jaundice",          dimId: "associations", value: "Jaundice"),
        EFChip(label: "Splenomegaly",      dimId: "exam",         value: "splenomegaly"),
    ]),
]

let haemLymphadenopathyEarlyForm: [EFGroup] = [
    EFGroup(question: "Node characteristics (single select)", icon: "circle.grid.3x3.fill", chips: [
        EFChip(label: "Tender + recent infection (reactive)", dimId: "character", value: "Tender",   multiSelect: false),
        EFChip(label: "Rubbery / painless (lymphoma)",        dimId: "character", value: "Rubbery",  multiSelect: false),
        EFChip(label: "Hard / fixed (metastatic)",            dimId: "character", value: "Hard",     multiSelect: false),
    ]),
    EFGroup(question: "B symptoms / systemic features", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Night sweats",                       dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",                        dimId: "associations", value: "Weight loss"),
        EFChip(label: "Mediastinal widening on CXR",        dimId: "inv",          value: "mediastinal widening"),
        EFChip(label: "Age > 50 (metastatic risk)",         dimId: "age_over",     value: "50"),
    ]),
]

// MARK: - Gynaecology & Obstetrics early forms

let gynaePelvicPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Pelvic pain aetiology (single select)", icon: "waveform.path.ecg.fill", chips: [
        EFChip(label: "Positive pregnancy test (ectopic — EMERGENCY)", dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "Absent ovarian Doppler flow (torsion)",          dimId: "doppler",                 value: "absent_flow", multiSelect: false),
        EFChip(label: "STI screen positive (PID)",                      dimId: "sti_screen",              value: "positive_chlamydia_gonorrhoea", multiSelect: false),
        EFChip(label: "Ultrasound fibroid confirmed",                   dimId: "ultrasound",              value: "fibroid_confirmed", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Free fluid on ultrasound (haemoperitoneum)", dimId: "haemoperitoneum", value: "free_fluid"),
        EFChip(label: "Adnexal mass on ultrasound",                 dimId: "adnexal_mass",    value: "present_on_ultrasound"),
        EFChip(label: "Uterosacral nodularity (endometriosis)",     dimId: "uterosacral_nodularity", value: "present"),
        EFChip(label: "Haemodynamic instability (ectopic — EMERGENCY)", dimId: "shock",       value: "haemodynamic_instability"),
    ]),
]

let gynaeVaginalBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding context (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Positive pregnancy — threatened miscarriage",     dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "Postmenopausal bleeding (endometrial pathology?)", dimId: "postmenopausal_bleeding", value: "present", multiSelect: false),
        EFChip(label: "Antepartum haemorrhage (> 20 weeks)",             dimId: "second_third_trimester",  value: "antepartum_bleed", multiSelect: false),
        EFChip(label: "Low-lying placenta (praevia)",                    dimId: "ultrasound",              value: "low_lying_placenta", multiSelect: false),
    ]),
    EFGroup(question: "Examination features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Friable irregular cervix (carcinoma)",           dimId: "cervix",        value: "friable_irregular"),
        EFChip(label: "Endometrial thickness > 4 mm (postmenop)",      dimId: "endometrial_thickness", value: "above_4mm_postmenop"),
        EFChip(label: "Painful rigid uterus (abruption)",              dimId: "painful_rigid_uterus", value: "present"),
        EFChip(label: "CTG showing fetal distress",                    dimId: "ctg",           value: "fetal_distress"),
    ]),
]

let gynaeObstetricEarlyForm: [EFGroup] = [
    EFGroup(question: "Obstetric complication type (single select)", icon: "heart.circle.fill", chips: [
        EFChip(label: "Persistent vomiting (hyperemesis gravidarum)",   dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "BP > 140/90 after 20 wks + proteinuria (pre-eclampsia)", dimId: "hypertension", value: "above_140_90_after_20_weeks", multiSelect: false),
        EFChip(label: "Abnormal OGTT (gestational diabetes)",           dimId: "ogtt",             value: "abnormal_pregnancy", multiSelect: false),
    ]),
    EFGroup(question: "Pre-eclampsia severity", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Proteinuria > 300 mg/24 h",      dimId: "proteinuria", value: "above_300mg_24h"),
        EFChip(label: "Fetal distress on CTG",          dimId: "ctg",         value: "fetal_distress"),
    ]),
]

// MARK: - Paediatrics early forms

let paedFeverEarlyForm: [EFGroup] = [
    EFGroup(question: "Fever source (single select)", icon: "thermometer.medium.fill", chips: [
        EFChip(label: "Non-blanching rash (meningococcal — EMERGENCY)", dimId: "petechiae_purpura", value: "non_blanching", multiSelect: false),
        EFChip(label: "Bulging fontanelle (meningitis in infant)",      dimId: "bulging_fontanelle", value: "in_infant",    multiSelect: false),
        EFChip(label: "Ear pain — otoscopy abnormal (otitis media)",    dimId: "otoscopy",          value: "bulging_erythematous_membrane", multiSelect: false),
        EFChip(label: "Significant urine culture (febrile UTI)",        dimId: "mssu",              value: "growth_significant", multiSelect: false),
        EFChip(label: "CXR consolidation (childhood pneumonia)",        dimId: "chest_xray",        value: "consolidation", multiSelect: false),
    ]),
    EFGroup(question: "Severity indicators", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Altered consciousness / stiff neck", dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Respiratory distress",               dimId: "associations", value: "Respiratory distress"),
        EFChip(label: "Prolonged fever > 5 days (Kawasaki?)", dimId: "timing",     value: ">5 days"),
    ]),
]

let paedAbdomEarlyForm: [EFGroup] = [
    EFGroup(question: "Paediatric abdominal cause (single select)", icon: "waveform.path.ecg.fill", chips: [
        EFChip(label: "Sausage mass + currant jelly stool (intussusception)", dimId: "currant_jelly_stool", value: "present",             multiSelect: false),
        EFChip(label: "Projectile non-bilious vomiting in infant (pyloric stenosis)", dimId: "vomiting", value: "projectile_non_bilious", multiSelect: false),
        EFChip(label: "RIF pain + anorexia + fever (appendicitis)",           dimId: "associations",       value: "RIF pain",            multiSelect: false),
        EFChip(label: "Umbilical → RIF migration (appendicitis)",             dimId: "site",               value: "RLQ",                 multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Palpable sausage-shaped RUQ mass",      dimId: "abdominal_mass",   value: "sausage_shaped_ruq"),
        EFChip(label: "Olive mass RUQ in infant (pyloric)",    dimId: "olive_mass",       value: "palpable_ruq"),
        EFChip(label: "Anorexia",                              dimId: "associations",     value: "Anorexia"),
        EFChip(label: "Rebound tenderness (appendicitis)",     dimId: "exam",             value: "rebound"),
    ]),
]

// MARK: - Dermatology early forms

let dermaRashEarlyForm: [EFGroup] = [
    EFGroup(question: "Rash pattern (single select)", icon: "oval.portrait.fill", chips: [
        EFChip(label: "Well-demarcated silvery plaques (psoriasis)", dimId: "plaques", value: "well_demarcated_silvery_scale", multiSelect: false),
        EFChip(label: "Migratory wheals (urticaria)",               dimId: "wheals",  value: "migratory_blanching_pruritic", multiSelect: false),
        EFChip(label: "Annular with central clearing (tinea)",      dimId: "character", value: "Annular",                    multiSelect: false),
        EFChip(label: "Herald patch then trunk rash (pityriasis rosea)", dimId: "herald_patch", value: "single_ovoid_salmon", multiSelect: false),
        EFChip(label: "Contact distribution (contact dermatitis)",  dimId: "character", value: "Contact",                   multiSelect: false),
    ]),
    EFGroup(question: "Features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "KOH scraping positive hyphae (tinea)", dimId: "koh_scraping",  value: "positive_hyphae"),
        EFChip(label: "Patch test positive (contact derm)",   dimId: "patch_test",    value: "positive"),
        EFChip(label: "Known atopy / eczema history",         dimId: "pmh",           value: "atopy"),
        EFChip(label: "Worse with allergen exposure",         dimId: "exacerbating",  value: "Allergen"),
    ]),
]

let dermaSkinLesionEarlyForm: [EFGroup] = [
    EFGroup(question: "Lesion characteristics (single select)", icon: "oval.lefthalf.filled", chips: [
        EFChip(label: "Irregular border + multiple colours (melanoma)", dimId: "associations", value: "Irregular border",   multiSelect: false),
        EFChip(label: "Pearly rolled border (BCC)",                    dimId: "associations", value: "Rolled border",      multiSelect: false),
        EFChip(label: "Indurated / crusting / ulceration (SCC)",       dimId: "associations", value: "Indurated",          multiSelect: false),
        EFChip(label: "Central punctum — soft (epidermoid cyst)",      dimId: "exam",         value: "punctum",            multiSelect: false),
        EFChip(label: "Soft / slips under finger (lipoma)",            dimId: "character",    value: "Soft compressible",  multiSelect: false),
    ]),
    EFGroup(question: "History factors", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Changing / growing lesion",            dimId: "timing", value: "Changing"),
        EFChip(label: "Diameter > 6 mm",                     dimId: "associations", value: "Diameter > 6mm"),
        EFChip(label: "Prior melanoma",                      dimId: "pmh",    value: "previous melanoma"),
        EFChip(label: "Prior actinic keratosis (SCC risk)",  dimId: "pmh",    value: "actinic keratosis"),
    ]),
]

// MARK: - Psychiatry / Mental Health early forms

let psychDepressionEarlyForm: [EFGroup] = [
    EFGroup(question: "Primary presentation (single select)", icon: "cloud.rain.fill", chips: [
        EFChip(label: "Low mood / anhedonia (depression)",         dimId: "associations", value: "Low mood",            multiSelect: false),
        EFChip(label: "Post-exertional malaise > 6 months (CFS/ME)", dimId: "timing",     value: ">6 months",           multiSelect: false),
        EFChip(label: "Anxiety / worry",                           dimId: "associations", value: "Anxiety",             multiSelect: false),
        EFChip(label: "Witnessed apnoea / snoring (OSA)",          dimId: "associations", value: "Witnessed apnoea",    multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Cognitive impairment",   dimId: "associations", value: "Cognitive impairment"),
        EFChip(label: "Pallor (anaemia ddx)",   dimId: "associations", value: "Pallor"),
        EFChip(label: "Cold intolerance (hypothyroid ddx)", dimId: "associations", value: "Cold intolerance"),
        EFChip(label: "Polyuria / polydipsia (DM ddx)", dimId: "associations", value: "Polyuria"),
        EFChip(label: "> 2 weeks duration",     dimId: "timing",       value: ">2 weeks"),
    ]),
]

// MARK: - Internal Medicine — additional forms

let internalCKDEarlyForm: [EFGroup] = [
    EFGroup(question: "CKD / renal disease pattern (single select)", icon: "drop.triangle.fill", chips: [
        EFChip(label: "eGFR < 60 × 3 months (CKD stage 3+)",       dimId: "gfr",          value: "below_60_three_months", multiSelect: false),
        EFChip(label: "Creatinine rise > 26 μmol in 48 h (AKI)",   dimId: "creatinine",   value: "rise_above_26_in_48h",  multiSelect: false),
        EFChip(label: "Proteinuria > 3.5 g/24 h (nephrotic)",      dimId: "proteinuria",  value: "above_3_5g_24h",        multiSelect: false),
        EFChip(label: "RBC casts + haematuria (nephritis/IgA)",     dimId: "rbc_casts",    value: "present",               multiSelect: false),
    ]),
    EFGroup(question: "Context / risk", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Known diabetes", dimId: "pmh", value: "diabetes"),
        EFChip(label: "Known hypertension", dimId: "pmh", value: "hypertension"),
        EFChip(label: "Proteinuria",    dimId: "associations", value: "Proteinuria"),
    ]),
]

let internalLiverEarlyForm: [EFGroup] = [
    EFGroup(question: "Liver disease type (single select)", icon: "leaf.fill", chips: [
        EFChip(label: "Hepatitis B — HBsAg + > 6 months",     dimId: "hbsag",      value: "positive_above_6_months", multiSelect: false),
        EFChip(label: "Hepatitis C — HCV RNA detectable",      dimId: "hcv_rna",    value: "detectable",              multiSelect: false),
        EFChip(label: "Cirrhosis — decompensated (ascites etc)", dimId: "exam",      value: "ascites",                 multiSelect: false),
        EFChip(label: "NAFLD — obesity / metabolic syndrome",  dimId: "pmh",        value: "obesity",                 multiSelect: false),
        EFChip(label: "Alcoholic hepatitis",                   dimId: "pmh",        value: "alcohol",                 multiSelect: false),
    ]),
    EFGroup(question: "Complication flags", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haematemesis (varices)",  dimId: "associations", value: "Haematemesis"),
        EFChip(label: "Jaundice",               dimId: "associations", value: "Jaundice"),
        EFChip(label: "Ascites on exam",        dimId: "exam",         value: "ascites"),
        EFChip(label: "Encephalopathy",         dimId: "associations", value: "Encephalopathy"),
    ]),
]

// swiftlint:enable line_length

/// Returns the early form chip groups for the given specialty hint + chief complaint.
/// Returns an empty array when no targeted form exists for the combination.
func specialtyEarlyFormGroups(hint: String, cc: String) -> [EFGroup] {
    let lc = cc.lowercased()
    switch hint {
    case "Neurology":
        if lc.contains("headache") || lc.contains("migraine") { return neurologHeadacheEarlyForm }
        if lc.contains("dizz") || lc.contains("vertigo") { return neurologDizzinessEarlyForm }
        return []
    case "Neurosurgery":
        if lc.contains("head injur") || lc.contains("trauma") { return neurosurgTraumaEarlyForm }
        if lc.contains("severe") || lc.contains("headache") { return neurosurgHeadacheEarlyForm }
        if lc.contains("tumour") || lc.contains("tumor") || lc.contains("hydrocephal") { return neurosurgTumourEarlyForm }
        return []
    case "Cardiology":
        if lc.contains("chest") { return cardiologyChestEarlyForm }
        if lc.contains("arrhythmia") || lc.contains("palpitation") || lc.contains("atrial") || lc.contains("fibrillation") {
            return cardiologyArrhythmiaEarlyForm
        }
        return []
    case "Internal Medicine":
        if lc.contains("ckd") || lc.contains("renal dis") || lc.contains("kidney") || lc.contains("nephro") { return internalCKDEarlyForm }
        if lc.contains("liver") || lc.contains("cirrhosis") || lc.contains("hepatitis") || lc.contains("hepat") { return internalLiverEarlyForm }
        if lc.contains("anaemia") || lc.contains("anemia") { return internalMedAnaemiaEarlyForm }
        if lc.contains("fatigue") || lc.contains("tired") || lc.contains("lethargy") { return internalMedFatigueEarlyForm }
        return []
    case "General & GI Surgery":
        if lc.contains("wound") || lc.contains("post-op") || lc.contains("postop") || lc.contains("post op") { return surgWoundEarlyForm }
        if lc.contains("obstruct") || lc.contains("ileus") || lc.contains("volvulus") { return surgObstructionEarlyForm }
        if lc.contains("hernia") { return surgHerniaEarlyForm }
        if lc.contains("bleed") && (lc.contains("upper") || lc.contains("gi") || lc.contains("haematemesis") || lc.contains("melaena")) { return surgUpperGIBleedEarlyForm }
        if lc.contains("rectal") || lc.contains("pr bleed") || lc.contains("haematochezia") { return surgRectalBleedEarlyForm }
        if lc.contains("perianal") || lc.contains("anal pain") || lc.contains("haemorrhoid") || lc.contains("fissure") || lc.contains("fistula") || lc.contains("abscess") { return surgPerianaleEarlyForm }
        if lc.contains("renal colic") || lc.contains("ureteric") || lc.contains("kidney stone") { return surgRenalColicEarlyForm }
        if lc.contains("acute limb") || lc.contains("ischaem") || lc.contains("embol") { return surgAcuteLimbEarlyForm }
        if lc.contains("vascular") || lc.contains("aneur") || lc.contains("claudic") || lc.contains("arterial") { return surgVascularEarlyForm }
        if lc.contains("reflux") || lc.contains("gerd") || lc.contains("heartburn") { return surgGERDEarlyForm }
        if lc.contains("dysphagia") || lc.contains("swallowing") { return surgDysphagiaEarlyForm }
        if lc.contains("jaundice") || lc.contains("biliary") || lc.contains("ercp") { return surgJaundiceEarlyForm }
        if lc.contains("neck lump") || lc.contains("neck mass") || lc.contains("lymph") || lc.contains("thyroid") { return surgNeckLumpEarlyForm }
        if lc.contains("breast") { return surgBreastLumpEarlyForm }
        if lc.contains("skin lesion") || lc.contains("melanoma") || lc.contains("skin lump") { return dermaSkinLesionEarlyForm }
        if lc.contains("abdom") || lc.contains("pain") || lc.contains("appendic") || lc.contains("cholecyst") || lc.contains("pancreati") || lc.contains("divertic") { return surgAbdominalPainEarlyForm }
        return []
    case "Cardiovascular":
        if lc.contains("stroke") || lc.contains("tia") || lc.contains("weakness") || lc.contains("facial droop") { return cardioStrokeTIAEarlyForm }
        if lc.contains("dvt") || lc.contains("pe") || lc.contains("embol") || lc.contains("thrombos") || lc.contains("leg swel") { return cardioDVTPEEarlyForm }
        if lc.contains("heart fail") || lc.contains("oedema") || lc.contains("breathless") { return cardioHeartFailureEarlyForm }
        if lc.contains("hypertens") || lc.contains("high bp") { return cardioHypertensionEarlyForm }
        if lc.contains("chest") { return cardiologyChestEarlyForm }
        if lc.contains("palpitat") || lc.contains("arrhyth") || lc.contains("fibrillat") { return cardiologyArrhythmiaEarlyForm }
        return []
    case "Respiratory":
        if lc.contains("cough") { return respCoughEarlyForm }
        if lc.contains("breath") || lc.contains("wheeze") || lc.contains("asthma") || lc.contains("copd") || lc.contains("shortness") { return respSOBEarlyForm }
        if lc.contains("haemoptysis") || lc.contains("pleurit") || lc.contains("tb") { return respSOBEarlyForm }
        return []
    case "Endocrine & Metabolic":
        if lc.contains("thyroid") || lc.contains("goitre") || lc.contains("hypothy") || lc.contains("hyperthy") { return endoThyroidEarlyForm }
        if lc.contains("adrenal") || lc.contains("cushing") || lc.contains("phaeo") || lc.contains("conn") { return endoAdrenalEarlyForm }
        if lc.contains("diabet") || lc.contains("glucose") || lc.contains("hba1c") { return endoDiabetesEarlyForm }
        return []
    case "Urology & Renal":
        if lc.contains("scrotal") || lc.contains("testicular") || lc.contains("torsion") { return uroScrotalEarlyForm }
        if lc.contains("retention") { return uroRetentionEarlyForm }
        if lc.contains("urinary") || lc.contains("haematuria") || lc.contains("dysuria") || lc.contains("uti") { return uroUrinaryEarlyForm }
        if lc.contains("renal colic") || lc.contains("stone") { return surgRenalColicEarlyForm }
        return []
    case "Musculoskeletal":
        if lc.contains("back") || lc.contains("sciatica") || lc.contains("spine") || lc.contains("cauda") { return mskBackPainEarlyForm }
        if lc.contains("joint") || lc.contains("gout") || lc.contains("arthrit") || lc.contains("knee") || lc.contains("hip") { return mskJointPainEarlyForm }
        return []
    case "Infectious & Tropical":
        if lc.contains("sepsis") || lc.contains("necrotis") || lc.contains("fasciit") || lc.contains("gangrene") { return infectSepsisEarlyForm }
        if lc.contains("fever") || lc.contains("dengue") || lc.contains("lepto") || lc.contains("typhoid") || lc.contains("infect") { return infectFeverEarlyForm }
        return []
    case "Haematology & Oncology":
        if lc.contains("lymph") || lc.contains("lymphoma") || lc.contains("node") { return haemLymphadenopathyEarlyForm }
        if lc.contains("anaemia") || lc.contains("anemia") || lc.contains("fatigue") || lc.contains("bleed") { return haemAnaemiaEarlyForm }
        return []
    case "Gynaecology & Obstetrics":
        if lc.contains("pregnan") || lc.contains("antenatal") || lc.contains("obstet") || lc.contains("hyperemesis") || lc.contains("pre-eclamp") { return gynaeObstetricEarlyForm }
        if lc.contains("vaginal bleed") || lc.contains("postmenop") || lc.contains("miscarriage") { return gynaeVaginalBleedEarlyForm }
        if lc.contains("pelvic") || lc.contains("ectopic") || lc.contains("ovarian") || lc.contains("fibroid") || lc.contains("pid") || lc.contains("endometrio") { return gynaePelvicPainEarlyForm }
        return []
    case "Paediatrics":
        if lc.contains("abdom") || lc.contains("vomiting") || lc.contains("intussus") || lc.contains("pyloric") { return paedAbdomEarlyForm }
        if lc.contains("fever") || lc.contains("rash") || lc.contains("child") || lc.contains("infect") || lc.contains("ear") || lc.contains("throat") { return paedFeverEarlyForm }
        return []
    case "Dermatology":
        if lc.contains("lesion") || lc.contains("melanoma") || lc.contains("mole") || lc.contains("bcc") || lc.contains("scc") || lc.contains("lump") { return dermaSkinLesionEarlyForm }
        if lc.contains("rash") || lc.contains("eczema") || lc.contains("psoriasis") || lc.contains("urticaria") || lc.contains("itch") || lc.contains("tinea") { return dermaRashEarlyForm }
        return []
    case "Psychiatry / Mental Health":
        return psychDepressionEarlyForm
    default:
        return []
    }
}
