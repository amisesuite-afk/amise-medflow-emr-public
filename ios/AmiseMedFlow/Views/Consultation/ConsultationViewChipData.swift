// ConsultationViewChipData.swift
// CC surgical chip data, PMH/PSHx chip catalogue, and common allergen chips.

import SwiftUI
import SwiftData

// MARK: - CC surgical chip data

struct CCSurgicalChip: Identifiable {
    let id = UUID()
    let label: String
    let icon: String
}

struct CCSpecialtyGroup: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let chips: [CCSurgicalChip]
}

let ccSpecialtyGroups: [CCSpecialtyGroup] = [
    CCSpecialtyGroup(name: "General & GI Surgery", icon: "scissors", chips: [
        CCSurgicalChip(label: "Abdominal pain",           icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Nausea / Vomiting",        icon: "arrow.up.circle"),
        CCSurgicalChip(label: "Hernia",                   icon: "arrow.up.left.and.arrow.down.right"),
        CCSurgicalChip(label: "Reflux / Heartburn",       icon: "flame"),
        CCSurgicalChip(label: "Change in bowel habit",    icon: "arrow.left.arrow.right"),
        CCSurgicalChip(label: "Rectal bleeding",          icon: "drop.fill"),
        CCSurgicalChip(label: "Anal pain",                icon: "figure.walk"),
        CCSurgicalChip(label: "Dysphagia",                icon: "mouth"),
        CCSurgicalChip(label: "Bloating",                 icon: "bubble.left"),
        CCSurgicalChip(label: "Jaundice",                 icon: "sun.max"),
        CCSurgicalChip(label: "Upper GI bleed",           icon: "drop.triangle.fill"),
        CCSurgicalChip(label: "Bowel obstruction",        icon: "stop.circle"),
        CCSurgicalChip(label: "Weight loss",              icon: "arrow.down.circle"),
        CCSurgicalChip(label: "Neck lump",                icon: "person.bust"),
        CCSurgicalChip(label: "Breast lump",              icon: "circle.circle"),
        CCSurgicalChip(label: "Skin lesion",              icon: "oval.lefthalf.filled"),
        CCSurgicalChip(label: "Wound / Post-op",          icon: "bandage"),
        CCSurgicalChip(label: "ERCP / Biliary",           icon: "circle.dotted"),
    ]),
    CCSpecialtyGroup(name: "Cardiovascular", icon: "heart.fill", chips: [
        CCSurgicalChip(label: "Chest pain",               icon: "heart.fill"),
        CCSurgicalChip(label: "Palpitations",             icon: "waveform"),
        CCSurgicalChip(label: "Hypertension review",      icon: "waveform.path.ecg.rectangle"),
        CCSurgicalChip(label: "Shortness of breath",      icon: "lungs.fill"),
        CCSurgicalChip(label: "Leg swelling / Oedema",    icon: "arrow.down.to.line"),
        CCSurgicalChip(label: "Syncope / Presyncope",     icon: "bolt.slash"),
        CCSurgicalChip(label: "Stroke / TIA",             icon: "brain.head.profile"),
        CCSurgicalChip(label: "Peripheral arterial disease", icon: "arrow.left.arrow.right.circle"),
    ]),
    CCSpecialtyGroup(name: "Respiratory", icon: "lungs.fill", chips: [
        CCSurgicalChip(label: "Cough",                    icon: "waveform.path"),
        CCSurgicalChip(label: "Wheeze / Asthma",          icon: "wind"),
        CCSurgicalChip(label: "Haemoptysis",              icon: "drop.fill"),
        CCSurgicalChip(label: "Pleuritic chest pain",     icon: "lungs"),
    ]),
    CCSpecialtyGroup(name: "Endocrine & Metabolic", icon: "staroflife", chips: [
        CCSurgicalChip(label: "Diabetes review",          icon: "cross.case"),
        CCSurgicalChip(label: "Thyroid symptoms",         icon: "staroflife"),
        CCSurgicalChip(label: "Adrenal symptoms",         icon: "bolt.circle"),
        CCSurgicalChip(label: "Obesity / Weight management", icon: "scalemass"),
        CCSurgicalChip(label: "Hyperlipidaemia review",   icon: "chart.line.uptrend.xyaxis"),
    ]),
    CCSpecialtyGroup(name: "Urology & Renal", icon: "drop", chips: [
        CCSurgicalChip(label: "Urinary symptoms",         icon: "drop"),
        CCSurgicalChip(label: "Renal colic",              icon: "bolt.fill"),
        CCSurgicalChip(label: "Haematuria",               icon: "drop.triangle"),
        CCSurgicalChip(label: "Urinary retention",        icon: "nosign"),
        CCSurgicalChip(label: "Scrotal / Testicular",     icon: "circle.grid.2x1"),
    ]),
    CCSpecialtyGroup(name: "Musculoskeletal", icon: "figure.walk.motion", chips: [
        CCSurgicalChip(label: "Joint pain",               icon: "figure.walk.motion"),
        CCSurgicalChip(label: "Back pain / Sciatica",     icon: "figure.stand"),
        CCSurgicalChip(label: "Limb swelling",            icon: "arrow.up.and.line.horizontal.and.arrow.down"),
        CCSurgicalChip(label: "Muscle weakness",          icon: "bolt.horizontal"),
    ]),
    CCSpecialtyGroup(name: "Neurology", icon: "brain.head.profile", chips: [
        CCSurgicalChip(label: "Headache",                 icon: "bolt.fill"),
        CCSurgicalChip(label: "Dizziness / Vertigo",      icon: "rotate.3d"),
        CCSurgicalChip(label: "Seizure",                  icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Memory / Cognitive",       icon: "brain"),
        CCSurgicalChip(label: "Numbness / Tingling",      icon: "hand.point.up"),
    ]),
    CCSpecialtyGroup(name: "Infectious & Tropical", icon: "thermometer.medium", chips: [
        CCSurgicalChip(label: "Fever / Infection",        icon: "thermometer.medium"),
        CCSurgicalChip(label: "Dengue fever",             icon: "thermometer.sun"),
        CCSurgicalChip(label: "Leptospirosis",            icon: "drop.degreesign"),
        CCSurgicalChip(label: "Sepsis",                   icon: "exclamationmark.triangle.fill"),
        CCSurgicalChip(label: "HIV / Immunodeficiency",   icon: "shield.slash"),
        CCSurgicalChip(label: "Skin / Soft tissue infection", icon: "bandage.fill"),
        CCSurgicalChip(label: "STI / Genital symptoms",   icon: "cross.circle"),
    ]),
    CCSpecialtyGroup(name: "Haematology & Oncology", icon: "drop.circle", chips: [
        CCSurgicalChip(label: "Anaemia / Fatigue",        icon: "battery.25"),
        CCSurgicalChip(label: "Lymphadenopathy",          icon: "circle.grid.3x3"),
        CCSurgicalChip(label: "Bruising / Bleeding",      icon: "bandage"),
        CCSurgicalChip(label: "Cancer follow-up",         icon: "arrow.clockwise.circle"),
    ]),
    CCSpecialtyGroup(name: "Gynaecology & Obstetrics", icon: "figure.and.child.holdinghands", chips: [
        CCSurgicalChip(label: "Pelvic pain",              icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Vaginal bleeding",         icon: "drop.fill"),
        CCSurgicalChip(label: "Amenorrhoea / Irregular periods", icon: "calendar.badge.exclamationmark"),
        CCSurgicalChip(label: "Dysmenorrhoea",            icon: "bolt.fill"),
        CCSurgicalChip(label: "Ovarian cyst symptoms",   icon: "circle.dotted"),
        CCSurgicalChip(label: "Fibroid symptoms",         icon: "circle.hexagongrid"),
        CCSurgicalChip(label: "Vaginal discharge",        icon: "drop"),
        CCSurgicalChip(label: "Menopausal symptoms",      icon: "thermometer.sun"),
        CCSurgicalChip(label: "PCOS review",              icon: "chart.bar"),
        CCSurgicalChip(label: "Pregnancy symptoms / Antenatal", icon: "heart.circle"),
        CCSurgicalChip(label: "Postpartum review",        icon: "person.2.circle"),
        CCSurgicalChip(label: "Fertility concerns",       icon: "leaf.circle"),
        CCSurgicalChip(label: "Dyspareunia",              icon: "exclamationmark.bubble"),
        CCSurgicalChip(label: "Vulval symptoms",          icon: "person.fill.questionmark"),
    ]),
    CCSpecialtyGroup(name: "Paediatrics", icon: "figure.child", chips: [
        CCSurgicalChip(label: "Fever in child",           icon: "thermometer.medium"),
        CCSurgicalChip(label: "Child with rash",          icon: "oval.portrait"),
        CCSurgicalChip(label: "Respiratory distress — child", icon: "lungs"),
        CCSurgicalChip(label: "Paediatric abdominal pain", icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Ear / Throat pain — child", icon: "ear"),
        CCSurgicalChip(label: "Failure to thrive",        icon: "arrow.down.forward"),
        CCSurgicalChip(label: "Developmental concern",    icon: "brain"),
        CCSurgicalChip(label: "Recurrent infections — child", icon: "shield.slash"),
        CCSurgicalChip(label: "Growth concern",           icon: "ruler"),
        CCSurgicalChip(label: "Neonatal review",          icon: "figure.child.circle"),
        CCSurgicalChip(label: "Immunisation review",      icon: "syringe"),
    ]),
    CCSpecialtyGroup(name: "Neurosurgery", icon: "brain.head.profile", chips: [
        CCSurgicalChip(label: "Head injury / Trauma",     icon: "bolt.trianglebadge.exclamationmark"),
        CCSurgicalChip(label: "Severe headache",          icon: "bolt.fill"),
        CCSurgicalChip(label: "Weakness / Paralysis",     icon: "figure.stand"),
        CCSurgicalChip(label: "Spinal cord symptoms",     icon: "arrow.up.and.down.and.sparkles"),
        CCSurgicalChip(label: "Brain tumour symptoms",    icon: "circle.dashed"),
        CCSurgicalChip(label: "Hydrocephalus symptoms",   icon: "drop.circle"),
        CCSurgicalChip(label: "Post-neurosurgical review", icon: "arrow.clockwise"),
        CCSurgicalChip(label: "Vision changes / Diplopia", icon: "eye"),
        CCSurgicalChip(label: "Raised intracranial pressure", icon: "exclamationmark.triangle.fill"),
    ]),
    CCSpecialtyGroup(name: "Cardiology", icon: "waveform.path.ecg.rectangle", chips: [
        CCSurgicalChip(label: "Heart failure",            icon: "heart.slash"),
        CCSurgicalChip(label: "Atrial fibrillation",      icon: "waveform"),
        CCSurgicalChip(label: "Arrhythmia / Palpitations", icon: "waveform.path"),
        CCSurgicalChip(label: "Valvular heart disease",   icon: "heart.circle"),
        CCSurgicalChip(label: "Cardiomyopathy",           icon: "heart.fill"),
        CCSurgicalChip(label: "Cardiac risk assessment",  icon: "chart.bar.xaxis"),
        CCSurgicalChip(label: "Pre-operative cardiac",    icon: "checkmark.shield"),
        CCSurgicalChip(label: "Lipid management",         icon: "chart.line.uptrend.xyaxis"),
    ]),
    CCSpecialtyGroup(name: "Dermatology", icon: "hand.raised", chips: [
        CCSurgicalChip(label: "Skin rash / Eczema",       icon: "oval.portrait.fill"),
        CCSurgicalChip(label: "Psoriasis",                icon: "square.grid.3x3.fill"),
        CCSurgicalChip(label: "Urticaria / Hives",        icon: "bubbles.and.sparkles"),
        CCSurgicalChip(label: "Skin infection / Cellulitis", icon: "bandage.fill"),
        CCSurgicalChip(label: "Acne",                     icon: "circle.grid.2x1.fill"),
        CCSurgicalChip(label: "Hair loss / Alopecia",     icon: "person.crop.circle.badge.minus"),
        CCSurgicalChip(label: "Nail disorder",            icon: "rectangle.fill"),
        CCSurgicalChip(label: "Pigmentation change",      icon: "circle.lefthalf.filled"),
        CCSurgicalChip(label: "Pruritus (generalised itch)", icon: "hand.raised.fill"),
        CCSurgicalChip(label: "Blistering skin disease",  icon: "circle.dotted.and.circle"),
    ]),
    CCSpecialtyGroup(name: "Internal Medicine", icon: "stethoscope", chips: [
        CCSurgicalChip(label: "CKD / Renal disease",      icon: "drop.triangle"),
        CCSurgicalChip(label: "Liver disease / Cirrhosis", icon: "leaf.fill"),
        CCSurgicalChip(label: "Autoimmune disease",        icon: "shield.lefthalf.filled"),
        CCSurgicalChip(label: "TB / Chronic infection",   icon: "lungs.fill"),
        CCSurgicalChip(label: "HIV management",           icon: "cross.circle"),
        CCSurgicalChip(label: "Chronic respiratory disease", icon: "wind"),
        CCSurgicalChip(label: "Electrolyte disturbance",  icon: "bolt.circle"),
        CCSurgicalChip(label: "Polymyalgia / Vasculitis", icon: "figure.walk.motion"),
        CCSurgicalChip(label: "Anaemia workup",           icon: "drop.circle.fill"),
    ]),
    CCSpecialtyGroup(name: "Psychiatry / Mental Health", icon: "brain", chips: [
        CCSurgicalChip(label: "Depression",               icon: "cloud.rain"),
        CCSurgicalChip(label: "Anxiety disorder",         icon: "waveform"),
        CCSurgicalChip(label: "Psychosis",                icon: "brain.head.profile"),
        CCSurgicalChip(label: "Substance misuse",         icon: "pills.circle"),
        CCSurgicalChip(label: "Insomnia",                 icon: "moon.zzz"),
        CCSurgicalChip(label: "Eating disorder",          icon: "scalemass"),
        CCSurgicalChip(label: "PTSD / Trauma",            icon: "bolt.shield"),
        CCSurgicalChip(label: "Mental health review",     icon: "arrow.clockwise.circle"),
    ]),
    CCSpecialtyGroup(name: "Administrative", icon: "calendar", chips: [
        CCSurgicalChip(label: "Follow-up",                icon: "arrow.clockwise"),
        CCSurgicalChip(label: "Screening",                icon: "magnifyingglass"),
        CCSurgicalChip(label: "Pre-operative assessment", icon: "checklist"),
        CCSurgicalChip(label: "Other",                    icon: "ellipsis.circle"),
    ]),
]

// Flat list derived from groups — used wherever a single array is needed
let ccSurgicalChips: [CCSurgicalChip] = ccSpecialtyGroups.flatMap(\.chips)


// MARK: - PMH & PSHx chip data

let pmhChips: [String] = [
    "Hypertension", "T2DM", "T1DM", "Ischaemic heart disease", "Atrial fibrillation",
    "Heart failure", "Stroke / TIA", "CKD", "COPD", "Asthma",
    "Liver disease / Cirrhosis", "Peptic ulcer disease", "GORD / Reflux", "IBD (Crohn's / UC)",
    "Malignancy", "Thyroid disease", "OSA", "DVT / PE", "Anaemia", "Epilepsy",
    "Depression / Anxiety", "Dementia", "Osteoporosis", "Rheumatoid arthritis", "Immunocompromised",
]

let pshxChips: [String] = [
    "Cholecystectomy", "Appendicectomy", "Inguinal hernia repair", "Umbilical hernia repair",
    "Bowel resection", "Anterior resection", "APR", "Hartmann's procedure",
    "Gastric bypass / sleeve", "Fundoplication", "Whipple's procedure",
    "Liver resection", "Splenectomy", "Thyroidectomy", "Parathyroidectomy",
    "Mastectomy", "Sentinel node biopsy", "Laparotomy", "Diagnostic laparoscopy",
    "ERCP", "OGD / Gastroscopy", "Colonoscopy", "Haemorrhoidectomy",
    "Fistula / abscess repair", "Caesarean section", "Hysterectomy", "Other abdominal surgery",
]

let familyHistoryChips: [String] = [
    "Colorectal cancer", "Breast cancer", "Ovarian cancer", "Gastric cancer",
    "Pancreatic cancer", "Hepatocellular carcinoma", "Lynch syndrome",
    "Ischaemic heart disease", "Stroke", "Hypertension", "T2DM",
    "Familial hypercholesterolaemia", "AAA", "IBD", "BRCA1/BRCA2 mutation",
]


// MARK: - Common allergen quick-chip data

struct AllergenChip {
    let name: String
    let reaction: String
}

let commonAllergenChips: [AllergenChip] = [
    .init(name: "Penicillin",     reaction: "Rash / urticaria"),
    .init(name: "NSAIDs",         reaction: "GI upset / bronchospasm"),
    .init(name: "Codeine",        reaction: "Nausea / vomiting"),
    .init(name: "Sulfonamides",   reaction: "Rash"),
    .init(name: "Latex",          reaction: "Contact reaction"),
    .init(name: "Contrast dye",   reaction: "Anaphylaxis"),
    .init(name: "Aspirin",        reaction: "Bronchospasm"),
    .init(name: "Metronidazole",  reaction: "Nausea / metallic taste"),
]

