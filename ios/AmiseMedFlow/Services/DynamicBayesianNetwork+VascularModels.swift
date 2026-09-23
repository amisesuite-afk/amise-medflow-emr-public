// DynamicBayesianNetwork+VascularModels.swift
// DBN disease models: Mesenteric Ischaemia, Ruptured AAA, Diverticulitis, Cholangitis, NF, PE

import Foundation

// MARK: - Model 7: Mesenteric Ischaemia

let mesentericIschaemiaDBN = DBNModel(
    diseaseName: "Mesenteric Ischaemia",
    states: [
        DiseaseState(id: 0, name: "Early / Reversible Ischaemia", shortLabel: "Early",       urgency: .urgent,    clinicalMarkers: "Pain out of proportion to signs, at-risk AF/atherosclerosis, normal initial CT"),
        DiseaseState(id: 1, name: "Established Ischaemia",        shortLabel: "Established", urgency: .emergency, clinicalMarkers: "CT bowel wall thickening, portal gas, mesenteric stranding, lactate rising"),
        DiseaseState(id: 2, name: "Transmural Infarction",        shortLabel: "Infarction",  urgency: .emergency, clinicalMarkers: "Full-thickness necrosis, pneumatosis, absent enhancement, lactate ≥4"),
        DiseaseState(id: 3, name: "Perforation / Peritonitis",    shortLabel: "Perforation", urgency: .emergency, clinicalMarkers: "Free air, generalised peritonitis, septic shock"),
        DiseaseState(id: 4, name: "Irreversible MOF",             shortLabel: "MOF",         urgency: .emergency, clinicalMarkers: "Non-viable bowel, refractory shock, perioperative death risk high")
    ],
    transitionMatrix: [
        [0.40, 0.40, 0.15, 0.04, 0.01],   // rapid progression if untreated
        [0.00, 0.35, 0.45, 0.15, 0.05],
        [0.00, 0.00, 0.30, 0.45, 0.25],
        [0.00, 0.00, 0.05, 0.35, 0.60],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.25, 0.40, 0.25, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.02, 0.12, 0.86],
        [0.00, 0.01, 0.06, 0.93]
    ],
    severeStateIndices: [1, 2, 3, 4],
    deteriorationThreshold: 0.15
)

// MARK: - Model 8: Ruptured AAA

let rupturedAAADBN = DBNModel(
    diseaseName: "Ruptured Abdominal Aortic Aneurysm",
    states: [
        DiseaseState(id: 0, name: "Symptomatic / Contained Leak",  shortLabel: "Contained",   urgency: .emergency, clinicalMarkers: "Back/flank pain, pulsatile mass, SBP 80–100, HR 90–110, no frank shock"),
        DiseaseState(id: 1, name: "Haemodynamic Instability",      shortLabel: "Unstable",    urgency: .emergency, clinicalMarkers: "SBP <80, HR >120, altered consciousness, intra-peritoneal blood"),
        DiseaseState(id: 2, name: "Frank Rupture / Shock",         shortLabel: "Rupture",     urgency: .emergency, clinicalMarkers: "Profound hypotension, distended abdomen, pulseless, GCS falling"),
        DiseaseState(id: 3, name: "Perioperative Arrest",          shortLabel: "Arrest",      urgency: .emergency, clinicalMarkers: "Cardiac arrest at induction or during repair, massive haemorrhage"),
        DiseaseState(id: 4, name: "Post-repair Multi-Organ Failure",shortLabel: "MOF",         urgency: .emergency, clinicalMarkers: "Ischaemia-reperfusion injury, AKI, ARDS, coagulopathy post-EVAR/open")
    ],
    transitionMatrix: [
        [0.30, 0.45, 0.18, 0.05, 0.02],   // very rapid deterioration
        [0.00, 0.25, 0.50, 0.18, 0.07],
        [0.00, 0.00, 0.20, 0.45, 0.35],
        [0.00, 0.00, 0.00, 0.30, 0.70],
        [0.05, 0.05, 0.05, 0.05, 0.80]
    ],
    emissionMatrix: [
        [0.05, 0.20, 0.45, 0.30],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.02, 0.10, 0.88],
        [0.00, 0.00, 0.05, 0.95],
        [0.00, 0.02, 0.15, 0.83]
    ],
    severeStateIndices: [0, 1, 2, 3, 4],
    deteriorationThreshold: 0.10
)

