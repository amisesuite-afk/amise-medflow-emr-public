// DynamicBayesianNetwork+OtherModels.swift
// DBN disease models 13-19 (Hernia, LBO, UGI/LGI Bleed, Ischaemic Colitis, Trauma, Limb Ischaemia) + disease registry

import Foundation

// MARK: - Model 13: Incarcerated / Strangulated Hernia

let herniaDBN = DBNModel(
    diseaseName: "Incarcerated / Strangulated Hernia",
    states: [
        DiseaseState(id: 0, name: "Reducible Hernia (Acute)",        shortLabel: "Reducible",    urgency: .semiUrgent, clinicalMarkers: "Hernia tender but reducible with analgesia and Trendelenburg, no systemic upset"),
        DiseaseState(id: 1, name: "Incarcerated Hernia",             shortLabel: "Incarcerated", urgency: .urgent,     clinicalMarkers: "Irreducible, tender, obstructed bowel sounds, no ischaemia yet on CT"),
        DiseaseState(id: 2, name: "Strangulated Hernia",             shortLabel: "Strangulated", urgency: .emergency,  clinicalMarkers: "Non-reducible, WBC >14, CRP rising, CT bowel ischaemia, constant pain"),
        DiseaseState(id: 3, name: "Bowel Necrosis / Perforation",    shortLabel: "Necrosis",     urgency: .emergency,  clinicalMarkers: "Lactate ≥4, peritonism, septic shock — emergency herniorrhaphy + bowel resection"),
        DiseaseState(id: 4, name: "Septic Shock (Hernia)",           shortLabel: "Shock",        urgency: .emergency,  clinicalMarkers: "Vasopressor requirement, multi-organ involvement — high perioperative mortality")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.10, 0.45, 0.30, 0.12, 0.03],
        [0.00, 0.05, 0.35, 0.42, 0.18],
        [0.00, 0.00, 0.05, 0.45, 0.50],
        [0.00, 0.00, 0.00, 0.10, 0.90]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.02, 0.10, 0.40, 0.48],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.01, 0.08, 0.91]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 14: Large Bowel Obstruction / Volvulus

