// ConsultationViewEarlyForms.swift
// Early form type definitions (EFChip, EFGroup) and General Surgery early forms.

import SwiftUI
import SwiftData

// MARK: - Specialty Early Form data

/// A single chip in the specialty early form. The `dimId` + `value` pair maps directly
/// to a feature key/value in DiagnosticDatabase.json, so tapping the chip feeds the
/// Bayesian scorer through the existing toggleSOCRATES mechanism.
struct EFChip: Identifiable {
    let id = UUID()
    let label: String
    let dimId: String          // DB feature key (standard SOCRATES dim or custom specialist key)
    let value: String          // must match the DB feature value (case-insensitive contains)
    var multiSelect: Bool = true
}

/// A labelled group of early-form chips shown under one clinical question.
struct EFGroup: Identifiable {
    let id = UUID()
    let question: String
    let icon: String
    let chips: [EFChip]
}

// swiftlint:disable line_length

// ── Neurology: Headache ──────────────────────────────────────────────────────
private let neurologHeadacheEarlyForm: [EFGroup] = [
    EFGroup(question: "Onset character", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Thunderclap — worst ever",      dimId: "onset",        value: "Thunderclap",            multiSelect: false),
        EFChip(label: "Sudden",                        dimId: "onset",        value: "Sudden",                 multiSelect: false),
        EFChip(label: "Sentinel (prior milder episode)", dimId: "onset",      value: "Sentinel headache",      multiSelect: false),
    ]),
    EFGroup(question: "Headache character", icon: "waveform.path", chips: [
        EFChip(label: "Pulsating / throbbing",         dimId: "character",    value: "Pulsating"),
        EFChip(label: "Pressure / band-like",          dimId: "character",    value: "Pressure"),
        EFChip(label: "Orbital / retro-orbital",       dimId: "character",    value: "Orbital / retro-orbital"),
        EFChip(label: "Temporal region",               dimId: "character",    value: "Temporal"),
        EFChip(label: "Unilateral",                    dimId: "character",    value: "Unilateral"),
        EFChip(label: "Excruciating severity",         dimId: "character",    value: "Excruciating"),
    ]),
    EFGroup(question: "Key associated features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Neck stiffness / meningism",    dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Scintillating scotoma",         dimId: "associations", value: "Scintillating scotoma"),
        EFChip(label: "Jaw claudication",              dimId: "associations", value: "Jaw claudication"),
        EFChip(label: "Scalp tenderness",              dimId: "associations", value: "Scalp tenderness"),
        EFChip(label: "Lacrimation / eye watering",    dimId: "associations", value: "Lacrimation"),
        EFChip(label: "Photophobia / phonophobia",     dimId: "associations", value: "Photophobia"),
        EFChip(label: "Loss of consciousness",         dimId: "associations", value: "Loss of consciousness"),
        EFChip(label: "Nausea / vomiting",             dimId: "associations", value: "Nausea"),
    ]),
    EFGroup(question: "Timing pattern", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Circadian clustering (same time each day)", dimId: "timing", value: "Circadian clustering"),
        EFChip(label: "Multiple attacks per day",      dimId: "timing",       value: "Multiple attacks per day"),
        EFChip(label: "Seasonal clustering",           dimId: "timing",       value: "Seasonal clustering"),
    ]),
]

