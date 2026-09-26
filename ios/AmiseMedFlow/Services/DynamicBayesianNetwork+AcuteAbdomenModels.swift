// DynamicBayesianNetwork+AcuteAbdomenModels.swift
// DBN disease models: Appendicitis, Pancreatitis, Sepsis, Cholecystitis, SBO, Perforated PU

import Foundation

// MARK: - Model 1: Acute Appendicitis

let appendicitisDBN = DBNModel(
    diseaseName: "Acute Appendicitis",
    states: [
        DiseaseState(id: 0, name: "Uncomplicated Appendicitis",   shortLabel: "Uncomplicated", urgency: .urgent,     clinicalMarkers: "RIF pain, low-grade fever, WBC mildly elevated"),
        DiseaseState(id: 1, name: "Gangrenous Appendicitis",      shortLabel: "Gangrenous",    urgency: .urgent,     clinicalMarkers: "Worsening pain, higher fever, CRP >100"),
        DiseaseState(id: 2, name: "Perforated Appendicitis",      shortLabel: "Perforated",    urgency: .emergency,  clinicalMarkers: "Sudden pain relief then generalisation, peritonism"),
        DiseaseState(id: 3, name: "Appendix Abscess",             shortLabel: "Abscess",       urgency: .urgent,     clinicalMarkers: "Palpable mass RIF, persistent fever, CRP plateau"),
        DiseaseState(id: 4, name: "Generalised Peritonitis",      shortLabel: "Peritonitis",   urgency: .emergency,  clinicalMarkers: "Board-like abdomen, systemically unwell, sepsis signs")
    ],
    transitionMatrix: [
        [0.70, 0.20, 0.05, 0.04, 0.01],
        [0.05, 0.55, 0.25, 0.10, 0.05],
        [0.00, 0.00, 0.40, 0.30, 0.30],
        [0.05, 0.05, 0.05, 0.75, 0.10],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.40, 0.40, 0.15, 0.05],
        [0.10, 0.30, 0.40, 0.20],
        [0.05, 0.10, 0.30, 0.55],
        [0.10, 0.30, 0.45, 0.15],
        [0.00, 0.05, 0.20, 0.75]
    ],
    severeStateIndices: [2, 4],
    deteriorationThreshold: 0.25
)

// MARK: - Model 2: Acute Pancreatitis