let lboDBN = DBNModel(
    diseaseName: "Large Bowel Obstruction",
    states: [
        DiseaseState(id: 0, name: "Partial / Subacute LBO",      shortLabel: "Partial",    urgency: .urgent,    clinicalMarkers: "Absolute constipation, distension, CT confirmed partial or pseudo-obstruction"),
        DiseaseState(id: 1, name: "Complete LBO",                shortLabel: "Complete",   urgency: .urgent,    clinicalMarkers: "No flatus/stool, massively distended caecum >9cm, closed-loop risk"),
        DiseaseState(id: 2, name: "Caecal / Sigmoid Volvulus",   shortLabel: "Volvulus",   urgency: .emergency, clinicalMarkers: "Whirl sign CT, rapid distension, haemodynamic instability risk"),
        DiseaseState(id: 3, name: "Caecal Necrosis / Perforation",shortLabel: "Necrosis",  urgency: .emergency, clinicalMarkers: "Caecum >12cm, pneumatosis, free air, peritonitis, lactate rising"),
        DiseaseState(id: 4, name: "Faecal Peritonitis",          shortLabel: "Peritonitis",urgency: .emergency, clinicalMarkers: "Free faecal soiling, generalised peritonitis, septic shock")
    ],
    transitionMatrix: [
        [0.60, 0.28, 0.08, 0.03, 0.01],
        [0.10, 0.45, 0.28, 0.12, 0.05],
        [0.00, 0.08, 0.42, 0.35, 0.15],
        [0.00, 0.00, 0.05, 0.45, 0.50],
        [0.00, 0.00, 0.00, 0.05, 0.95]
    ],
    emissionMatrix: [
        [0.40, 0.38, 0.17, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.03, 0.12, 0.45, 0.40],
        [0.00, 0.04, 0.18, 0.78],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 15: Upper GI Haemorrhage

let ugiBleedDBN = DBNModel(
    diseaseName: "Upper GI Haemorrhage",
    states: [
        DiseaseState(id: 0, name: "Low-Risk Bleed (Rockall 0–2)", shortLabel: "Low Risk",  urgency: .urgent,    clinicalMarkers: "HR <100, SBP >100, no major comorbidity, no stigmata of recent haemorrhage at OGD"),
        DiseaseState(id: 1, name: "Moderate Bleed (Rockall 3–4)", shortLabel: "Moderate",  urgency: .urgent,    clinicalMarkers: "Rockall 3–4, active ooze or adherent clot, haemoglobin 70–90, requires transfusion"),
        DiseaseState(id: 2, name: "High-Risk Bleed (Rockall ≥5)", shortLabel: "High Risk", urgency: .emergency, clinicalMarkers: "Active arterial spurting, visible vessel, SBP <90, Hb <70, liver disease or malignancy"),
        DiseaseState(id: 3, name: "Haemorrhagic Shock",           shortLabel: "Shock",     urgency: .emergency, clinicalMarkers: "Transfusion requirement >4 units, SBP <80, HR >120, GCS falling, vasopressors"),
        DiseaseState(id: 4, name: "Rebleeding / Failed Haemostasis",shortLabel: "Rebleed", urgency: .emergency, clinicalMarkers: "Haematemesis after endotherapy, Hb drop >2 g, haemodynamic decompensation — repeat OGD or IR")
    ],
    transitionMatrix: [
        [0.80, 0.15, 0.04, 0.01, 0.00],
        [0.25, 0.45, 0.20, 0.07, 0.03],
        [0.05, 0.15, 0.40, 0.25, 0.15],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.05, 0.10, 0.20, 0.20, 0.45]
    ],
    emissionMatrix: [
        [0.60, 0.28, 0.10, 0.02],
        [0.25, 0.40, 0.27, 0.08],
        [0.05, 0.15, 0.45, 0.35],
        [0.00, 0.05, 0.20, 0.75],
        [0.05, 0.10, 0.35, 0.50]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 16: Lower GI Haemorrhage

let lgiBleedDBN = DBNModel(
    diseaseName: "Lower GI Haemorrhage",
    states: [
        DiseaseState(id: 0, name: "Minor Haemorrhage",              shortLabel: "Minor",      urgency: .semiUrgent, clinicalMarkers: "Haematochezia with haemodynamic stability, Hb >90, cause likely haemorrhoids/fissure"),
        DiseaseState(id: 1, name: "Moderate LGIB",                  shortLabel: "Moderate",   urgency: .urgent,     clinicalMarkers: "Ongoing haematochezia, Hb 70–90, transfusion required, CT angiography positive"),
        DiseaseState(id: 2, name: "Severe LGIB",                    shortLabel: "Severe",     urgency: .emergency,  clinicalMarkers: "Continuous bright red rectal bleeding, Hb <70, haemodynamic instability"),
        DiseaseState(id: 3, name: "Haemorrhagic Shock",             shortLabel: "Shock",      urgency: .emergency,  clinicalMarkers: "SBP <80, transfusion >4 units, colonic angiodysplasia/diverticular — IR embolisation"),
        DiseaseState(id: 4, name: "Operative Haemorrhage (Failed IR)",shortLabel: "Operative", urgency: .emergency,  clinicalMarkers: "Colectomy required, continued haemodynamic instability, mortality 3–5%")
    ],
    transitionMatrix: [
        [0.75, 0.18, 0.05, 0.01, 0.01],
        [0.25, 0.45, 0.22, 0.06, 0.02],
        [0.05, 0.15, 0.45, 0.28, 0.07],
        [0.00, 0.05, 0.10, 0.55, 0.30],
        [0.00, 0.00, 0.05, 0.05, 0.90]
    ],
    emissionMatrix: [
        [0.60, 0.28, 0.10, 0.02],
        [0.20, 0.42, 0.28, 0.10],
        [0.03, 0.12, 0.48, 0.37],
        [0.00, 0.04, 0.18, 0.78],
        [0.00, 0.02, 0.10, 0.88]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 17: Ischaemic Colitis

let ischaemicColitisDBN = DBNModel(
    diseaseName: "Ischaemic Colitis",
    states: [
        DiseaseState(id: 0, name: "Mild Transient Ischaemia",       shortLabel: "Transient",   urgency: .urgent,    clinicalMarkers: "Crampy LIF pain, haematochezia, CT thumbprinting limited to watershed area, haemodynamically stable"),
        DiseaseState(id: 1, name: "Non-Gangrenous Ischaemic Colitis",shortLabel: "Non-Gang.",   urgency: .urgent,    clinicalMarkers: "Persistent symptoms >24h, CT wall thickening and oedema, colonoscopy cyanotic mucosa"),
        DiseaseState(id: 2, name: "Gangrenous Ischaemic Colitis",    shortLabel: "Gangrenous",  urgency: .emergency, clinicalMarkers: "Transmural infarction, peritonism, CT pneumatosis or portal gas, lactate rising"),
        DiseaseState(id: 3, name: "Perforation / Peritonitis",       shortLabel: "Perforation", urgency: .emergency, clinicalMarkers: "Free perforation, generalised peritonitis, septic shock — emergency colectomy"),
        DiseaseState(id: 4, name: "Post-Colectomy Complication",     shortLabel: "Post-op",     urgency: .urgent,    clinicalMarkers: "Anastomotic leak or stoma complications — re-look laparotomy")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.25, 0.45, 0.22, 0.06, 0.02],
        [0.00, 0.05, 0.40, 0.42, 0.13],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.10, 0.10, 0.05, 0.05, 0.70]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.15, 0.40, 0.35, 0.10],
        [0.01, 0.07, 0.40, 0.52],
        [0.00, 0.03, 0.15, 0.82],
        [0.15, 0.35, 0.35, 0.15]
    ],
    severeStateIndices: [2, 3],
    deteriorationThreshold: 0.20
)

// MARK: - Model 18: Abdominal Trauma

let abdominalTraumaDBN = DBNModel(
    diseaseName: "Abdominal Trauma",
    states: [
        DiseaseState(id: 0, name: "AAST Grade I–II (Minor)",        shortLabel: "Minor",       urgency: .urgent,    clinicalMarkers: "Haemodynamically stable, superficial laceration or small subcapsular haematoma, NOM candidate"),
        DiseaseState(id: 1, name: "AAST Grade III (Moderate)",      shortLabel: "Moderate",    urgency: .urgent,    clinicalMarkers: "Solid organ laceration >3cm, active extravasation on CT angiography, IR embolisation considered"),
        DiseaseState(id: 2, name: "AAST Grade IV–V (Severe)",       shortLabel: "Severe",      urgency: .emergency, clinicalMarkers: "Shattered organ, hilar injury, haemodynamic instability — damage control laparotomy"),
        DiseaseState(id: 3, name: "Class III–IV Haemorrhagic Shock",shortLabel: "Shock",       urgency: .emergency, clinicalMarkers: "SBP <70, HR >140, transfusion activation protocol — MTP, TXA, massive haemorrhage"),
        DiseaseState(id: 4, name: "Damage Control / Reoperation",   shortLabel: "Damage Ctrl", urgency: .emergency, clinicalMarkers: "Hypothermia + coagulopathy + acidosis triad — pack, close, ICU, planned re-look 48h")
    ],
    transitionMatrix: [
        [0.65, 0.25, 0.07, 0.02, 0.01],
        [0.20, 0.45, 0.25, 0.07, 0.03],
        [0.00, 0.10, 0.35, 0.40, 0.15],
        [0.00, 0.00, 0.05, 0.50, 0.45],
        [0.05, 0.05, 0.05, 0.10, 0.75]
    ],
    emissionMatrix: [
        [0.45, 0.35, 0.15, 0.05],
        [0.10, 0.30, 0.42, 0.18],
        [0.00, 0.05, 0.28, 0.67],
        [0.00, 0.02, 0.10, 0.88],
        [0.00, 0.03, 0.15, 0.82]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Model 19: Acute Limb Ischaemia

let acuteLimbIschaemiaDBN = DBNModel(
    diseaseName: "Acute Limb Ischaemia",
    states: [
        DiseaseState(id: 0, name: "Rutherford I (Viable)",           shortLabel: "Viable",     urgency: .urgent,    clinicalMarkers: "No sensory or motor deficit, Doppler signals present, urgent vascular review — LMWH and angiography"),
        DiseaseState(id: 1, name: "Rutherford IIa (Marginally Threatened)",shortLabel: "Marginal",urgency: .urgent, clinicalMarkers: "Sensory loss, motor intact, audible Doppler — revascularisation within hours"),
        DiseaseState(id: 2, name: "Rutherford IIb (Immediately Threatened)",shortLabel: "Threatened",urgency: .emergency, clinicalMarkers: "Motor deficit, sensory loss, mottling — emergency embolectomy or bypass within 1–2h"),
        DiseaseState(id: 3, name: "Rutherford III (Irreversible)",   shortLabel: "Irreversible",urgency: .emergency, clinicalMarkers: "Paralysis, anaesthesia, skin mottling fixed — primary amputation vs. reperfusion injury risk"),
        DiseaseState(id: 4, name: "Reperfusion Injury / Compartment",shortLabel: "Reperfusion",urgency: .emergency, clinicalMarkers: "Post-revascularisation myoglobinuria, AKI, compartment syndrome, fasciotomy required")
    ],
    transitionMatrix: [
        [0.50, 0.30, 0.15, 0.04, 0.01],
        [0.05, 0.40, 0.38, 0.14, 0.03],
        [0.00, 0.05, 0.35, 0.45, 0.15],
        [0.00, 0.00, 0.05, 0.55, 0.40],
        [0.05, 0.05, 0.05, 0.05, 0.80]
    ],
    emissionMatrix: [
        [0.40, 0.35, 0.18, 0.07],
        [0.10, 0.30, 0.42, 0.18],
        [0.02, 0.08, 0.38, 0.52],
        [0.00, 0.03, 0.15, 0.82],
        [0.00, 0.03, 0.18, 0.79]
    ],
    severeStateIndices: [2, 3, 4],
    deteriorationThreshold: 0.20
)

// MARK: - Disease registry (19 models, with synonyms)

let dbnRegistry: [String: DBNModel] = [
    // Appendicitis
    "Acute Appendicitis":                   appendicitisDBN,
    "Perforated Appendicitis":              appendicitisDBN,
    "Appendicitis":                         appendicitisDBN,

    // Pancreatitis
    "Acute Pancreatitis":                   pancreatitisDBN,
    "Severe Acute Pancreatitis":            pancreatitisDBN,
    "Necrotising Pancreatitis":             pancreatitisDBN,

    // Sepsis
    "Sepsis":                               sepsisDBN,
    "Septic Shock":                         sepsisDBN,
    "Severe Sepsis":                        sepsisDBN,
    "SIRS":                                 sepsisDBN,

    // Cholecystitis
    "Acute Cholecystitis":                  cholecystitisDBN,
    "Gangrenous Cholecystitis":             cholecystitisDBN,
    "Perforated Cholecystitis":             cholecystitisDBN,

    // SBO
    "Small Bowel Obstruction":              sboDBN,
    "Adhesional Bowel Obstruction":         sboDBN,

    // PPU
    "Perforated Peptic Ulcer":              ppuDBN,
    "Perforated Viscus":                    ppuDBN,
    "Gastric Perforation":                  ppuDBN,
    "Duodenal Perforation":                 ppuDBN,

    // Mesenteric ischaemia
    "Mesenteric Ischaemia":                 mesentericIschaemiaDBN,
    "Acute Mesenteric Ischaemia":           mesentericIschaemiaDBN,
    "Bowel Ischaemia":                      mesentericIschaemiaDBN,

    // AAA
    "Ruptured Abdominal Aortic Aneurysm":   rupturedAAADBN,
    "Aortic Aneurysm (Leaking / Ruptured)": rupturedAAADBN,
    "Ruptured AAA":                         rupturedAAADBN,

    // Diverticulitis
    "Acute Diverticulitis":                 diverticulitisDBN,
    "Diverticulitis":                       diverticulitisDBN,
    "Perforated Diverticulitis":            diverticulitisDBN,

    // Cholangitis
    "Acute Cholangitis":                    cholangitisDBN,
    "Biliary Sepsis":                       cholangitisDBN,
    "Cholangitis":                          cholangitisDBN,

    // NF
    "Necrotising Fasciitis":                necfascDBN,
    "Fournier's Gangrene":                  necfascDBN,
    "Gas Gangrene":                         necfascDBN,

    // PE
    "Pulmonary Embolism":                   peDBN,
    "Massive Pulmonary Embolism":           peDBN,
    "PE":                                   peDBN,

    // Hernia
    "Incarcerated / Strangulated Hernia":   herniaDBN,
    "Strangulated Hernia":                  herniaDBN,
    "Incarcerated Hernia":                  herniaDBN,

    // LBO
    "Large Bowel Obstruction":              lboDBN,
    "Sigmoid Volvulus":                     lboDBN,
    "Caecal Volvulus":                      lboDBN,
    "Colonic Volvulus":                     lboDBN,

    // Upper GI bleed
    "Upper GI Haemorrhage":                 ugiBleedDBN,
    "Upper GI Bleed":                       ugiBleedDBN,
    "Peptic Ulcer Haemorrhage":             ugiBleedDBN,
    "Mallory-Weiss Tear":                   ugiBleedDBN,

    // Lower GI bleed
    "Lower GI Haemorrhage":                 lgiBleedDBN,
    "Lower GI Bleed":                       lgiBleedDBN,
    "Diverticular Haemorrhage":             lgiBleedDBN,

    // Ischaemic colitis
    "Ischaemic Colitis":                    ischaemicColitisDBN,
    "Colonic Ischaemia":                    ischaemicColitisDBN,

    // Trauma
    "Abdominal Trauma":                     abdominalTraumaDBN,
    "Blunt Abdominal Trauma":               abdominalTraumaDBN,
    "Splenic Laceration":                   abdominalTraumaDBN,
    "Hepatic Laceration":                   abdominalTraumaDBN,

    // Limb ischaemia
    "Acute Limb Ischaemia":                 acuteLimbIschaemiaDBN,
    "Peripheral Arterial Occlusion":        acuteLimbIschaemiaDBN,
    "Embolism (Limb)":                      acuteLimbIschaemiaDBN
]