// ── Neurology: Dizziness / Vertigo ───────────────────────────────────────────
private let neurologDizzinessEarlyForm: [EFGroup] = [
    EFGroup(question: "Type of dizziness", icon: "rotate.3d", chips: [
        EFChip(label: "Positional (position-triggered)", dimId: "character",  value: "Positional",             multiSelect: false),
        EFChip(label: "Lightheadedness / near-faint",  dimId: "character",    value: "Lightheadedness",        multiSelect: false),
    ]),
    EFGroup(question: "Pattern & trigger", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Brief (seconds)",               dimId: "timing",       value: "Brief"),
        EFChip(label: "Episodic (minutes–hours)",       dimId: "timing",       value: "Episodic"),
        EFChip(label: "Continuous / persistent",       dimId: "timing",       value: "Continuous"),
        EFChip(label: "Rolling over in bed",           dimId: "exacerbating", value: "Rolling over"),
        EFChip(label: "Standing up / postural change", dimId: "exacerbating", value: "Standing up"),
        EFChip(label: "Looking upward",                dimId: "exacerbating", value: "Looking up"),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Tinnitus",                      dimId: "associations", value: "Tinnitus"),
        EFChip(label: "Hearing loss",                  dimId: "associations", value: "Hearing loss"),
        EFChip(label: "Diplopia / double vision",      dimId: "associations", value: "Diplopia"),
        EFChip(label: "Dysarthria / slurred speech",   dimId: "associations", value: "Dysarthria"),
        EFChip(label: "Limb ataxia / unsteadiness",    dimId: "associations", value: "Limb ataxia"),
        EFChip(label: "Diaphoresis / sweating",        dimId: "associations", value: "Diaphoresis"),
    ]),
]

// ── Neurosurgery: Head injury / Trauma ───────────────────────────────────────
private let neurosurgTraumaEarlyForm: [EFGroup] = [
    EFGroup(question: "Key clinical history", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Lucid interval (talked, then deteriorated)", dimId: "lucid_interval",   value: "present"),
        EFChip(label: "New-onset seizure post-injury",              dimId: "seizure",          value: "new_onset_adult"),
        EFChip(label: "Ipsilateral pupil dilation",                dimId: "pupil",            value: "ipsilateral_dilation"),
    ]),
    EFGroup(question: "Associated symptoms", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Thunderclap / sudden severe headache",       dimId: "onset",            value: "Thunderclap"),
        EFChip(label: "Neck stiffness",                            dimId: "associations",     value: "Neck stiffness"),
        EFChip(label: "Loss of consciousness",                     dimId: "associations",     value: "Loss of consciousness"),
    ]),
]

// ── Neurosurgery: Severe headache ─────────────────────────────────────────────
private let neurosurgHeadacheEarlyForm: [EFGroup] = [
    EFGroup(question: "Onset", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Thunderclap — worst ever",      dimId: "onset",        value: "Thunderclap",            multiSelect: false),
        EFChip(label: "Sudden",                        dimId: "onset",        value: "Sudden",                 multiSelect: false),
        EFChip(label: "Sentinel (prior milder)",       dimId: "onset",        value: "Sentinel headache",      multiSelect: false),
    ]),
    EFGroup(question: "Red flag features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Neck stiffness / meningism",    dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Loss of consciousness",         dimId: "associations", value: "Loss of consciousness"),
        EFChip(label: "Seizure at onset",              dimId: "associations", value: "Seizure at ictus"),
        EFChip(label: "Lucid interval (post-trauma)",  dimId: "lucid_interval", value: "present"),
        EFChip(label: "Progressive over days/weeks",   dimId: "new_focal_deficit", value: "present"),
    ]),
]

// ── Neurosurgery: Brain tumour / Hydrocephalus ───────────────────────────────
private let neurosurgTumourEarlyForm: [EFGroup] = [
    EFGroup(question: "Specific features", icon: "brain.head.profile", chips: [
        EFChip(label: "New-onset seizure in adult",                dimId: "seizure",          value: "new_onset_adult"),
        EFChip(label: "Progressive focal neurological deficit",    dimId: "new_focal_deficit", value: "present"),
        EFChip(label: "Gait + cognition + incontinence triad",     dimId: "triad_nph",        value: "gait_cognitive_incontinence"),
        EFChip(label: "Headache worse lying flat / AM",            dimId: "associations",     value: "Loss of consciousness"),
    ]),
]