let pancreatitisDBN = DBNModel(
    diseaseName: "Acute Pancreatitis",
    states: [
        DiseaseState(id: 0, name: "Mild Acute Pancreatitis",       shortLabel: "Mild",        urgency: .urgent,     clinicalMarkers: "Epigastric pain, mildly elevated amylase, no organ failure"),
        DiseaseState(id: 1, name: "Moderately Severe Pancreatitis", shortLabel: "Mod-Severe",  urgency: .urgent,     clinicalMarkers: "Transient organ failure <48h, local complications"),
        DiseaseState(id: 2, name: "Severe Acute Pancreatitis",     shortLabel: "Severe",       urgency: .emergency,  clinicalMarkers: "Persistent organ failure >48h, APACHE ≥8, Glasgow ≥3"),
        DiseaseState(id: 3, name: "Necrotising Pancreatitis",      shortLabel: "Necrotising",  urgency: .emergency,  clinicalMarkers: "CT pancreatic necrosis, infected necrosis, sepsis"),
        DiseaseState(id: 4, name: "Pancreatic Pseudocyst",         shortLabel: "Pseudocyst",   urgency: .semiUrgent, clinicalMarkers: "Fluid collection persisting >4 weeks, palpable mass")
    ],
    transitionMatrix: [
        [0.75, 0.15, 0.05, 0.03, 0.02],
        [0.20, 0.50, 0.20, 0.08, 0.02],
        [0.05, 0.15, 0.45, 0.30, 0.05],
        [0.00, 0.05, 0.20, 0.65, 0.10],
        [0.10, 0.05, 0.05, 0.05, 0.75]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.35, 0.35, 0.15],
        [0.02, 0.10, 0.35, 0.53],
        [0.01, 0.05, 0.25, 0.69],
        [0.30, 0.45, 0.20, 0.05]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 3: Sepsis

let sepsisDBN = DBNModel(
    diseaseName: "Sepsis",
    states: [
        DiseaseState(id: 0, name: "SIRS / Uncomplicated Infection", shortLabel: "SIRS",   urgency: .urgent,    clinicalMarkers: "2+ SIRS criteria, suspected source, haemodynamically stable"),
        DiseaseState(id: 1, name: "Sepsis",                         shortLabel: "Sepsis", urgency: .urgent,    clinicalMarkers: "Organ dysfunction (qSOFA ≥2), lactate <2"),
        DiseaseState(id: 2, name: "Severe Sepsis",                  shortLabel: "Severe", urgency: .emergency, clinicalMarkers: "Lactate 2–4, acute organ dysfunction, hypoperfusion"),
        DiseaseState(id: 3, name: "Septic Shock",                   shortLabel: "Shock",  urgency: .emergency, clinicalMarkers: "Vasopressors required, lactate >2 despite fluids, MAP <65"),
        DiseaseState(id: 4, name: "Multi-Organ Failure",            shortLabel: "MOF",    urgency: .emergency, clinicalMarkers: "≥3 failing organs, refractory shock, ICU dependency")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.30, 0.45, 0.18, 0.06, 0.01],
        [0.08, 0.20, 0.40, 0.25, 0.07],
        [0.03, 0.07, 0.15, 0.55, 0.20],
        [0.01, 0.02, 0.07, 0.20, 0.70]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.40, 0.35, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.05, 0.20, 0.75],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 4: Acute Cholecystitis

let cholecystitisDBN = DBNModel(
    diseaseName: "Acute Cholecystitis",
    states: [
        DiseaseState(id: 0, name: "Tokyo Grade I (Mild)",    shortLabel: "Grade I",    urgency: .urgent,    clinicalMarkers: "RUQ pain, Murphy's sign, WBC mildly elevated, no organ dysfunction"),
        DiseaseState(id: 1, name: "Tokyo Grade II (Moderate)",shortLabel: "Grade II",   urgency: .urgent,    clinicalMarkers: "WBC >18, palpable mass, >72h symptoms, marked local inflammation"),
        DiseaseState(id: 2, name: "Tokyo Grade III (Severe)", shortLabel: "Grade III",  urgency: .emergency, clinicalMarkers: "Cardiovascular, neurological, respiratory, renal, hepatic, or haematological dysfunction"),
        DiseaseState(id: 3, name: "Gangrenous Cholecystitis", shortLabel: "Gangrenous", urgency: .emergency, clinicalMarkers: "Rapid deterioration, absent Murphy's, peritonism, air in GB wall on CT"),
        DiseaseState(id: 4, name: "Perforated Cholecystitis", shortLabel: "Perforated", urgency: .emergency, clinicalMarkers: "Free perforation, pericholecystic abscess, biliary peritonitis")
    ],
    transitionMatrix: [
        [0.70, 0.22, 0.04, 0.03, 0.01],
        [0.10, 0.55, 0.20, 0.12, 0.03],
        [0.00, 0.10, 0.55, 0.25, 0.10],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.10, 0.40, 0.38, 0.12],
        [0.02, 0.10, 0.35, 0.53],
        [0.01, 0.06, 0.28, 0.65],
        [0.00, 0.04, 0.16, 0.80]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 5: Small Bowel Obstruction

let sboDBN = DBNModel(
    diseaseName: "Small Bowel Obstruction",
    states: [
        DiseaseState(id: 0, name: "Partial SBO",         shortLabel: "Partial",      urgency: .semiUrgent, clinicalMarkers: "Some flatus/stool, colicky pain, distension, CT confirms partial"),
        DiseaseState(id: 1, name: "Complete SBO",         shortLabel: "Complete",     urgency: .urgent,     clinicalMarkers: "No flatus/stool, high-pitched bowel sounds, water-soluble contrast trial"),
        DiseaseState(id: 2, name: "Closed-Loop SBO",      shortLabel: "Closed Loop",  urgency: .emergency,  clinicalMarkers: "Rapid distension, C or U loop on CT, early ischaemia risk"),
        DiseaseState(id: 3, name: "Strangulated Bowel",   shortLabel: "Strangulated", urgency: .emergency,  clinicalMarkers: "Constant severe pain, peritonism, fever, lactate rising, CT ischaemia"),
        DiseaseState(id: 4, name: "Ischaemic Perforation",shortLabel: "Perforation",  urgency: .emergency,  clinicalMarkers: "Free perforation, peritonitis, septic shock")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.06, 0.03, 0.01],
        [0.20, 0.55, 0.15, 0.08, 0.02],
        [0.00, 0.10, 0.45, 0.35, 0.10],
        [0.00, 0.00, 0.10, 0.45, 0.45],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.20, 0.45, 0.28, 0.07],
        [0.05, 0.15, 0.45, 0.35],
        [0.01, 0.05, 0.20, 0.74],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.25
)

// MARK: - Model 6: Perforated Peptic Ulcer

let ppuDBN = DBNModel(
    diseaseName: "Perforated Peptic Ulcer",
    states: [
        DiseaseState(id: 0, name: "Contained Perforation",       shortLabel: "Contained",    urgency: .urgent,    clinicalMarkers: "Localised peritonism, small pneumoperitoneum, haemodynamically stable"),
        DiseaseState(id: 1, name: "Localised Peritonitis",        shortLabel: "Localised",    urgency: .urgent,    clinicalMarkers: "Epigastric/generalising tenderness, rigidity, free air, CRP rising"),
        DiseaseState(id: 2, name: "Generalised Peritonitis",      shortLabel: "Generalised",  urgency: .emergency, clinicalMarkers: "Board-like abdomen, generalised tenderness, haemodynamic compromise beginning"),
        DiseaseState(id: 3, name: "Septic Shock (PPU)",           shortLabel: "Shock",        urgency: .emergency, clinicalMarkers: "Vasopressor requirement, lactate >4, multi-organ involvement"),
        DiseaseState(id: 4, name: "Multi-Organ Failure (PPU)",    shortLabel: "MOF",          urgency: .emergency, clinicalMarkers: "Refractory shock, ICU-dependent, ≥3 organ systems failing")
    ],
    transitionMatrix: [
        [0.55, 0.30, 0.10, 0.04, 0.01],
        [0.05, 0.45, 0.35, 0.12, 0.03],
        [0.00, 0.05, 0.40, 0.40, 0.15],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.35, 0.40, 0.20, 0.05],
        [0.08, 0.30, 0.42, 0.20],
        [0.01, 0.08, 0.35, 0.56],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.07, 0.92]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)