// MARK: - Model 9: Acute Diverticulitis

let diverticulitisDBN = DBNModel(
    diseaseName: "Acute Diverticulitis",
    states: [
        DiseaseState(id: 0, name: "Hinchey I — Pericolic Abscess",   shortLabel: "Hinchey I",   urgency: .semiUrgent, clinicalMarkers: "LIF pain and tenderness, fever, CRP elevated, CT pericolic fat stranding + small abscess"),
        DiseaseState(id: 1, name: "Hinchey II — Pelvic Abscess",     shortLabel: "Hinchey II",  urgency: .urgent,     clinicalMarkers: "Larger abscess, may be amenable to CT-guided drainage, persistent fever"),
        DiseaseState(id: 2, name: "Hinchey III — Purulent Peritonitis",shortLabel: "Hinchey III",urgency: .emergency,  clinicalMarkers: "Ruptured abscess, free pus, generalised peritonitis without faecal contamination"),
        DiseaseState(id: 3, name: "Hinchey IV — Faecal Peritonitis", shortLabel: "Hinchey IV",  urgency: .emergency,  clinicalMarkers: "Free faecal contamination, septic shock, Hartmann's or primary anastomosis decision"),
        DiseaseState(id: 4, name: "Septic Complication / Fistula",   shortLabel: "Complication",urgency: .urgent,     clinicalMarkers: "Colovesical/colovaginal fistula, recurrent abscess, elective resection planning")
    ],
    transitionMatrix: [
        [0.55, 0.25, 0.10, 0.05, 0.05],
        [0.15, 0.45, 0.25, 0.10, 0.05],
        [0.00, 0.05, 0.45, 0.40, 0.10],
        [0.00, 0.00, 0.05, 0.70, 0.25],
        [0.10, 0.10, 0.05, 0.05, 0.70]
    ],
    emissionMatrix: [
        [0.40, 0.40, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.02, 0.10, 0.45, 0.43],
        [0.00, 0.04, 0.18, 0.78],
        [0.20, 0.40, 0.30, 0.10]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 10: Acute Cholangitis

let cholangitisDBN = DBNModel(
    diseaseName: "Acute Cholangitis",
    states: [
        DiseaseState(id: 0, name: "Grade I (Mild Cholangitis)",   shortLabel: "Grade I",  urgency: .urgent,    clinicalMarkers: "Charcot's triad incomplete, responds to antibiotics, no organ dysfunction"),
        DiseaseState(id: 1, name: "Grade II (Moderate)",          shortLabel: "Grade II", urgency: .urgent,    clinicalMarkers: "WBC >12 or <4, fever >39°C, age >75, hyperbilirubinaemia, hypoalbuminaemia"),
        DiseaseState(id: 2, name: "Grade III (Severe)",           shortLabel: "Grade III",urgency: .emergency, clinicalMarkers: "Reynolds pentad: Charcot's + septic shock + mental obtundation, organ dysfunction"),
        DiseaseState(id: 3, name: "Biliary Septic Shock",         shortLabel: "Shock",    urgency: .emergency, clinicalMarkers: "MAP <65, lactate >4, requires vasopressors — urgent ERCP or PTC decompression"),
        DiseaseState(id: 4, name: "Multi-Organ Failure",          shortLabel: "MOF",      urgency: .emergency, clinicalMarkers: "Hepatic, renal, respiratory failure; DIC; >3 organs; ICU-dependent")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.20, 0.45, 0.25, 0.08, 0.02],
        [0.00, 0.10, 0.40, 0.35, 0.15],
        [0.00, 0.00, 0.10, 0.50, 0.40],
        [0.00, 0.00, 0.03, 0.12, 0.85]
    ],
    emissionMatrix: [
        [0.50, 0.35, 0.12, 0.03],
        [0.15, 0.40, 0.33, 0.12],
        [0.02, 0.10, 0.40, 0.48],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.07, 0.92]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 11: Necrotising Fasciitis

let necfascDBN = DBNModel(
    diseaseName: "Necrotising Fasciitis",
    states: [
        DiseaseState(id: 0, name: "Soft Tissue Infection",        shortLabel: "SSTi",       urgency: .urgent,    clinicalMarkers: "Cellulitis or early NF, erythema, swelling, LRINEC 0–5, no crepitus"),
        DiseaseState(id: 1, name: "Early Necrotising Fasciitis",  shortLabel: "Early NF",   urgency: .emergency, clinicalMarkers: "LRINEC 6–7, wooden-hard induration, bullae beginning, crepitus on palpation"),
        DiseaseState(id: 2, name: "Established NF",               shortLabel: "NF",         urgency: .emergency, clinicalMarkers: "LRINEC ≥8, skin necrosis, gas on CT, haemodynamic instability"),
        DiseaseState(id: 3, name: "NF with Septic Shock",         shortLabel: "NF+Shock",   urgency: .emergency, clinicalMarkers: "Vasopressors, lactate >4, extensive tissue destruction, ICU"),
        DiseaseState(id: 4, name: "Multi-Organ Failure (NF)",     shortLabel: "MOF",        urgency: .emergency, clinicalMarkers: "Renal failure, DIC, ARDS, streptococcal toxic shock — mortality >30%")
    ],
    transitionMatrix: [
        [0.50, 0.35, 0.10, 0.04, 0.01],
        [0.00, 0.30, 0.45, 0.20, 0.05],
        [0.00, 0.00, 0.30, 0.45, 0.25],
        [0.00, 0.00, 0.05, 0.40, 0.55],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.35, 0.40, 0.20, 0.05],
        [0.03, 0.15, 0.45, 0.37],
        [0.00, 0.05, 0.25, 0.70],
        [0.00, 0.01, 0.10, 0.89],
        [0.00, 0.00, 0.05, 0.95]
    ],
    severeStateIndices: [1, 2, 3, 4],
    deteriorationThreshold: 0.15
)

// MARK: - Model 12: Pulmonary Embolism

let peDBN = DBNModel(
    diseaseName: "Pulmonary Embolism",
    states: [
        DiseaseState(id: 0, name: "Low-Risk PE (PESI I–II)",     shortLabel: "Low Risk",    urgency: .semiUrgent, clinicalMarkers: "SpO2 ≥95%, SBP stable, troponin/BNP normal, PESI I or II — outpatient DOAC eligible"),
        DiseaseState(id: 1, name: "Intermediate-Low PE",          shortLabel: "Intermed-Low",urgency: .urgent,     clinicalMarkers: "RV dysfunction on echo or CT, troponin raised, haemodynamically stable — monitoring required"),
        DiseaseState(id: 2, name: "Intermediate-High PE",         shortLabel: "Intermed-High",urgency: .urgent,    clinicalMarkers: "RV strain + troponin + haemodynamic stability borderline — consider thrombolysis threshold"),
        DiseaseState(id: 3, name: "High-Risk / Massive PE",       shortLabel: "Massive",     urgency: .emergency,  clinicalMarkers: "Haemodynamic compromise: SBP <90, syncope, cardiac arrest — systemic thrombolysis or embolectomy"),
        DiseaseState(id: 4, name: "Cardiorespiratory Arrest",     shortLabel: "Arrest",      urgency: .emergency,  clinicalMarkers: "Pulseless electrical activity, massive PE confirmed or suspected — CPR + thrombolysis")
    ],
    transitionMatrix: [
        [0.75, 0.18, 0.05, 0.01, 0.01],
        [0.20, 0.50, 0.22, 0.06, 0.02],
        [0.05, 0.20, 0.45, 0.25, 0.05],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.55, 0.30, 0.12, 0.03],
        [0.20, 0.40, 0.30, 0.10],
        [0.05, 0.20, 0.45, 0.30],
        [0.00, 0.05, 0.20, 0.75],
        [0.00, 0.00, 0.05, 0.95]
    ],
    severeStateIndices: [3, 4],
    deteriorationThreshold: 0.20
)