// ── Cardiology: Chest pain ───────────────────────────────────────────────────
private let cardiologyChestEarlyForm: [EFGroup] = [
    EFGroup(question: "Pain character", icon: "heart.fill", chips: [
        EFChip(label: "Pressure / tightness",          dimId: "character",    value: "Pressure"),
        EFChip(label: "Tearing / ripping",             dimId: "character",    value: "Tearing"),
        EFChip(label: "Sharp / pleuritic",             dimId: "character",    value: "Sharp"),
    ]),
    EFGroup(question: "Radiation", icon: "arrow.up.right.and.arrow.down.left", chips: [
        EFChip(label: "Arm radiation",                 dimId: "radiation",    value: "Arm"),
        EFChip(label: "Jaw radiation",                 dimId: "radiation",    value: "Jaw"),
        EFChip(label: "Back radiation",                dimId: "radiation",    value: "Back"),
    ]),
    EFGroup(question: "Modifying factors & onset", icon: "arrow.2.circlepath", chips: [
        EFChip(label: "Exertion-triggered",            dimId: "exacerbating", value: "Exertion"),
        EFChip(label: "Relieved by rest",              dimId: "relieving",    value: "Rest"),
        EFChip(label: "Relieved by nitrates",          dimId: "relieving",    value: "Nitrates"),
        EFChip(label: "Sudden onset",                  dimId: "onset",        value: "Sudden"),
        EFChip(label: "Shortness of breath",           dimId: "associations", value: "Shortness of breath"),
    ]),
]

// ── Cardiology: Arrhythmia / Palpitations ────────────────────────────────────
private let cardiologyArrhythmiaEarlyForm: [EFGroup] = [
    EFGroup(question: "ECG pattern (if available)", icon: "waveform.path.ecg.rectangle", chips: [
        EFChip(label: "Irregularly irregular pulse",   dimId: "pulse",        value: "irregularly_irregular"),
        EFChip(label: "No P waves (AF on ECG)",        dimId: "ecg",          value: "no_p_waves_irregular_rhythm"),
        EFChip(label: "Short PR + delta wave (WPW)",   dimId: "ecg",          value: "short_pr_delta_wave"),
        EFChip(label: "Wide QRS, regular >100 bpm",    dimId: "ecg",          value: "wide_qrs_regular_above_100"),
        EFChip(label: "P waves independent of QRS",    dimId: "ecg",          value: "p_waves_independent_qrs"),
    ]),
    EFGroup(question: "Clinical context", icon: "heart.text.square.fill", chips: [
        EFChip(label: "Known structural heart disease", dimId: "structural_heart_disease", value: "present"),
        EFChip(label: "Terminates with vagal manoeuvre", dimId: "vagal_response",          value: "terminates"),
    ]),
]

// ── Internal Medicine: Anaemia workup ────────────────────────────────────────
private let internalMedAnaemiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Associated features", icon: "drop.circle.fill", chips: [
        EFChip(label: "Crisis pain (sickle)",          dimId: "associations", value: "Crisis pain"),
        EFChip(label: "Jaundice (haemolysis)",         dimId: "associations", value: "Jaundice"),
        EFChip(label: "Pica (craving non-food items)", dimId: "associations", value: "Pica"),
        EFChip(label: "Peripheral neuropathy (B12)",   dimId: "associations", value: "Neuropathy"),
        EFChip(label: "Dark urine (haemolysis)",       dimId: "associations", value: "Dark urine"),
        EFChip(label: "Pallor",                        dimId: "associations", value: "Pallor"),
        EFChip(label: "Sore tongue (B12/folate)",      dimId: "associations", value: "Sore tongue"),
    ]),
]

// ── Internal Medicine: Fatigue ───────────────────────────────────────────────
private let internalMedFatigueEarlyForm: [EFGroup] = [
    EFGroup(question: "Duration & pattern", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Worse with exertion (CFS/ME)",  dimId: "associations", value: "Post-exertional malaise"),
        EFChip(label: ">6 months duration",            dimId: "timing",       value: ">6 months"),
        EFChip(label: ">2 weeks duration",             dimId: "timing",       value: ">2 weeks"),
    ]),
    EFGroup(question: "Specific associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Low mood / anhedonia",          dimId: "associations", value: "Low mood"),
        EFChip(label: "Snoring / witnessed apnoea",    dimId: "associations", value: "Witnessed apnoea"),
        EFChip(label: "Polyuria / polydipsia (DM)",    dimId: "associations", value: "Polyuria"),
        EFChip(label: "Cold intolerance (hypothyroid)", dimId: "associations", value: "Cold intolerance"),
        EFChip(label: "Pallor (anaemia)",              dimId: "associations", value: "Pallor"),
        EFChip(label: "Cognitive impairment",          dimId: "associations", value: "Cognitive impairment"),
    ]),
]

// MARK: - General Surgery early forms — Abdominal Pain

private let surgAbdominalPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Pain site (single select)", icon: "mappin.circle.fill", chips: [
        EFChip(label: "Right iliac fossa (appendix)",  dimId: "site", value: "RLQ",        multiSelect: false),
        EFChip(label: "Epigastric (PUD / reflux)",     dimId: "site", value: "Epigastric", multiSelect: false),
        EFChip(label: "Left iliac fossa (diverticula)", dimId: "site", value: "LLQ",       multiSelect: false),
        EFChip(label: "Loin (renal colic)",             dimId: "site", value: "Loin",      multiSelect: false),
        EFChip(label: "Generalised / peritonitis",      dimId: "site", value: "Generalised", multiSelect: false),
    ]),
    EFGroup(question: "Pain character (single select)", icon: "waveform.path.ecg", chips: [
        EFChip(label: "Colicky",   dimId: "character", value: "Colicky",  multiSelect: false),
        EFChip(label: "Burning",   dimId: "character", value: "Burning",  multiSelect: false),
        EFChip(label: "Cramping",  dimId: "character", value: "Cramping", multiSelect: false),
        EFChip(label: "Constant",  dimId: "character", value: "Constant", multiSelect: false),
    ]),
    EFGroup(question: "Key associated features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haematuria",              dimId: "associations", value: "Haematuria"),
        EFChip(label: "Vomiting",                dimId: "associations", value: "Vomiting"),
        EFChip(label: "Abdominal distension",    dimId: "associations", value: "Distension"),
        EFChip(label: "No bowel motion / flatus", dimId: "associations", value: "No bowel motion"),
        EFChip(label: "Rectal bleeding",         dimId: "associations", value: "Rectal bleeding"),
        EFChip(label: "Heartburn",               dimId: "associations", value: "Heartburn"),
        EFChip(label: "Melaena",                 dimId: "associations", value: "Melaena"),
        EFChip(label: "Haematemesis",            dimId: "associations", value: "Haematemesis"),
    ]),
    EFGroup(question: "Radiation & modifiers", icon: "arrow.forward.circle.fill", chips: [
        EFChip(label: "Radiates loin → groin",   dimId: "radiation",   value: "Groin"),
        EFChip(label: "Relieved by antacids",     dimId: "relieving",  value: "Antacids"),
        EFChip(label: "Relieved by defaecation",  dimId: "relieving",  value: "Defaecation"),
        EFChip(label: "Worse lying flat",         dimId: "exacerbating", value: "Lying flat"),
        EFChip(label: "Worse with NSAIDs",        dimId: "exacerbating", value: "NSAIDs"),
    ]),
]

private let surgObstructionEarlyForm: [EFGroup] = [
    EFGroup(question: "Obstruction features (select all that apply)", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Colicky abdominal pain",  dimId: "character",    value: "Colicky"),
        EFChip(label: "Abdominal distension",    dimId: "associations", value: "Distension"),
        EFChip(label: "Vomiting",                dimId: "associations", value: "Vomiting"),
        EFChip(label: "Absolute constipation",   dimId: "associations", value: "No bowel motion"),
        EFChip(label: "Bilious vomit (SBO)",     dimId: "character",    value: "Bilious"),
        EFChip(label: "Projectile vomit (GOO)",  dimId: "character",    value: "Projectile"),
        EFChip(label: "High-pitched bowel sounds", dimId: "exam",       value: "high pitched"),
    ]),
    EFGroup(question: "Previous history", icon: "clock.arrow.circlepath", chips: [
        EFChip(label: "Prior laparotomy / adhesions", dimId: "pshx", value: "laparotomy"),
        EFChip(label: "Known colorectal cancer",      dimId: "pmh",  value: "colorectal"),
        EFChip(label: "Incisional hernia",            dimId: "pmh",  value: "hernia"),
    ]),
]

private let surgHerniaEarlyForm: [EFGroup] = [
    EFGroup(question: "Hernia type features (single select)", icon: "arrow.down.circle.fill", chips: [
        EFChip(label: "Groin — above inguinal ligament (inguinal)", dimId: "site",  value: "Groin", multiSelect: false),
        EFChip(label: "Groin — below inguinal ligament (femoral)",  dimId: "exam",  value: "below inguinal", multiSelect: false),
        EFChip(label: "Umbilical / paraumbilical",  dimId: "site",  value: "Midline", multiSelect: false),
        EFChip(label: "Prior laparotomy scar (incisional)", dimId: "pmh", value: "laparotomy", multiSelect: false),
    ]),
    EFGroup(question: "Clinical behaviour", icon: "checkmark.seal.fill", chips: [
        EFChip(label: "Cough impulse present",  dimId: "exam",         value: "cough impulse"),
        EFChip(label: "Reducible",              dimId: "exam",         value: "reducible"),
        EFChip(label: "Worse with straining",   dimId: "exacerbating", value: "Straining"),
        EFChip(label: "Severe irreducible pain (strangulation?)", dimId: "associations", value: "Severe pain"),
        EFChip(label: "Female sex (↑ femoral)", dimId: "sex_female",   value: ""),
    ]),
]

private let surgUpperGIBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding character (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Melaena (dark / tarry stool)", dimId: "character", value: "Melaena",    multiSelect: false),
        EFChip(label: "Haematemesis (bright red)",    dimId: "character", value: "Haematemesis", multiSelect: false),
        EFChip(label: "Coffee-ground vomiting",       dimId: "character", value: "Coffee-ground", multiSelect: false),
    ]),
    EFGroup(question: "Prior history (major risk discriminators)", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Known peptic ulcer",     dimId: "pmh",  value: "peptic ulcer"),
        EFChip(label: "NSAID / aspirin use",    dimId: "pmh",  value: "nsaid"),
        EFChip(label: "H. pylori positive",     dimId: "pmh",  value: "h.pylori"),
        EFChip(label: "Liver cirrhosis",        dimId: "pmh",  value: "cirrhosis"),
        EFChip(label: "Alcohol excess",         dimId: "pmh",  value: "alcohol"),
        EFChip(label: "Preceded by retching (Mallory-Weiss)", dimId: "onset", value: "After retching"),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.clipboard.fill", chips: [
        EFChip(label: "Epigastric pain",        dimId: "associations", value: "Epigastric pain"),
        EFChip(label: "Weight loss",            dimId: "associations", value: "Weight loss"),
        EFChip(label: "Dysphagia",              dimId: "associations", value: "Dysphagia"),
        EFChip(label: "Ascites on exam",        dimId: "exam",         value: "ascites"),
    ]),
]

private let surgRenalColicEarlyForm: [EFGroup] = [
    EFGroup(question: "Renal colic pattern (single select)", icon: "bolt.circle.fill", chips: [
        EFChip(label: "Sudden onset",              dimId: "onset",     value: "Sudden",        multiSelect: false),
        EFChip(label: "Colicky character",         dimId: "character", value: "Colicky",       multiSelect: false),
    ]),
    EFGroup(question: "Key features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Loin to groin radiation",   dimId: "radiation",    value: "Loin to groin"),
        EFChip(label: "Haematuria",                dimId: "associations", value: "Haematuria"),
        EFChip(label: "Restlessness (can't settle)", dimId: "associations", value: "Restlessness"),
        EFChip(label: "Previous renal stones",     dimId: "pmh",          value: "renal stone"),
        EFChip(label: "Fever (pyelonephritis?)",   dimId: "associations", value: "Fever"),
        EFChip(label: "Dysuria",                   dimId: "associations", value: "Dysuria"),
    ]),
]

private let surgVascularEarlyForm: [EFGroup] = [
    EFGroup(question: "Vascular red flags (single select)", icon: "heart.circle.fill", chips: [
        EFChip(label: "Pulsatile abdominal mass (AAA)", dimId: "exam",  value: "pulsatile abdominal mass", multiSelect: false),
        EFChip(label: "Intermittent claudication (PAD)", dimId: "associations", value: "Intermittent claudication", multiSelect: false),
        EFChip(label: "Limb rest pain (critical ischaemia)", dimId: "associations", value: "Rest pain", multiSelect: false),
        EFChip(label: "Absent pedal pulses",              dimId: "exam", value: "absent pulses",          multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "staroflife.circle", chips: [
        EFChip(label: "Smoking history",      dimId: "pmh", value: "smoking"),
        EFChip(label: "Diabetes",             dimId: "pmh", value: "diabetes"),
        EFChip(label: "Family AAA history",   dimId: "pmh", value: "family aneurysm"),
        EFChip(label: "Age > 65",             dimId: "age_over", value: "65"),
        EFChip(label: "Male sex",             dimId: "sex_male", value: ""),
        EFChip(label: "Back pain with AAA sx", dimId: "associations", value: "Back pain"),
    ]),
]

private let surgRectalBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding pattern & associated symptoms", icon: "drop.fill", chips: [
        EFChip(label: "Bright red per rectum",        dimId: "associations", value: "Rectal bleeding"),
        EFChip(label: "Blood mixed in stool (IBD/Ca)", dimId: "diarrhoea",   value: "bloody_chronic"),
        EFChip(label: "Severe pain on defaecation (fissure)", dimId: "pain", value: "severe_on_defecation"),
        EFChip(label: "Change in bowel habit",        dimId: "associations", value: "Change in bowel habit"),
        EFChip(label: "Weight loss",                  dimId: "associations", value: "Weight loss"),
        EFChip(label: "Age > 50 (colorectal Ca risk)", dimId: "age_over",   value: "50"),
    ]),
    EFGroup(question: "Risk factors & history", icon: "clock.badge.fill", chips: [
        EFChip(label: "Known diverticular disease",  dimId: "pmh", value: "divert"),
        EFChip(label: "Known Crohn's / colitis",     dimId: "pmh", value: "crohn"),
        EFChip(label: "Iron deficiency anaemia",     dimId: "iron_deficiency_anaemia", value: "present"),
    ]),
]

private let surgGERDEarlyForm: [EFGroup] = [
    EFGroup(question: "Reflux symptoms", icon: "flame.fill", chips: [
        EFChip(label: "Heartburn",                dimId: "associations", value: "Heartburn"),
        EFChip(label: "Regurgitation",            dimId: "associations", value: "Regurgitation"),
        EFChip(label: "Burning epigastric pain",  dimId: "character",    value: "Burning"),
        EFChip(label: "Worse lying flat",         dimId: "exacerbating", value: "Lying flat"),
        EFChip(label: "Relieved by antacids",     dimId: "relieving",    value: "Antacids"),
        EFChip(label: "Epigastric site",          dimId: "site",         value: "Epigastric"),
    ]),
    EFGroup(question: "Duration & alarm features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: ">5 years (Barrett's risk)",   dimId: "timing",       value: "years"),
        EFChip(label: "Dysphagia (alarm)",           dimId: "associations", value: "Dysphagia"),
        EFChip(label: "Melaena / haematemesis (alarm)", dimId: "associations", value: "Melaena"),
        EFChip(label: "Weight loss (alarm)",         dimId: "associations", value: "Weight loss"),
    ]),
]

